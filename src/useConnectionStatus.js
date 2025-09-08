import { useState, useEffect, useCallback } from 'react';
import { useUser } from './UserContext';
import axios from 'axios';

export function useConnectionStatus() {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState('disconnected');
  const [lastChecked, setLastChecked] = useState(null);
  const { userId } = useUser();

  const checkConnection = useCallback(async () => {
    if (!userId) {
      setIsConnected(false);
      setConnectionState('disconnected');
      return false;
    }

    try {
      const res = await axios.get('/api/check-connection', {
        headers: { 'x-user-id': userId },
        timeout: 5000
      });

      const connected = res.data.connected;
      const state = res.data.state || 'disconnected';

      setIsConnected(connected);
      setConnectionState(state);
      setLastChecked(new Date());

      return connected;
    } catch (error) {
      console.error('Connection check failed:', error);
      setIsConnected(false);
      setConnectionState('error');
      setLastChecked(new Date());
      return false;
    }
  }, [userId]);

  const requireConnection = useCallback(async () => {
    const connected = await checkConnection();
    if (!connected) {
      throw new Error('No active connection to server. Please connect first.');
    }
    return true;
  }, [checkConnection]);

  // Check connection on mount and when userId changes
  useEffect(() => {
    if (userId) {
      checkConnection();
    } else {
      setIsConnected(false);
      setConnectionState('disconnected');
    }
  }, [userId, checkConnection]);

  // Periodic connection check
  useEffect(() => {
    if (!userId || !isConnected) return;

    const interval = setInterval(() => {
      checkConnection();
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [userId, isConnected, checkConnection]);

  return {
    isConnected,
    connectionState,
    lastChecked,
    checkConnection,
    requireConnection,
    // Utility methods
    isConnecting: connectionState === 'connecting',
    isDisconnected: connectionState === 'disconnected',
    hasError: connectionState === 'error',
  };
}
