import { Client } from 'ssh2';

class SSHManager {
  constructor() {
    this.connections = new Map();
  }

  async connect(userId, config) {
    if (this.connections.has(userId)) {
      await this.disconnect(userId);
    }

    return new Promise((resolve, reject) => {
      const conn = new Client();
      conn.on('ready', () => {
        this.connections.set(userId, conn);
        resolve(conn);
      }).on('error', (err) => {
        reject(err);
      }).connect(config);
    });
  }

  async disconnect(userId) {
    const conn = this.connections.get(userId);
    if (conn) {
      conn.end();
      this.connections.delete(userId);
    }
  }

  getConnection(userId) {
    return this.connections.get(userId);
  }

  async executeCommand(userId, command) {
    console.log('executeCommand', userId, command);
    const conn = this.getConnection(userId);
    if (!conn) {
      throw new Error('No active SSH connection');
    }

    return new Promise((resolve, reject) => {
      conn.exec(command, (err, stream) => {
        if (err) reject(err);
        let stdout = '';
        let stderr = '';
        stream.on('close', (code) => {
          resolve({ code, stdout, stderr });
        }).on('data', (chunk) => {
          stdout += chunk;
        }).stderr.on('data', (chunk) => {
          stderr += chunk;
        });
      });
    });
  }
}

export const sshManager = new SSHManager();