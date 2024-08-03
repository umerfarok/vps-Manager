import { sshManager } from '../../lib/sshManager';

export default async function handler(req, res) {
  const userId = req.headers['x-user-id'];
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { method } = req;

  try {
    switch (method) {
      case 'GET':
        if (req.query.info === 'server') {
          return await handleGetServerInfo(userId, res);
        } else {
          return await handleGetSuggestions(res);
        }
      case 'POST':
        return await handleExecuteCommand(userId, req, res);
      default:
        res.setHeader('Allow', ['GET', 'POST']);
        res.status(405).end(`Method ${method} Not Allowed`);
    }
  } catch (error) {
    console.error('Error in VPS Manager API:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleGetServerInfo(userId, res) {
  try {
    const commands = [
      "echo $(hostname -I | cut -d' ' -f1)", // Get IP address
      "uptime | awk '{print $2}'", // Get uptime
      "top -bn1 | grep 'Cpu(s)' | sed 's/.*, *\\([0-9.]*\\)%* id.*/\\1/' | awk '{print 100 - $1}'", // Get CPU usage
      "free | grep Mem | awk '{print $3/$2 * 100.0}'", // Get memory usage
      "df -h / | awk 'NR==2 {print $5}' | sed 's/%//'" // Get disk usage
    ];

    const results = await Promise.all(commands.map(cmd => sshManager.executeCommand(userId, cmd)));

    const [ip, uptime, cpu, memory, disk] = results.map(result => result.stdout.trim());

    const serverInfo = {
      status: 'Running',
      ip,
      uptime,
      cpu: parseFloat(cpu).toFixed(2) + '%',
      memory: parseFloat(memory).toFixed(2) + '%',
      disk: disk + '%'
    };

    res.status(200).json(serverInfo);
  } catch (error) {
    console.error('Failed to fetch server info:', error);
    res.status(500).json({ error: 'Failed to fetch server information' });
  }
}

async function handleGetSuggestions(res) {
  const suggestions = [
    { command: 'ls -la', description: 'List all files and directories with details' },
    { command: 'pwd', description: 'Print working directory' },
    { command: 'mkdir my_website', description: 'Create a new directory for your website' },
    { command: 'cd my_website', description: 'Change to the website directory' },
    { command: 'git clone https://github.com/your-repo.git', description: 'Clone a Git repository' },
    { command: 'npm install', description: 'Install Node.js dependencies' },
    { command: 'npm start', description: 'Start a Node.js application' },
    { command: 'sudo apt-get update', description: 'Update package lists' },
    { command: 'sudo apt-get install nginx', description: 'Install Nginx web server' },
    { command: 'sudo systemctl start nginx', description: 'Start Nginx service' },
    { command: 'df -h', description: 'Show disk space usage' },
    { command: 'top', description: 'Display Linux processes' },
    { command: 'uname -a', description: 'Show system information' },
    { command: 'free -m', description: 'Display amount of free and used memory' },
    { command: 'netstat -tuln', description: 'Show listening ports' },
  ];

  res.status(200).json({ suggestions });
}

async function handleExecuteCommand(userId, req, res) {
  const { command } = req.body;

  if (!command) {
    return res.status(400).json({ error: 'Command is required' });
  }

  try {
    const { code, stdout, stderr } = await sshManager.executeCommand(userId, command);
    const output = stdout || stderr;
    res.status(200).json({ output, exitCode: code });
  } catch (error) {
    console.error('Failed to execute command:', error);
    res.status(500).json({ error: 'Failed to execute command', details: error.message });
  }
}