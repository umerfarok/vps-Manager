import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Paper, Typography, Grid, Card, CardContent, CardActions,
  Button, Dialog, DialogTitle, DialogContent, DialogActions,
  List, ListItem, ListItemText, ListItemSecondaryAction, IconButton,
  Tooltip, Chip, Tabs, Tab, TextField, FormControl, InputLabel,
  Select, MenuItem, Alert, CircularProgress, LinearProgress,
  Switch, FormControlLabel, Divider, Badge
} from '@mui/material';
import {
  Backup, Restore, Schedule, History, Download, Delete,
  PlayArrow, Stop, Settings, Folder, Database, Storage,
  CloudUpload, CloudDownload, Timer, CheckCircle, Error,
  Warning, Info, Add, Edit, Save
} from '@mui/icons-material';
import { useConnectionStatus } from '../useConnectionStatus';
import axios from 'axios';
import { useUser } from '../UserContext';

const BackupManager = () => {
  const { userId } = useUser();
  const { requireConnection } = useConnectionStatus();
  const [backups, setBackups] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [backupProgress, setBackupProgress] = useState(null);
  const [restoreProgress, setRestoreProgress] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState(null);
  const [backupForm, setBackupForm] = useState({
    name: '',
    type: 'full',
    paths: ['/home', '/etc', '/var/www'],
    includeDatabases: true,
    compression: 'gzip',
    retention: 30
  });
  const [scheduleForm, setScheduleForm] = useState({
    name: '',
    type: 'daily',
    time: '02:00',
    enabled: true,
    backupType: 'full',
    retention: 30
  });

  const fetchBackups = useCallback(async () => {
    try {
      await requireConnection();
      setLoading(true);

      const response = await axios.get('/api/backups', {
        headers: { 'x-user-id': userId }
      });

      setBackups(response.data.backups);
    } catch (error) {
      console.error('Failed to fetch backups:', error);
    } finally {
      setLoading(false);
    }
  }, [userId, requireConnection]);

  const fetchSchedules = useCallback(async () => {
    try {
      await requireConnection();

      const response = await axios.get('/api/backups/schedules', {
        headers: { 'x-user-id': userId }
      });

      setSchedules(response.data.schedules);
    } catch (error) {
      console.error('Failed to fetch schedules:', error);
    }
  }, [userId, requireConnection]);

  const createBackup = async () => {
    try {
      setBackupProgress({ status: 'starting', progress: 0 });
      await requireConnection();

      const response = await axios.post('/api/backups/create', backupForm, {
        headers: { 'x-user-id': userId }
      });

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setBackupProgress(prev => {
          if (prev.progress >= 100) {
            clearInterval(progressInterval);
            return { status: 'completed', progress: 100 };
          }
          return { ...prev, progress: prev.progress + 10 };
        });
      }, 1000);

      // Refresh backups after completion
      setTimeout(() => {
        fetchBackups();
        setBackupProgress(null);
        setDialogOpen(false);
      }, 10000);

    } catch (error) {
      console.error('Failed to create backup:', error);
      setBackupProgress({ status: 'error', progress: 0, error: error.message });
    }
  };

  const restoreBackup = async (backupId) => {
    try {
      setRestoreProgress({ status: 'starting', progress: 0 });
      await requireConnection();

      await axios.post(`/api/backups/${backupId}/restore`, {}, {
        headers: { 'x-user-id': userId }
      });

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setRestoreProgress(prev => {
          if (prev.progress >= 100) {
            clearInterval(progressInterval);
            return { status: 'completed', progress: 100 };
          }
          return { ...prev, progress: prev.progress + 5 };
        });
      }, 2000);

      setTimeout(() => {
        setRestoreProgress(null);
      }, 20000);

    } catch (error) {
      console.error('Failed to restore backup:', error);
      setRestoreProgress({ status: 'error', progress: 0, error: error.message });
    }
  };

  const deleteBackup = async (backupId) => {
    try {
      await requireConnection();

      await axios.delete(`/api/backups/${backupId}`, {
        headers: { 'x-user-id': userId }
      });

      await fetchBackups();
    } catch (error) {
      console.error('Failed to delete backup:', error);
    }
  };

  const downloadBackup = async (backupId) => {
    try {
      await requireConnection();

      const response = await axios.get(`/api/backups/${backupId}/download`, {
        headers: { 'x-user-id': userId },
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `backup_${backupId}.tar.gz`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download backup:', error);
    }
  };

  const createSchedule = async () => {
    try {
      await requireConnection();

      await axios.post('/api/backups/schedules', scheduleForm, {
        headers: { 'x-user-id': userId }
      });

      await fetchSchedules();
      setScheduleDialogOpen(false);
    } catch (error) {
      console.error('Failed to create schedule:', error);
    }
  };

  const toggleSchedule = async (scheduleId, enabled) => {
    try {
      await requireConnection();

      await axios.patch(`/api/backups/schedules/${scheduleId}`, {
        enabled
      }, {
        headers: { 'x-user-id': userId }
      });

      await fetchSchedules();
    } catch (error) {
      console.error('Failed to toggle schedule:', error);
    }
  };

  const deleteSchedule = async (scheduleId) => {
    try {
      await requireConnection();

      await axios.delete(`/api/backups/schedules/${scheduleId}`, {
        headers: { 'x-user-id': userId }
      });

      await fetchSchedules();
    } catch (error) {
      console.error('Failed to delete schedule:', error);
    }
  };

  const formatSize = (bytes) => {
    if (!bytes) return 'Unknown';
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return <CheckCircle color="success" />;
      case 'running': return <PlayArrow color="primary" />;
      case 'failed': return <Error color="error" />;
      case 'pending': return <Info color="warning" />;
      default: return <Info color="default" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'success';
      case 'running': return 'primary';
      case 'failed': return 'error';
      case 'pending': return 'warning';
      default: return 'default';
    }
  };

  useEffect(() => {
    fetchBackups();
    fetchSchedules();
  }, [fetchBackups, fetchSchedules]);

  return (
    <Box sx={{ width: '100%', p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">
          Backup & Restore Manager
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setDialogOpen(true)}
          >
            Create Backup
          </Button>
          <Button
            variant="outlined"
            startIcon={<Schedule />}
            onClick={() => setScheduleDialogOpen(true)}
          >
            Schedule Backup
          </Button>
        </Box>
      </Box>

      {/* Progress Indicators */}
      {backupProgress && (
        <Alert severity={backupProgress.status === 'error' ? 'error' : 'info'} sx={{ mb: 2 }}>
          <Typography variant="body2">
            Creating backup: {backupProgress.progress}%
          </Typography>
          <LinearProgress variant="determinate" value={backupProgress.progress} sx={{ mt: 1 }} />
          {backupProgress.error && (
            <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
              Error: {backupProgress.error}
            </Typography>
          )}
        </Alert>
      )}

      {restoreProgress && (
        <Alert severity={restoreProgress.status === 'error' ? 'error' : 'info'} sx={{ mb: 2 }}>
          <Typography variant="body2">
            Restoring backup: {restoreProgress.progress}%
          </Typography>
          <LinearProgress variant="determinate" value={restoreProgress.progress} sx={{ mt: 1 }} />
          {restoreProgress.error && (
            <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
              Error: {restoreProgress.error}
            </Typography>
          )}
        </Alert>
      )}

      <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)} sx={{ mb: 3 }}>
        <Tab label="Backups" />
        <Tab label="Schedules" />
        <Tab label="Settings" />
      </Tabs>

      {activeTab === 0 && (
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>
              Backup History ({backups.length})
            </Typography>
          </Grid>
          {backups.map((backup) => (
            <Grid item xs={12} sm={6} md={4} key={backup.id}>
              <Card elevation={2}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Backup sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="h6" noWrap>
                      {backup.name}
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Created: {new Date(backup.createdAt).toLocaleString()}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
                    <Chip label={backup.type} size="small" variant="outlined" />
                    <Chip label={formatSize(backup.size)} size="small" variant="outlined" />
                    <Chip
                      label={backup.status}
                      size="small"
                      color={getStatusColor(backup.status)}
                    />
                  </Box>
                  {backup.description && (
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      {backup.description}
                    </Typography>
                  )}
                </CardContent>
                <CardActions>
                  <Tooltip title="Download">
                    <IconButton
                      size="small"
                      onClick={() => downloadBackup(backup.id)}
                      disabled={backup.status !== 'completed'}
                    >
                      <Download />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Restore">
                    <IconButton
                      size="small"
                      color="warning"
                      onClick={() => restoreBackup(backup.id)}
                      disabled={backup.status !== 'completed'}
                    >
                      <Restore />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => deleteBackup(backup.id)}
                    >
                      <Delete />
                    </IconButton>
                  </Tooltip>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {activeTab === 1 && (
        <Box>
          <Typography variant="h6" gutterBottom>
            Backup Schedules
          </Typography>
          <List>
            {schedules.map((schedule) => (
              <ListItem key={schedule.id} divider>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Schedule />
                      <Typography variant="subtitle1">{schedule.name}</Typography>
                      <Chip
                        label={schedule.enabled ? 'Active' : 'Disabled'}
                        color={schedule.enabled ? 'success' : 'default'}
                        size="small"
                      />
                    </Box>
                  }
                  secondary={
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        {schedule.type} at {schedule.time} • {schedule.backupType} backup
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Retention: {schedule.retention} days • Next run: {schedule.nextRun}
                      </Typography>
                    </Box>
                  }
                />
                <ListItemSecondaryAction>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={schedule.enabled}
                        onChange={(e) => toggleSchedule(schedule.id, e.target.checked)}
                        color="primary"
                      />
                    }
                    label=""
                  />
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => deleteSchedule(schedule.id)}
                  >
                    <Delete />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </Box>
      )}

      {activeTab === 2 && (
        <Box>
          <Typography variant="h6" gutterBottom>
            Backup Settings
          </Typography>
          <Alert severity="info" sx={{ mb: 2 }}>
            Configure global backup settings and storage locations.
          </Alert>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Default Backup Location"
                defaultValue="/var/backups"
                helperText="Directory where backups are stored"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Compression Method</InputLabel>
                <Select defaultValue="gzip">
                  <MenuItem value="gzip">GZIP</MenuItem>
                  <MenuItem value="bzip2">BZIP2</MenuItem>
                  <MenuItem value="xz">XZ</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Default Retention (days)"
                type="number"
                defaultValue={30}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Max Backup Size (GB)"
                type="number"
                defaultValue={100}
              />
            </Grid>
          </Grid>
        </Box>
      )}

      {/* Create Backup Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create New Backup</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Backup Name"
                value={backupForm.name}
                onChange={(e) => setBackupForm({ ...backupForm, name: e.target.value })}
                placeholder="e.g., Daily Backup 2024-01-15"
              />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Backup Type</InputLabel>
                <Select
                  value={backupForm.type}
                  label="Backup Type"
                  onChange={(e) => setBackupForm({ ...backupForm, type: e.target.value })}
                >
                  <MenuItem value="full">Full System</MenuItem>
                  <MenuItem value="incremental">Incremental</MenuItem>
                  <MenuItem value="database">Database Only</MenuItem>
                  <MenuItem value="files">Files Only</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Compression</InputLabel>
                <Select
                  value={backupForm.compression}
                  label="Compression"
                  onChange={(e) => setBackupForm({ ...backupForm, compression: e.target.value })}
                >
                  <MenuItem value="gzip">GZIP (Fast)</MenuItem>
                  <MenuItem value="bzip2">BZIP2 (Better compression)</MenuItem>
                  <MenuItem value="xz">XZ (Best compression)</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Paths to Backup"
                multiline
                rows={3}
                value={backupForm.paths.join('\n')}
                onChange={(e) => setBackupForm({
                  ...backupForm,
                  paths: e.target.value.split('\n').filter(p => p.trim())
                })}
                helperText="One path per line"
              />
            </Grid>
            <Grid item xs={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={backupForm.includeDatabases}
                    onChange={(e) => setBackupForm({ ...backupForm, includeDatabases: e.target.checked })}
                  />
                }
                label="Include Databases"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Retention (days)"
                type="number"
                value={backupForm.retention}
                onChange={(e) => setBackupForm({ ...backupForm, retention: parseInt(e.target.value) || 30 })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={createBackup}
            variant="contained"
            disabled={!backupForm.name || backupForm.paths.length === 0}
          >
            Start Backup
          </Button>
        </DialogActions>
      </Dialog>

      {/* Schedule Backup Dialog */}
      <Dialog open={scheduleDialogOpen} onClose={() => setScheduleDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Schedule Automatic Backup</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Schedule Name"
                value={scheduleForm.name}
                onChange={(e) => setScheduleForm({ ...scheduleForm, name: e.target.value })}
              />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Frequency</InputLabel>
                <Select
                  value={scheduleForm.type}
                  label="Frequency"
                  onChange={(e) => setScheduleForm({ ...scheduleForm, type: e.target.value })}
                >
                  <MenuItem value="hourly">Hourly</MenuItem>
                  <MenuItem value="daily">Daily</MenuItem>
                  <MenuItem value="weekly">Weekly</MenuItem>
                  <MenuItem value="monthly">Monthly</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Time"
                type="time"
                value={scheduleForm.time}
                onChange={(e) => setScheduleForm({ ...scheduleForm, time: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Backup Type</InputLabel>
                <Select
                  value={scheduleForm.backupType}
                  label="Backup Type"
                  onChange={(e) => setScheduleForm({ ...scheduleForm, backupType: e.target.value })}
                >
                  <MenuItem value="full">Full</MenuItem>
                  <MenuItem value="incremental">Incremental</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Retention (days)"
                type="number"
                value={scheduleForm.retention}
                onChange={(e) => setScheduleForm({ ...scheduleForm, retention: parseInt(e.target.value) || 30 })}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={scheduleForm.enabled}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, enabled: e.target.checked })}
                  />
                }
                label="Enable Schedule"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setScheduleDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={createSchedule}
            variant="contained"
            disabled={!scheduleForm.name}
          >
            Create Schedule
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BackupManager;
