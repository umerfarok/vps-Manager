import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Paper, Typography, Grid, Card, CardContent, CardActions,
  Button, Chip, Alert, List, ListItem, ListItemText, ListItemIcon,
  LinearProgress, Tabs, Tab, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, IconButton, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  FormControl, InputLabel, Select, MenuItem, Badge
} from '@mui/material';
import {
  Security, Shield, Lock, Warning, Error, CheckCircle,
  Firewall, VpnLock, BugReport, NetworkCheck, Key,
  Refresh, Settings, Block, VerifiedUser, GppGood,
  GppBad, SecurityUpdate, ReportProblem
} from '@mui/icons-material';
import { useConnectionStatus } from '../useConnectionStatus';
import axios from 'axios';
import { useUser } from '../UserContext';

const SecurityDashboard = () => {
  const { userId } = useUser();
  const { requireConnection } = useConnectionStatus();
  const [securityStatus, setSecurityStatus] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [firewallRules, setFirewallRules] = useState([]);
  const [sslCertificates, setSslCertificates] = useState([]);
  const [securityLogs, setSecurityLogs] = useState([]);
  const [scanResults, setScanResults] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [ruleForm, setRuleForm] = useState({
    action: 'allow',
    protocol: 'tcp',
    port: '',
    source: '',
    description: ''
  });

  const fetchSecurityStatus = useCallback(async () => {
    try {
      await requireConnection();
      setLoading(true);

      const response = await axios.get('/api/security/status', {
        headers: { 'x-user-id': userId }
      });

      setSecurityStatus(response.data);

      // Generate security alerts
      const newAlerts = [];
      if (response.data.firewall?.status === 'disabled') {
        newAlerts.push({
          severity: 'error',
          title: 'Firewall Disabled',
          message: 'Firewall is not active - system is vulnerable',
          icon: <Firewall />
        });
      }
      if (response.data.updates?.security > 0) {
        newAlerts.push({
          severity: 'warning',
          title: 'Security Updates Available',
          message: `${response.data.updates.security} security updates pending`,
          icon: <SecurityUpdate />
        });
      }
      if (response.data.ssl?.expiring?.length > 0) {
        newAlerts.push({
          severity: 'warning',
          title: 'SSL Certificates Expiring',
          message: `${response.data.ssl.expiring.length} certificates expiring soon`,
          icon: <Lock />
        });
      }

      setAlerts(newAlerts);
    } catch (error) {
      console.error('Failed to fetch security status:', error);
    } finally {
      setLoading(false);
    }
  }, [userId, requireConnection]);

  const fetchFirewallRules = useCallback(async () => {
    try {
      await requireConnection();
      const response = await axios.get('/api/security/firewall/rules', {
        headers: { 'x-user-id': userId }
      });
      setFirewallRules(response.data.rules);
    } catch (error) {
      console.error('Failed to fetch firewall rules:', error);
    }
  }, [userId, requireConnection]);

  const fetchSslCertificates = useCallback(async () => {
    try {
      await requireConnection();
      const response = await axios.get('/api/security/ssl/certificates', {
        headers: { 'x-user-id': userId }
      });
      setSslCertificates(response.data.certificates);
    } catch (error) {
      console.error('Failed to fetch SSL certificates:', error);
    }
  }, [userId, requireConnection]);

  const fetchSecurityLogs = useCallback(async () => {
    try {
      await requireConnection();
      const response = await axios.get('/api/security/logs', {
        headers: { 'x-user-id': userId },
        params: { limit: 100 }
      });
      setSecurityLogs(response.data.logs);
    } catch (error) {
      console.error('Failed to fetch security logs:', error);
    }
  }, [userId, requireConnection]);

  const runSecurityScan = async () => {
    try {
      setLoading(true);
      await requireConnection();

      const response = await axios.post('/api/security/scan', {}, {
        headers: { 'x-user-id': userId }
      });

      setScanResults(response.data);
    } catch (error) {
      console.error('Security scan failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const addFirewallRule = async () => {
    try {
      await requireConnection();

      await axios.post('/api/security/firewall/rules', ruleForm, {
        headers: { 'x-user-id': userId }
      });

      await fetchFirewallRules();
      setDialogOpen(false);
      setRuleForm({
        action: 'allow',
        protocol: 'tcp',
        port: '',
        source: '',
        description: ''
      });
    } catch (error) {
      console.error('Failed to add firewall rule:', error);
    }
  };

  const deleteFirewallRule = async (ruleId) => {
    try {
      await requireConnection();

      await axios.delete(`/api/security/firewall/rules/${ruleId}`, {
        headers: { 'x-user-id': userId }
      });

      await fetchFirewallRules();
    } catch (error) {
      console.error('Failed to delete firewall rule:', error);
    }
  };

  const toggleFirewall = async () => {
    try {
      await requireConnection();

      const newStatus = securityStatus.firewall.status === 'active' ? 'inactive' : 'active';
      await axios.post('/api/security/firewall/toggle', {
        status: newStatus
      }, {
        headers: { 'x-user-id': userId }
      });

      await fetchSecurityStatus();
    } catch (error) {
      console.error('Failed to toggle firewall:', error);
    }
  };

  const getSecurityScore = () => {
    if (!securityStatus) return 0;

    let score = 0;
    if (securityStatus.firewall?.status === 'active') score += 25;
    if (securityStatus.updates?.security === 0) score += 25;
    if (securityStatus.ssl?.valid > 0) score += 25;
    if (securityStatus.antivirus?.status === 'active') score += 25;

    return score;
  };

  const getScoreColor = (score) => {
    if (score >= 75) return 'success';
    if (score >= 50) return 'warning';
    return 'error';
  };

  const getLogLevelIcon = (level) => {
    switch (level.toLowerCase()) {
      case 'error': return <Error color="error" />;
      case 'warning': return <Warning color="warning" />;
      case 'info': return <Info color="info" />;
      default: return <Info color="default" />;
    }
  };

  useEffect(() => {
    fetchSecurityStatus();
    fetchFirewallRules();
    fetchSslCertificates();
    fetchSecurityLogs();
  }, [fetchSecurityStatus, fetchFirewallRules, fetchSslCertificates, fetchSecurityLogs]);

  const securityScore = getSecurityScore();

  return (
    <Box sx={{ width: '100%', p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">
          Security Dashboard
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Chip
            label={`Security Score: ${securityScore}%`}
            color={getScoreColor(securityScore)}
            variant="outlined"
          />
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={fetchSecurityStatus}
            disabled={loading}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<Security />}
            onClick={runSecurityScan}
            disabled={loading}
          >
            Run Security Scan
          </Button>
        </Box>
      </Box>

      {/* Security Alerts */}
      {alerts.length > 0 && (
        <Box sx={{ mb: 3 }}>
          {alerts.map((alert, index) => (
            <Alert
              key={index}
              severity={alert.severity}
              sx={{ mb: 1 }}
              icon={alert.icon}
            >
              <Typography variant="subtitle2">{alert.title}</Typography>
              <Typography variant="body2">{alert.message}</Typography>
            </Alert>
          ))}
        </Box>
      )}

      <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)} sx={{ mb: 3 }}>
        <Tab label="Overview" />
        <Tab label="Firewall" />
        <Tab label="SSL/TLS" />
        <Tab label="Security Logs" />
        <Tab label="Scan Results" />
      </Tabs>

      {activeTab === 0 && (
        <Grid container spacing={3}>
          {/* Firewall Status */}
          <Grid item xs={12} md={6} lg={3}>
            <Card elevation={3}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Firewall color="primary" sx={{ mr: 1 }} />
                  <Typography variant="h6">Firewall</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="h4" color={
                    securityStatus?.firewall?.status === 'active' ? 'success.main' : 'error.main'
                  }>
                    {securityStatus?.firewall?.status === 'active' ? 'Active' : 'Inactive'}
                  </Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={toggleFirewall}
                    disabled={loading}
                  >
                    Toggle
                  </Button>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {securityStatus?.firewall?.rules || 0} rules configured
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Security Updates */}
          <Grid item xs={12} md={6} lg={3}>
            <Card elevation={3}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <SecurityUpdate color="warning" sx={{ mr: 1 }} />
                  <Typography variant="h6">Security Updates</Typography>
                </Box>
                <Typography variant="h4" color={
                  (securityStatus?.updates?.security || 0) === 0 ? 'success.main' : 'warning.main'
                }>
                  {securityStatus?.updates?.security || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Pending security updates
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* SSL Certificates */}
          <Grid item xs={12} md={6} lg={3}>
            <Card elevation={3}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Lock color="success" sx={{ mr: 1 }} />
                  <Typography variant="h6">SSL Certificates</Typography>
                </Box>
                <Typography variant="h4" color="success.main">
                  {securityStatus?.ssl?.valid || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Valid certificates
                </Typography>
                {(securityStatus?.ssl?.expiring?.length || 0) > 0 && (
                  <Typography variant="caption" color="warning.main">
                    {securityStatus.ssl.expiring.length} expiring soon
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Failed Login Attempts */}
          <Grid item xs={12} md={6} lg={3}>
            <Card elevation={3}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <BugReport color="error" sx={{ mr: 1 }} />
                  <Typography variant="h6">Failed Logins</Typography>
                </Box>
                <Typography variant="h4" color="error.main">
                  {securityStatus?.auth?.failedAttempts || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Last 24 hours
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Security Score Breakdown */}
          <Grid item xs={12}>
            <Card elevation={3}>
              <CardContent>
                <Typography variant="h6" gutterBottom>Security Score Breakdown</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6} md={3}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="body2" color="text.secondary">Firewall</Typography>
                      <LinearProgress
                        variant="determinate"
                        value={securityStatus?.firewall?.status === 'active' ? 100 : 0}
                        sx={{ height: 8, borderRadius: 4, mt: 1 }}
                        color={securityStatus?.firewall?.status === 'active' ? 'success' : 'error'}
                      />
                    </Box>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="body2" color="text.secondary">Updates</Typography>
                      <LinearProgress
                        variant="determinate"
                        value={(securityStatus?.updates?.security || 0) === 0 ? 100 : 50}
                        sx={{ height: 8, borderRadius: 4, mt: 1 }}
                        color={(securityStatus?.updates?.security || 0) === 0 ? 'success' : 'warning'}
                      />
                    </Box>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="body2" color="text.secondary">SSL</Typography>
                      <LinearProgress
                        variant="determinate"
                        value={securityStatus?.ssl?.valid > 0 ? 100 : 0}
                        sx={{ height: 8, borderRadius: 4, mt: 1 }}
                        color={securityStatus?.ssl?.valid > 0 ? 'success' : 'error'}
                      />
                    </Box>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="body2" color="text.secondary">Intrusion Detection</Typography>
                      <LinearProgress
                        variant="determinate"
                        value={securityStatus?.ids?.status === 'active' ? 100 : 0}
                        sx={{ height: 8, borderRadius: 4, mt: 1 }}
                        color={securityStatus?.ids?.status === 'active' ? 'success' : 'warning'}
                      />
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {activeTab === 1 && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Firewall Rules ({firewallRules.length})</Typography>
            <Button
              variant="contained"
              startIcon={<Shield />}
              onClick={() => setDialogOpen(true)}
            >
              Add Rule
            </Button>
          </Box>

          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Action</TableCell>
                  <TableCell>Protocol</TableCell>
                  <TableCell>Port</TableCell>
                  <TableCell>Source</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {firewallRules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell>
                      <Chip
                        label={rule.action}
                        color={rule.action === 'allow' ? 'success' : 'error'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{rule.protocol}</TableCell>
                    <TableCell>{rule.port || 'Any'}</TableCell>
                    <TableCell>{rule.source || 'Any'}</TableCell>
                    <TableCell>{rule.description || 'N/A'}</TableCell>
                    <TableCell>
                      <Tooltip title="Delete Rule">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => deleteFirewallRule(rule.id)}
                        >
                          <Block />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {activeTab === 2 && (
        <Box>
          <Typography variant="h6" gutterBottom>
            SSL/TLS Certificates ({sslCertificates.length})
          </Typography>
          <Grid container spacing={2}>
            {sslCertificates.map((cert) => (
              <Grid item xs={12} sm={6} md={4} key={cert.id}>
                <Card variant="outlined">
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <Lock sx={{ mr: 1, color: 'success.main' }} />
                      <Typography variant="h6" noWrap>
                        {cert.domain}
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Issuer: {cert.issuer}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Valid until: {new Date(cert.expiryDate).toLocaleDateString()}
                    </Typography>
                    <Chip
                      label={cert.status}
                      color={cert.status === 'valid' ? 'success' : 'warning'}
                      size="small"
                    />
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {activeTab === 3 && (
        <Box>
          <Typography variant="h6" gutterBottom>
            Security Event Logs
          </Typography>
          <List>
            {securityLogs.slice(0, 50).map((log, index) => (
              <ListItem key={index} divider>
                <ListItemIcon>
                  {getLogLevelIcon(log.level)}
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="subtitle2">{log.event}</Typography>
                      <Chip label={log.level} size="small" color={
                        log.level === 'error' ? 'error' :
                        log.level === 'warning' ? 'warning' : 'info'
                      } />
                    </Box>
                  }
                  secondary={
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        {new Date(log.timestamp).toLocaleString()} • {log.source}
                      </Typography>
                      {log.details && (
                        <Typography variant="body2" color="text.secondary">
                          {log.details}
                        </Typography>
                      )}
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
        </Box>
      )}

      {activeTab === 4 && (
        <Box>
          <Typography variant="h6" gutterBottom>
            Security Scan Results
          </Typography>
          {scanResults ? (
            <Box>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={6} md={3}>
                  <Card variant="outlined">
                    <CardContent sx={{ textAlign: 'center' }}>
                      <Typography variant="h6" color="success.main">
                        {scanResults.vulnerabilities?.low || 0}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Low Risk
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Card variant="outlined">
                    <CardContent sx={{ textAlign: 'center' }}>
                      <Typography variant="h6" color="warning.main">
                        {scanResults.vulnerabilities?.medium || 0}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Medium Risk
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Card variant="outlined">
                    <CardContent sx={{ textAlign: 'center' }}>
                      <Typography variant="h6" color="error.main">
                        {scanResults.vulnerabilities?.high || 0}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        High Risk
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Card variant="outlined">
                    <CardContent sx={{ textAlign: 'center' }}>
                      <Typography variant="h6" color="info.main">
                        {scanResults.vulnerabilities?.critical || 0}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Critical
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              <Typography variant="h6" gutterBottom>Scan Details</Typography>
              <List>
                {scanResults.details?.map((detail, index) => (
                  <ListItem key={index} divider>
                    <ListItemIcon>
                      {detail.severity === 'critical' ? <GppBad color="error" /> :
                       detail.severity === 'high' ? <Warning color="error" /> :
                       detail.severity === 'medium' ? <Warning color="warning" /> :
                       <Info color="info" />}
                    </ListItemIcon>
                    <ListItemText
                      primary={detail.title}
                      secondary={detail.description}
                    />
                    <Chip
                      label={detail.severity}
                      color={
                        detail.severity === 'critical' ? 'error' :
                        detail.severity === 'high' ? 'error' :
                        detail.severity === 'medium' ? 'warning' : 'info'
                      }
                      size="small"
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          ) : (
            <Alert severity="info">
              No security scan results available. Run a security scan to see detailed results.
            </Alert>
          )}
        </Box>
      )}

      {/* Add Firewall Rule Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Firewall Rule</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Action</InputLabel>
                <Select
                  value={ruleForm.action}
                  label="Action"
                  onChange={(e) => setRuleForm({ ...ruleForm, action: e.target.value })}
                >
                  <MenuItem value="allow">Allow</MenuItem>
                  <MenuItem value="deny">Deny</MenuItem>
                  <MenuItem value="reject">Reject</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Protocol</InputLabel>
                <Select
                  value={ruleForm.protocol}
                  label="Protocol"
                  onChange={(e) => setRuleForm({ ...ruleForm, protocol: e.target.value })}
                >
                  <MenuItem value="tcp">TCP</MenuItem>
                  <MenuItem value="udp">UDP</MenuItem>
                  <MenuItem value="icmp">ICMP</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Port"
                value={ruleForm.port}
                onChange={(e) => setRuleForm({ ...ruleForm, port: e.target.value })}
                placeholder="80 or 80,443"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Source IP/Network"
                value={ruleForm.source}
                onChange={(e) => setRuleForm({ ...ruleForm, source: e.target.value })}
                placeholder="192.168.1.0/24 or 0.0.0.0/0"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                value={ruleForm.description}
                onChange={(e) => setRuleForm({ ...ruleForm, description: e.target.value })}
                placeholder="Optional description for this rule"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={addFirewallRule}
            variant="contained"
            disabled={!ruleForm.port && !ruleForm.source}
          >
            Add Rule
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SecurityDashboard;
