import { sshManager } from '../../lib/sshManager';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const userId = req.headers['x-user-id'];

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      await sshManager.disconnect(userId);
      res.status(200).json({ message: 'Disconnected successfully' });
    } catch (error) {
      console.error('Disconnect error:', error);
      res.status(500).json({ error: 'Failed to disconnect: ' + error.message });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}