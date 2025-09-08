import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Paper, Typography, TextField, InputAdornment, IconButton,
  Select, MenuItem, FormControl, InputLabel, Chip, Tabs, Tab,
  Grid, Card, CardContent, Button, Tooltip, Badge, Alert,
  CircularProgress, Autocomplete, Divider
} from '@mui/material';
import {
  Search, FilterList, Download, Clear, Refresh, BugReport,
  Error, Warning, Info, CheckCircle, PlayArrow, Pause,
  FastForward, SkipNext, SkipPrevious, VolumeUp, VolumeOff
} from '@mui/icons-material';
import { useConnectionStatus } from '../useConnectionStatus';
import axios from 'axios';
import { useUser } from '../UserContext';

const LogViewer = () => {
  const { userId } = useUser();
  const { requireConnection } = useConnectionStatus();
  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [availableServices, setAvailableServices] = useState([]);
  const [activeTab, setActiveTab] = useState(0);
  const [isLive, setIsLive] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const [loading, setLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const logsEndRef = useRef(null);
  const [logFiles, setLogFiles] = useState([]);

  const scrollToBottom = () => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const fetchLogFiles = useCallback(async () => {
    try {
      await requireConnection();
      const response = await axios.get('/api/logs/files', {
        headers: { 'x-user-id': userId }
      });
      setLogFiles(response.data.files);
    } catch (error) {
      console.error('Failed to fetch log files:', error);
    }
  }, [userId, requireConnection]);

  const fetchLogs = useCallback(async (file = null) => {
    try {
      await requireConnection();
      setLoading(true);

      const params = { file };
      const response = await axios.get('/api/logs', {
        headers: { 'x-user-id': userId },
        params
      });

      const newLogs = response.data.logs.map((log, index) => ({
        id: `${Date.now()}-${index}`,
        timestamp: log.timestamp,
        level: log.level,
        service: log.service || 'system',
        message: log.message,
        raw: log.raw || log.message
      }));

      setLogs(prev => [...prev, ...newLogs]);

    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setLoading(false);
    }
  }, [userId, requireConnection]);

  const filterLogs = useCallback(() => {
    let filtered = logs;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(log =>
        log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.service.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Level filter
    if (levelFilter !== 'all') {
      filtered = filtered.filter(log => log.level === levelFilter);
    }

    // Service filter
    if (serviceFilter !== 'all') {
      filtered = filtered.filter(log => log.service === serviceFilter);
    }

    setFilteredLogs(filtered);
  }, [logs, searchTerm, levelFilter, serviceFilter]);

  const clearLogs = () => {
    setLogs([]);
    setFilteredLogs([]);
  };

  const downloadLogs = () => {
    const logText = filteredLogs.map(log =>
      `[${log.timestamp}] ${log.level.toUpperCase()} ${log.service}: ${log.message}`
    ).join('\n');

    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getLogLevelColor = (level) => {
    switch (level.toLowerCase()) {
      case 'error': return 'error';
      case 'warn': case 'warning': return 'warning';
      case 'info': return 'info';
      case 'debug': return 'default';
      default: return 'default';
    }
  };

  const getLogLevelIcon = (level) => {
    switch (level.toLowerCase()) {
      case 'error': return <Error fontSize="small" />;
      case 'warn': case 'warning': return <Warning fontSize="small" />;
      case 'info': return <Info fontSize="small" />;
      case 'debug': return <BugReport fontSize="small" />;
      default: return <Info fontSize="small" />;
    }
  };

  const getLogStats = () => {
    const total = logs.length;
    const errors = logs.filter(log => log.level === 'error').length;
    const warnings = logs.filter(log => log.level === 'warn' || log.level === 'warning').length;
    const info = logs.filter(log => log.level === 'info').length;

    return { total, errors, warnings, info };
  };

  useEffect(() => {
    fetchLogFiles();
    fetchLogs();

    if (isLive) {
      const interval = setInterval(() => fetchLogs(), 5000);
      return () => clearInterval(interval);
    }
  }, [fetchLogFiles, fetchLogs, isLive]);

  useEffect(() => {
    filterLogs();
  }, [filterLogs]);

  useEffect(() => {
    scrollToBottom();
  }, [filteredLogs]);

  const stats = getLogStats();

  return (
    <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h4" fontWeight="bold">
            Log Viewer & Analytics
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Chip
              label={isLive ? 'Live' : 'Paused'}
              color={isLive ? 'success' : 'default'}
              size="small"
              icon={isLive ? <PlayArrow /> : <Pause />}
            />
            <IconButton onClick={() => setIsLive(!isLive)} color={isLive ? 'error' : 'success'}>
              {isLive ? <Pause /> : <PlayArrow />}
            </IconButton>
            <IconButton onClick={fetchLogs} disabled={loading}>
              <Refresh />
            </IconButton>
          </Box>
        </Box>

        {/* Stats Cards */}
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={6} sm={3}>
            <Card variant="outlined">
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Typography variant="h6" color="text.secondary">Total Logs</Typography>
                <Typography variant="h4" fontWeight="bold">{stats.total}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Card variant="outlined">
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Typography variant="h6" color="error.main">Errors</Typography>
                <Typography variant="h4" fontWeight="bold" color="error.main">{stats.errors}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Card variant="outlined">
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Typography variant="h6" color="warning.main">Warnings</Typography>
                <Typography variant="h4" fontWeight="bold" color="warning.main">{stats.warnings}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Card variant="outlined">
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Typography variant="h6" color="info.main">Info</Typography>
                <Typography variant="h4" fontWeight="bold" color="info.main">{stats.info}</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
                endAdornment: searchTerm && (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setSearchTerm('')}>
                      <Clear />
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />
          </Grid>
          <Grid item xs={6} md={2}>
            <FormControl fullWidth>
              <InputLabel>Level</InputLabel>
              <Select
                value={levelFilter}
                label="Level"
                onChange={(e) => setLevelFilter(e.target.value)}
              >
                <MenuItem value="all">All Levels</MenuItem>
                <MenuItem value="error">Error</MenuItem>
                <MenuItem value="warn">Warning</MenuItem>
                <MenuItem value="info">Info</MenuItem>
                <MenuItem value="debug">Debug</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} md={3}>
            <FormControl fullWidth>
              <InputLabel>Service</InputLabel>
              <Select
                value={serviceFilter}
                label="Service"
                onChange={(e) => setServiceFilter(e.target.value)}
              >
                <MenuItem value="all">All Services</MenuItem>
                {availableServices.map(service => (
                  <MenuItem key={service} value={service}>{service}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                startIcon={<Download />}
                onClick={downloadLogs}
                disabled={filteredLogs.length === 0}
              >
                Export
              </Button>
              <Button
                variant="outlined"
                color="error"
                startIcon={<Clear />}
                onClick={clearLogs}
              >
                Clear
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Log Files Tabs */}
      <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)} sx={{ mb: 2 }}>
        <Tab label="Live Logs" />
        {logFiles.slice(0, 4).map((file, index) => (
          <Tab key={file} label={file.split('/').pop()} />
        ))}
      </Tabs>

      {/* Logs Display */}
      <Paper sx={{
        flexGrow: 1,
        p: 0,
        display: 'flex',
        flexDirection: 'column',
        maxHeight: 600,
        overflow: 'hidden'
      }}>
        <Box sx={{
          flexGrow: 1,
          overflow: 'auto',
          p: 2,
          fontFamily: 'monospace',
          fontSize: '0.875rem',
          lineHeight: 1.4,
          bgcolor: 'grey.900',
          color: 'grey.100'
        }}>
          {filteredLogs.length === 0 ? (
            <Box sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'grey.500'
            }}>
              <BugReport sx={{ fontSize: 48, mb: 2 }} />
              <Typography>No logs found matching your filters</Typography>
            </Box>
          ) : (
            filteredLogs.map((log) => (
              <Box
                key={log.id}
                sx={{
                  mb: 1,
                  p: 1,
                  borderRadius: 1,
                  cursor: 'pointer',
                  '&:hover': {
                    bgcolor: 'rgba(255, 255, 255, 0.1)'
                  },
                  borderLeft: 4,
                  borderColor: `${getLogLevelColor(log.level)}.main`
                }}
                onClick={() => setSelectedLog(log)}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  {getLogLevelIcon(log.level)}
                  <Chip
                    label={log.level}
                    size="small"
                    color={getLogLevelColor(log.level)}
                    variant="outlined"
                    sx={{ height: 20, fontSize: '0.7rem' }}
                  />
                  <Typography variant="caption" color="grey.400">
                    {new Date(log.timestamp).toLocaleString()}
                  </Typography>
                  <Chip
                    label={log.service}
                    size="small"
                    variant="filled"
                    sx={{
                      height: 20,
                      fontSize: '0.7rem',
                      bgcolor: 'rgba(255, 255, 255, 0.1)'
                    }}
                  />
                </Box>
                <Typography
                  sx={{
                    fontFamily: 'monospace',
                    fontSize: '0.8rem',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}
                >
                  {log.message}
                </Typography>
              </Box>
            ))
          )}
          <div ref={logsEndRef} />
        </Box>

        {loading && (
          <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={16} />
            <Typography variant="body2">Loading logs...</Typography>
          </Box>
        )}
      </Paper>

      {/* Log Detail Modal */}
      {selectedLog && (
        <Paper sx={{
          position: 'fixed',
          bottom: 20,
          right: 20,
          width: 400,
          maxHeight: 300,
          p: 2,
          zIndex: 1000,
          overflow: 'auto'
        }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Log Details</Typography>
            <IconButton size="small" onClick={() => setSelectedLog(null)}>
              <Clear />
            </IconButton>
          </Box>
          <Divider sx={{ mb: 2 }} />
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Timestamp: {new Date(selectedLog.timestamp).toLocaleString()}
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Level: {selectedLog.level}
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Service: {selectedLog.service}
          </Typography>
          <Typography variant="body2" sx={{ mt: 2, fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
            {selectedLog.raw}
          </Typography>
        </Paper>
      )}
    </Box>
  );
};

export default LogViewer;
