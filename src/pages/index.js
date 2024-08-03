"use client";
import React, { useEffect, useState } from 'react';
import {
  Button, TextField, Box, Typography, RadioGroup, FormControlLabel, Radio,
  Paper, Grid, Container, InputAdornment, Divider, Card, CardContent, CardActions,
  Snackbar, Alert, CircularProgress
} from '@mui/material';
import { styled } from '@mui/system';
import Link from 'next/link';
import axios from 'axios';
import { Computer, HardDrive, Globe, Shield, Settings, Server, Cloud, PowerOff } from 'lucide-react';
import { useUser } from '../UserContext';

const StyledCard = styled(Card)(({ theme }) => ({
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  transition: 'transform 0.15s ease-in-out',
  '&:hover': { transform: 'scale3d(1.05, 1.05, 1)' },
  backgroundColor: theme.palette.background.paper,
  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
}));

const StyledCardContent = styled(CardContent)({
  flexGrow: 1,
});

const StyledIcon = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  marginBottom: theme.spacing(2),
  '& > svg': {
    width: 48,
    height: 48,
    color: theme.palette.primary.main,
  },
}));

const LoaderOverlay = styled(Box)(({ theme }) => ({
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 9999,
}));

export default function Home() {
  const { userId, isLoadingUserId } = useUser();
  const [connection, setConnection] = useState({
    host: '127.0.0.1',
    port: '2222',
    username: 'root',
    authType: 'password',
    password: 'root',
    privateKey: '',
    userId: userId
  });

  const [loading, setLoading] = useState(false);
  const [setupLoading, setSetupLoading] = useState({
    nginx: false,
    'nginx-certbot': false,
    caddy: false
  });
  const [isConnected, setIsConnected] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [keepAliveInterval, setKeepAliveInterval] = useState(null);

  useEffect(() => {
    setConnection(prev => ({ ...prev, userId }));
    checkConnection(userId);

    return () => {
      if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
      }
    };
  }, [userId]);

  const checkConnection = async (userId) => {
    try {
      const res = await axios.get('/api/check-connection', { headers: { 'x-user-Id': userId } });
      setIsConnected(res.data.connected);
      if (res.data.connected) {
        setConnection(res.data.connection);
        startKeepAlive();
      }
    } catch (error) {
      console.error('Error checking connection:', error);
    }
  };

  const startKeepAlive = () => {
    const interval = setInterval(async () => {
      try {
        await axios.post('/api/keep-alive', null, { headers: { 'x-user-Id': userId } });
      } catch (error) {
        console.error('Keep-alive failed:', error);
        clearInterval(interval);
        setIsConnected(false);
        setSnackbar({ open: true, message: 'Connection lost. Please reconnect.', severity: 'error' });
      }
    }, 30000); // Send keep-alive every 30 seconds
    setKeepAliveInterval(interval);
  };

  const handleConnect = async () => {
    try {
      setLoading(true);
      const res = await axios.post('/api/connect', connection);
      setIsConnected(true);
      setSnackbar({ open: true, message: res.data.message, severity: 'success' });
      startKeepAlive();
    } catch (error) {
      setSnackbar({ open: true, message: 'Connection failed: ' + error.response.data.error, severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setLoading(true);
      await axios.post('/api/disconnect', null, { headers: { 'x-user-Id': userId } });
      setIsConnected(false);
      setSnackbar({ open: true, message: 'Disconnected successfully', severity: 'success' });
      if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
      }
    } catch (error) {
      setSnackbar({ open: true, message: 'Disconnection failed: ' + error.response.data.error, severity: 'error' });
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

  if (isLoadingUserId) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ my: 4 }}>
          <Typography variant="h3" component="h1" gutterBottom align="center" color="primary">
            VPS Manager
          </Typography>
          <LoaderOverlay>
            <CircularProgress />
          </LoaderOverlay>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg">
      <Box sx={{ my: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom align="center" color="primary">
          VPS Manager
        </Typography>
        <Paper elevation={3} sx={{ p: 3, mb: 4, bgcolor: 'background.paper' }}>
          <Typography variant="h5" gutterBottom color="primary">
            {isConnected ? 'VPS Connection' : 'Connect to Your VPS'}
          </Typography>
          {isConnected ? (
            <Box>
              <Typography variant="body1" gutterBottom>
                Connected to: {connection.username}@{connection.host}:{connection.port}
              </Typography>
              <Button
                variant="contained"
                color="secondary"
                onClick={handleDisconnect}
                startIcon={<PowerOff />}
                disabled={loading}
              >
                Disconnect
              </Button>
            </Box>
          ) : (
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Host"
                  value={connection.host}
                  onChange={(e) => setConnection({ ...connection, host: e.target.value })}
                  margin="normal"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Server size={20} />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Port"
                  value={connection.port}
                  onChange={(e) => setConnection({ ...connection, port: e.target.value })}
                  margin="normal"
                  InputProps={{
                    startAdornment: <InputAdornment position="start">:</InputAdornment>,
                  }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Username"
                  value={connection.username}
                  onChange={(e) => setConnection({ ...connection, username: e.target.value })}
                  margin="normal"
                />
              </Grid>
              <Grid item xs={12}>
                <RadioGroup
                  row
                  value={connection.authType}
                  onChange={(e) => setConnection({ ...connection, authType: e.target.value })}
                >
                  <FormControlLabel value="password" control={<Radio />} label="Password" />
                  <FormControlLabel value="privateKey" control={<Radio />} label="Private Key" />
                </RadioGroup>
              </Grid>
              <Grid item xs={12}>
                {connection.authType === 'password' ? (
                  <TextField
                    fullWidth
                    label="Password"
                    type="password"
                    value={connection.password}
                    onChange={(e) => setConnection({ ...connection, password: e.target.value })}
                    margin="normal"
                  />
                ) : (
                  <TextField
                    fullWidth
                    label="Private Key"
                    multiline
                    rows={4}
                    value={connection.privateKey}
                    onChange={(e) => setConnection({ ...connection, privateKey: e.target.value })}
                    margin="normal"
                  />
                )}
              </Grid>
              <Grid item xs={12}>
                <Button
                  variant="contained"
                  onClick={handleConnect}
                  size="large"
                  disabled={loading}
                  startIcon={loading ? <CircularProgress size={20} /> : <Server />}
                  fullWidth
                >
                  {loading ? 'Connecting...' : 'Connect'}
                </Button>
              </Grid>
            </Grid>
          )}
        </Paper>

        <Typography variant="h5" gutterBottom color="primary">
          Quick Setup
        </Typography>
        <Grid container spacing={2} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={4}>
            <Button
              fullWidth
              variant="contained"
              onClick={() => handleQuickSetup('nginx')}
              size="large"
              disabled={setupLoading.nginx || !isConnected}
              startIcon={setupLoading.nginx ? <CircularProgress size={20} /> : null}
            >
              {setupLoading.nginx ? 'Setting up...' : 'Setup Nginx'}
            </Button>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Button
              fullWidth
              variant="contained"
              onClick={() => handleQuickSetup('nginx-certbot')}
              size="large"
              disabled={setupLoading['nginx-certbot'] || !isConnected}
              startIcon={setupLoading['nginx-certbot'] ? <CircularProgress size={20} /> : null}
            >
              {setupLoading['nginx-certbot'] ? 'Setting up...' : 'Setup Nginx + Certbot'}
            </Button>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Button
              fullWidth
              variant="contained"
              onClick={() => handleQuickSetup('caddy')}
              size="large"
              disabled={setupLoading.caddy || !isConnected}
              startIcon={setupLoading.caddy ? <CircularProgress size={20} /> : null}
            >
              {setupLoading.caddy ? 'Setting up...' : 'Setup Caddy'}
            </Button>
          </Grid>
        </Grid>

        <Divider sx={{ my: 4 }} />

        <Typography variant="h5" gutterBottom color="primary">
          Management Tools
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6} md={4}>
            <StyledCard>
              <StyledCardContent>
                <StyledIcon>
                  <HardDrive />
                </StyledIcon>
                <Typography variant="h6" component="h2" align="center">
                  File Manager
                </Typography>
                <Typography align="center">
                  Manage your VPS files
                </Typography>
              </StyledCardContent>
              <CardActions>
                <Button fullWidth component={Link} href="/file-manager" variant="contained" disabled={!isConnected}>
                  Open File Manager
                </Button>
              </CardActions>
            </StyledCard>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <StyledCard>
              <StyledCardContent>
                <StyledIcon>
                  <Settings />
                </StyledIcon>
                <Typography variant="h6" component="h2" align="center">
                  Nginx Config
                </Typography>
                <Typography align="center">
                  Manage Nginx configuration
                </Typography>
              </StyledCardContent>
              <CardActions>
                <Button fullWidth component={Link} href="/nginx-config" variant="contained" disabled={!isConnected}>
                  Edit Nginx Config
                </Button>
              </CardActions>
            </StyledCard>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <StyledCard>
              <StyledCardContent>
                <StyledIcon>
                  <Computer />
                </StyledIcon>
                <Typography variant="h6" component="h2" align="center">
                  Caddy Config
                </Typography>
                <Typography align="center">
                  Manage Caddy configuration
                </Typography>
              </StyledCardContent>
              <CardActions>
                <Button fullWidth component={Link} href="/caddy-config" variant="contained" disabled={!isConnected}>
                  Edit Caddy Config
                </Button>
              </CardActions>
            </StyledCard>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <StyledCard>
              <StyledCardContent>
                <StyledIcon>
                  <Globe />
                </StyledIcon>
                <Typography variant="h6" component="h2" align="center">
                  Domain Manager
                </Typography>
                <Typography align="center">
                  Manage your domains
                </Typography>
              </StyledCardContent>
              <CardActions>
                <Button fullWidth component={Link} href="/domain-manager" variant="contained" disabled={!isConnected}>
                  Manage Domains
                </Button>
              </CardActions>
            </StyledCard>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <StyledCard>
              <StyledCardContent>
                <StyledIcon>
                  <Shield />
                </StyledIcon>
                <Typography variant="h6" component="h2" align="center">
                  SSL Manager
                </Typography>
                <Typography align="center">
                  Manage SSL certificates
                </Typography>
              </StyledCardContent>
              <CardActions>
                <Button fullWidth component={Link} href="/ssl-manager" variant="contained" disabled={!isConnected}>
                  Manage SSL
                </Button>
              </CardActions>
            </StyledCard>
          </Grid>
        </Grid>
      </Box>
      {loading && (
        <LoaderOverlay>
          <Cloud size={64} className="animate-spin" color="white" />
        </LoaderOverlay>
      )}
      <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={handleCloseSnackbar}>
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
}