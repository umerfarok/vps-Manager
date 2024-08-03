import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

export function useConnection(userId) {
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
  const [loading, setLoading] = useState(false);
  const [setupLoading, setSetupLoading] = useState({
    nginx: false,
    'nginx-certbot': false,
    caddy: false
  });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [manualDisconnect, setManualDisconnect] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('vpsConnection', JSON.stringify(connection));
    }
  }, [connection]);

  const checkConnection = useCallback(async () => {
    if (userId && !manualDisconnect) {
      try {
        const res = await axios.get('/api/check-connection', { headers: { 'x-user-Id': userId } });
        setIsConnected(res.data.connected);
      } catch (error) {
        console.error('Error checking connection:', error);
        setIsConnected(false);
      }
    }
  }, [userId, manualDisconnect]);

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  const handleConnect = async () => {
    try {
      setLoading(true);
      setManualDisconnect(false);
      const res = await axios.post('/api/connect', connection, { headers: { 'x-user-Id': userId } });
      setIsConnected(true);
      setSnackbar({ open: true, message: 'Connected successfully', severity: 'success' });
    } catch (error) {
      setSnackbar({ open: true, message: 'Connection failed: ' + error.message, severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setLoading(true);
      setManualDisconnect(true);
      await axios.post('/api/disconnect', null, { headers: { 'x-user-Id': userId } });
      setIsConnected(false);
      setSnackbar({ open: true, message: 'Disconnected successfully', severity: 'success' });
    } catch (error) {
      setSnackbar({ open: true, message: 'Disconnection failed: ' + error.message, severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSetup = async (type) => {
    if (!isConnected) {
      setSnackbar({ open: true, message: 'Please connect to your VPS first', severity: 'warning' });
      return;
    }

    try {
      setSetupLoading({ ...setupLoading, [type]: true });
      const res = await axios.post('/api/quick-setup', { setupType: type }, { headers: { 'x-user-Id': userId } });
      setSnackbar({ open: true, message: res.data.message, severity: 'success' });
    } catch (error) {
      setSnackbar({ open: true, message: 'Setup failed: ' + error.response.data.error, severity: 'error' });
    } finally {
      setSetupLoading({ ...setupLoading, [type]: false });
    }
  };

  const handleCloseSnackbar = (event, reason) => {
    if (reason === 'clickaway') {
      return;
    }
    setSnackbar({ ...snackbar, open: false });
  };

  return {
    connection,
    isConnected,
    connect: handleConnect,
    disconnect: handleDisconnect,
    setConnection,
    loading,
    setupLoading,
    snackbar,
    setSnackbar,
    handleConnect,
    handleDisconnect,
    handleQuickSetup,
    handleCloseSnackbar,
    checkConnection
  };
}