import { sshManager } from '../../lib/sshManager';

export default async function handler(req, res) {
  const userId = req.headers['x-user-id']; // You should implement proper user authentication

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    try {
      const { code, data } = await sshManager.executeCommand(userId, 'cat /etc/caddy/Caddyfile');
      if (code === 0) {
        res.status(200).json({ config: data });
      } else {
        res.status(500).json({ error: 'Failed to fetch Caddy config' });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  } else if (req.method === 'POST') {
    const { config } = req.body;
    try {
      const { code, data } = await sshManager.executeCommand(userId, `echo '${config}' | sudo tee /etc/caddy/Caddyfile && sudo systemctl reload caddy`);
      if (code === 0) {
        res.status(200).json({ message: 'Caddy configuration updated successfully' });
      } else {
        res.status(500).json({ error: 'Failed to update Caddy configuration', output: data });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}