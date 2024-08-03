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
        // Here you would typically query your database or a service to get the server info
        // For this example, we'll use mock data
        const serverInfo = {
            status: 'Running',
            ip: '192.168.1.100',
            cpu: '25%',
            memory: '40%',
            disk: '60%'
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
        res.status(200).json({ output: stdout, error: stderr, exitCode: code });
    } catch (error) {
        console.error('Failed to execute command:', error);
        res.status(500).json({ error: 'Failed to execute command', details: error.message });
    }
}