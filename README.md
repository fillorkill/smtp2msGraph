# SMTP to Microsoft Graph Bridge

Microsoft has announced plans to disable legacy SMTP AUTH authentication for Microsoft 365 services as part of their security improvements. This change affects many organizations that rely on devices and applications that can only use SMTP for sending emails. This bridge provides a solution by:

- Allowing continued use of SMTP-only devices and applications
- Providing a secure transition path to Microsoft Graph API
- Maintaining email functionality without requiring hardware/software upgrades
- Supporting organizations affected by Microsoft's deprecation of basic authentication

This project serves as a secure bridge that allows applications to send emails through Microsoft 365 using a standard SMTP interface. This service accepts emails via SMTP and forwards them to Microsoft 365 using the Microsoft Graph API. 

## Use Cases

This bridge is particularly useful for:

- **Multi-Function Devices (MFDs)**: Enable scanners, printers, and copiers to send scanned documents via email through Microsoft 365
- **Legacy Applications**: Connect older software that only supports SMTP to modern Microsoft 365 environments
- **Local Services**: Allow on-premises applications, monitoring tools, and notification systems to send alerts via Microsoft 365
- **IoT Devices**: Enable smart devices and sensors to send notifications through Microsoft 365
- **Network Equipment**: Allow routers, switches, and other network devices to send logs and alerts
- **Development Environments**: Simplify email testing during development without requiring direct Graph API integration
- **Migration Scenarios**: Facilitate gradual migration from traditional SMTP servers to Microsoft 365

## Features

- **SMTP Server**: Provides a standard SMTP interface for applications
- **Microsoft Graph Integration**: Sends emails through Microsoft 365 using Graph API
- **Security Features**:
  - IP address filtering
  - Authentication required
  - Client secret encryption
  - TLS support
- **Email Features**:
  - Support for HTML and plain text emails
  - Attachments handling
  - CC and BCC recipients
  - Reply-To headers

## Prerequisites

- Node.js (v21.7 or higher)
- Microsoft 365 account with appropriate permissions
- Azure AD application registration with Mail.Send permissions

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/fillorkill/smtp2msGraph.git
   cd smtp2msGraph
   ```

2. Copy `.env.example` and `users.json.example` to `.env` and `users.json` respectively, and configure your `.env` file with your Microsoft Graph API credentials and other settings.

3. Install dependencies:
   ```
   npm install
   ```

4. Run the setup script to encrypt CLIENT_SECRET:
   ```
   node setup.js
   ```

## Configuration

### Environment Variables

Edit the `.env` file with your specific configuration:

```
# Microsoft Graph API credentials
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
ENCRYPTION_KEY=your_encryption_key # This is used to encrypt CLIENT_SECRET
ALLOWED_IPS=172.16.0.0/16,10.0.0.0/8  # Add your allowed IP ranges here
```

### User Configuration

Edit the `users.json` file to configure SMTP authentication users and their corresponding Microsoft 365 accounts:

```json
{
  "smtp_username@example.com": {
    "password": "smtp_password",
    "graphUser": "microsoft365_email@yourdomain.com"
  }
}
```

## Usage

1. Start the SMTP server:
   ```
   node app.js
   ```

2. Configure your application to use the SMTP server:
   - Server: Your server IP or hostname
   - Port: 2525 (or as configured)
   - Authentication: Required
   - Username/Password: As configured in users.json
   - TLS: As configured in .env

## Security Considerations

- Always use TLS in production environments
- Restrict allowed IP addresses to trusted networks
- Store the `.env` and `users.json` files securely
- Use strong passwords for SMTP authentication

## Troubleshooting

- Check the console logs for detailed error messages
- Verify your Microsoft Graph API permissions
- Ensure your IP is in the allowed range
- Confirm that your authentication credentials are correct

## License

[MIT License](LICENSE)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. 