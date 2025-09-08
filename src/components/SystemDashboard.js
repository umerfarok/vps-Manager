import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Grid, Paper, Typography, Card, CardContent, LinearProgress,
  Chip, IconButton, Tooltip, Alert, Tabs, Tab, Divider, List,
  ListItem, ListItemText, ListItemIcon, CircularProgress
} from '@mui/material';
import {
  Memory, Storage, Cpu, Network, Thermometer, Activity,
  Server, HardDrive, Wifi, TrendingUp, TrendingDown,
  Refresh, Warning, CheckCircle, Error, Info, Settings,
  Stop, PlayArrow
} from '@mui/icons-material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { useConnectionStatus } from '../useConnectionStatus';
import axios from 'axios';
import { useUser } from '../UserContext';

const SystemDashboard = () => {
  const { userId } = useUser();
  const { requireConnection } = useConnectionStatus();
  const [systemStats, setSystemStats] = useState(null);
  const [historicalData, setHistoricalData] = useState([]);
  const [activeTab, setActiveTab] = useState(0);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [alerts, setAlerts] = useState([]);

  const fetchSystemStats = useCallback(async () => {
    try {
      await requireConnection();
      setLoading(true);

      const response = await axios.get('/api/system-stats', {
        headers: { 'x-user-id': userId },
        timeout: 10000
      });

      const data = response.data;
      setSystemStats(data);

      // Add to historical data for charts
      setHistoricalData(prev => {
        const newData = [...prev, {
          time: new Date().toLocaleTimeString(),
          cpu: data.cpu.usage,
          memory: data.memory.usedPercent,
          disk: data.disk.usedPercent,
          network: data.network ? data.network.rx_sec : 0
        }];

        // Keep only last 20 data points
        return newData.slice(-20);
      });

      // Generate alerts based on thresholds
      const newAlerts = [];
      if (data.cpu.usage > 90) {
        newAlerts.push({
          type: 'error',
          message: `High CPU usage: ${data.cpu.usage}%`,
          icon: <Cpu />
        });
      }
      if (data.memory.usedPercent > 85) {
        newAlerts.push({
          type: 'warning',
          message: `High memory usage: ${data.memory.usedPercent}%`,
          icon: <Memory />
        });
      }
      if (data.disk.usedPercent > 90) {
        newAlerts.push({
          type: 'error',
          message: `Low disk space: ${data.disk.usedPercent}% used`,
          icon: <Storage />
        });
      }

      setAlerts(newAlerts);

    } catch (error) {
      console.error('Failed to fetch system stats:', error);
    } finally {
      setLoading(false);
    }
  }, [userId, requireConnection]);

  const fetchServices = useCallback(async () => {
    try {
      await requireConnection();
      const response = await axios.get('/api/services', {
        headers: { 'x-user-id': userId }
      });
      setServices(response.data.services);
    } catch (error) {
      console.error('Failed to fetch services:', error);
    }
  }, [userId, requireConnection]);

  const handleServiceAction = async (serviceName, action) => {
    try {
      await requireConnection();
      await axios.post('/api/services', {
        serviceName,
        action
      }, {
        headers: { 'x-user-id': userId }
      });

      // Refresh services after action
      setTimeout(fetchServices, 1000);
    } catch (error) {
      console.error(`Failed to ${action} service:`, error);
    }
  };

  useEffect(() => {
    fetchSystemStats();
    fetchServices();

    // Set up real-time updates
    const interval = setInterval(fetchSystemStats, 5000);
    return () => clearInterval(interval);
  }, [fetchSystemStats, fetchServices]);

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatUptime = (seconds) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'running': return 'success';
      case 'stopped': return 'error';
      case 'failed': return 'error';
      default: return 'warning';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'running': return <CheckCircle color="success" />;
      case 'stopped': return <Error color="error" />;
      case 'failed': return <Error color="error" />;
      default: return <Info color="warning" />;
    }
  };

  if (!systemStats) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Loading system information...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">
          System Dashboard
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Chip
            label={`Uptime: ${formatUptime(systemStats.uptime)}`}
            color="primary"
            variant="outlined"
          />
          <IconButton onClick={() => { fetchSystemStats(); fetchServices(); }} disabled={loading}>
            <Refresh />
          </IconButton>
        </Box>
      </Box>

      {/* Alerts Section */}
      {alerts.length > 0 && (
        <Box sx={{ mb: 3 }}>
          {alerts.map((alert, index) => (
            <Alert
              key={index}
              severity={alert.type}
              sx={{ mb: 1 }}
              icon={alert.icon}
            >
              {alert.message}
            </Alert>
          ))}
        </Box>
      )}

      <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)} sx={{ mb: 3 }}>
        <Tab label="Overview" />
        <Tab label="Performance" />
        <Tab label="Services" />
        <Tab label="Storage" />
      </Tabs>

      {activeTab === 0 && (
        <Grid container spacing={3}>
          {/* CPU Usage */}
          <Grid item xs={12} md={6} lg={3}>
            <Card elevation={3}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Cpu color="primary" sx={{ mr: 1 }} />
                  <Typography variant="h6">CPU Usage</Typography>
                </Box>
                <Typography variant="h4" color="primary" fontWeight="bold">
                  {systemStats.cpu.usage}%
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={systemStats.cpu.usage}
                  sx={{ mt: 1, height: 8, borderRadius: 4 }}
                  color={systemStats.cpu.usage > 80 ? "error" : "primary"}
                />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  {systemStats.cpu.count} cores • {systemStats.cpu.loadAvg[0]} load avg
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Memory Usage */}
          <Grid item xs={12} md={6} lg={3}>
            <Card elevation={3}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Memory color="secondary" sx={{ mr: 1 }} />
                  <Typography variant="h6">Memory</Typography>
                </Box>
                <Typography variant="h4" color="secondary" fontWeight="bold">
                  {systemStats.memory.usedPercent}%
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={systemStats.memory.usedPercent}
                  sx={{ mt: 1, height: 8, borderRadius: 4 }}
                  color={systemStats.memory.usedPercent > 80 ? "error" : "secondary"}
                />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  {formatBytes(systemStats.memory.used)} / {formatBytes(systemStats.memory.total)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Disk Usage */}
          <Grid item xs={12} md={6} lg={3}>
            <Card elevation={3}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Storage color="warning" sx={{ mr: 1 }} />
                  <Typography variant="h6">Storage</Typography>
                </Box>
                <Typography variant="h4" color="warning" fontWeight="bold">
                  {systemStats.disk.usedPercent}%
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={systemStats.disk.usedPercent}
                  sx={{ mt: 1, height: 8, borderRadius: 4 }}
                  color={systemStats.disk.usedPercent > 85 ? "error" : "warning"}
                />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  {formatBytes(systemStats.disk.used)} / {formatBytes(systemStats.disk.total)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Network */}
          <Grid item xs={12} md={6} lg={3}>
            <Card elevation={3}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Network color="info" sx={{ mr: 1 }} />
                  <Typography variant="h6">Network</Typography>
                </Box>
                <Typography variant="h4" color="info" fontWeight="bold">
                  {systemStats.network ? `${systemStats.network.rx_sec} KB/s` : 'N/A'}
                </Typography>
                <Box sx={{ mt: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    RX: {systemStats.network ? formatBytes(systemStats.network.rx_bytes) : 'N/A'}
                  </Typography>
                  <br />
                  <Typography variant="caption" color="text.secondary">
                    TX: {systemStats.network ? formatBytes(systemStats.network.tx_bytes) : 'N/A'}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* System Information */}
          <Grid item xs={12} md={6}>
            <Card elevation={3}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                  <Server sx={{ mr: 1 }} />
                  System Information
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">OS</Typography>
                    <Typography variant="body1">{systemStats.os.platform} {systemStats.os.release}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">Hostname</Typography>
                    <Typography variant="body1">{systemStats.os.hostname}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">Architecture</Typography>
                    <Typography variant="body1">{systemStats.os.arch}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">Node Version</Typography>
                    <Typography variant="body1">{systemStats.node.version}</Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Top Processes */}
          <Grid item xs={12} md={6}>
            <Card elevation={3}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                  <Activity sx={{ mr: 1 }} />
                  Top Processes
                </Typography>
                <List dense>
                  {systemStats.processes.slice(0, 5).map((process, index) => (
                    <ListItem key={index} sx={{ px: 0 }}>
                      <ListItemText
                        primary={`${process.name} (${process.pid})`}
                        secondary={`${process.cpu}% CPU • ${formatBytes(process.memory)} RAM`}
                      />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {activeTab === 1 && historicalData.length > 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card elevation={3}>
              <CardContent>
                <Typography variant="h6" gutterBottom>Performance History</Typography>
                <Box sx={{ width: '100%', height: 300 }}>
                  <ResponsiveContainer>
                    <LineChart data={historicalData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" />
                      <YAxis />
                      <RechartsTooltip />
                      <Line type="monotone" dataKey="cpu" stroke="#2196f3" strokeWidth={2} name="CPU %" />
                      <Line type="monotone" dataKey="memory" stroke="#ff4081" strokeWidth={2} name="Memory %" />
                      <Line type="monotone" dataKey="disk" stroke="#ff9800" strokeWidth={2} name="Disk %" />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {activeTab === 2 && (
        <Card elevation={3}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
              <Settings sx={{ mr: 1 }} />
              Service Management
            </Typography>
            <List>
              {services.map((service) => (
                <ListItem key={service.name} divider>
                  <ListItemIcon>
                    {getStatusIcon(service.status)}
                  </ListItemIcon>
                  <ListItemText
                    primary={service.name}
                    secondary={service.description}
                  />
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Chip
                      label={service.status}
                      color={getStatusColor(service.status)}
                      size="small"
                    />
                    {service.status === 'running' ? (
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Tooltip title="Restart">
                          <IconButton
                            size="small"
                            onClick={() => handleServiceAction(service.name, 'restart')}
                          >
                            <Refresh />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Stop">
                          <IconButton
                            size="small"
                            onClick={() => handleServiceAction(service.name, 'stop')}
                            color="error"
                          >
                            <Stop />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    ) : (
                      <Tooltip title="Start">
                        <IconButton
                          size="small"
                          onClick={() => handleServiceAction(service.name, 'start')}
                          color="success"
                        >
                          <PlayArrow />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      )}

      {activeTab === 3 && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card elevation={3}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                  <HardDrive sx={{ mr: 1 }} />
                  Disk Usage Details
                </Typography>
                {systemStats.disk.mounts.map((mount, index) => (
                  <Box key={index} sx={{ mb: 2 }}>
                    <Typography variant="subtitle1">{mount.mount}</Typography>
                    <LinearProgress
                      variant="determinate"
                      value={mount.use}
                      sx={{ height: 10, borderRadius: 5, mb: 1 }}
                      color={mount.use > 85 ? "error" : "primary"}
                    />
                    <Typography variant="body2" color="text.secondary">
                      {formatBytes(mount.used)} / {formatBytes(mount.size)} ({mount.use}%)
                    </Typography>
                  </Box>
                ))}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </Box>
  );
};

export default SystemDashboard;
