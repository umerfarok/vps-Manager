import { useState, useEffect } from 'react';
import { Box, Typography, Button, Select, MenuItem } from '@mui/material';
import AceEditor from 'react-ace';
import 'ace-builds/src-noconflict/mode-nginx';
import 'ace-builds/src-noconflict/theme-monokai';
import axios from 'axios';
import { useUser } from '../UserContext';

const sampleConfigs = {
  basic: `
server {
    listen 80;
    server_name example.com;
    root /var/www/html;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }
}
  `,
  php: `
server {
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
}
  `,
  nodejs: `
server {
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
}
  `,
};

export default function NginxConfig() {
  const [config, setConfig] = useState('');
  const [selectedSample, setSelectedSample] = useState('');
  const { userId, isLoadingUserId } = useUser();

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await axios.get('/api/nginx', { headers: { 'X-User-Id': userId } });
      setConfig(res.data.config);
    } catch (error) {
      console.error('Failed to fetch Nginx config:', error);
    }
  };

  const saveConfig = async () => {
    try {
      await axios.post('/api/nginx', { config });
      alert('Nginx configuration saved successfully');
    } catch (error) {
      alert('Failed to save Nginx configuration: ' + error.response.data.error);
    }
  };

  const handleSampleChange = (event) => {
    setSelectedSample(event.target.value);
    setConfig(sampleConfigs[event.target.value]);
  };
  if (isLoadingUserId) {
    return <p>Loading...</p>;
  }

  return (
    <Box sx={{ maxWidth: 800, margin: 'auto', mt: 4 }}>
      <Typography variant="h4" gutterBottom>
        Nginx Configuration
      </Typography>
      <Select
        value={selectedSample}
        onChange={handleSampleChange}
        displayEmpty
        fullWidth
        sx={{ mb: 2 }}
      >
        <MenuItem value="">
          <em>Select a sample configuration</em>
        </MenuItem>
        <MenuItem value="basic">Basic HTTP Server</MenuItem>
        <MenuItem value="php">PHP Server</MenuItem>
        <MenuItem value="nodejs">Node.js Proxy</MenuItem>
      </Select>
      <AceEditor
        mode="nginx"
        theme="monokai"
        onChange={setConfig}
        value={config}
        name="nginx-config-editor"
        editorProps={{ $blockScrolling: true }}
        setOptions={{
          useWorker: false
        }}
        style={{ width: '100%', height: '400px' }}
      />
      <Button variant="contained" onClick={saveConfig} sx={{ mt: 2 }}>
        Save Configuration
      </Button>
    </Box>
  );
}