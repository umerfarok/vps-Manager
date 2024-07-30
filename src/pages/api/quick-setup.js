import { sshManager } from '../../lib/sshManager';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const linuxSetupScripts = {
  nginx: `
    if command -v apt &> /dev/null; then
      sudo apt update && sudo apt install -y nginx && sudo systemctl start nginx && sudo systemctl enable nginx
    elif command -v yum &> /dev/null; then
      sudo yum update -y && sudo yum install -y nginx && sudo systemctl start nginx && sudo systemctl enable nginx
    else
      echo "Unsupported package manager" && exit 1
    fi
  `,
  'nginx-certbot': `
    if command -v apt &> /dev/null; then
      sudo apt update && sudo apt install -y nginx certbot python3-certbot-nginx && sudo systemctl start nginx && sudo systemctl enable nginx
    elif command -v yum &> /dev/null; then
      sudo yum update -y && sudo yum install -y nginx certbot python3-certbot-nginx && sudo systemctl start nginx && sudo systemctl enable nginx
    else
      echo "Unsupported package manager" && exit 1
    fi
  `,
  caddy: `
    if command -v apt &> /dev/null; then
      sudo apt update && sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
      curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
      curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
      sudo apt update && sudo apt install -y caddy
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
  nginx: `
    # Note: Nginx installation on Windows is more complex and may require manual steps
    Write-Host "Nginx installation on Windows requires manual steps. Please refer to the official Nginx documentation."
  `,
  'nginx-certbot': `
    # Note: Nginx and Certbot installation on Windows is more complex and may require manual steps
    Write-Host "Nginx and Certbot installation on Windows requires manual steps. Please refer to the official documentation for both Nginx and Certbot."
  `,
  caddy: `
    # Download and install Caddy
    Invoke-WebRequest -Uri "https://github.com/caddyserver/caddy/releases/download/v2.4.6/caddy_2.4.6_windows_amd64.zip" -OutFile "caddy.zip"
    Expand-Archive -Path "caddy.zip" -DestinationPath "C:\\Caddy"
    $env:Path += ";C:\\Caddy"
    [Environment]::SetEnvironmentVariable("Path", $env:Path, [EnvironmentVariableTarget]::Machine)
    Write-Host "Caddy has been installed. You may need to restart your terminal for the PATH changes to take effect."
  `,
};

const waitForPackageManager = async (retries = 5, interval = 5000) => {
  for (let i = 0; i < retries; i++) {
    try {
      const { stdout } = await execAsync('powershell -Command "Get-Process | Where-Object {$_.Name -eq \'msiexec\' -or $_.Name -eq \'dpkg\' -or $_.Name -eq \'rpm\'}"');
      if (stdout.trim()) {
        console.log('Package manager is busy. Waiting...');
        await new Promise(resolve => setTimeout(resolve, interval));
      } else {
        console.log('Package manager is available');
        return;
      }
    } catch (error) {
      console.log('Error checking package manager, assuming it\'s available');
      return;
    }
  }
  throw new Error('Timeout waiting for package manager to be available');
};

const checkAndInstallCommand = async (command, installCommand, os) => {
  try {
    if (os === 'windows') {
      await execAsync(`powershell -Command "if (Get-Command ${command} -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"`);
    } else {
      await execAsync(`command -v ${command}`);
    }
  } catch (error) {
    console.log(`${command} is not available. Installing...`);
    try {
      await execAsync(installCommand);
      console.log(`${command} installed successfully.`);
    } catch (installError) {
      throw new Error(`Failed to install ${command}: ${installError.message}`);
    }
  }
};

const getOS = async () => {
  try {
    const { stdout } = await execAsync('powershell -Command "(Get-CimInstance Win32_OperatingSystem).Caption"');
    if (stdout.toLowerCase().includes('windows')) {
      return 'windows';
    }
    const { stdout: unameOutput } = await execAsync('uname -a');
    if (unameOutput.toLowerCase().includes('linux')) {
      return 'linux';
    }
    throw new Error('Unsupported OS');
  } catch (error) {
    throw new Error(`Failed to determine OS: ${error.message}`);
  }
};

const installCommands = {
  windows: {
    sudo: 'powershell -Command "Start-Process powershell -Verb RunAs -ArgumentList \'-Command Set-ExecutionPolicy RemoteSigned -Force\'"',
    curl: 'powershell -Command "Invoke-WebRequest -Uri https://curl.se/windows/dl-7.78.0/curl-7.78.0-win64-mingw.zip -OutFile curl.zip; Expand-Archive curl.zip -DestinationPath C:\\Windows\\System32; Remove-Item curl.zip"',
  },
  linux: {
    sudo: 'apt update && apt install -y sudo || yum update -y && yum install -y sudo',
    curl: 'sudo apt update && sudo apt install -y curl || sudo yum update -y && sudo yum install -y curl',
  },
};

const checkDiskSpace = async (os) => {
  try {
    if (os === 'windows') {
      const { stdout } = await execAsync('powershell -Command "(Get-PSDrive C | Select-Object -ExpandProperty Free) / 1GB"');
      const freeSpaceGB = parseFloat(stdout.trim());
      if (freeSpaceGB < 5) {
        throw new Error('Insufficient disk space. At least 5GB of free space is required.');
      }
    } else {
      const { stdout } = await execAsync("df -BG / | awk 'NR==2 {print $4}'");
      const freeSpaceGB = parseInt(stdout.trim().replace('G', ''));
      if (freeSpaceGB < 5) {
        throw new Error('Insufficient disk space. At least 5GB of free space is required.');
      }
    }
  } catch (error) {
    throw new Error(`Failed to check disk space: ${error.message}`);
  }
};

const checkMemory = async (os) => {
  try {
    if (os === 'windows') {
      const { stdout } = await execAsync('powershell -Command "(Get-CimInstance Win32_OperatingSystem | Select-Object -ExpandProperty FreePhysicalMemory) / 1MB"');
      const freeMemoryGB = parseFloat(stdout.trim());
      if (freeMemoryGB < 0.5) {
        throw new Error('Insufficient memory. At least 512MB of free memory is required.');
      }
    } else {
      const { stdout } = await execAsync("free -g | awk '/^Mem:/ {print $7}'");
      const freeMemoryGB = parseInt(stdout.trim());
      if (freeMemoryGB < 1) {
        throw new Error('Insufficient memory. At least 1GB of free memory is required.');
      }
    }
  } catch (error) {
    throw new Error(`Failed to check memory: ${error.message}`);
  }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { setupType, userId } = req.body;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized: User ID is required' });
  }

  if (!linuxSetupScripts[setupType] && !windowsSetupScripts[setupType]) {
    return res.status(400).json({ error: 'Invalid setup type' });
  }

  try {
    const os = await getOS();
    const commands = installCommands[os];

    if (!commands) {
      throw new Error(`Unsupported operating system: ${os}`);
    }

    // Check system resources
    await checkDiskSpace(os);
    await checkMemory(os);

    // Wait for package manager lock to be released
    await waitForPackageManager();

    // Check and install required commands
    await checkAndInstallCommand('sudo', commands.sudo, os);
    await checkAndInstallCommand('curl', commands.curl, os);

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

    if (error.message.includes('Timeout waiting for package manager')) {
      errorResponse.error = 'Server is busy. Please try again later.';
      res.status(503).json(errorResponse);
    } else if (error.code === 'ECONNREFUSED') {
      errorResponse.error = 'Unable to connect to the server. Please check server status.';
      res.status(500).json(errorResponse);
    } else if (error.code === 'ENOTFOUND') {
      errorResponse.error = 'Server not found. Please check the server address.';
      res.status(500).json(errorResponse);
    } else if (error.message.includes('Authentication failed')) {
      errorResponse.error = 'SSH authentication failed. Please check your credentials.';
      res.status(401).json(errorResponse);
    } else if (error.message.includes('Permission denied')) {
      errorResponse.error = 'Permission denied. Please check your user permissions.';
      res.status(403).json(errorResponse);
    } else if (error.message.includes('EHOSTUNREACH')) {
      errorResponse.error = 'Host unreachable. Please check the server network connectivity.';
      res.status(500).json(errorResponse);
    } else if (error.message.includes('ETIMEDOUT')) {
      errorResponse.error = 'Connection timed out. Please check the server and network configuration.';
      res.status(500).json(errorResponse);
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