const SMTPServer = require('smtp-server').SMTPServer;
const simpleParser = require('mailparser').simpleParser;
const axios = require('axios');
const { Client } = require('@microsoft/microsoft-graph-client');
const { ClientSecretCredential } = require("@azure/identity");
const { TokenCredentialAuthenticationProvider } = require("@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials");
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const crypto = require('crypto');
const ipaddr = require('ipaddr.js');

// Load environment variables
dotenv.config();

// Encryption configuration
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const ALGORITHM = 'aes-256-cbc';

function decrypt(text) {
  const [ivHex, encryptedHex] = text.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

// IP validation function
function isAllowedIP(ip) {
  const allowedIPs = process.env.ALLOWED_IPS ? process.env.ALLOWED_IPS.split(',') : [];
  const clientIP = ipaddr.parse(ip);
  
  return allowedIPs.some(allowed => {
    try {
      const allowedRange = ipaddr.parseCIDR(allowed.trim());
      return clientIP.match(allowedRange);
    } catch (e) {
      console.error(`Invalid IP range in ALLOWED_IPS: ${allowed}`);
      return false;
    }
  });
}

// Initialize Microsoft Graph client with encrypted credentials
const credential = new ClientSecretCredential(
  process.env.TENANT_ID,
  process.env.CLIENT_ID,
  decrypt(process.env.ENCRYPTED_CLIENT_SECRET)
);

const authProvider = new TokenCredentialAuthenticationProvider(credential, {
  scopes: ['https://graph.microsoft.com/.default']
});

const graphClient = Client.initWithMiddleware({ authProvider });

// Function to send email using Microsoft Graph API
async function sendEmailWithGraph(parsedMail, authenticatedUser) {
  // Extract email details
  const subject = parsedMail.subject || '';
  const from = parsedMail.from.text;
  const to = parsedMail.to.text;
  const text = parsedMail.text || '';
  const html = parsedMail.html || '';
  
  // Get the Microsoft 365 user email to send from based on authenticated SMTP user
  const graphUser = users[authenticatedUser]?.graphUser
  
  // Create message for Graph API
  const message = {
    message: {
      subject: subject,
      body: {
        contentType: html ? 'HTML' : 'Text',
        content: html || text
      },
      toRecipients: parsedMail.to.value.map(recipient => ({
        emailAddress: {
          address: recipient.address
        }
      })),
      from: {
        emailAddress: {
          address: graphUser
        }
      }
    },
    saveToSentItems: 'true'
  };

  // Add CC recipients if present
  if (parsedMail.cc && parsedMail.cc.value.length > 0) {
    message.message.ccRecipients = parsedMail.cc.value.map(recipient => ({
      emailAddress: {
        address: recipient.address
      }
    }));
  }

  // Add BCC recipients if present
  if (parsedMail.bcc && parsedMail.bcc.value.length > 0) {
    message.message.bccRecipients = parsedMail.bcc.value.map(recipient => ({
      emailAddress: {
        address: recipient.address
      }
    }));
  }

  // Add Reply-To if present, otherwise use the authenticated user
  if (parsedMail.replyTo && parsedMail.replyTo.value.length > 0) {
    message.message.replyTo = parsedMail.replyTo.value.map(recipient => ({
      emailAddress: {
        address: recipient.address
      }
    }));
  } else {
    message.message.replyTo = [{
      emailAddress: {
        address: authenticatedUser
      }
    }];
  }
  
  // Handle attachments if present
  if (parsedMail.attachments && parsedMail.attachments.length > 0) {
    message.message.attachments = parsedMail.attachments.map(attachment => ({
      '@odata.type': '#microsoft.graph.fileAttachment',
      name: attachment.filename,
      contentType: attachment.contentType,
      contentBytes: attachment.content.toString('base64')
    }));
  }
  
  try {
    // Send via Microsoft Graph using the mapped user
    await graphClient.api(`/users/${graphUser}/sendMail`).post(message);
    
    console.log(`Email sent successfully: "${subject}" from ${from} to ${to}`);
  } catch (error) {
    console.error('Error sending email via Graph API:', error.response?.data || error.message);
    throw error;
  }
}

// Load users from JSON file
let users = {};
try {
  const usersData = fs.readFileSync(path.join(__dirname, 'users.json'), 'utf8');
  users = JSON.parse(usersData);
  console.log(`Loaded ${Object.keys(users).length} users from ${path.join(__dirname, 'users.json')}`);
} catch (error) {
  console.error('Error loading users:', error.message);
}

// Create SMTP server
const server = new SMTPServer({
  secure: false,
  authOptional: false,
  authMethods: ['PLAIN', 'LOGIN'],
  name: process.env.SMTP_HOST,
  key: fs.readFileSync(process.env.TLS_KEY_PATH),
  cert: fs.readFileSync(process.env.TLS_CERT_PATH),
  starttls: true,
  tls: {
    minVersion: 'TLSv1.2',
    maxVersion: 'TLSv1.3'
  },

  // Connection settings
  socketTimeout: 30000,
  
  // IP validation
  onConnect(session, callback) {
    const clientIP = session.remoteAddress;
    if (!isAllowedIP(clientIP)) {
      console.log(`Connection rejected from unauthorized IP: ${clientIP}`);
      return callback(new Error('Unauthorized IP address'));
    }
    console.log(`Connection accepted from ${clientIP}`);
    callback();
  },

  // Handle authentication
  onAuth(auth, session, callback) {
    const username = auth.username;
    const password = auth.password;

    if (!users[username] || users[username].password !== password) {
      console.log(`Authentication failed for ${username}`);
      return callback(new Error('Invalid username or password'));
    }

    console.log(`User authenticated: ${username}`);
    callback(null, { user: username });
  },

  // Handle incoming mail
  async onData(stream, session, callback) {
    console.log('Receiving message data');
    let mailData = '';
    
    stream.on('data', chunk => {
      mailData += chunk.toString();
    });
    
    stream.on('end', async () => {
      try {
        // Parse incoming email
        const parsedMail = await simpleParser(mailData);
        console.log(`Received mail: "${parsedMail.subject}" from ${parsedMail.from?.text || 'unknown'}`);
        
        // Make sure session has authenticated user
        if (!session.user) {
          return callback(new Error('Authentication required'));
        }
        
        // Send mail using Graph API with authenticated username
        await sendEmailWithGraph(parsedMail, session.user);
        
        callback();
      } catch (error) {
        console.error('Error processing email:', error);
        callback(new Error('Failed to process email'));
      }
    });
  }
});

// Log errors
server.on('error', err => {
  console.error('SMTP server error:', err);
});

// Start server
const PORT = process.env.SMTP_PORT || 2525;
const HOST = process.env.SMTP_HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`SMTP server running on ${HOST}:${PORT}`);
});