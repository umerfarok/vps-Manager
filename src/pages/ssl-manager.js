import { useState } from 'react';
import { Box, Typography, TextField, Button, List, ListItem, ListItemText } from '@mui/material';
import axios from 'axios';

export default function SSLManager() {
  const [domain, setDomain] = useState('');
  const [email, setEmail] = useState('');
  const [certificates, setCertificates] = useState([]);

  const generateSSL = async () => {
    try {
      const res = await axios.post('/api/ssl', { domain, email });
      alert(res.data.message);
      fetchCertificates();
    } catch (error) {
      alert('Failed to generate SSL: ' + error.response.data.error);
    }
  };

  const fetchCertificates = async () => {
    try {
      const res = await axios.get('/api/ssl');
      setCertificates(res.data.certificates);
    } catch (error) {
      console.error('Failed to fetch certificates:', error);
    }
  };

  return (
    <Box sx={{ maxWidth: 600, margin: 'auto', mt: 4 }}>
      <Typography variant="h4" gutterBottom>
        SSL Manager
      </Typography>
      <TextField
        fullWidth
        label="Domain"
        value={domain}
        onChange={(e) => setDomain(e.target.value)}
        margin="normal"
      />
      <TextField
        fullWidth
        label="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        margin="normal"
      />
      <Button variant="contained" onClick={generateSSL} sx={{ mt: 2 }}>
        Generate SSL Certificate
      </Button>
      <Typography variant="h6" sx={{ mt: 4 }}>
        Existing Certificates
      </Typography>
      <List>
        {certificates.map((cert, index) => (
          <ListItem key={index}>
            <ListItemText primary={cert.domain} secondary={`Expires: ${cert.expiryDate}`} />
          </ListItem>
        ))}
      </List>
    </Box>
  );
}