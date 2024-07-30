import { sshManager } from '../../lib/sshManager';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    try {
      const connection = sshManager.getConnection(userId);
      if (connection) {
        // Test the connection
        await connection.exec('echo "Connection test"');
        res.status(200).json({ connected: true, connection: {
          host: connection.config.host,
          port: connection.config.port,
          username: connection.config.username,
          authType: connection.config.password ? 'password' : 'privateKey'
        }});
      } else {
        res.status(200).json({ connected: false });
      }
    } catch (error) {
      console.error('Error checking connection:', error);
      res.status(200).json({ connected: false });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}