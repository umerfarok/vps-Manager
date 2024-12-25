import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

export function useConnection(userId) {
  const [connection, setConnection] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('vpsConnection');
      return saved ? JSON.parse(saved) : {
        host: '',
        port: '22',
        username: '',
        authType: 'password',
        password: '',
        privateKey: '',
        passphrase: '',
      };
    }
    return {
      host: '',
      port: '22',
      username: '',
      authType: 'password',
      password: '',
      privateKey: '',
      passphrase: '',
    };
  });

  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState('disconnected');
  const [loading, setLoading] = useState(false);
  const [setupLoading, setSetupLoading] = useState({
    nginx: false,
    'nginx-certbot': false,
    caddy: false
  });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  
  // Use ref for manual disconnect to persist across renders
  const manualDisconnectRef = useRef(false);
  
  // Connection check interval
  const checkIntervalRef = useRef(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('vpsConnection', JSON.stringify(connection));
    }
  }, [connection]);

  const checkConnection = useCallback(async () => {
    if (!userId || manualDisconnectRef.current) return;

    try {
      const res = await axios.get('/api/check-connection', {
        headers: { 'x-user-id': userId }
      });
      
      setIsConnected(res.data.connected);
      setConnectionState(res.data.state || 'disconnected');

      if (!res.data.connected && connectionState === 'connected') {
        setSnackbar({
          open: true,
          message: 'Connection lost. Please reconnect.',
          severity: 'error'
        });
      }
    } catch (error) {
      console.error('Error checking connection:', error);
      setIsConnected(false);
      setConnectionState('error');
    }
  }, [userId, connectionState]);

  // Setup periodic connection check
  useEffect(() => {
    if (userId && isConnected && !manualDisconnectRef.current) {
      checkIntervalRef.current = setInterval(checkConnection, 30000);
    }

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [userId, isConnected, checkConnection]);

  const validateConnection = useCallback(() => {
    const errors = [];
    if (!connection.host) errors.push('Host is required');
    if (!connection.port) errors.push('Port is required');
    if (!connection.username) errors.push('Username is required');
    if (connection.authType === 'password' && !connection.password) {
      errors.push('Password is required');
    }
    if (connection.authType === 'privateKey' && !connection.privateKey) {
      errors.push('Private key is required');
    }
    return errors;
  }, [connection]);

  const handleConnect = async () => {
    const errors = validateConnection();
    if (errors.length > 0) {
      setSnackbar({
        open: true,
        message: `Validation errors: ${errors.join(', ')}`,
        severity: 'error'
      });
      return;
    }

    try {
      setLoading(true);
      manualDisconnectRef.current = false;
      setConnectionState('connecting');

      const res = await axios.post('/api/connect', connection, {
        headers: { 'x-user-id': userId },
        timeout: 30000 // 30 second timeout
      });

      setIsConnected(true);
      setConnectionState('connected');
      setSnackbar({
        open: true,
        message: 'Connected successfully',
        severity: 'success'
      });

      // Start connection check interval
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
      checkIntervalRef.current = setInterval(checkConnection, 30000);

    } catch (error) {
      console.error('Connection error:', error);
      setIsConnected(false);
      setConnectionState('error');

      let errorMessage = 'Connection failed';
      if (error.response) {
        errorMessage = error.response.data.message || error.response.data.error || errorMessage;
      } else if (error.message) {
        errorMessage = error.message;
      }

      setSnackbar({
        open: true,
        message: errorMessage,
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setLoading(true);
      manualDisconnectRef.current = true;
      setConnectionState('disconnecting');

      await axios.post('/api/disconnect', null, {
        headers: { 'x-user-id': userId }
      });

      setIsConnected(false);
      setConnectionState('disconnected');
      setSnackbar({
        open: true,
        message: 'Disconnected successfully',
        severity: 'success'
      });

      // Clear connection check interval
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }

    } catch (error) {
      console.error('Disconnect error:', error);
      setSnackbar({
        open: true,
        message: 'Failed to disconnect: ' + (error.response?.data?.error || error.message),
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSetup = async (type) => {
    if (!isConnected) {
      setSnackbar({
        open: true,
        message: 'Please connect to your VPS first',
        severity: 'warning'
      });
      return;
    }

    try {
      setSetupLoading(prev => ({ ...prev, [type]: true }));
      
      const res = await axios.post('/api/quick-setup',
        { setupType: type },
        { 
          headers: { 'x-user-id': userId },
          timeout: 180000 // 3 minute timeout for setup
        }
      );

      setSnackbar({
        open: true,
        message: res.data.message,
        severity: 'success'
      });
    } catch (error) {
      console.error('Setup error:', error);
      
      let errorMessage = 'Setup failed';
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }

      setSnackbar({
        open: true,
        message: errorMessage,
        severity: 'error'
      });

      // If we get a 401 or connection error, mark as disconnected
      if (error.response?.status === 401 || 
          error.message.includes('No active SSH connection')) {
        setIsConnected(false);
        setConnectionState('disconnected');
      }
    } finally {
      setSetupLoading(prev => ({ ...prev, [type]: false }));
    }
  };

  const handleCloseSnackbar = (event, reason) => {
    if (reason === 'clickaway') {
      return;
    }
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, []);

  return {
    connection,
    isConnected,
    connectionState,
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