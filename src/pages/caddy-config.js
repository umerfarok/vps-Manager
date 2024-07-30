import { useState, useEffect } from 'react';
import { Box, Typography, Button } from '@mui/material';
import AceEditor from 'react-ace';
import 'ace-builds/src-noconflict/mode-json';
import 'ace-builds/src-noconflict/theme-monokai';
import axios from 'axios';

export default function CaddyConfig() {
  const [config, setConfig] = useState('');

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await axios.get('/api/caddy');
      setConfig(res.data.config);
    } catch (error) {
      console.error('Failed to fetch Caddy config:', error);
    }
  };

  const saveConfig = async () => {
    try {
      await axios.post('/api/caddy', { config });
      alert('Caddy configuration saved successfully');
    } catch (error) {
      alert('Failed to save Caddy configuration: ' + error.response.data.error);
    }
  };

  return (
    <Box sx={{ maxWidth: 800, margin: 'auto', mt: 4 }}>
      <Typography variant="h4" gutterBottom>
        Caddy Configuration
      </Typography>
      <AceEditor
        mode="json"
        theme="monokai"
        onChange={setConfig}
        value={config}
        name="caddy-config-editor"
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