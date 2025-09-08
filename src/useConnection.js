import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

// Connection state manager to prevent race conditions
class ConnectionStateManager {
  constructor() {
    this.states = new Map();
    this.intervals = new Map();
    this.manualDisconnects = new Map();
  }

  getState(userId) {
    return this.states.get(userId) || {
      isConnected: false,
      connectionState: 'disconnected',
      loading: false,
      setupLoading: {
        nginx: false,
        'nginx-certbot': false,
        caddy: false
      },
      snackbar: { open: false, message: '', severity: 'info' }
    };
  }

  setState(userId, updates) {
    const currentState = this.getState(userId);
    const newState = { ...currentState, ...updates };
    this.states.set(userId, newState);
    return newState;
  }

  setManualDisconnect(userId, value) {
    this.manualDisconnects.set(userId, value);
  }

  getManualDisconnect(userId) {
    return this.manualDisconnects.get(userId) || false;
  }

  startHealthCheck(userId, callback) {
    this.stopHealthCheck(userId);
    const interval = setInterval(callback, 30000); // 30 seconds
    this.intervals.set(userId, interval);
  }

  stopHealthCheck(userId) {
    const interval = this.intervals.get(userId);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(userId);
    }
  }

  cleanup(userId) {
    this.stopHealthCheck(userId);
    this.states.delete(userId);
    this.manualDisconnects.delete(userId);
  }
}

const connectionStateManager = new ConnectionStateManager();

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

  // Get current state from manager
  const [state, setState] = useState(() => connectionStateManager.getState(userId));

  // Sync with connection state manager
  useEffect(() => {
    const currentState = connectionStateManager.getState(userId);
    setState(currentState);
  }, [userId]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('vpsConnection', JSON.stringify(connection));
    }
  }, [connection]);

  const updateState = useCallback((updates) => {
    const newState = connectionStateManager.setState(userId, updates);
    setState(newState);
  }, [userId]);

  const checkConnection = useCallback(async () => {
    if (!userId || connectionStateManager.getManualDisconnect(userId)) return;

    try {
      const res = await axios.get('/api/check-connection', {
        headers: { 'x-user-id': userId }
      });

      const wasConnected = state.connectionState === 'connected';
      const isStillConnected = res.data.connected;

      updateState({
        isConnected: isStillConnected,
        connectionState: res.data.state || 'disconnected'
      });

      if (!isStillConnected && wasConnected) {
        updateState({
          snackbar: {
            open: true,
            message: 'Connection lost. Please reconnect.',
            severity: 'error'
          }
        });
      }
    } catch (error) {
      console.error('Error checking connection:', error);
      updateState({
        isConnected: false,
        connectionState: 'error'
      });
    }
  }, [userId, state.connectionState, updateState]);

  // Setup periodic connection check
  useEffect(() => {
    if (userId && state.isConnected && !connectionStateManager.getManualDisconnect(userId)) {
      connectionStateManager.startHealthCheck(userId, checkConnection);
    } else {
      connectionStateManager.stopHealthCheck(userId);
    }

    return () => {
      connectionStateManager.stopHealthCheck(userId);
    };
  }, [userId, state.isConnected, checkConnection]);

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
      updateState({
        snackbar: {
          open: true,
          message: `Validation errors: ${errors.join(', ')}`,
          severity: 'error'
        }
      });
      return;
    }

    try {
      updateState({ loading: true, connectionState: 'connecting' });
      connectionStateManager.setManualDisconnect(userId, false);

      const res = await axios.post('/api/connect', connection, {
        headers: { 'x-user-id': userId },
        timeout: 30000 // 30 second timeout
      });

      updateState({
        isConnected: true,
        connectionState: 'connected',
        loading: false,
        snackbar: {
          open: true,
          message: 'Connected successfully',
          severity: 'success'
        }
      });

      // Start health check
      connectionStateManager.startHealthCheck(userId, checkConnection);

    } catch (error) {
      console.error('Connection error:', error);
      updateState({
        isConnected: false,
        connectionState: 'error',
        loading: false
      });

      let errorMessage = 'Connection failed';
      if (error.response) {
        errorMessage = error.response.data.message || error.response.data.error || errorMessage;
      } else if (error.message) {
        errorMessage = error.message;
      }

      updateState({
        snackbar: {
          open: true,
          message: errorMessage,
          severity: 'error'
        }
      });
    }
  };

  const handleDisconnect = async () => {
    try {
      updateState({ loading: true, connectionState: 'disconnecting' });
      connectionStateManager.setManualDisconnect(userId, true);

      await axios.post('/api/disconnect', null, {
        headers: { 'x-user-id': userId }
      });

      updateState({
        isConnected: false,
        connectionState: 'disconnected',
        loading: false,
        snackbar: {
          open: true,
          message: 'Disconnected successfully',
          severity: 'success'
        }
      });

      // Stop health check
      connectionStateManager.stopHealthCheck(userId);

    } catch (error) {
      console.error('Disconnect error:', error);
      updateState({
        snackbar: {
          open: true,
          message: 'Failed to disconnect: ' + (error.response?.data?.error || error.message),
          severity: 'error'
        },
        loading: false
      });
    }
  };

  const handleQuickSetup = async (type) => {
    if (!state.isConnected) {
      updateState({
        snackbar: {
          open: true,
          message: 'Please connect to your VPS first',
          severity: 'warning'
        }
      });
      return;
    }

    try {
      updateState({
        setupLoading: { ...state.setupLoading, [type]: true }
      });

      const res = await axios.post('/api/quick-setup',
        { setupType: type },
        {
          headers: { 'x-user-id': userId },
          timeout: 180000 // 3 minute timeout for setup
        }
      );

      updateState({
        snackbar: {
          open: true,
          message: res.data.message,
          severity: 'success'
        }
      });
    } catch (error) {
      console.error('Setup error:', error);

      let errorMessage = 'Setup failed';
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }

      updateState({
        snackbar: {
          open: true,
          message: errorMessage,
          severity: 'error'
        }
      });

      // If we get a 401 or connection error, mark as disconnected
      if (error.response?.status === 401 ||
          error.message.includes('No active SSH connection')) {
        updateState({
          isConnected: false,
          connectionState: 'disconnected'
        });
      }
    } finally {
      updateState({
        setupLoading: { ...state.setupLoading, [type]: false }
      });
    }
  };

  const handleCloseSnackbar = (event, reason) => {
    if (reason === 'clickaway') {
      return;
    }
    updateState({
      snackbar: { ...state.snackbar, open: false }
    });
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      connectionStateManager.cleanup(userId);
    };
  }, [userId]);

  return {
    connection,
    isConnected: state.isConnected,
    connectionState: state.connectionState,
    connect: handleConnect,
    disconnect: handleDisconnect,
    setConnection,
    loading: state.loading,
    setupLoading: state.setupLoading,
    snackbar: state.snackbar,
    setSnackbar: (snackbar) => updateState({ snackbar }),
    handleConnect,
    handleDisconnect,
    handleQuickSetup,
    handleCloseSnackbar,
    checkConnection
  };
}