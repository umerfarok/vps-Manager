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
        } else if (req.query.command !== undefined) {
          return await handleTabCompletion(userId, req, res);
        } else {
          return res.status(400).json({ error: 'Invalid GET request' });
        }
      case 'POST':
        return await handleExecuteCommand(userId, req, res);
      default:
        res.setHeader('Allow', ['GET', 'POST']);
        res.status(405).end(`Method ${method} Not Allowed`);
    }
  } catch (error) {
    console.error('Error in VPS Manager API:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

async function handleGetServerInfo(userId, res) {
  try {
    const commands = [
      "hostname -I | cut -d' ' -f1",
      "uptime -p",
      "top -bn1 | grep 'Cpu(s)' | sed 's/.*, *\\([0-9.]*\\)%* id.*/\\1/' | awk '{print 100 - $1}'",
      "free | grep Mem | awk '{print $3/$2 * 100.0}'",
      "df -h / | awk 'NR==2 {print $5}' | sed 's/%//'"
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
    res.status(500).json({ error: 'Failed to fetch server information', details: error.message });
  }
}

async function handleTabCompletion(userId, req, res) {
  const { command, currentDirectory } = req.query;

  if (!command || !currentDirectory) {
    return res.status(400).json({ error: 'Command and currentDirectory are required' });
  }

  try {
    // Change to the current directory
    await sshManager.executeCommand(userId, `cd ${currentDirectory}`);

    // Use the 'compgen' command to get possible completions
    let completionCommand;
    if (command.startsWith('cd ')) {
      // For 'cd' command, complete directories
      completionCommand = `compgen -d ${command.slice(3)}`;
    } else {
      // For other commands, complete both commands and files/directories
      completionCommand = `compgen -c ${command}; compgen -f ${command}`;
    }

    const { stdout } = await sshManager.executeCommand(userId, completionCommand);

    const completions = [...new Set(stdout.trim().split('\n').filter(Boolean))];
    res.status(200).json({ completions });
  } catch (error) {
    console.error('Failed to get completions:', error);
    res.status(500).json({ error: 'Failed to get completions', details: error.message });
  }
}

async function handleExecuteCommand(userId, req, res) {
  const { command, currentDirectory } = req.body;

  if (!command) {
    return res.status(400).json({ error: 'Command is required' });
  }

  try {
    // Change to the current directory before executing the command
    await sshManager.executeCommand(userId, `cd ${currentDirectory}`);

    const { code, stdout, stderr } = await sshManager.executeCommand(userId, command);
    const output = stdout || stderr;

    // Check if the command was a 'cd' command and update the current directory
    let newDirectory = currentDirectory;
    if (command.trim().startsWith('cd ')) {
      const pwdResult = await sshManager.executeCommand(userId, 'pwd');
      newDirectory = pwdResult.stdout.trim();
    }

    res.status(200).json({ output, exitCode: code, newDirectory });
  } catch (error) {
    console.error('Failed to execute command:', error);
    res.status(500).json({ error: 'Failed to execute command', details: error.message });
  }
}