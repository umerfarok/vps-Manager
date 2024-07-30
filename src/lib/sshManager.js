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
  async disconnect(userId) {
    const conn = this.connections.get(userId);
    if (conn) {
      conn.end();
      this.connections.delete(userId);
    }
  }
  async executeCommand(userId, command) {
    const conn = this.getConnection(userId);
    if (!conn) {
      throw new Error('No active SSH connection');
    }

    return new Promise((resolve, reject) => {
      conn.exec(command, (err, stream) => {
        if (err) reject(err);
        let data = '';
        stream.on('close', (code) => {
          resolve({ code, data });
        }).on('data', (chunk) => {
          data += chunk;
        }).stderr.on('data', (chunk) => {
          data += chunk;
        });
      });
    });
  }
}

export const sshManager = new SSHManager();