import { useState, useEffect } from 'react';
import axios from 'axios';

export function useConnection(userId) {
  console.log('userId', userId);
  const [connection, setConnection] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('vpsConnection');
      return saved ? JSON.parse(saved) : {
        host: '',
        port: '',
        username: '',
        authType: 'password',
        password: '',
        privateKey: '',
        userId: userId
      };
    }
    return {
      host: '',
      port: '',
      username: '',
      authType: 'password',
      password: '',
      privateKey: '',
      userId: userId
    };
  });
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('vpsConnection', JSON.stringify(connection));
    }
  }, [connection]);

  const connect = async (connectionData) => {
    try {
      const res = await axios.post('/api/connect', connectionData, { headers: { 'x-user-Id': userId } });
      setIsConnected(true);
      setConnection(connectionData);
      return res.data;
    } catch (error) {
      throw error;
    }
  };

  const disconnect = async () => {
    try {
      await axios.post('/api/disconnect', null, { headers: { 'x-user-Id': userId } });
      setIsConnected(false);
    } catch (error) {
      throw error;
    }
  };

  return { connection, isConnected, connect, disconnect, setConnection };
}