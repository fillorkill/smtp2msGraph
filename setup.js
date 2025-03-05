const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Encryption configuration
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const IV_LENGTH = 16;
const ALGORITHM = 'aes-256-cbc';

// Encryption function
function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

// Create .env file if it doesn't exist
const envPath = path.join(__dirname, '.env');
const envTemplate = `# Microsoft Graph API credentials
CLIENT_ID=your_client_id
CLIENT_SECRET=your_client_secret
TENANT_ID=your_tenant_id

# SMTP server settings
SMTP_PORT=2525
SMTP_HOST=0.0.0.0

# TLS settings
TLS_ENABLED=true
TLS_CERT_PATH=certs/certificate.crt
TLS_KEY_PATH=certs/private.key

# Security settings
ENCRYPTION_KEY=${ENCRYPTION_KEY}
ALLOWED_IPS=172.16.0.0/16,10.0.0.0/8  # Add your allowed IP ranges here
`;

if (!fs.existsSync(envPath)) {
  fs.writeFileSync(envPath, envTemplate);
  console.log('.env file created with template');
}

// Encrypt client secret if provided
if (process.env.CLIENT_SECRET) {
  const encryptedSecret = encrypt(process.env.CLIENT_SECRET);
  const envContent = fs.readFileSync(envPath, 'utf8');
  const updatedContent = envContent.replace(
    /CLIENT_SECRET=.*/,
    `ENCRYPTED_CLIENT_SECRET=${encryptedSecret}`
  );
  fs.writeFileSync(envPath, updatedContent);
  console.log('Client secret encrypted and stored in .env');
}

// Create and encrypt users file if it doesn't exist
const usersPath = path.join(__dirname, 'users.json');
const usersTemplate = {
  'noreply@outlook.com': {
    password: '123456',
    graphUser: 'noreply@outlook.com'
  }
};

if (!fs.existsSync(usersPath)) {
  fs.writeFileSync(usersPath, JSON.stringify(usersTemplate, null, 2));
  console.log('Users file created');
}

console.log('Setup completed successfully!'); 