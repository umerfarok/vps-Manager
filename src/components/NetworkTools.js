import React, { useState, useCallback } from 'react';
import {
  Box, Paper, Typography, Grid, Card, CardContent, TextField,
  Button, Tabs, Tab, List, ListItem, ListItemText, ListItemIcon,
  Chip, CircularProgress, Alert, Divider, IconButton, Tooltip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow
} from '@mui/material';
import {
  Wifi, Router, Dns, Search, PlayArrow, Stop, Refresh,
  CheckCircle, Error, Warning, Info, NetworkCheck,
  Speed, Timer, Globe, Server, Settings
} from '@mui/icons-material';
import { useConnectionStatus } from '../useConnectionStatus';
import axios from 'axios';
import { useUser } from '../UserContext';

const NetworkTools = () => {
  const { userId } = useUser();
  const { requireConnection } = useConnectionStatus();
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [target, setTarget] = useState('');
  const [port, setPort] = useState('80');
  const [pingResults, setPingResults] = useState([]);
  const [tracerouteResults, setTracerouteResults] = useState([]);
  const [dnsResults, setDnsResults] = useState(null);
  const [portScanResults, setPortScanResults] = useState([]);

  const executePing = async () => {
    if (!target) return;

    try {
      setLoading(true);
      await requireConnection();

      const response = await axios.post('/api/network/ping', {
        target,
        count: 4
      }, {
        headers: { 'x-user-id': userId }
      });

      setPingResults(response.data.results);
      setResults({ type: 'ping', data: response.data });
    } catch (error) {
      console.error('Ping failed:', error);
      setResults({ type: 'error', message: error.message });
    } finally {
      setLoading(false);
    }
  };

  const executeTraceroute = async () => {
    if (!target) return;

    try {
      setLoading(true);
      await requireConnection();

      const response = await axios.post('/api/network/traceroute', {
        target
      }, {
        headers: { 'x-user-id': userId }
      });

      setTracerouteResults(response.data.hops);
      setResults({ type: 'traceroute', data: response.data });
    } catch (error) {
      console.error('Traceroute failed:', error);
      setResults({ type: 'error', message: error.message });
    } finally {
      setLoading(false);
    }
  };

  const executeDNSLookup = async () => {
    if (!target) return;

    try {
      setLoading(true);
      await requireConnection();

      const response = await axios.post('/api/network/dns', {
        domain: target,
        type: 'A'
      }, {
        headers: { 'x-user-id': userId }
      });

      setDnsResults(response.data);
      setResults({ type: 'dns', data: response.data });
    } catch (error) {
      console.error('DNS lookup failed:', error);
      setResults({ type: 'error', message: error.message });
    } finally {
      setLoading(false);
    }
  };

  const executePortScan = async () => {
    if (!target) return;

    try {
      setLoading(true);
      await requireConnection();

      const response = await axios.post('/api/network/portscan', {
        target,
        ports: '1-1024'
      }, {
        headers: { 'x-user-id': userId }
      });

      setPortScanResults(response.data.ports);
      setResults({ type: 'portscan', data: response.data });
    } catch (error) {
      console.error('Port scan failed:', error);
      setResults({ type: 'error', message: error.message });
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    if (!target || !port) return;

    try {
      setLoading(true);
      await requireConnection();

      const response = await axios.post('/api/network/test-connection', {
        host: target,
        port: parseInt(port)
      }, {
        headers: { 'x-user-id': userId }
      });

      setResults({
        type: 'connection_test',
        data: response.data,
        success: response.data.success
      });
    } catch (error) {
      console.error('Connection test failed:', error);
      setResults({ type: 'error', message: error.message });
    } finally {
      setLoading(false);
    }
  };

  const getNetworkInfo = async () => {
    try {
      setLoading(true);
      await requireConnection();

      const response = await axios.get('/api/network/info', {
        headers: { 'x-user-id': userId }
      });

      setResults({ type: 'network_info', data: response.data });
    } catch (error) {
      console.error('Failed to get network info:', error);
      setResults({ type: 'error', message: error.message });
    } finally {
      setLoading(false);
    }
  };

  const clearResults = () => {
    setResults(null);
    setPingResults([]);
    setTracerouteResults([]);
    setDnsResults(null);
    setPortScanResults([]);
  };

  const renderPingResults = () => (
    <Box>
      <Typography variant="h6" gutterBottom>Ping Results</Typography>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Seq</TableCell>
              <TableCell>Time (ms)</TableCell>
              <TableCell>TTL</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {pingResults.map((result, index) => (
              <TableRow key={index}>
                <TableCell>{result.seq}</TableCell>
                <TableCell>{result.time || 'N/A'}</TableCell>
                <TableCell>{result.ttl || 'N/A'}</TableCell>
                <TableCell>
                  <Chip
                    label={result.success ? 'Success' : 'Failed'}
                    color={result.success ? 'success' : 'error'}
                    size="small"
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {pingResults.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2">
            Packets sent: {pingResults.length}, Received: {pingResults.filter(r => r.success).length},
            Lost: {pingResults.filter(r => !r.success).length} ({((pingResults.filter(r => !r.success).length / pingResults.length) * 100).toFixed(1)}%)
          </Typography>
        </Box>
      )}
    </Box>
  );

  const renderTracerouteResults = () => (
    <Box>
      <Typography variant="h6" gutterBottom>Traceroute Results</Typography>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Hop</TableCell>
              <TableCell>IP Address</TableCell>
              <TableCell>Hostname</TableCell>
              <TableCell>Time (ms)</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {tracerouteResults.map((hop, index) => (
              <TableRow key={index}>
                <TableCell>{hop.hop}</TableCell>
                <TableCell>{hop.ip || 'N/A'}</TableCell>
                <TableCell>{hop.hostname || 'N/A'}</TableCell>
                <TableCell>{hop.rtt || 'N/A'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );

  const renderDNSResults = () => (
    <Box>
      <Typography variant="h6" gutterBottom>DNS Lookup Results</Typography>
      {dnsResults && (
        <Box>
          <Typography variant="subtitle1" gutterBottom>
            Domain: {dnsResults.domain}
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Query Type: {dnsResults.type}
          </Typography>

          {dnsResults.records && dnsResults.records.length > 0 ? (
            <TableContainer component={Paper} variant="outlined" sx={{ mt: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Type</TableCell>
                    <TableCell>Value</TableCell>
                    <TableCell>TTL</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {dnsResults.records.map((record, index) => (
                    <TableRow key={index}>
                      <TableCell>{record.type}</TableCell>
                      <TableCell>{record.value}</TableCell>
                      <TableCell>{record.ttl}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Alert severity="warning">No records found for this domain</Alert>
          )}
        </Box>
      )}
    </Box>
  );

  const renderPortScanResults = () => (
    <Box>
      <Typography variant="h6" gutterBottom>Port Scan Results</Typography>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Port</TableCell>
              <TableCell>Service</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Banner</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {portScanResults.map((port, index) => (
              <TableRow key={index}>
                <TableCell>{port.number}</TableCell>
                <TableCell>{port.service || 'Unknown'}</TableCell>
                <TableCell>
                  <Chip
                    label={port.open ? 'Open' : 'Closed'}
                    color={port.open ? 'success' : 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell>{port.banner || 'N/A'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );

  const renderNetworkInfo = () => (
    <Box>
      <Typography variant="h6" gutterBottom>Network Information</Typography>
      {results?.data && (
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" gutterBottom>Local Network</Typography>
                <Typography variant="body2">IP Address: {results.data.local?.ip || 'N/A'}</Typography>
                <Typography variant="body2">Subnet: {results.data.local?.subnet || 'N/A'}</Typography>
                <Typography variant="body2">Gateway: {results.data.local?.gateway || 'N/A'}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" gutterBottom>Public Network</Typography>
                <Typography variant="body2">Public IP: {results.data.public?.ip || 'N/A'}</Typography>
                <Typography variant="body2">ISP: {results.data.public?.isp || 'N/A'}</Typography>
                <Typography variant="body2">Location: {results.data.public?.location || 'N/A'}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" gutterBottom>DNS Servers</Typography>
                <List dense>
                  {results.data.dns?.map((server, index) => (
                    <ListItem key={index}>
                      <ListItemText primary={server} />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </Box>
  );

  return (
    <Box sx={{ width: '100%', p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">
          Network Diagnostic Tools
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={clearResults}
            disabled={!results}
          >
            Clear Results
          </Button>
          <Button
            variant="outlined"
            startIcon={<NetworkCheck />}
            onClick={getNetworkInfo}
            disabled={loading}
          >
            Network Info
          </Button>
        </Box>
      </Box>

      {/* Input Section */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Target (IP or Hostname)"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="e.g., google.com or 192.168.1.1"
            />
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField
              fullWidth
              label="Port (optional)"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              placeholder="80"
            />
          </Grid>
          <Grid item xs={12} sm={3}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="contained"
                startIcon={loading ? <CircularProgress size={16} /> : <PlayArrow />}
                onClick={testConnection}
                disabled={!target || loading}
              >
                Test Connection
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)} sx={{ mb: 3 }}>
        <Tab label="Quick Tests" />
        <Tab label="Advanced Tools" />
        <Tab label="Results" />
      </Tabs>

      {activeTab === 0 && (
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <Card elevation={2}>
              <CardContent sx={{ textAlign: 'center' }}>
                <Wifi sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
                <Typography variant="h6" gutterBottom>Ping Test</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Test connectivity and latency
                </Typography>
                <Button
                  fullWidth
                  variant="contained"
                  onClick={executePing}
                  disabled={!target || loading}
                  startIcon={loading ? <CircularProgress size={16} /> : <PlayArrow />}
                >
                  Ping
                </Button>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card elevation={2}>
              <CardContent sx={{ textAlign: 'center' }}>
                <Router sx={{ fontSize: 48, color: 'secondary.main', mb: 2 }} />
                <Typography variant="h6" gutterBottom>Traceroute</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Trace network path to target
                </Typography>
                <Button
                  fullWidth
                  variant="contained"
                  onClick={executeTraceroute}
                  disabled={!target || loading}
                  startIcon={loading ? <CircularProgress size={16} /> : <PlayArrow />}
                >
                  Trace
                </Button>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card elevation={2}>
              <CardContent sx={{ textAlign: 'center' }}>
                <Dns sx={{ fontSize: 48, color: 'success.main', mb: 2 }} />
                <Typography variant="h6" gutterBottom>DNS Lookup</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Resolve domain names
                </Typography>
                <Button
                  fullWidth
                  variant="contained"
                  onClick={executeDNSLookup}
                  disabled={!target || loading}
                  startIcon={loading ? <CircularProgress size={16} /> : <PlayArrow />}
                >
                  Lookup
                </Button>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card elevation={2}>
              <CardContent sx={{ textAlign: 'center' }}>
                <Search sx={{ fontSize: 48, color: 'warning.main', mb: 2 }} />
                <Typography variant="h6" gutterBottom>Port Scan</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Scan for open ports
                </Typography>
                <Button
                  fullWidth
                  variant="contained"
                  onClick={executePortScan}
                  disabled={!target || loading}
                  startIcon={loading ? <CircularProgress size={16} /> : <PlayArrow />}
                >
                  Scan
                </Button>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {activeTab === 1 && (
        <Box>
          <Typography variant="h6" gutterBottom>Advanced Network Tools</Typography>
          <Alert severity="info" sx={{ mb: 2 }}>
            Advanced network diagnostic tools for detailed analysis and troubleshooting.
          </Alert>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={4}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6">Speed Test</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Test network bandwidth
                  </Typography>
                  <Button variant="outlined" sx={{ mt: 2 }} disabled>
                    Coming Soon
                  </Button>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6">WHOIS Lookup</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Domain registration info
                  </Typography>
                  <Button variant="outlined" sx={{ mt: 2 }} disabled>
                    Coming Soon
                  </Button>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6">SSL Certificate Check</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Check SSL certificate validity
                  </Typography>
                  <Button variant="outlined" sx={{ mt: 2 }} disabled>
                    Coming Soon
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      )}

      {activeTab === 2 && (
        <Box>
          {results ? (
            <Box>
              {results.type === 'error' && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {results.message}
                </Alert>
              )}

              {results.type === 'connection_test' && (
                <Alert
                  severity={results.success ? 'success' : 'error'}
                  sx={{ mb: 2 }}
                >
                  Connection to {target}:{port} {results.success ? 'successful' : 'failed'}
                  {results.data?.latency && (
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      Latency: {results.data.latency}ms
                    </Typography>
                  )}
                </Alert>
              )}

              {results.type === 'ping' && renderPingResults()}
              {results.type === 'traceroute' && renderTracerouteResults()}
              {results.type === 'dns' && renderDNSResults()}
              {results.type === 'portscan' && renderPortScanResults()}
              {results.type === 'network_info' && renderNetworkInfo()}
            </Box>
          ) : (
            <Box sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              py: 8,
              color: 'text.secondary'
            }}>
              <NetworkCheck sx={{ fontSize: 64, mb: 2 }} />
              <Typography variant="h6" gutterBottom>No Results Yet</Typography>
              <Typography variant="body2">
                Run a network diagnostic test to see results here
              </Typography>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};

export default NetworkTools;
