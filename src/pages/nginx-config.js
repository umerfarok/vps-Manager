import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, Select, MenuItem, TextField, Snackbar, CircularProgress } from '@mui/material';
import { Alert } from '@mui/material';
import AceEditor from 'react-ace';
import 'ace-builds/src-noconflict/mode-nginx';
import 'ace-builds/src-noconflict/theme-github';
import axios from 'axios';
import { useUser } from '../UserContext';

const sampleConfigs = {
  basic: `server {
    listen 80;
    server_name example.com;
    root /var/www/html;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }
}`,
  php: `server {
    listen 80;
    server_name example.com;
    root /var/www/html;
    index index.php index.html;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \.php$ {
        fastcgi_pass unix:/var/run/php/php7.4-fpm.sock;
        fastcgi_index index.php;
        include fastcgi_params;
    }
}`,
  nodejs: `server {
    listen 80;
    server_name example.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}`
};

export default function NginxConfigManager() {
  const [config, setConfig] = useState('');
  const [selectedSample, setSelectedSample] = useState('');
  const [configName, setConfigName] = useState('');
  const [savedConfigs, setSavedConfigs] = useState([]);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [isLoading, setIsLoading] = useState(false);
  const { userId, isLoadingUserId } = useUser();

  useEffect(() => {
    if (userId) {
      fetchSavedConfigs();
    }
  }, [userId]);

  const fetchSavedConfigs = async () => {
    setIsLoading(true);
    try {
      const res = await axios.get('/api/nginx', { headers: { 'X-User-Id': userId } });
      setSavedConfigs(res.data.configs);
    } catch (error) {
      console.error('Failed to fetch saved configs:', error);
      showSnackbar('Failed to fetch saved configurations: ' + (error.response?.data?.error || error.message), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSampleChange = (event) => {
    setSelectedSample(event.target.value);
    setConfig(sampleConfigs[event.target.value]);
  };

  const saveConfig = async () => {
    if (!configName.trim()) {
      showSnackbar('Please enter a name for the configuration', 'warning');
      return;
    }
    setIsLoading(true);
    try {
      const res = await axios.post('/api/nginx?action=save', { name: configName, config }, { headers: { 'X-User-Id': userId } });
      showSnackbar(res.data.message, 'success');
      fetchSavedConfigs();
    } catch (error) {
      showSnackbar('Failed to save configuration: ' + (error.response?.data?.error || error.message), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const loadConfig = async (name) => {
    if (!name) {
      showSnackbar('Please select a configuration to load', 'warning');
      return;
    }
    setIsLoading(true);
    try {
      const res = await axios.post('/api/nginx?action=load', { name }, { headers: { 'X-User-Id': userId } });
      setConfig(res.data.config);
      setConfigName(name);
      showSnackbar('Configuration loaded successfully', 'success');
    } catch (error) {
      showSnackbar('Failed to load configuration: ' + (error.response?.data?.error || error.message), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const applyConfig = async () => {
    setIsLoading(true);
    try {
      const res = await axios.post('/api/nginx?action=apply', { config }, { headers: { 'X-User-Id': userId } });
      showSnackbar(res.data.message, 'success');
    } catch (error) {
      showSnackbar('Failed to apply configuration: ' + (error.response?.data?.error || error.message), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const showSnackbar = (message, severity = 'info') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCloseSnackbar = (event, reason) => {
    if (reason === 'clickaway') {
      return;
    }
    setSnackbar({ ...snackbar, open: false });
  };

  if (isLoadingUserId) {
    return <Typography>Loading...</Typography>;
  }

  return (
    <Box sx={{ maxWidth: 800, margin: 'auto', mt: 4 }}>
      <Typography variant="h4" gutterBottom>
        Nginx Configuration Manager
      </Typography>
      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <Select
          value={selectedSample}
          onChange={handleSampleChange}
          displayEmpty
          fullWidth
          disabled={isLoading}
        >
          <MenuItem value="">
            <em>Select a sample configuration</em>
          </MenuItem>
          <MenuItem value="basic">Basic HTTP Server</MenuItem>
          <MenuItem value="php">PHP Server</MenuItem>
          <MenuItem value="nodejs">Node.js Proxy</MenuItem>
        </Select>
        <Select
          value={configName}
          onChange={(e) => loadConfig(e.target.value)}
          displayEmpty
          fullWidth
          disabled={isLoading}
        >
          <MenuItem value="">
            <em>Load saved configuration</em>
          </MenuItem>
          {savedConfigs.map((cfg) => (
            <MenuItem key={cfg.name} value={cfg.name}>{cfg.name}</MenuItem>
          ))}
        </Select>
      </Box>
      <AceEditor
        mode="nginx"
        theme="github"
        onChange={setConfig}
        value={config}
        name="nginx-config-editor"
        editorProps={{ $blockScrolling: true }}
        setOptions={{
          useWorker: false
        }}
        style={{ width: '100%', height: '400px', marginBottom: '16px' }}
        readOnly={isLoading}
      />
      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <TextField
          label="Configuration Name"
          variant="outlined"
          value={configName}
          onChange={(e) => setConfigName(e.target.value)}
          fullWidth
          disabled={isLoading}
        />
        <Button variant="contained" onClick={saveConfig} disabled={isLoading}>
          {isLoading ? <CircularProgress size={24} /> : 'Save Configuration'}
        </Button>
      </Box>
      <Button variant="contained" color="primary" onClick={applyConfig} fullWidth disabled={isLoading}>
        {isLoading ? <CircularProgress size={24} /> : 'Apply Configuration'}
      </Button>
      <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={handleCloseSnackbar}>
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}