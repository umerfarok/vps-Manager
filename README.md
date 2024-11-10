# VPS Manager

A modern web-based VPS (Virtual Private Server) management interface that provides an intuitive way to manage your server through a clean, responsive UI.

![VPS Manager Screenshot](screenshot.png)

## 🌟 Features

### 🔐 Connection Management
- Secure SSH connection support
- Multiple authentication methods:
  - Password authentication
  - Private key authentication
- Persistent connection status
- Real-time connection feedback

### 🚀 Quick Setup Tools
- One-click server setup options:
  - Nginx installation and configuration
  - Nginx + Certbot automatic SSL setup
  - Caddy server installation and configuration

### 🛠️ Management Tools

#### File Manager
- Browse and manage server files
- Upload and download capabilities
- Edit files directly in the browser
- Multi-file operations (copy, move, delete)

#### SSH Terminal
- Browser-based SSH terminal
- Full terminal emulation
- Command history
- Custom keyboard shortcuts

#### Web Server Configuration
- Nginx configuration editor
- Caddy configuration editor
- Syntax highlighting
- Configuration validation

#### Domain Management
- Domain configuration
- DNS management
- Virtual host setup

#### SSL Certificate Management
- SSL certificate installation
- Auto-renewal management
- Certificate status monitoring

## 🔧 Technical Stack

- **Frontend**: Next.js, React, Material-UI
- **State Management**: React Context
- **UI Components**: MUI (Material-UI)
- **Icons**: Lucide React
- **SSH Connection**: Custom SSH implementation
- **Authentication**: Session-based with UUID

## 🚀 Getting Started

### Prerequisites

- Node.js 16.x or higher
- npm or yarn
- A VPS with SSH access

### Installation

1. Clone the repository:
```bash
git clone https://github.com/umerfarok/vps-manager.git


cd vps-manager
npm install
# or
yarn install
 Configuration
Environment Variables

NEXT_PUBLIC_API_URL: Backend API URL
NODE_ENV: Development/Production environment

Security Considerations

All SSH connections are encrypted
Private keys are never stored on the server
Session-based authentication
Rate limiting on API endpoints

🔒 Security
This application implements several security measures:

Encrypted SSH connections
No storage of sensitive credentials
Session-based authentication
Input validation and sanitization
XSS protection
CSRF protection

🤝 Contributing

Fork the repository
Create your feature branch (git checkout -b feature/AmazingFeature)
Commit your changes (git commit -m 'Add some AmazingFeature')
Push to the branch (git push origin feature/AmazingFeature)
Open a Pull Request

📜 License
This project is licensed under the MIT License - see the LICENSE file for details
🙏 Acknowledgments

Material-UI
Lucide Icons
Next.js
Node.js

💡 Support
For support, email support@vpsmanager.com or open an issue in the repository.
🚀 Roadmap

 Docker container management
 Database management interface
 Backup management system
 Multi-server support
 Custom script execution
 Performance monitoring
 Email server configuration
 Firewall management interface

⚠️ Disclaimer
This tool provides powerful server management capabilities. Please ensure you understand the implications of the actions you take using this tool. Always backup your data and use with caution.

## run test ssh continer 
```sh
docker run -d -p 2222:22 --name ssh-server rastasheep/ubuntu-sshd
```