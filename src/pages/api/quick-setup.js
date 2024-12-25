import { sshManager } from '../../lib/sshManager';

// Base installation scripts - removing sudo for root user
const baseScripts = {
  nginx: `
    set -e
    # Update package lists and ensure prerequisites
    if command -v apt-get &> /dev/null; then
      echo "Detected Debian/Ubuntu system"
      apt-get update
      DEBIAN_FRONTEND=noninteractive apt-get install -y curl gnupg2 ca-certificates lsb-release ubuntu-keyring
      DEBIAN_FRONTEND=noninteractive apt-get install -y nginx
    elif command -v dnf &> /dev/null; then
      echo "Detected RHEL/CentOS/Fedora system with DNF"
      dnf update -y
      dnf install -y nginx
    elif command -v yum &> /dev/null; then
      echo "Detected RHEL/CentOS system with YUM"
      yum update -y
      yum install -y epel-release
      yum install -y nginx
    else
      echo "Unsupported package manager"
      exit 1
    fi

    # Ensure nginx is started and enabled
    if command -v systemctl &> /dev/null; then
      systemctl start nginx
      systemctl enable nginx
    else
      service nginx start
      chkconfig nginx on
    fi

    # Verify installation
    nginx -v
    curl -f http://localhost &> /dev/null || exit 1
  `,
  certbot: `
    set -e
    if command -v apt-get &> /dev/null; then
      apt-get update
      DEBIAN_FRONTEND=noninteractive apt-get install -y certbot python3-certbot-nginx
    elif command -v dnf &> /dev/null; then
      dnf install -y certbot python3-certbot-nginx
    elif command -v yum &> /dev/null; then
      yum install -y certbot python3-certbot-nginx
    else
      echo "Unsupported package manager"
      exit 1
    fi
  `,
  caddy: `
    set -e
    if command -v apt-get &> /dev/null; then
      # Debian/Ubuntu installation
      apt-get update
      DEBIAN_FRONTEND=noninteractive apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl gnupg
      curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
      curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
      apt-get update
      DEBIAN_FRONTEND=noninteractive apt-get install -y caddy
    elif command -v dnf &> /dev/null; then
      # RHEL/CentOS/Fedora with DNF
      dnf install -y 'dnf-command(copr)'
      dnf copr enable -y @caddy/caddy
      dnf install -y caddy
    elif command -v yum &> /dev/null; then
      # RHEL/CentOS with YUM
      yum install -y yum-plugin-copr
      yum copr enable -y @caddy/caddy
      yum install -y caddy
    else
      echo "Unsupported package manager"
      exit 1
    fi

    # Ensure caddy is started and enabled
    if command -v systemctl &> /dev/null; then
      systemctl start caddy
      systemctl enable caddy
    else
      service caddy start
      chkconfig caddy on
    fi
  `
};

