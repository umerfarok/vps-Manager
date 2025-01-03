import { sshManager } from '../../lib/sshManager';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const userId = req.headers['x-user-id'];

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const isConnected = await sshManager.isConnected(userId);
      res.status(200).json({ connected: isConnected });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}