"use client";
import React, { useEffect, useState } from 'react';
import {
  Button, TextField, Box, Typography, RadioGroup, FormControlLabel, Radio,
  Paper, Grid, Container, InputAdornment, Divider, Card, CardContent, CardActions,
  Snackbar, Alert, CircularProgress,
  IconButton,
  Chip
} from '@mui/material';
import { Terminal } from '@mui/icons-material';
import { styled } from '@mui/system';
import Link from 'next/link';
import axios from 'axios';
import { Computer, HardDrive, Globe, Shield, Settings, Server, Cloud, PowerOff, Moon, Sun, Activity, Bug, Database, Archive, Network } from 'lucide-react';
import { useUser } from '../UserContext';
import { useConnection } from '../useConnection';
import { useTheme } from '../ThemeContext';
import ConnectionProfiles from '../components/ConnectionProfiles';

const StyledCard = styled(Card)(({ theme, disabled }) => ({
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.6 : 1,
  '&:hover': disabled ? {} : {
    transform: 'translateY(-8px) scale(1.02)',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
    '& .icon-container': {
      transform: 'scale(1.1)',
      color: theme.palette.primary.main,
    }
  },
  backgroundColor: theme.palette.background.paper,
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
  border: disabled ? `2px solid ${theme.palette.grey[300]}` : `1px solid ${theme.palette.divider}`,
  position: 'relative',
  overflow: 'hidden',
  '&::before': disabled ? {} : {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '4px',
    background: 'linear-gradient(90deg, #2196F3, #21CBF3)',
    transform: 'translateX(-100%)',
    transition: 'transform 0.3s ease',
  },
  '&:hover::before': disabled ? {} : {
    transform: 'translateX(0)',
  },
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
    color: theme.palette.grey[500],
    transition: 'all 0.3s ease',
    className: 'icon-container',
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
  const { darkMode, toggleDarkMode } = useTheme();
  const {
    connection,
    isConnected,
    connect,
    disconnect,
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
  } = useConnection(userId);


  const [setupProgress, setSetupProgress] = useState({
    open: false,
    currentStep: '',
    log: [],
    error: null
  });

  // Enhanced quick setup handler
  const handleEnhancedQuickSetup = async (type) => {
    if (!isConnected) {
      setSnackbar({
        open: true,
        message: 'Please connect to your VPS first',
        severity: 'warning'
      });
      return;
    }

    setSetupProgress({
      open: true,
      currentStep: 'System Check',
      log: [],
      error: null
    });

    try {
      const response = await fetch('/api/quick-setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId
        },
        body: JSON.stringify({ setupType: type })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.details || data.error || 'Setup failed');
      }

      // Update progress dialog with success
      setSetupProgress(prev => ({
        ...prev,
        currentStep: 'Complete',
        log: [
          ...prev.log,
          { type: 'success', message: 'Setup completed successfully' }
        ]
      }));

      setSnackbar({
        open: true,
        message: `${type} setup completed successfully`,
        severity: 'success'
      });

    } catch (error) {
      console.error('Setup error:', error);
      
      setSetupProgress(prev => ({
        ...prev,
        error: error.message,
        log: [
          ...prev.log,
          { type: 'error', message: 'Setup failed', details: error.message }
        ]
      }));

      setSnackbar({
        open: true,
        message: `Setup failed: ${error.message}`,
        severity: 'error'
      });

      // Check if we need to update connection state
      if (error.message.includes('No active SSH connection') || 
          error.message.includes('Authentication failed')) {
            setConnection(false);
        // setConnectionState('disconnected');
      }
    }
  };
  const handleSetupDialogClose = () => {
    setSetupProgress(prev => ({ ...prev, open: false }));
  };

  useEffect(() => {
    if (userId) {
      checkConnection();
    }
  }, [userId, checkConnection]);

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
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box />
            <IconButton
              onClick={toggleDarkMode}
              sx={{
                color: 'primary.main',
                '&:hover': {
                  bgcolor: 'primary.50',
                  transform: 'scale(1.1)',
                },
                transition: 'all 0.3s ease',
              }}
            >
              {darkMode ? <Sun size={24} /> : <Moon size={24} />}
            </IconButton>
          </Box>
          <Typography
            variant="h3"
            component="h1"
            gutterBottom
            color="primary"
            sx={{
              background: darkMode
                ? 'linear-gradient(45deg, #64B5F6 30%, #90CAF9 90%)'
                : 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontWeight: 'bold'
            }}
          >
            VPS Manager Pro
          </Typography>
          <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 2 }}>
            Professional VPS Management Made Simple
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mb: 3, flexWrap: 'wrap' }}>
            <Chip label="SSH Terminal" size="small" color="primary" variant="outlined" />
            <Chip label="File Manager" size="small" color="primary" variant="outlined" />
            <Chip label="Connection Profiles" size="small" color="primary" variant="outlined" />
            <Chip label="SSL Management" size="small" color="primary" variant="outlined" />
            <Chip label={darkMode ? "Dark Mode" : "Light Mode"} size="small" color="secondary" variant="outlined" />
          </Box>
        </Box>
        <Paper elevation={3} sx={{
          p: 3,
          mb: 4,
          bgcolor: 'background.paper',
          background: isConnected
            ? 'linear-gradient(135deg, rgba(76, 175, 80, 0.1) 0%, rgba(139, 195, 74, 0.1) 100%)'
            : 'linear-gradient(135deg, rgba(33, 150, 243, 0.1) 0%, rgba(33, 203, 243, 0.1) 100%)',
          border: isConnected ? '1px solid rgba(76, 175, 80, 0.3)' : '1px solid rgba(33, 150, 243, 0.3)'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h5" color="primary">
              {isConnected ? 'VPS Connection' : 'Connect to Your VPS'}
            </Typography>
            {isConnected && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box
                  sx={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    bgcolor: 'success.main',
                    animation: 'pulse 2s infinite',
                    '@keyframes pulse': {
                      '0%': { opacity: 1 },
                      '50%': { opacity: 0.6 },
                      '100%': { opacity: 1 },
                    },
                  }}
                />
                <Typography variant="body2" color="success.main" fontWeight="bold">
                  Connected
                </Typography>
              </Box>
            )}
          </Box>
          {isConnected ? (
            <Box sx={{ p: 2, bgcolor: 'rgba(76, 175, 80, 0.05)', borderRadius: 1 }}>
              <Typography variant="body1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Server size={20} />
                Connected to: <strong>{connection.username}@{connection.host}:{connection.port}</strong>
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Connection established successfully. All features are now available.
              </Typography>
              <Button
                variant="outlined"
                color="error"
                onClick={handleDisconnect}
                startIcon={<PowerOff />}
                disabled={loading}
                sx={{
                  '&:hover': {
                    bgcolor: 'error.main',
                    color: 'white'
                  }
                }}
              >
                {loading ? 'Disconnecting...' : 'Disconnect'}
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

        {/* Connection Profiles Section - Only show when not connected */}
        {!isConnected && (
          <Paper elevation={3} sx={{ p: 3, mb: 4, bgcolor: 'background.paper' }}>
            <ConnectionProfiles
              onConnect={(profile) => {
                setConnection({
                  host: profile.host,
                  port: profile.port,
                  username: profile.username,
                  authType: profile.authType,
                  password: profile.password,
                  privateKey: profile.privateKey,
                  passphrase: profile.passphrase
                });
                // Auto-connect after a short delay
                setTimeout(() => {
                  handleConnect();
                }, 500);
              }}
              currentConnection={connection}
            />
          </Paper>
        )}

        {/* Quick Setup Section */}
          <Typography variant="h5" gutterBottom color="primary">
          Quick Setup
        </Typography>
        <Grid container spacing={2} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={4}>
            <Button
              fullWidth
              variant="contained"
              onClick={() => handleEnhancedQuickSetup('nginx')}
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
              onClick={() => handleEnhancedQuickSetup('nginx-certbot')}
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
              onClick={() => handleEnhancedQuickSetup('caddy')}
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
            <StyledCard disabled={!isConnected}>
              <StyledCardContent>
                <StyledIcon>
                  <HardDrive />
                </StyledIcon>
                <Typography variant="h6" component="h2" align="center" gutterBottom>
                  File Manager
                </Typography>
                <Typography align="center" color="text.secondary" sx={{ mb: 2 }}>
                  Upload, download, and manage files with drag & drop support
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Chip label="Drag & Drop" size="small" color="primary" variant="outlined" />
                  <Chip label="Bulk Operations" size="small" color="primary" variant="outlined" />
                </Box>
              </StyledCardContent>
              <CardActions>
                <Button
                  fullWidth
                  component={Link}
                  href="/file-manager"
                  variant="contained"
                  disabled={!isConnected}
                  sx={{
                    background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
                    '&:hover': {
                      background: 'linear-gradient(45deg, #1976D2 30%, #00BCD4 90%)',
                    }
                  }}
                >
                  {isConnected ? 'Open File Manager' : 'Connect First'}
                </Button>
              </CardActions>
            </StyledCard>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <StyledCard disabled={!isConnected}>
              <StyledCardContent>
                <StyledIcon>
                  <Activity />
                </StyledIcon>
                <Typography variant="h6" component="h2" align="center" gutterBottom>
                  System Dashboard
                </Typography>
                <Typography align="center" color="text.secondary" sx={{ mb: 2 }}>
                  Real-time monitoring of CPU, memory, disk, and network usage
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Chip label="Real-time" size="small" color="success" variant="outlined" />
                  <Chip label="Live Charts" size="small" color="success" variant="outlined" />
                </Box>
              </StyledCardContent>
              <CardActions>
                <Button
                  fullWidth
                  component={Link}
                  href="/system-dashboard"
                  variant="contained"
                  disabled={!isConnected}
                  sx={{
                    background: 'linear-gradient(45deg, #4CAF50 30%, #81C784 90%)',
                    '&:hover': {
                      background: 'linear-gradient(45deg, #388E3C 30%, #66BB6A 90%)',
                    }
                  }}
                >
                  {isConnected ? 'View Dashboard' : 'Connect First'}
                </Button>
              </CardActions>
            </StyledCard>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <StyledCard disabled={!isConnected}>
              <StyledCardContent>
                <StyledIcon>
                  <Bug />
                </StyledIcon>
                <Typography variant="h6" component="h2" align="center" gutterBottom>
                  Log Analyzer
                </Typography>
                <Typography align="center" color="text.secondary" sx={{ mb: 2 }}>
                  Advanced log viewer with filtering, search, and analytics
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Chip label="Real-time" size="small" color="warning" variant="outlined" />
                  <Chip label="Analytics" size="small" color="warning" variant="outlined" />
                </Box>
              </StyledCardContent>
              <CardActions>
                <Button
                  fullWidth
                  component={Link}
                  href="/log-viewer"
                  variant="contained"
                  disabled={!isConnected}
                  sx={{
                    background: 'linear-gradient(45deg, #FF9800 30%, #FFB74D 90%)',
                    '&:hover': {
                      background: 'linear-gradient(45deg, #F57C00 30%, #FFA726 90%)',
                    }
                  }}
                >
                  {isConnected ? 'View Logs' : 'Connect First'}
                </Button>
              </CardActions>
            </StyledCard>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <StyledCard disabled={!isConnected}>
              <StyledCardContent>
                <StyledIcon>
                  <Database />
                </StyledIcon>
                <Typography variant="h6" component="h2" align="center" gutterBottom>
                  Database Manager
                </Typography>
                <Typography align="center" color="text.secondary" sx={{ mb: 2 }}>
                  GUI for MySQL, PostgreSQL, MongoDB with query builder
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Chip label="SQL/NoSQL" size="small" color="info" variant="outlined" />
                  <Chip label="Query Builder" size="small" color="info" variant="outlined" />
                </Box>
              </StyledCardContent>
              <CardActions>
                <Button
                  fullWidth
                  component={Link}
                  href="/database-manager"
                  variant="contained"
                  disabled={!isConnected}
                  sx={{
                    background: 'linear-gradient(45deg, #9C27B0 30%, #BA68C8 90%)',
                    '&:hover': {
                      background: 'linear-gradient(45deg, #7B1FA2 30%, #AB47BC 90%)',
                    }
                  }}
                >
                  {isConnected ? 'Manage DB' : 'Connect First'}
                </Button>
              </CardActions>
            </StyledCard>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <StyledCard disabled={!isConnected}>
              <StyledCardContent>
                <StyledIcon>
                  <Archive />
                </StyledIcon>
                <Typography variant="h6" component="h2" align="center" gutterBottom>
                  Backup & Restore
                </Typography>
                <Typography align="center" color="text.secondary" sx={{ mb: 2 }}>
                  Automated backups with scheduling and one-click restore
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Chip label="Automated" size="small" color="secondary" variant="outlined" />
                  <Chip label="Scheduled" size="small" color="secondary" variant="outlined" />
                </Box>
              </StyledCardContent>
              <CardActions>
                <Button
                  fullWidth
                  component={Link}
                  href="/backup-manager"
                  variant="contained"
                  disabled={!isConnected}
                  sx={{
                    background: 'linear-gradient(45deg, #3F51B5 30%, #7986CB 90%)',
                    '&:hover': {
                      background: 'linear-gradient(45deg, #303F9F 30%, #5C6BC0 90%)',
                    }
                  }}
                >
                  {isConnected ? 'Manage Backups' : 'Connect First'}
                </Button>
              </CardActions>
            </StyledCard>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <StyledCard disabled={!isConnected}>
              <StyledCardContent>
                <StyledIcon>
                  <Network />
                </StyledIcon>
                <Typography variant="h6" component="h2" align="center" gutterBottom>
                  Network Tools
                </Typography>
                <Typography align="center" color="text.secondary" sx={{ mb: 2 }}>
                  Ping, traceroute, DNS lookup, port scanning, and diagnostics
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Chip label="Diagnostics" size="small" color="primary" variant="outlined" />
                  <Chip label="Network Tools" size="small" color="primary" variant="outlined" />
                </Box>
              </StyledCardContent>
              <CardActions>
                <Button
                  fullWidth
                  component={Link}
                  href="/network-tools"
                  variant="contained"
                  disabled={!isConnected}
                  sx={{
                    background: 'linear-gradient(45deg, #009688 30%, #4DB6AC 90%)',
                    '&:hover': {
                      background: 'linear-gradient(45deg, #00695C 30%, #26A69A 90%)',
                    }
                  }}
                >
                  {isConnected ? 'Network Tools' : 'Connect First'}
                </Button>
              </CardActions>
            </StyledCard>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <StyledCard disabled={!isConnected}>
              <StyledCardContent>
                <StyledIcon>
                  <Shield />
                </StyledIcon>
                <Typography variant="h6" component="h2" align="center" gutterBottom>
                  Security Center
                </Typography>
                <Typography align="center" color="text.secondary" sx={{ mb: 2 }}>
                  Firewall management, SSL monitoring, and security scanning
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Chip label="Firewall" size="small" color="error" variant="outlined" />
                  <Chip label="SSL Monitor" size="small" color="error" variant="outlined" />
                </Box>
              </StyledCardContent>
              <CardActions>
                <Button
                  fullWidth
                  component={Link}
                  href="/security-dashboard"
                  variant="contained"
                  disabled={!isConnected}
                  sx={{
                    background: 'linear-gradient(45deg, #F44336 30%, #EF5350 90%)',
                    '&:hover': {
                      background: 'linear-gradient(45deg, #D32F2F 30%, #E53935 90%)',
                    }
                  }}
                >
                  {isConnected ? 'Security Center' : 'Connect First'}
                </Button>
              </CardActions>
            </StyledCard>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <StyledCard disabled={!isConnected}>
              <StyledCardContent>
                <StyledIcon>
                  <Terminal />
                </StyledIcon>
                <Typography variant="h6" component="h2" align="center" gutterBottom>
                  SSH Terminal
                </Typography>
                <Typography align="center" color="text.secondary" sx={{ mb: 2 }}>
                  Interactive SSH terminal with command history and auto-completion
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Chip label="Interactive" size="small" color="success" variant="outlined" />
                  <Chip label="Auto-complete" size="small" color="success" variant="outlined" />
                </Box>
              </StyledCardContent>
              <CardActions>
                <Button
                  fullWidth
                  component={Link}
                  href="/terminal-ssh"
                  variant="contained"
                  disabled={!isConnected}
                  sx={{
                    background: 'linear-gradient(45deg, #4CAF50 30%, #81C784 90%)',
                    '&:hover': {
                      background: 'linear-gradient(45deg, #388E3C 30%, #66BB6A 90%)',
                    }
                  }}
                >
                  {isConnected ? 'Open SSH Terminal' : 'Connect First'}
                </Button>
              </CardActions>
            </StyledCard>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <StyledCard disabled={!isConnected}>
              <StyledCardContent>
                <StyledIcon>
                  <Settings />
                </StyledIcon>
                <Typography variant="h6" component="h2" align="center" gutterBottom>
                  Nginx Config
                </Typography>
                <Typography align="center" color="text.secondary" sx={{ mb: 2 }}>
                  Visual Nginx configuration editor with syntax validation
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Chip label="Visual Editor" size="small" color="warning" variant="outlined" />
                  <Chip label="Syntax Check" size="small" color="warning" variant="outlined" />
                </Box>
              </StyledCardContent>
              <CardActions>
                <Button
                  fullWidth
                  component={Link}
                  href="/nginx-config"
                  variant="contained"
                  disabled={!isConnected}
                  sx={{
                    background: 'linear-gradient(45deg, #FF9800 30%, #FFB74D 90%)',
                    '&:hover': {
                      background: 'linear-gradient(45deg, #F57C00 30%, #FFA726 90%)',
                    }
                  }}
                >
                  {isConnected ? 'Edit Nginx Config' : 'Connect First'}
                </Button>
              </CardActions>
            </StyledCard>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <StyledCard disabled={!isConnected}>
              <StyledCardContent>
                <StyledIcon>
                  <Computer />
                </StyledIcon>
                <Typography variant="h6" component="h2" align="center" gutterBottom>
                  Caddy Config
                </Typography>
                <Typography align="center" color="text.secondary" sx={{ mb: 2 }}>
                  Modern web server configuration with automatic HTTPS
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Chip label="Auto HTTPS" size="small" color="info" variant="outlined" />
                  <Chip label="Modern" size="small" color="info" variant="outlined" />
                </Box>
              </StyledCardContent>
              <CardActions>
                <Button
                  fullWidth
                  component={Link}
                  href="/caddy-config"
                  variant="contained"
                  disabled={!isConnected}
                  sx={{
                    background: 'linear-gradient(45deg, #9C27B0 30%, #BA68C8 90%)',
                    '&:hover': {
                      background: 'linear-gradient(45deg, #7B1FA2 30%, #AB47BC 90%)',
                    }
                  }}
                >
                  {isConnected ? 'Edit Caddy Config' : 'Connect First'}
                </Button>
              </CardActions>
            </StyledCard>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <StyledCard disabled={!isConnected}>
              <StyledCardContent>
                <StyledIcon>
                  <Globe />
                </StyledIcon>
                <Typography variant="h6" component="h2" align="center" gutterBottom>
                  Domain Manager
                </Typography>
                <Typography align="center" color="text.secondary" sx={{ mb: 2 }}>
                  Manage domains, DNS records, and virtual hosts
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Chip label="DNS Management" size="small" color="secondary" variant="outlined" />
                  <Chip label="Virtual Hosts" size="small" color="secondary" variant="outlined" />
                </Box>
              </StyledCardContent>
              <CardActions>
                <Button
                  fullWidth
                  component={Link}
                  href="/domain-manager"
                  variant="contained"
                  disabled={!isConnected}
                  sx={{
                    background: 'linear-gradient(45deg, #3F51B5 30%, #7986CB 90%)',
                    '&:hover': {
                      background: 'linear-gradient(45deg, #303F9F 30%, #5C6BC0 90%)',
                    }
                  }}
                >
                  {isConnected ? 'Manage Domains' : 'Connect First'}
                </Button>
              </CardActions>
            </StyledCard>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <StyledCard disabled={!isConnected}>
              <StyledCardContent>
                <StyledIcon>
                  <Shield />
                </StyledIcon>
                <Typography variant="h6" component="h2" align="center" gutterBottom>
                  SSL Manager
                </Typography>
                <Typography align="center" color="text.secondary" sx={{ mb: 2 }}>
                  Install and manage SSL certificates with Let's Encrypt
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Chip label="Let's Encrypt" size="small" color="success" variant="outlined" />
                  <Chip label="Auto-renewal" size="small" color="success" variant="outlined" />
                </Box>
              </StyledCardContent>
              <CardActions>
                <Button
                  fullWidth
                  component={Link}
                  href="/ssl-manager"
                  variant="contained"
                  disabled={!isConnected}
                  sx={{
                    background: 'linear-gradient(45deg, #009688 30%, #4DB6AC 90%)',
                    '&:hover': {
                      background: 'linear-gradient(45deg, #00695C 30%, #26A69A 90%)',
                    }
                  }}
                >
                  {isConnected ? 'Manage SSL' : 'Connect First'}
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

      {/* Professional Footer */}
      <Box
        sx={{
          mt: 8,
          py: 4,
          background: 'linear-gradient(135deg, rgba(33, 150, 243, 0.05) 0%, rgba(33, 203, 243, 0.05) 100%)',
          borderTop: '1px solid',
          borderColor: 'divider'
        }}
      >
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h6" color="primary" gutterBottom>
              VPS Manager Pro
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Professional VPS Management Made Simple • Built with ❤️ for DevOps Engineers
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap' }}>
              <Chip label="SSH Terminal" size="small" variant="outlined" />
              <Chip label="File Management" size="small" variant="outlined" />
              <Chip label="SSL Certificates" size="small" variant="outlined" />
              <Chip label="Domain Management" size="small" variant="outlined" />
              <Chip label="Web Server Config" size="small" variant="outlined" />
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
              © 2024 VPS Manager Pro • Secure • Reliable • Professional
            </Typography>
          </Box>
        </Container>
      </Box>
    </Container>
  );
}