// Installation configurations
const linuxSetupScripts = {
  nginx: {
    preCheck: `
      # Check if nginx is already installed
      if command -v nginx &> /dev/null; then
        echo "Nginx is already installed"
        nginx -v
        exit 100
      fi
      
      # Check ports 80 and 443
      if netstat -tln | grep -E ':80|:443' &> /dev/null; then
        echo "Ports 80 or 443 are already in use"
        exit 101
      fi
    `,
    install: baseScripts.nginx,
    postCheck: `
      # Verify nginx is running
      if ! pgrep nginx &> /dev/null; then
        echo "Nginx is not running after installation"
        exit 1
      fi
      
      # Check if config is valid
      nginx -t || exit 1
      
      # Check if ports are listening
      if ! netstat -tln | grep -E ':80|:443' &> /dev/null; then
        echo "Nginx is not listening on expected ports"
        exit 1
      fi
    `
  },
  'nginx-certbot': {
    preCheck: `
      # Check existing installations
      if command -v certbot &> /dev/null; then
        echo "Certbot is already installed"
        certbot --version
        exit 100
      fi
    `,
    install: `
      set -e
      # Install Nginx first if not present
      if ! command -v nginx &> /dev/null; then
        ${baseScripts.nginx}
      fi

      # Install certbot and nginx plugin
      ${baseScripts.certbot}

      # Verify installations
      nginx -v
      certbot --version
    `,
    postCheck: `
      # Check certbot and nginx are working
      if ! command -v certbot &> /dev/null; then
        echo "Certbot installation failed"
        exit 1
      fi
      
      # Verify nginx plugin
      if ! certbot plugins --noninteractive | grep -q "nginx"; then
        echo "Nginx plugin for Certbot is not properly installed"
        exit 1
      fi
    `
  },
  caddy: {
    preCheck: `
      # Check if caddy is already installed
      if command -v caddy &> /dev/null; then
        echo "Caddy is already installed"
        caddy version
        exit 100
      fi
      
      # Check ports 80 and 443
      if netstat -tln | grep -E ':80|:443' &> /dev/null; then
        echo "Ports 80 or 443 are already in use"
        exit 101
      fi
    `,
    install: baseScripts.caddy,
    postCheck: `
      # Verify Caddy is running
      if ! pgrep caddy &> /dev/null; then
        echo "Caddy is not running after installation"
        exit 1
      fi
      
      # Check if ports are listening
      if ! netstat -tln | grep -E ':80|:443' &> /dev/null; then
        echo "Caddy is not listening on expected ports"
        exit 1
      fi
    `
  }
};

// System checks
const systemChecks = {
  disk: async (userId) => {
    const { code, stdout } = await sshManager.executeCommand(
      userId,
      "df -BG / | awk 'NR==2 {print $4}'"
    );
    if (code !== 0) throw new Error('Failed to check disk space');
    
    const freeSpaceGB = parseInt(stdout.trim().replace('G', ''));
    if (freeSpaceGB < 5) {
      throw new Error(`Insufficient disk space: ${freeSpaceGB}GB free, minimum 5GB required`);
    }
    return freeSpaceGB;
  },

  memory: async (userId) => {
    const { code, stdout } = await sshManager.executeCommand(
      userId,
      "free -g | awk '/^Mem:/ {print $7}'"
    );
    if (code !== 0) throw new Error('Failed to check memory');
    
    const freeMemoryGB = parseInt(stdout.trim());
    if (freeMemoryGB < 1) {
      throw new Error(`Insufficient memory: ${freeMemoryGB}GB free, minimum 1GB required`);
    }
    return freeMemoryGB;
  },

  ports: async (userId) => {
    const { code, stdout } = await sshManager.executeCommand(
      userId,
      "netstat -tln | grep -E ':80|:443' || true"
    );
    if (code !== 0) throw new Error('Failed to check port availability');
    
    if (stdout.trim()) {
      return stdout.split('\n').map(line => {
        const port = line.match(/:(\d+)/)?.[1];
        return `Port ${port} is already in use`;
      });
    }
    return [];
  },

  permissions: async (userId) => {
    // First check if user is root
    const { code: whoamiCode, stdout: whoamiOutput } = await sshManager.executeCommand(userId, "whoami");
    
    if (whoamiCode === 0 && whoamiOutput.trim() === 'root') {
      return true; // Root user has all permissions
    }

    // If not root, check sudo access
    const { code: sudoCode } = await sshManager.executeCommand(userId, "sudo -n true 2>/dev/null");
    if (sudoCode !== 0) {
      throw new Error('Insufficient permissions: root or sudo access is required');
    }
    return true;
  }
};

