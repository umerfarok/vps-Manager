import { sshManager } from '../../lib/sshManager';

export default async function handler(req, res) {
  const userId = req.headers['x-user-id']; // You should implement proper user authentication

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    try {
      const { code, data } = await sshManager.executeCommand(userId, 'cat /etc/nginx/sites-available/*');
      if (code === 0) {
        const domains = data.match(/server_name\s+(.*?);/g)
          ?.map(line => line.replace('server_name', '').trim().replace(';', ''))
          ?.flat()
          ?.filter((domain, index, self) => self.indexOf(domain) === index) || [];
        res.status(200).json({ domains });
      } else {
        res.status(500).json({ error: 'Failed to fetch domains' });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  } else if (req.method === 'POST') {
    const { domain } = req.body;
    const config = `
server {
    listen 80;
    server_name ${domain};
    root /var/www/${domain};
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }
}`;
    
    try {
      const { code, data } = await sshManager.executeCommand(userId, `echo '${config}' | sudo tee /etc/nginx/sites-available/${domain} && sudo ln -s /etc/nginx/sites-available/${domain} /etc/nginx/sites-enabled/ && sudo nginx -t && sudo systemctl reload nginx`);
      if (code === 0) {
        res.status(200).json({ message: 'Domain added successfully' });
      } else {
        res.status(500).json({ error: 'Failed to add domain', output: data });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  } else if (req.method === 'DELETE') {
    const { domain } = req.query;
    try {
      const { code, data } = await sshManager.executeCommand(userId, `sudo rm /etc/nginx/sites-available/${domain} /etc/nginx/sites-enabled/${domain} && sudo nginx -t && sudo systemctl reload nginx`);
      if (code === 0) {
        res.status(200).json({ message: 'Domain deleted successfully' });
      } else {
        res.status(500).json({ error: 'Failed to delete domain', output: data });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}