import { Client } from 'ssh2';

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { host, port, username, authType, password, privateKey } = req.body;

  const conn = new Client();

  conn.on('ready', () => {
    console.log('SSH connection established');

    // Commands to install and set up Nginx
    const commands = [
      'sudo apt update',
      'sudo apt install -y nginx',
      'sudo systemctl start nginx',
      'sudo systemctl enable nginx',
    ].join(' && ');

    conn.exec(commands, (err, stream) => {
      if (err) throw err;

      let output = '';

      stream.on('close', (code, signal) => {
        conn.end();
        if (code === 0) {
          res.status(200).json({ message: 'Nginx installed and started successfully', output });
        } else {
          res.status(500).json({ error: 'Failed to set up Nginx', output });
        }
      }).on('data', (data) => {
        output += data;
      }).stderr.on('data', (data) => {
        output += data;
      });
    });
  }).on('error', (err) => {
    console.error('SSH connection error:', err);
    res.status(500).json({ error: 'Failed to connect to the server' });
  }).connect({
    host,
    port: parseInt(port, 10),
    username,
    password: authType === 'password' ? password : undefined,
    privateKey: authType === 'privateKey' ? privateKey : undefined,
  });
}