// OS detection
const detectOS = async (userId) => {
  try {
    const commands = [
      { cmd: 'cat /etc/os-release', parse: stdout => stdout.toLowerCase() },
      { cmd: 'uname -a', parse: stdout => stdout.toLowerCase() },
      { cmd: 'lsb_release -a', parse: stdout => stdout.toLowerCase() }
    ];

    for (const { cmd, parse } of commands) {
      try {
        const { code, stdout } = await sshManager.executeCommand(userId, cmd);
        if (code === 0 && stdout) {
          const output = parse(stdout);
          
          if (output.includes('ubuntu') || output.includes('debian')) {
            return { type: 'linux', flavor: 'debian' };
          } else if (output.includes('centos') || output.includes('rhel') || output.includes('fedora')) {
            return { type: 'linux', flavor: 'rhel' };
          } else if (output.includes('linux')) {
            return { type: 'linux', flavor: 'unknown' };
          }
        }
      } catch (error) {
        console.warn(`Failed to execute ${cmd}:`, error);
        continue;
      }
    }
    throw new Error('Unable to determine OS type');
  } catch (error) {
    throw new Error(`OS detection failed: ${error.message}`);
  }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = req.headers['x-user-id'];
  const { setupType } = req.body;
  console.log('Quick setup:', setupType);
  console.log('User ID:', userId);

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized: User ID is required' });
  }

  if (!linuxSetupScripts[setupType]) {
    return res.status(400).json({ error: 'Invalid setup type' });
  }

  const setupLog = [];

  try {
    // Check SSH connection
    if (!await sshManager.isConnected(userId)) {
      throw new Error('No active SSH connection');
    }
    setupLog.push('SSH connection verified');

    // Detect OS
    const os = await detectOS(userId);
    if (os.type !== 'linux') {
      throw new Error(`Unsupported operating system: ${os.type}`);
    }
    setupLog.push(`Detected OS: ${os.type} (${os.flavor})`);

    // Check permissions first
    await systemChecks.permissions(userId);
    setupLog.push('Permission check passed');

    // Check system resources
    const diskSpace = await systemChecks.disk(userId);
    setupLog.push(`Disk space check passed: ${diskSpace}GB available`);

    const memory = await systemChecks.memory(userId);
    setupLog.push(`Memory check passed: ${memory}GB available`);

    const portIssues = await systemChecks.ports(userId);
    if (portIssues.length > 0) {
      setupLog.push('Port availability issues:', ...portIssues);
      throw new Error(`Port conflict detected: ${portIssues.join(', ')}`);
    }
    setupLog.push('Port availability check passed');

    // Run pre-installation checks
    const { code: preCheckCode, stdout: preCheckOutput } = await sshManager.executeCommand(
      userId,
      linuxSetupScripts[setupType].preCheck
    );
    
    if (preCheckCode === 100) {
      setupLog.push(preCheckOutput);
      return res.status(200).json({
        message: 'Software is already installed',
        details: preCheckOutput,
        log: setupLog
      });
    }

    setupLog.push('Pre-installation checks passed');

    // Run installation
    const { code: installCode, stdout: installOutput } = await sshManager.executeCommand(
      userId,
      linuxSetupScripts[setupType].install
    );
    
    if (installCode !== 0) {
      throw new Error(`Installation failed: ${installOutput}`);
    }
    setupLog.push('Installation completed successfully');

    // Run post-installation checks
    const { code: postCheckCode, stdout: postCheckOutput } = await sshManager.executeCommand(
      userId,
      linuxSetupScripts[setupType].postCheck
    );
    
    if (postCheckCode !== 0) {
      throw new Error(`Post-installation verification failed: ${postCheckOutput}`);
    }
    setupLog.push('Post-installation verification passed');

    res.status(200).json({
      message: `${setupType} setup completed successfully`,
      details: {
        os: os,
        installOutput: installOutput,
        verificationOutput: postCheckOutput
      },
      log: setupLog
    });

  } catch (error) {
    console.error('Setup error:', error);

    const errorResponse = {
      error: 'Setup failed',
      step: 'setup',
      details: error.message,
      log: setupLog
    };

        // Map errors to appropriate status codes
    const errorMapping = {
      'No active SSH connection': 400,
      'Unauthorized': 401,
      'Permission denied': 403,
      'Insufficient permissions': 403,
      'Unsupported operating system': 400,
      'Insufficient disk space': 507,
      'Insufficient memory': 507,
      'Port': 409 // Conflict
    };
    
    const statusCode = Object.keys(errorMapping).find(key => error.message.includes(key)) ? errorMapping[Object.keys(errorMapping).find(key => error.message.includes(key))] : 500;
    
    res.status(statusCode).json(errorResponse);
  }
}