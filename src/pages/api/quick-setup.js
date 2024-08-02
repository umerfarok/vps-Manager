import { sshManager } from '../../lib/sshManager';

const linuxSetupScripts = {
  nginx: `
    set -e
    if command -v apt-get &> /dev/null; then
      sudo apt-get update
      sudo DEBIAN_FRONTEND=noninteractive apt-get install -y nginx
    elif command -v yum &> /dev/null; then
      sudo yum update -y
      sudo yum install -y nginx
    else
      echo "Unsupported package manager" && exit 1
    fi
    sudo systemctl start nginx || sudo service nginx start
    sudo systemctl enable nginx || sudo chkconfig nginx on
    echo "Nginx installation completed"
  `,
  'nginx-certbot': `
    set -e
    if command -v apt-get &> /dev/null; then
      sudo apt-get update
      sudo DEBIAN_FRONTEND=noninteractive apt-get install -y nginx certbot python3-certbot-nginx
    elif command -v yum &> /dev/null; then
      sudo yum update -y
      sudo yum install -y nginx certbot python3-certbot-nginx
    else
      echo "Unsupported package manager" && exit 1
    fi
    sudo systemctl start nginx || sudo service nginx start
    sudo systemctl enable nginx || sudo chkconfig nginx on
    echo "Nginx and Certbot installation completed"
  `,
  caddy: `
    set -e
    if command -v apt-get &> /dev/null; then
      sudo apt-get update
      sudo DEBIAN_FRONTEND=noninteractive apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
      curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
      curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
      sudo apt-get update
      sudo DEBIAN_FRONTEND=noninteractive apt-get install -y caddy
    elif command -v yum &> /dev/null; then
      sudo yum install -y yum-utils
      sudo yum-config-manager --add-repo https://yum.caddy.com/caddy.repo
      sudo yum install -y caddy
    else
      echo "Unsupported package manager" && exit 1
    fi
    sudo systemctl start caddy || sudo service caddy start
    sudo systemctl enable caddy || sudo chkconfig caddy on
    echo "Caddy installation completed"
  `,
};

const windowsSetupScripts = {
  // ... (your existing Windows setup scripts)
};

const getOS = async (userId) => {
  try {
    const { code, data } = await sshManager.executeCommand(userId, 'uname -s');
    if (code === 0) {
      const os = data.trim().toLowerCase();
      if (os === 'linux') return 'linux';
      if (os === 'darwin') return 'macos';
      if (os.includes('win')) return 'windows';
    }
    throw new Error('Unsupported OS');
  } catch (error) {
    throw new Error(`Failed to determine OS: ${error.message}`);
  }
};

const checkSystemResources = async (userId) => {
  try {
    // Check disk space
    const { code: diskCode, data: diskData } = await sshManager.executeCommand(userId, "df -BG / | awk 'NR==2 {print $4}'");
    if (diskCode === 0) {
      const freeSpaceGB = parseInt(diskData.trim().replace('G', ''));
      if (freeSpaceGB < 5) {
        throw new Error('Insufficient disk space. At least 5GB of free space is required.');
      }
    } else {
      throw new Error('Failed to check disk space');
    }

    // Check memory
    const { code: memCode, data: memData } = await sshManager.executeCommand(userId, "free -g | awk '/^Mem:/ {print $7}'");
    if (memCode === 0) {
      const freeMemoryGB = parseInt(memData.trim());
      if (freeMemoryGB < 1) {
        throw new Error('Insufficient memory. At least 1GB of free memory is required.');
      }
    } else {
      throw new Error('Failed to check memory');
    }
  } catch (error) {
    throw new Error(`Failed to check system resources: ${error.message}`);
  }
};

const executeSetupScript = async (userId, setupScript) => {
  const maxRetries = 3;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const { code, data } = await sshManager.executeCommand(userId, setupScript);
      if (code === 0) {
        return { success: true, data };
      } else {
        throw new Error(`Setup failed: ${data}`);
      }
    } catch (error) {
      console.error(`Attempt ${i + 1} failed:`, error.message);
      if (i === maxRetries - 1) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds before retrying
    }
  }
};

const verifyInstallation = async (userId, setupType) => {
  const verificationCommands = {
    nginx: "nginx -v",
    'nginx-certbot': "nginx -v && certbot --version",
    caddy: "caddy version"
  };

  const command = verificationCommands[setupType];
  if (!command) {
    throw new Error(`No verification command for setup type: ${setupType}`);
  }

  const { code, data } = await sshManager.executeCommand(userId, command);
  if (code !== 0) {
    throw new Error(`Verification failed: ${data}`);
  }
  return data;
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

  if (!linuxSetupScripts[setupType] && !windowsSetupScripts[setupType]) {
    return res.status(400).json({ error: 'Invalid setup type' });
  }

  try {
    // Check if there's an active SSH connection
    if (!sshManager.getConnection(userId)) {
      throw new Error('No active SSH connection. Please connect to the server first.');
    }

    const os = await getOS(userId);

    if (os !== 'linux' && os !== 'windows') {
      throw new Error(`Unsupported operating system: ${os}`);
    }

    // Check system resources
    await checkSystemResources(userId);

    // Execute the setup script
    const setupScript = os === 'windows' ? windowsSetupScripts[setupType] : linuxSetupScripts[setupType];
    const { success, data } = await executeSetupScript(userId, setupScript);

    if (success) {
      // Verify the installation
      const verificationOutput = await verifyInstallation(userId, setupType);
      res.status(200).json({
        message: `${setupType} setup completed successfully`,
        output: data,
        verificationOutput
      });
    } else {
      throw new Error(`${setupType} setup failed: ${data}`);
    }
  } catch (error) {
    console.error('Setup error:', error);

    const errorResponse = {
      error: 'An error occurred during setup',
      details: error.message,
    };

    if (error.message.includes('No active SSH connection')) {
      res.status(400).json(errorResponse);
    } else if (error.message.includes('Authentication failed')) {
      errorResponse.error = 'SSH authentication failed. Please check your credentials.';
      res.status(401).json(errorResponse);
    } else if (error.message.includes('Permission denied')) {
      errorResponse.error = 'Permission denied. Please check your user permissions.';
      res.status(403).json(errorResponse);
    } else if (error.message.includes('Unsupported operating system')) {
      errorResponse.error = 'Unsupported operating system';
      res.status(500).json(errorResponse);
    } else if (error.message.includes('Insufficient disk space')) {
      errorResponse.error = 'Insufficient disk space on the server';
      res.status(507).json(errorResponse);
    } else if (error.message.includes('Insufficient memory')) {
      errorResponse.error = 'Insufficient memory on the server';
      res.status(507).json(errorResponse);
    } else if (error.message.includes('Failed to check')) {
      errorResponse.error = 'Failed to check system resources';
      res.status(500).json(errorResponse);
    } else if (error.message.includes('Verification failed')) {
      errorResponse.error = 'Installation verification failed';
      res.status(500).json(errorResponse);
    } else {
      res.status(500).json(errorResponse);
    }
  }
}