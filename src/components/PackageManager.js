import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Paper, Typography, TextField, Button, Grid, Card,
  CardContent, CardActions, Chip, IconButton, Tooltip,
  List, ListItem, ListItemText, ListItemSecondaryAction,
  Dialog, DialogTitle, DialogContent, DialogActions,
  CircularProgress, Alert, Tabs, Tab, Autocomplete,
  InputAdornment, Badge, LinearProgress
} from '@mui/material';
import {
  Search, GetApp, Delete, Refresh, Update, Info,
  CheckCircle, Error, Warning, PlayArrow, Stop,
  Settings, Extension, SystemUpdate, History
} from '@mui/icons-material';
import { useConnectionStatus } from '../useConnectionStatus';
import axios from 'axios';
import { useUser } from '../UserContext';

const PackageManager = () => {
  const { userId } = useUser();
  const { requireConnection } = useConnectionStatus();
  const [packages, setPackages] = useState([]);
  const [installedPackages, setInstalledPackages] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [operationLoading, setOperationLoading] = useState({});
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: '',
    message: '',
    action: null,
    packageName: ''
  });

  const fetchInstalledPackages = useCallback(async () => {
    try {
      await requireConnection();
      setLoading(true);

      const response = await axios.get('/api/packages/installed', {
        headers: { 'x-user-id': userId }
      });

      setInstalledPackages(response.data.packages);
    } catch (error) {
      console.error('Failed to fetch installed packages:', error);
    } finally {
      setLoading(false);
    }
  }, [userId, requireConnection]);

  const searchPackages = useCallback(async () => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setLoading(true);
      await requireConnection();

      const response = await axios.get('/api/packages/search', {
        headers: { 'x-user-id': userId },
        params: { query: searchTerm }
      });

      setSearchResults(response.data.packages);
    } catch (error) {
      console.error('Failed to search packages:', error);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, userId, requireConnection]);

  const installPackage = async (packageName) => {
    try {
      setOperationLoading(prev => ({ ...prev, [packageName]: true }));

      await axios.post('/api/packages/install', {
        packageName
      }, {
        headers: { 'x-user-id': userId }
      });

      // Refresh installed packages
      await fetchInstalledPackages();
      setSearchResults(prev => prev.filter(pkg => pkg.name !== packageName));

    } catch (error) {
      console.error('Failed to install package:', error);
    } finally {
      setOperationLoading(prev => ({ ...prev, [packageName]: false }));
    }
  };

  const removePackage = async (packageName) => {
    try {
      setOperationLoading(prev => ({ ...prev, [packageName]: true }));

      await axios.delete('/api/packages/remove', {
        data: { packageName },
        headers: { 'x-user-id': userId }
      });

      // Refresh installed packages
      await fetchInstalledPackages();

    } catch (error) {
      console.error('Failed to remove package:', error);
    } finally {
      setOperationLoading(prev => ({ ...prev, [packageName]: false }));
    }
  };

  const updatePackage = async (packageName) => {
    try {
      setOperationLoading(prev => ({ ...prev, [packageName]: true }));

      await axios.post('/api/packages/update', {
        packageName
      }, {
        headers: { 'x-user-id': userId }
      });

      // Refresh installed packages
      await fetchInstalledPackages();

    } catch (error) {
      console.error('Failed to update package:', error);
    } finally {
      setOperationLoading(prev => ({ ...prev, [packageName]: false }));
    }
  };

  const updateAllPackages = async () => {
    try {
      setLoading(true);

      await axios.post('/api/packages/update-all', {}, {
        headers: { 'x-user-id': userId }
      });

      // Refresh installed packages
      await fetchInstalledPackages();

    } catch (error) {
      console.error('Failed to update all packages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmAction = (action, packageName, title, message) => {
    setConfirmDialog({
      open: true,
      title,
      message,
      action: () => action(packageName),
      packageName
    });
  };

  const executeConfirmedAction = async () => {
    await confirmDialog.action();
    setConfirmDialog({ ...confirmDialog, open: false });
  };

  useEffect(() => {
    fetchInstalledPackages();
  }, [fetchInstalledPackages]);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (searchTerm) {
        searchPackages();
      }
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [searchTerm, searchPackages]);

  const getPackageStatus = (packageName) => {
    const installed = installedPackages.find(pkg => pkg.name === packageName);
    return installed ? installed : null;
  };

  const formatSize = (bytes) => {
    if (!bytes) return 'Unknown';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <Box sx={{ width: '100%', p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">
          Package Manager
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<SystemUpdate />}
            onClick={updateAllPackages}
            disabled={loading}
          >
            Update All
          </Button>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={fetchInstalledPackages}
            disabled={loading}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)} sx={{ mb: 3 }}>
        <Tab label="Installed Packages" />
        <Tab label="Search & Install" />
        <Tab label="Updates Available" />
      </Tabs>

      {activeTab === 0 && (
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>
              Installed Packages ({installedPackages.length})
            </Typography>
          </Grid>
          {installedPackages.map((pkg) => (
            <Grid item xs={12} sm={6} md={4} key={pkg.name}>
              <Card elevation={2}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Extension sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="h6" noWrap>
                      {pkg.name}
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {pkg.description || 'No description available'}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
                    <Chip label={`v${pkg.version}`} size="small" variant="outlined" />
                    <Chip label={formatSize(pkg.size)} size="small" variant="outlined" />
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    Installed: {new Date(pkg.installDate).toLocaleDateString()}
                  </Typography>
                </CardContent>
                <CardActions>
                  <Tooltip title="Package Info">
                    <IconButton size="small" onClick={() => setSelectedPackage(pkg)}>
                      <Info />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Update Package">
                    <IconButton
                      size="small"
                      color="primary"
                      onClick={() => handleConfirmAction(
                        updatePackage,
                        pkg.name,
                        'Update Package',
                        `Are you sure you want to update ${pkg.name}?`
                      )}
                      disabled={operationLoading[pkg.name]}
                    >
                      {operationLoading[pkg.name] ? <CircularProgress size={16} /> : <Update />}
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Remove Package">
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleConfirmAction(
                        removePackage,
                        pkg.name,
                        'Remove Package',
                        `Are you sure you want to remove ${pkg.name}? This action cannot be undone.`
                      )}
                      disabled={operationLoading[pkg.name]}
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
          <Paper sx={{ p: 2, mb: 3 }}>
            <TextField
              fullWidth
              placeholder="Search for packages to install..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
              }}
            />
          </Paper>

          <Grid container spacing={2}>
            {searchResults.map((pkg) => {
              const installed = getPackageStatus(pkg.name);
              return (
                <Grid item xs={12} sm={6} md={4} key={pkg.name}>
                  <Card elevation={2} sx={{
                    border: installed ? '2px solid' : '1px solid',
                    borderColor: installed ? 'success.main' : 'divider'
                  }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <Extension sx={{ mr: 1, color: 'primary.main' }} />
                        <Typography variant="h6" noWrap>
                          {pkg.name}
                        </Typography>
                        {installed && (
                          <Chip
                            label="Installed"
                            color="success"
                            size="small"
                            sx={{ ml: 'auto' }}
                          />
                        )}
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {pkg.description || 'No description available'}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        <Chip label={pkg.version} size="small" variant="outlined" />
                        <Chip label={formatSize(pkg.size)} size="small" variant="outlined" />
                        <Chip label={pkg.category || 'Uncategorized'} size="small" variant="outlined" />
                      </Box>
                    </CardContent>
                    <CardActions>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<Info />}
                        onClick={() => setSelectedPackage(pkg)}
                      >
                        Details
                      </Button>
                      {installed ? (
                        <Button
                          size="small"
                          color="error"
                          variant="outlined"
                          startIcon={<Delete />}
                          onClick={() => handleConfirmAction(
                            removePackage,
                            pkg.name,
                            'Remove Package',
                            `Are you sure you want to remove ${pkg.name}?`
                          )}
                          disabled={operationLoading[pkg.name]}
                        >
                          Remove
                        </Button>
                      ) : (
                        <Button
                          size="small"
                          variant="contained"
                          startIcon={<GetApp />}
                          onClick={() => handleConfirmAction(
                            installPackage,
                            pkg.name,
                            'Install Package',
                            `Are you sure you want to install ${pkg.name}?`
                          )}
                          disabled={operationLoading[pkg.name]}
                        >
                          Install
                        </Button>
                      )}
                    </CardActions>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </Box>
      )}

      {activeTab === 2 && (
        <Box>
          <Typography variant="h6" gutterBottom>
            Updates Available
          </Typography>
          <Alert severity="info" sx={{ mb: 2 }}>
            Updates feature coming soon! This will show packages that have available updates.
          </Alert>
        </Box>
      )}

      {/* Package Details Dialog */}
      <Dialog
        open={!!selectedPackage}
        onClose={() => setSelectedPackage(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Package Details: {selectedPackage?.name}
        </DialogTitle>
        <DialogContent>
          {selectedPackage && (
            <Box>
              <Typography variant="h6" gutterBottom>Description</Typography>
              <Typography paragraph>
                {selectedPackage.description || 'No description available'}
              </Typography>

              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="subtitle2">Version</Typography>
                  <Typography>{selectedPackage.version}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2">Size</Typography>
                  <Typography>{formatSize(selectedPackage.size)}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2">Category</Typography>
                  <Typography>{selectedPackage.category || 'Uncategorized'}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2">Dependencies</Typography>
                  <Typography>
                    {selectedPackage.dependencies?.length || 0} dependencies
                  </Typography>
                </Grid>
              </Grid>

              {selectedPackage.dependencies && selectedPackage.dependencies.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>Dependencies</Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {selectedPackage.dependencies.map((dep, index) => (
                      <Chip key={index} label={dep} size="small" variant="outlined" />
                    ))}
                  </Box>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedPackage(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog({ ...confirmDialog, open: false })}
      >
        <DialogTitle>{confirmDialog.title}</DialogTitle>
        <DialogContent>
          <Typography>{confirmDialog.message}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog({ ...confirmDialog, open: false })}>
            Cancel
          </Button>
          <Button
            onClick={executeConfirmedAction}
            color="primary"
            variant="contained"
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PackageManager;
