// Client-side safe SSH manager
// Only import Node.js modules when running on server
let Client, Readable;
if (typeof window === 'undefined') {
  // Server-side only imports
  Client = require('ssh2').Client;
  Readable = require('stream').Readable;
}

class SSHManager {
  constructor() {
    this.connections = new Map();
    this.connectionStates = new Map();
    this.activeOperations = new Map(); // Track active operations per user
    this.rateLimiters = new Map(); // Rate limiting per user
    this.cleanupTimers = new Map(); // Auto cleanup timers
    this.reconnectTimers = new Map(); // Auto-reconnection timers
    this.connectionConfigs = new Map(); // Store connection configs for reconnection
    this.healthCheckIntervals = new Map(); // Health check intervals
    this.connectionAttempts = new Map(); // Track reconnection attempts
  }

  async connect(userId, config, enableAutoReconnect = true) {
    // Client-side safety check
    if (typeof window !== 'undefined') {
      throw new Error('SSH connections can only be established on the server side');
    }

    if (!Client) {
      throw new Error('SSH2 library not available');
    }

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

    // Store config for potential reconnection
    this.connectionConfigs.set(userId, { ...config, enableAutoReconnect });

    // Reset reconnection attempts
    this.connectionAttempts.set(userId, 0);

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

          // Reset reconnection attempts on successful connection
          this.connectionAttempts.set(userId, 0);

          // Start health monitoring if auto-reconnect is enabled
          if (enableAutoReconnect) {
            this.startHealthMonitoring(userId);
          }

          // Monitor connection state
          conn.on('error', (err) => {
            console.error('Connection error:', err);
            this.handleConnectionError(userId, err);
          });

          conn.on('end', () => {
            this.handleConnectionEnd(userId);
          });

          conn.on('close', (hadError) => {
            console.log(`Connection closed for user ${userId}, hadError: ${hadError}`);
            this.handleConnectionClose(userId, hadError);
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
    // Input validation and sanitization
    if (!config.host || typeof config.host !== 'string') {
      throw new Error('Invalid host: must be a non-empty string');
    }

    // Validate host format (basic check)
    const hostRegex = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$|^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
    if (!hostRegex.test(config.host) && config.host !== 'localhost') {
      throw new Error('Invalid host format');
    }

    const port = parseInt(config.port, 10);
    if (isNaN(port) || port < 1 || port > 65535) {
      throw new Error('Invalid port: must be between 1 and 65535');
    }

    if (!config.username || typeof config.username !== 'string' || config.username.length === 0) {
      throw new Error('Invalid username: must be a non-empty string');
    }

    // Sanitize username (prevent command injection)
    const sanitizedUsername = config.username.replace(/[^a-zA-Z0-9._-]/g, '');

    // Create a clean config object with only necessary fields
    const sanitized = {
      host: config.host,
      port: port,
      username: sanitizedUsername,
      readyTimeout: 30000,
      keepaliveInterval: 10000,
      keepaliveCountMax: 3,
      // Security hardening
      algorithms: {
        kex: ['ecdh-sha2-nistp256', 'ecdh-sha2-nistp384', 'ecdh-sha2-nistp521', 'diffie-hellman-group14-sha256'],
        cipher: ['aes128-ctr', 'aes192-ctr', 'aes256-ctr', 'aes128-gcm', 'aes256-gcm'],
        hmac: ['hmac-sha2-256', 'hmac-sha2-512'],
        compress: ['none']
      }
    };

    if (config.password && typeof config.password === 'string') {
      // Basic password validation
      if (config.password.length < 8) {
        console.warn('Password is shorter than recommended minimum of 8 characters');
      }
      sanitized.password = config.password;
    }

    if (config.privateKey && typeof config.privateKey === 'string') {
      // Validate private key format (basic check)
      if (!config.privateKey.includes('-----BEGIN') || !config.privateKey.includes('-----END')) {
        throw new Error('Invalid private key format');
      }

      // Check for encrypted private key
      if (config.privateKey.includes('ENCRYPTED')) {
        if (!config.passphrase) {
          throw new Error('Private key is encrypted but no passphrase provided');
        }
      }

      sanitized.privateKey = config.privateKey;

      // Add passphrase if provided
      if (config.passphrase && typeof config.passphrase === 'string') {
        sanitized.passphrase = config.passphrase;
      }
    }

    // Ensure either password or private key is provided
    if (!sanitized.password && !sanitized.privateKey) {
      throw new Error('Either password or privateKey must be provided for authentication');
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
    this.stopHealthMonitoring(userId);
  }

  handleConnectionClose(userId, hadError) {
    console.log(`Connection closed for user ${userId}, hadError: ${hadError}`);
    this.connectionStates.set(userId, 'disconnected');
    this.connections.delete(userId);
    this.stopHealthMonitoring(userId);

    // Attempt reconnection if enabled and not manually disconnected
    const config = this.connectionConfigs.get(userId);
    if (config && config.enableAutoReconnect && !this.getManualDisconnect(userId)) {
      this.scheduleReconnection(userId);
    }
  }

  getManualDisconnect(userId) {
    // Check if this was a manual disconnect
    const state = this.connectionStates.get(userId);
    return state === 'manually_disconnected';
  }

  setManualDisconnect(userId, value = true) {
    if (value) {
      this.connectionStates.set(userId, 'manually_disconnected');
    }
  }

  startHealthMonitoring(userId) {
    this.stopHealthMonitoring(userId); // Clear any existing interval

    const interval = setInterval(async () => {
      try {
        const conn = this.connections.get(userId);
        if (!conn) {
          this.stopHealthMonitoring(userId);
          return;
        }

        // Simple health check - try to execute a lightweight command
        await this.executeCommand(userId, 'echo "health_check"', 5000);
        this.connectionStates.set(userId, 'connected');
      } catch (error) {
        console.warn(`Health check failed for user ${userId}:`, error.message);
        this.connectionStates.set(userId, 'error');

        // If health check fails, attempt immediate reconnection
        const config = this.connectionConfigs.get(userId);
        if (config && config.enableAutoReconnect) {
          this.attemptReconnection(userId);
        }
      }
    }, 30000); // Health check every 30 seconds

    this.healthCheckIntervals.set(userId, interval);
  }

  stopHealthMonitoring(userId) {
    const interval = this.healthCheckIntervals.get(userId);
    if (interval) {
      clearInterval(interval);
      this.healthCheckIntervals.delete(userId);
    }
  }

  scheduleReconnection(userId) {
    this.stopReconnectionTimer(userId);

    const attempts = this.connectionAttempts.get(userId) || 0;
    const delay = Math.min(1000 * Math.pow(2, attempts), 30000); // Exponential backoff, max 30s

    console.log(`Scheduling reconnection for user ${userId} in ${delay}ms (attempt ${attempts + 1})`);

    const timer = setTimeout(() => {
      this.attemptReconnection(userId);
    }, delay);

    this.reconnectTimers.set(userId, timer);
  }

  stopReconnectionTimer(userId) {
    const timer = this.reconnectTimers.get(userId);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(userId);
    }
  }

  async attemptReconnection(userId) {
    const config = this.connectionConfigs.get(userId);
    if (!config) {
      console.warn(`No stored config for user ${userId}, cannot reconnect`);
      return;
    }

    const attempts = this.connectionAttempts.get(userId) || 0;
    const maxAttempts = 5;

    if (attempts >= maxAttempts) {
      console.error(`Max reconnection attempts (${maxAttempts}) reached for user ${userId}`);
      this.connectionStates.set(userId, 'failed');
      return;
    }

    this.connectionAttempts.set(userId, attempts + 1);
    this.connectionStates.set(userId, 'reconnecting');

    try {
      console.log(`Attempting reconnection for user ${userId} (attempt ${attempts + 1})`);
      await this.connect(userId, config.config || config, config.enableAutoReconnect);
      console.log(`Reconnection successful for user ${userId}`);
    } catch (error) {
      console.error(`Reconnection failed for user ${userId}:`, error.message);
      this.connectionStates.set(userId, 'error');

      // Schedule next reconnection attempt
      if (attempts + 1 < maxAttempts) {
        this.scheduleReconnection(userId);
      }
    }
  }

  // Enhanced disconnect method that prevents auto-reconnection
  async disconnect(userId, manual = true) {
    this.stopHealthMonitoring(userId);
    this.stopReconnectionTimer(userId);

    // Mark as manually disconnected to prevent auto-reconnection
    this.setManualDisconnect(userId, manual);

    const conn = this.connections.get(userId);
    if (conn) {
      return new Promise((resolve) => {
        try {
          conn.on('end', () => {
            this.connections.delete(userId);
            // Keep the manually_disconnected state
            resolve();
          });

          conn.end();
        } catch (error) {
          console.error('Error during disconnect:', error);
          // Force cleanup even if there's an error
          this.connections.delete(userId);
          // Keep the manually_disconnected state
          resolve();
        }
      });
    }
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

  async executeCommand(userId, command, timeoutMs = 60000) {
    // Client-side safety check
    if (typeof window !== 'undefined') {
      throw new Error('SSH commands can only be executed on the server side');
    }

    const conn = this.getConnection(userId);
    if (!conn) {
      throw new Error('No active SSH connection');
    }

    if (!command || typeof command !== 'string') {
      throw new Error('Invalid command');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Command execution timeout after ${timeoutMs / 1000} seconds`));
      }, timeoutMs);

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

  async uploadFile(userId, fileBuffer, remotePath, onProgress, options = {}) {
    const conn = this.getConnection(userId);
    if (!conn) {
      throw new Error('No active SSH connection');
    }

    // Validate file size (100MB default limit)
    const maxSize = options.maxSize || 100 * 1024 * 1024;
    if (fileBuffer.length > maxSize) {
      throw new Error(`File size ${fileBuffer.length} exceeds maximum allowed size ${maxSize}`);
    }

    // Validate remote path for security
    if (!remotePath || typeof remotePath !== 'string') {
      throw new Error('Invalid remote path');
    }

    // Prevent directory traversal attacks
    if (remotePath.includes('../') || remotePath.includes('..\\')) {
      throw new Error('Directory traversal not allowed in path');
    }

    return new Promise((resolve, reject) => {
      let timeout = setTimeout(() => {
        reject(new Error('File upload timeout after 10 minutes'));
      }, 600000); // 10 minute timeout for large files

      conn.sftp((err, sftp) => {
        if (err) {
          clearTimeout(timeout);
          return reject(new Error(`SFTP initialization failed: ${err.message}`));
        }

        // Create directory if it doesn't exist with better error handling
        const dirPath = remotePath.substring(0, remotePath.lastIndexOf('/'));
        if (dirPath && dirPath !== '.') {
          sftp.mkdir(dirPath, { recursive: true }, (mkdirErr) => {
            if (mkdirErr && mkdirErr.code !== 4 && mkdirErr.code !== 'EEXIST') {
              clearTimeout(timeout);
              sftp.end();
              return reject(new Error(`Failed to create directory: ${mkdirErr.message}`));
            }
            proceedWithUpload();
          });
        } else {
          proceedWithUpload();
        }

        const proceedWithUpload = () => {
          try {
            const writeStream = sftp.createWriteStream(remotePath, {
              flags: 'w',
              encoding: null,
              mode: 0o644
            });

            const readStream = new Readable({
              highWaterMark: 64 * 1024, // 64KB chunks for better memory usage
              objectMode: false
            });

            let uploadedBytes = 0;
            const totalBytes = fileBuffer.length;
            let bufferOffset = 0;

            // Create a streaming mechanism for large files
            const writeChunk = () => {
              if (bufferOffset >= totalBytes) {
                readStream.push(null);
                return;
              }

              const chunkSize = Math.min(64 * 1024, totalBytes - bufferOffset);
              const chunk = fileBuffer.slice(bufferOffset, bufferOffset + chunkSize);
              bufferOffset += chunkSize;

              if (!readStream.push(chunk)) {
                // Wait for drain event if buffer is full
                readStream.once('drain', writeChunk);
              } else {
                // Continue immediately if buffer has space
                setImmediate(writeChunk);
              }
            };

            writeChunk();

            readStream.on('data', (chunk) => {
              uploadedBytes += chunk.length;
              if (onProgress && typeof onProgress === 'function') {
                try {
                  const progress = Math.min(99, Math.round((uploadedBytes / totalBytes) * 100));
                  onProgress(progress);
                } catch (progressErr) {
                  console.warn('Progress callback error:', progressErr);
                }
              }
            });

            writeStream.on('error', (uploadErr) => {
              clearTimeout(timeout);
              sftp.end();
              reject(new Error(`File upload failed: ${uploadErr.message}`));
            });

            writeStream.on('finish', () => {
              clearTimeout(timeout);
              sftp.end();
              if (onProgress) onProgress(100);
              resolve({
                message: 'File uploaded successfully',
                path: remotePath,
                size: totalBytes,
                uploadedAt: new Date().toISOString()
              });
            });

            readStream.on('error', (readErr) => {
              clearTimeout(timeout);
              sftp.end();
              reject(new Error(`File read error: ${readErr.message}`));
            });

            readStream.pipe(writeStream);

          } catch (streamErr) {
            clearTimeout(timeout);
            sftp.end();
            reject(new Error(`Stream setup error: ${streamErr.message}`));
          }
        };
      });
    });
  }

  async downloadFile(userId, remotePath, onProgress) {
    const conn = this.getConnection(userId);
    if (!conn) {
      throw new Error('No active SSH connection');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('File download timeout after 10 minutes'));
      }, 600000); // 10 minute timeout for large files

      conn.sftp((err, sftp) => {
        if (err) {
          clearTimeout(timeout);
          return reject(new Error(`SFTP initialization failed: ${err.message}`));
        }

        sftp.stat(remotePath, (statErr, stats) => {
          if (statErr) {
            clearTimeout(timeout);
            sftp.end();
            return reject(new Error(`File not found: ${statErr.message}`));
          }

          // Check file size limit (100MB)
          const maxSize = 100 * 1024 * 1024;
          if (stats.size > maxSize) {
            clearTimeout(timeout);
            sftp.end();
            return reject(new Error(`File size ${stats.size} exceeds maximum allowed size ${maxSize}`));
          }

          const readStream = sftp.createReadStream(remotePath, {
            highWaterMark: 64 * 1024, // 64KB chunks for better memory usage
          });

          const chunks = [];
          let downloadedBytes = 0;
          let lastProgressUpdate = 0;

          readStream.on('data', (chunk) => {
            chunks.push(chunk);
            downloadedBytes += chunk.length;

            // Throttle progress updates to avoid overwhelming the UI
            const now = Date.now();
            if (onProgress && (now - lastProgressUpdate > 100 || downloadedBytes === stats.size)) {
              try {
                const progress = Math.min(99, Math.round((downloadedBytes / stats.size) * 100));
                onProgress(progress);
                lastProgressUpdate = now;
              } catch (progressErr) {
                console.warn('Progress callback error:', progressErr);
              }
            }
          });

          readStream.on('end', () => {
            clearTimeout(timeout);
            sftp.end();
            if (onProgress) onProgress(100);

            // For very large files, consider streaming instead of concatenating
            let fileBuffer;
            try {
              fileBuffer = Buffer.concat(chunks);
            } catch (concatErr) {
              clearTimeout(timeout);
              reject(new Error(`Failed to assemble file data: ${concatErr.message}`));
              return;
            }

            resolve({
              buffer: fileBuffer,
              size: stats.size,
              path: remotePath,
              downloadedAt: new Date().toISOString()
            });
          });

          readStream.on('error', (readErr) => {
            clearTimeout(timeout);
            sftp.end();
            reject(new Error(`File download failed: ${readErr.message}`));
          });

          readStream.on('close', () => {
            // Ensure SFTP connection is closed
            sftp.end();
          });
        });
      });
    });
  }
}

export const sshManager = new SSHManager();