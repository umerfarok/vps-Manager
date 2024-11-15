import { sshManager } from '../../lib/sshManager';

export default async function handler(req, res) {
  const userId = req.headers['x-user-id'];

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    switch (req.method) {
      case 'GET':
        return await getConfigs(req, res, userId);
      case 'POST':
        return await handlePost(req, res, userId);
      default:
        res.setHeader('Allow', ['GET', 'POST']);
        res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }
  } catch (error) {
    console.error('Error in Nginx API handler:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

async function getConfigs(req, res, userId) {
  try {
    const { code, stdout, stderr } = await sshManager.executeCommand(userId, 'ls /etc/nginx/sites-available');
    if (code === 0) {
      const configs = stdout.trim().split('\n').map(name => ({ name }));
      res.status(200).json({ configs });
    } else {
      res.status(500).json({ error: 'Failed to fetch Nginx configs', details: stderr });
    }
  } catch (error) {
    res.status(500).json({ error: 'Error fetching configs', details: error.message });
  }
}

async function handlePost(req, res, userId) {
  const { action } = req.query;

  switch (action) {
    case 'save':
      return await saveConfig(req, res, userId);
    case 'load':
      return await loadConfig(req, res, userId);
    case 'apply':
      return await applyConfig(req, res, userId);
    case 'delete':
      return await deleteConfig(req, res, userId);
    case 'create':
      return await createNewFile(req, res, userId);
    default:
      res.status(400).json({ error: 'Invalid action' });
  }
}

async function saveConfig(req, res, userId) {
  const { name, config } = req.body;
  if (!name || !config) {
    return res.status(400).json({ error: 'Name and config are required' });
  }

  try {
    const escapedConfig = config.replace(/'/g, "'\\''").replace(/\\/g, '\\\\');
    const command = `echo '${escapedConfig}' | sudo tee /etc/nginx/sites-available/${name}`;
    const { code, stdout, stderr } = await sshManager.executeCommand(userId, command);

    if (code === 0) {
      res.status(200).json({ message: 'Configuration saved successfully' });
    } else {
      res.status(500).json({ error: 'Failed to save configuration', details: stderr || stdout });
    }
  } catch (error) {
    res.status(500).json({ error: 'Error saving config', details: error.message });
  }
}

async function loadConfig(req, res, userId) {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Config name is required' });
  }

  try {
    const command = `cat /etc/nginx/sites-available/${name}`;
    const { code, stdout, stderr } = await sshManager.executeCommand(userId, command);
    if (code === 0) {
      res.status(200).json({ config: stdout });
    } else {
      res.status(404).json({ error: 'Config not found', details: stderr });
    }
  } catch (error) {
    res.status(500).json({ error: 'Error loading config', details: error.message });
  }
}
async function applyConfig(req, res, userId) {
  const { config, name } = req.body;
  if (!config || !name) {
    return res.status(400).json({ error: 'Config and name are required' });
  }

  try {
    const escapedConfig = config.replace(/'/g, "'\\''").replace(/\\/g, '\\\\');
    const commands = [
      `echo '${escapedConfig}' | sudo tee /etc/nginx/sites-available/${name}`,
      `sudo ln -sf /etc/nginx/sites-available/${name} /etc/nginx/sites-enabled/${name}`,
      'sudo nginx -t',
      'sudo systemctl reload nginx'
    ];
    const command = commands.join(' && ');
    const { code, stdout, stderr } = await sshManager.executeCommand(userId, command);
    if (code === 0) {
      res.status(200).json({ message: 'Configuration applied successfully', output: stdout });
    } else {
      res.status(500).json({ error: 'Failed to apply configuration', details: stderr });
    }
  } catch (error) {
    res.status(500).json({ error: 'Error applying config', details: error.message });
  }
}

async function deleteConfig(req, res, userId) {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Config name is required' });
  }

  try {
    const commands = [
      `sudo rm -f /etc/nginx/sites-available/${name}`,
      `sudo rm -f /etc/nginx/sites-enabled/${name}`,
      'sudo nginx -t',
      'sudo systemctl reload nginx'
    ];
    const command = commands.join(' && ');
    const { code, stdout, stderr } = await sshManager.executeCommand(userId, command);
    if (code === 0) {
      res.status(200).json({ message: 'Configuration deleted successfully', output: stdout });
    } else {
      res.status(500).json({ error: 'Failed to delete configuration', details: stderr });
    }
  } catch (error) {
    res.status(500).json({ error: 'Error deleting config', details: error.message });
  }
}

async function createNewFile(req, res, userId) {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'File name is required' });
  }

  try {
    const command = `sudo touch /etc/nginx/sites-available/${name} && echo "# New Nginx configuration file" | sudo tee /etc/nginx/sites-available/${name}`;
    const { code, stdout, stderr } = await sshManager.executeCommand(userId, command);
    if (code === 0) {
      res.status(200).json({ message: 'New file created successfully', output: stdout });
    } else {
      res.status(500).json({ error: 'Failed to create new file', details: stderr });
    }
  } catch (error) {
    res.status(500).json({ error: 'Error creating new file', details: error.message });
  }
}