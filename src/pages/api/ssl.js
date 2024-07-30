import { sshManager } from '../../lib/sshManager';

export default async function handler(req, res) {
  const userId = req.headers['x-user-id']; // You should implement proper user authentication

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    try {
      const { code, data } = await sshManager.executeCommand(userId, 'sudo certbot certificates');
      if (code === 0) {
        const certificates = data.split('Certificate Name:').slice(1).map(cert => {
          const domain = cert.match(/^\s*(.*?)\n/)?.[1].trim();
          const expiryDate = cert.match(/Expiry Date: (.*?) /)?.[1];
          return { domain, expiryDate };
        });
        res.status(200).json({ certificates });
      } else {
        res.status(500).json({ error: 'Failed to fetch SSL certificates' });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  } else if (req.method === 'POST') {
    const { domain, email } = req.body;
    try {
      const { code, data } = await sshManager.executeCommand(userId, `sudo certbot --nginx -d ${domain} -m ${email} --agree-tos --non-interactive`);
      if (code === 0) {
        res.status(200).json({ message: 'SSL certificate generated successfully', output: data });
      } else {
        res.status(500).json({ error: 'Failed to generate SSL certificate', output: data });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}