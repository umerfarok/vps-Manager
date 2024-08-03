import { sshManager } from '../../lib/sshManager';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { host, port, username, authType, password, privateKey } = req.body;
    const userId = req.headers['x-user-id']; 

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const config = {
        host,
        port,
        username,
        ...(authType === 'password' ? { password } : { privateKey }),
      };

      await sshManager.connect(userId, config);
      res.status(200).json({ message: 'Connected successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}