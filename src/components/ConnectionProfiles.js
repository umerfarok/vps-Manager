import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, List, ListItem, ListItemText, ListItemSecondaryAction,
  IconButton, Menu, MenuItem, Typography, Box, Paper, Grid,
  Chip, Tooltip, Divider, Card, CardContent, CardActions
} from '@mui/material';
import {
  Add, Edit, Delete, MoreVert, PlayArrow, ContentCopy,
  ImportExport, Download, Upload, History, Star
} from '@mui/icons-material';
import { useConnectionProfiles } from '../useConnectionProfiles';

const ConnectionProfiles = ({ onConnect, currentConnection }) => {
  const {
    profiles,
    saveProfile,
    updateProfile,
    deleteProfile,
    markProfileUsed,
    duplicateProfile,
    exportProfiles,
    importProfiles,
    getRecentProfiles,
    getMostUsedProfiles
  } = useConnectionProfiles();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState(null);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    host: '',
    port: '22',
    username: '',
    authType: 'password',
    password: '',
    privateKey: '',
    passphrase: ''
  });

  const resetForm = () => {
    setFormData({
      name: '',
      host: '',
      port: '22',
      username: '',
      authType: 'password',
      password: '',
      privateKey: '',
      passphrase: ''
    });
    setEditingProfile(null);
  };

  const handleOpenDialog = (profile = null) => {
    if (profile) {
      setFormData({
        name: profile.name,
        host: profile.host,
        port: profile.port,
        username: profile.username,
        authType: profile.authType,
        password: profile.password,
        privateKey: profile.privateKey,
        passphrase: profile.passphrase
      });
      setEditingProfile(profile);
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    resetForm();
  };

  const handleSaveProfile = () => {
    if (editingProfile) {
      updateProfile(editingProfile.id, formData);
    } else {
      saveProfile(formData);
    }
    handleCloseDialog();
  };

  const handleConnect = (profile) => {
    markProfileUsed(profile.id);
    onConnect && onConnect(profile);
  };

  const handleMenuOpen = (event, profile) => {
    setMenuAnchor(event.currentTarget);
    setSelectedProfile(profile);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setSelectedProfile(null);
  };

  const handleDuplicate = () => {
    duplicateProfile(selectedProfile.id);
    handleMenuClose();
  };

  const handleDelete = () => {
    deleteProfile(selectedProfile.id);
    handleMenuClose();
  };

  const handleExport = () => {
    const data = exportProfiles();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'connection-profiles.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = importProfiles(e.target.result);
        if (!result.success) {
          alert(`Import failed: ${result.error}`);
        }
      };
      reader.readAsText(file);
    }
  };

  const formatLastUsed = (dateString) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
  };

  const recentProfiles = getRecentProfiles(3);
  const mostUsedProfiles = getMostUsedProfiles(3);

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">Connection Profiles</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            startIcon={<ImportExport />}
            onClick={handleExport}
            disabled={profiles.length === 0}
            size="small"
          >
            Export
          </Button>
          <Button
            component="label"
            startIcon={<Upload />}
            size="small"
          >
            Import
            <input
              type="file"
              accept=".json"
              hidden
              onChange={handleImport}
            />
          </Button>
          <Button
            startIcon={<Add />}
            variant="contained"
            onClick={() => handleOpenDialog()}
          >
            New Profile
          </Button>
        </Box>
      </Box>

      {/* Quick Access Sections */}
      {(recentProfiles.length > 0 || mostUsedProfiles.length > 0) && (
        <Box sx={{ mb: 4 }}>
          <Grid container spacing={3}>
            {recentProfiles.length > 0 && (
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <History />
                    Recent Connections
                  </Typography>
                  <List dense>
                    {recentProfiles.map((profile) => (
                      <ListItem key={profile.id} sx={{ px: 0 }}>
                        <ListItemText
                          primary={profile.name}
                          secondary={`${profile.username}@${profile.host}:${profile.port}`}
                        />
                        <ListItemSecondaryAction>
                          <IconButton
                            size="small"
                            onClick={() => handleConnect(profile)}
                            color="primary"
                          >
                            <PlayArrow />
                          </IconButton>
                        </ListItemSecondaryAction>
                      </ListItem>
                    ))}
                  </List>
                </Paper>
              </Grid>
            )}

            {mostUsedProfiles.length > 0 && (
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Star />
                    Most Used
                  </Typography>
                  <List dense>
                    {mostUsedProfiles.map((profile) => (
                      <ListItem key={profile.id} sx={{ px: 0 }}>
                        <ListItemText
                          primary={profile.name}
                          secondary={`${profile.useCount} connections`}
                        />
                        <ListItemSecondaryAction>
                          <IconButton
                            size="small"
                            onClick={() => handleConnect(profile)}
                            color="primary"
                          >
                            <PlayArrow />
                          </IconButton>
                        </ListItemSecondaryAction>
                      </ListItem>
                    ))}
                  </List>
                </Paper>
              </Grid>
            )}
          </Grid>
        </Box>
      )}

      {/* All Profiles */}
      <Typography variant="h6" sx={{ mb: 2 }}>All Profiles ({profiles.length})</Typography>

      {profiles.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            No connection profiles saved yet.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Create your first profile to easily connect to your servers.
          </Typography>
          <Button
            startIcon={<Add />}
            variant="contained"
            sx={{ mt: 2 }}
            onClick={() => handleOpenDialog()}
          >
            Create Profile
          </Button>
        </Paper>
      ) : (
        <Grid container spacing={2}>
          {profiles.map((profile) => (
            <Grid item xs={12} sm={6} md={4} key={profile.id}>
              <Card sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                border: currentConnection?.host === profile.host ? '2px solid' : '1px solid',
                borderColor: currentConnection?.host === profile.host ? 'primary.main' : 'divider'
              }}>
                <CardContent sx={{ flexGrow: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Typography variant="h6" noWrap sx={{ flexGrow: 1 }}>
                      {profile.name}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={(e) => handleMenuOpen(e, profile)}
                    >
                      <MoreVert />
                    </IconButton>
                  </Box>

                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {profile.username}@{profile.host}:{profile.port}
                  </Typography>

                  <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Chip
                      label={profile.authType}
                      size="small"
                      variant="outlined"
                    />
                    {profile.lastUsed && (
                      <Chip
                        label={formatLastUsed(profile.lastUsed)}
                        size="small"
                        variant="outlined"
                        color="primary"
                      />
                    )}
                  </Box>

                  {profile.useCount > 0 && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                      Used {profile.useCount} time{profile.useCount !== 1 ? 's' : ''}
                    </Typography>
                  )}
                </CardContent>

                <CardActions sx={{ justifyContent: 'space-between' }}>
                  <Button
                    size="small"
                    startIcon={<Edit />}
                    onClick={() => handleOpenDialog(profile)}
                  >
                    Edit
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<PlayArrow />}
                    onClick={() => handleConnect(profile)}
                  >
                    Connect
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Profile Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => handleOpenDialog(selectedProfile)}>
          <Edit sx={{ mr: 1 }} /> Edit
        </MenuItem>
        <MenuItem onClick={handleDuplicate}>
          <ContentCopy sx={{ mr: 1 }} /> Duplicate
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
          <Delete sx={{ mr: 1 }} /> Delete
        </MenuItem>
      </Menu>

      {/* Profile Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingProfile ? 'Edit Profile' : 'New Connection Profile'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Profile Name"
            fullWidth
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            sx={{ mb: 2 }}
          />

          <Grid container spacing={2}>
            <Grid item xs={8}>
              <TextField
                margin="dense"
                label="Host"
                fullWidth
                value={formData.host}
                onChange={(e) => setFormData({ ...formData, host: e.target.value })}
              />
            </Grid>
            <Grid item xs={4}>
              <TextField
                margin="dense"
                label="Port"
                fullWidth
                value={formData.port}
                onChange={(e) => setFormData({ ...formData, port: e.target.value })}
              />
            </Grid>
          </Grid>

          <TextField
            margin="dense"
            label="Username"
            fullWidth
            value={formData.username}
            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            sx={{ mt: 2 }}
          />

          <TextField
            select
            margin="dense"
            label="Authentication Type"
            fullWidth
            value={formData.authType}
            onChange={(e) => setFormData({ ...formData, authType: e.target.value })}
            sx={{ mt: 2 }}
            SelectProps={{ native: true }}
          >
            <option value="password">Password</option>
            <option value="privateKey">Private Key</option>
          </TextField>

          {formData.authType === 'password' ? (
            <TextField
              margin="dense"
              label="Password"
              type="password"
              fullWidth
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              sx={{ mt: 2 }}
            />
          ) : (
            <>
              <TextField
                margin="dense"
                label="Private Key"
                multiline
                rows={4}
                fullWidth
                value={formData.privateKey}
                onChange={(e) => setFormData({ ...formData, privateKey: e.target.value })}
                sx={{ mt: 2 }}
              />
              <TextField
                margin="dense"
                label="Passphrase (optional)"
                type="password"
                fullWidth
                value={formData.passphrase}
                onChange={(e) => setFormData({ ...formData, passphrase: e.target.value })}
                sx={{ mt: 2 }}
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            onClick={handleSaveProfile}
            variant="contained"
            disabled={!formData.name || !formData.host || !formData.username}
          >
            {editingProfile ? 'Update' : 'Save'} Profile
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ConnectionProfiles;
