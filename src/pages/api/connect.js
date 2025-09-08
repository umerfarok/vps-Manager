import { sshManager } from '../../lib/sshManager';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = req.headers['x-user-id'];
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized: User ID is required' });
  }

  try {
    const { host, port, username, authType, password, privateKey, passphrase } = req.body;

    // Input validation
    if (!host || !port || !username || !authType) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: {
          host: !host ? 'Host is required' : null,
          port: !port ? 'Port is required' : null,
          username: !username ? 'Username is required' : null,
          authType: !authType ? 'Authentication type is required' : null,
        }
      });
    }

    // Validate authentication method
    if (authType === 'password' && !password) {
      return res.status(400).json({
        error: 'Password is required for password authentication'
      });
    }

    if (authType === 'privateKey' && !privateKey) {
      return res.status(400).json({
        error: 'Private key is required for key-based authentication'
      });
    }

    // Prepare connection config with Docker networking support
    let connectionHost = host.trim();
    let connectionPort = parseInt(port, 10);

    // Auto-detect Docker environment and adjust networking
    // If user is trying to connect to localhost:2222 (Docker SSH server),
    // translate it to ssh-server:22 for internal Docker networking
    if (connectionHost === 'localhost' && connectionPort === 2222) {
      connectionHost = 'ssh-server';
      connectionPort = 22;
      console.log('Docker environment detected: translating localhost:2222 to ssh-server:22');
    }

    const config = {
      host: connectionHost,
      port: connectionPort,
      username: username.trim(),
      ...(authType === 'password'
        ? { password }
        : {
            privateKey,
            ...(passphrase ? { passphrase } : {})
          }
      )
    };

    // Check if there's an existing connection
    const isConnected = await sshManager.isConnected(userId);
    if (isConnected) {
      await sshManager.disconnect(userId);
    }

    // Attempt connection
    await sshManager.connect(userId, config);

    // Verify connection is successful
    const connectionState = sshManager.getConnectionState(userId);
    if (connectionState !== 'connected') {
      throw new Error('Connection verification failed');
    }

    res.status(200).json({ 
      message: 'Connected successfully',
      state: connectionState
    });

  } catch (error) {
    console.error('Connection error:', error);

    // Map error messages to appropriate HTTP status codes
    let statusCode = 500;
    let errorMessage = error.message;

    if (error.message.includes('Authentication failed')) {
      statusCode = 401;
    } else if (error.message.includes('connect ETIMEDOUT')) {
      statusCode = 504;
    } else if (error.message.includes('connect ECONNREFUSED')) {
      statusCode = 503;
    } else if (error.message.includes('Missing required')) {
      statusCode = 400;
    }

    res.status(statusCode).json({
      error: 'Connection failed',
      message: errorMessage,
      state: sshManager.getConnectionState(userId)
    });
  }
}