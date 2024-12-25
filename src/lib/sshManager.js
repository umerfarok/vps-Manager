import { Client } from 'ssh2';

class SSHManager {
  constructor() {
    this.connections = new Map();
    this.connectionStates = new Map();
  }

  async connect(userId, config) {
    if (!userId || !config) {
      throw new Error('Invalid connection parameters: userId and config are required');
    }

    // Validate required config fields
    const requiredFields = ['host', 'port', 'username'];
    for (const field of requiredFields) {
      if (!config[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Validate authentication method
    if (!config.password && !config.privateKey) {
      throw new Error('Either password or privateKey must be provided');
    }

    // Check if there's an existing connection
    const existingConn = this.connections.get(userId);
    if (existingConn) {
      try {
        // Properly close existing connection
        await this.disconnect(userId);
      } catch (error) {
        console.error('Error closing existing connection:', error);
      }
    }

    return new Promise((resolve, reject) => {
      try {
        const conn = new Client();
        
        // Set connection state
        this.connectionStates.set(userId, 'connecting');

        // Set connection timeout
        const timeout = setTimeout(() => {
          conn.end();
          this.connectionStates.set(userId, 'failed');
          reject(new Error('Connection timeout after 30 seconds'));
        }, 30000);

        conn.on('ready', () => {
          clearTimeout(timeout);
          this.connections.set(userId, conn);
          this.connectionStates.set(userId, 'connected');
          
          // Monitor connection state
          conn.on('error', (err) => {
            console.error('Connection error:', err);
            this.handleConnectionError(userId, err);
          });
          
          conn.on('end', () => {
            this.handleConnectionEnd(userId);
          });
          
          resolve(conn);
        }).on('error', (err) => {
          clearTimeout(timeout);
          this.connectionStates.set(userId, 'failed');
          
          // Map SSH2 errors to more user-friendly messages
          const errorMessage = this.mapSSHError(err);
          reject(new Error(errorMessage));
        });

        // Attempt connection with the provided config
        const sanitizedConfig = this.sanitizeConfig(config);
        conn.connect(sanitizedConfig);

      } catch (error) {
        this.connectionStates.set(userId, 'failed');
        reject(new Error(`Failed to initiate connection: ${error.message}`));
      }
    });
  }

  sanitizeConfig(config) {
    // Create a clean config object with only necessary fields
    const sanitized = {
      host: config.host,
      port: parseInt(config.port, 10),
      username: config.username,
      readyTimeout: 30000,
      keepaliveInterval: 10000,  // Set keep-alive interval in connection config
      keepaliveCountMax: 3,      // Maximum number of keep-alive messages to send
    };

    if (config.password) {
      sanitized.password = config.password;
    }

    if (config.privateKey) {
      sanitized.privateKey = config.privateKey;
      // Add passphrase if provided
      if (config.passphrase) {
        sanitized.passphrase = config.passphrase;
      }
    }

    return sanitized;
  }

  mapSSHError(error) {
    const errorMap = {
      'All configured authentication methods failed': 'Authentication failed. Please check your credentials.',
      'connect ETIMEDOUT': 'Connection timed out. Please check your host and port.',
      'connect ECONNREFUSED': 'Connection refused. Please verify the server is running and accessible.',
      'Invalid private key': 'Invalid SSH private key format.',
      'Encrypted private key detected': 'Encrypted private key detected. Please provide a passphrase.',
    };

    for (const [key, message] of Object.entries(errorMap)) {
      if (error.message.includes(key)) {
        return message;
      }
    }

    return `SSH connection error: ${error.message}`;
  }

  async disconnect(userId) {
    const conn = this.connections.get(userId);
    if (conn) {
      return new Promise((resolve) => {
        try {
          conn.on('end', () => {
            this.connections.delete(userId);
            this.connectionStates.set(userId, 'disconnected');
            resolve();
          });
          
          conn.end();
        } catch (error) {
          console.error('Error during disconnect:', error);
          // Force cleanup even if there's an error
          this.connections.delete(userId);
          this.connectionStates.set(userId, 'disconnected');
          resolve();
        }
      });
    }
  }

  handleConnectionError(userId, error) {
    console.error(`Connection error for user ${userId}:`, error);
    this.connectionStates.set(userId, 'error');
    if (this.connections.has(userId)) {
      this.connections.get(userId).end();
      this.connections.delete(userId);
    }
  }

  handleConnectionEnd(userId) {
    console.log(`Connection ended for user ${userId}`);
    this.connectionStates.set(userId, 'disconnected');
    this.connections.delete(userId);
  }

  getConnection(userId) {
    return this.connections.get(userId);
  }

  getConnectionState(userId) {
    return this.connectionStates.get(userId) || 'disconnected';
  }

  async isConnected(userId) {
    const conn = this.getConnection(userId);
    const state = this.getConnectionState(userId);
    return !!conn && state === 'connected';
  }

  async executeCommand(userId, command) {
    const conn = this.getConnection(userId);
    if (!conn) {
      throw new Error('No active SSH connection');
    }

    if (!command || typeof command !== 'string') {
      throw new Error('Invalid command');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Command execution timeout after 60 seconds'));
      }, 60000);

      conn.exec(command, (err, stream) => {
        if (err) {
          clearTimeout(timeout);
          reject(new Error(`Failed to execute command: ${err.message}`));
          return;
        }

        let stdout = '';
        let stderr = '';

        stream.on('close', (code, signal) => {
          clearTimeout(timeout);
          resolve({
            code,
            signal,
            stdout: stdout.trim(),
            stderr: stderr.trim(),
          });
        }).on('data', (data) => {
          stdout += data.toString();
        }).stderr.on('data', (data) => {
          stderr += data.toString();
        }).on('error', (err) => {
          clearTimeout(timeout);
          reject(new Error(`Stream error: ${err.message}`));
        });
      });
    });
  }
}

export const sshManager = new SSHManager();