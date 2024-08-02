import { sshManager } from '../../lib/sshManager';

export default async function handler(req, res) {
  const userId = req.headers['x-user-id']; // Implement proper user authentication

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const config = {
    nginxSitesPath: '/etc/nginx/sites-available',
    nginxEnabledPath: '/etc/nginx/sites-enabled',
    wwwPath: '/var/www',
  };

  const reloadNginx = async () => {
    const reloadCommand = 'if command -v systemctl &> /dev/null; then sudo systemctl reload nginx; else sudo nginx -s reload; fi';
    const result = await sshManager.executeCommand(userId, reloadCommand);
    if (result.code !== 0) {
      throw new Error(`Failed to reload Nginx: ${result.data}`);
    }
  };

  if (req.method === 'GET') {
    try {
      console.log('Executing SSH command to list Nginx sites...');
      const result = await sshManager.executeCommand(userId, `ls ${config.nginxSitesPath}`);
      console.log('SSH command result:', result);

      if (!result || typeof result !== 'object') {
        console.error('Unexpected result from sshManager:', result);
        return res.status(500).json({ error: 'Failed to fetch domains: Unexpected SSH result' });
      }

      const { code, data } = result;
      
      if (code !== 0 || !data) {
        console.error('Failed to list Nginx sites:', { code, data });
        return res.status(500).json({ error: 'Failed to fetch domains: No Nginx sites found or permission denied' });
      }

      const siteFiles = data.trim().split('\n');
      const domains = [];

      for (const file of siteFiles) {
        console.log(`Reading file: ${file}`);
        const fileResult = await sshManager.executeCommand(userId, `cat ${config.nginxSitesPath}/${file}`);
        console.log(`File read result for ${file}:`, fileResult);

        if (fileResult && fileResult.code === 0 && fileResult.data) {
          const serverNames = fileResult.data.match(/server_name\s+(.*?);/g);
          if (serverNames) {
            domains.push(...serverNames.map(line => line.replace('server_name', '').trim().replace(';', '')));
          }
        } else {
          console.error(`Failed to read file ${file}:`, fileResult ? fileResult.data : 'No result');
        }
      }

      const uniqueDomains = [...new Set(domains)];
      console.log('Unique domains found:', uniqueDomains);
      res.status(200).json({ domains: uniqueDomains });
    } catch (error) {
      console.error('Failed to fetch domains:', error);
      res.status(500).json({ error: 'Failed to fetch domains: ' + error.message });
    }
  } else if (req.method === 'POST') {
    const { domain } = req.body;
    if (!domain) {
      return res.status(400).json({ error: 'Domain is required' });
    }

    const nginxConfig = `
server {
    listen 80;
    server_name ${domain};
    root ${config.wwwPath}/${domain};
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }
}`;

    try {
      const commands = [
        `echo '${nginxConfig}' | sudo tee ${config.nginxSitesPath}/${domain}`,
        `sudo ln -s ${config.nginxSitesPath}/${domain} ${config.nginxEnabledPath}/`,
        `sudo mkdir -p ${config.wwwPath}/${domain}`,
        `sudo chown -R www-data:www-data ${config.wwwPath}/${domain}`,
        `sudo nginx -t`
      ];

      console.log('Executing commands to add domain:', commands);
      const result = await sshManager.executeCommand(userId, commands.join(' && '));
      console.log('Add domain result:', result);

      if (result && result.code === 0) {
        await reloadNginx();
        res.status(200).json({ message: 'Domain added successfully' });
      } else {
        console.error('Failed to add domain:', result ? result.data : 'No result');
        res.status(500).json({ error: 'Failed to add domain', output: result ? result.data : 'Unknown error' });
      }
    } catch (error) {
      console.error('Failed to add domain:', error);
      res.status(500).json({ error: 'Failed to add domain: ' + error.message });
    }
  } else if (req.method === 'DELETE') {
    const { domain } = req.query;
    if (!domain) {
      return res.status(400).json({ error: 'Domain is required' });
    }

    try {
      const commands = [
        `sudo rm -f ${config.nginxSitesPath}/${domain} ${config.nginxEnabledPath}/${domain}`,
        `sudo nginx -t`
      ];

      console.log('Executing commands to delete domain:', commands);
      const result = await sshManager.executeCommand(userId, commands.join(' && '));
      console.log('Delete domain result:', result);

      if (result && result.code === 0) {
        await reloadNginx();
        res.status(200).json({ message: 'Domain deleted successfully' });
      } else {
        console.error('Failed to delete domain:', result ? result.data : 'No result');
        res.status(500).json({ error: 'Failed to delete domain', output: result ? result.data : 'Unknown error' });
      }
    } catch (error) {
      console.error('Failed to delete domain:', error);
      res.status(500).json({ error: 'Failed to delete domain: ' + error.message });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}