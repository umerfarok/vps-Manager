import { sshManager } from '../../lib/sshManager';

const linuxSetupScripts = {
  nginx: `
    if command -v apt &> /dev/null; then
      sudo DEBIAN_FRONTEND=noninteractive apt-get update && sudo DEBIAN_FRONTEND=noninteractive apt-get install -y nginx && sudo systemctl start nginx && sudo systemctl enable nginx
    elif command -v yum &> /dev/null; then
      sudo yum update -y && sudo yum install -y nginx && sudo systemctl start nginx && sudo systemctl enable nginx
    else
      echo "Unsupported package manager" && exit 1
    fi
  `,
  'nginx-certbot': `
    if command -v apt &> /dev/null; then
      sudo DEBIAN_FRONTEND=noninteractive apt-get update && sudo DEBIAN_FRONTEND=noninteractive apt-get install -y nginx certbot python3-certbot-nginx && sudo systemctl start nginx && sudo systemctl enable nginx
    elif command -v yum &> /dev/null; then
      sudo yum update -y && sudo yum install -y nginx certbot python3-certbot-nginx && sudo systemctl start nginx && sudo systemctl enable nginx
    else
      echo "Unsupported package manager" && exit 1
    fi
  `,
  caddy: `
    if command -v apt &> /dev/null; then
      sudo DEBIAN_FRONTEND=noninteractive apt-get update && sudo DEBIAN_FRONTEND=noninteractive apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
      curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
      curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
      sudo DEBIAN_FRONTEND=noninteractive apt-get update && sudo DEBIAN_FRONTEND=noninteractive apt-get install -y caddy
    elif command -v yum &> /dev/null; then
      sudo yum install -y yum-utils
      sudo yum-config-manager --add-repo https://yum.caddy.com/caddy.repo
      sudo yum install -y caddy
    else
      echo "Unsupported package manager" && exit 1
    fi
  `,
};

const windowsSetupScripts = {
  // ... (your existing Windows setup scripts)
};

const getPackageManagerStatus = async (userId) => {
  try {
    const { code, data } = await sshManager.executeCommand(userId, 'ps aux | grep -E "(apt|dpkg|yum|rpm)"');
    if (code === 0 && data.trim()) {
      return data.trim().split('\n').map(line => line.trim());
    }
    return [];
  } catch (error) {
    console.error('Error getting package manager status:', error);
    return [];
  }
};

const waitForPackageManager = async (userId, retries = 10, interval = 10000) => {
  for (let i = 0; i < retries; i++) {
    try {
      const { code, data } = await sshManager.executeCommand(userId, 'ps aux | grep -E "(apt|dpkg|yum|rpm)"');
      if (code === 0 && data.trim()) {
        console.log(`Package manager is busy. Waiting... (Attempt ${i + 1}/${retries})`);
        await new Promise(resolve => setTimeout(resolve, interval));
      } else {
        console.log('Package manager is available');
        return;
      }
    } catch (error) {
      console.error('Error checking package manager:', error);
      return;
    }
  }
  throw new Error('Timeout waiting for package manager to be available');
};

const checkAndInstallCommand = async (userId, command, installCommand) => {
  try {
    const { code } = await sshManager.executeCommand(userId, `command -v ${command}`);
    if (code !== 0) {
      console.log(`${command} is not available. Installing...`);
      const { code: installCode, data: installData } = await sshManager.executeCommand(userId, installCommand);
      if (installCode !== 0) {
        throw new Error(`Failed to install ${command}: ${installData}`);
      }
      console.log(`${command} installed successfully.`);
    }
  } catch (error) {
    throw new Error(`Failed to check/install ${command}: ${error.message}`);
  }
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
    }

    // Check memory
    const { code: memCode, data: memData } = await sshManager.executeCommand(userId, "free -g | awk '/^Mem:/ {print $7}'");
    if (memCode === 0) {
      const freeMemoryGB = parseInt(memData.trim());
      if (freeMemoryGB < 1) {
        throw new Error('Insufficient memory. At least 1GB of free memory is required.');
      }
    }
  } catch (error) {
    throw new Error(`Failed to check system resources: ${error.message}`);
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

    // Wait for package manager lock to be released
    await waitForPackageManager(userId);

    // Check and install required commands (for Linux only)
    if (os === 'linux') {
      await checkAndInstallCommand(userId, 'sudo', 'apt-get update && apt-get install -y sudo || yum update -y && yum install -y sudo');
      await checkAndInstallCommand(userId, 'curl', 'sudo apt-get update && sudo apt-get install -y curl || sudo yum update -y && sudo yum install -y curl');
    }

    // Execute the setup script
    const setupScript = os === 'windows' ? windowsSetupScripts[setupType] : linuxSetupScripts[setupType];
    const { code, data } = await sshManager.executeCommand(userId, setupScript);

    if (code === 0) {
      res.status(200).json({ message: `${setupType} setup completed successfully`, output: data });
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
    } else if (error.message.includes('Timeout waiting for package manager')) {
      errorResponse.error = 'Server is busy. Please try again later.';
      res.status(503).json(errorResponse);
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
    } else {
      res.status(500).json(errorResponse);
    }
  }
}