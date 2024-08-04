import React, { useState, useEffect } from 'react';
import { Box, Typography, TextField, Button, List, ListItem, ListItemText, ListItemSecondaryAction, IconButton, Paper, Snackbar, CircularProgress } from '@mui/material';
import { Delete as DeleteIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import axios from 'axios';
import { useUser } from '@/UserContext';


export default function SSLManager() {
  const [domain, setDomain] = useState('');
  const [email, setEmail] = useState('');
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const { userId, isLoadingUserId } = useUser();

  useEffect(() => {
    if (userId) {
      fetchCertificates();
    }
  }, [userId]);

  const generateSSL = async () => {
    setLoading(true);
    try {
      const res = await axios.post('/api/ssl', { domain, email }, { headers: { 'x-user-id': userId } });
      showSnackbar(res.data.message, 'success');
      fetchCertificates();
      setDomain('');
      setEmail('');
    } catch (error) {
      showSnackbar(`Failed to generate SSL: ${error.response?.data?.error || error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const revokeSSL = async (domain) => {
    setLoading(true);
    try {
      const res = await axios.delete('/api/ssl', { data: { domain }, headers: { 'x-user-id': userId } });
      showSnackbar(res.data.message, 'success');
      fetchCertificates();
    } catch (error) {
      showSnackbar(`Failed to revoke SSL: ${error.response?.data?.error || error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchCertificates = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/ssl', { headers: { 'x-user-id': userId } });
      setCertificates(res.data.certificates);
    } catch (error) {
      showSnackbar(`Failed to fetch certificates: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const showSnackbar = (message, severity) => {
    setSnackbar({ open: true, message, severity });
  };

  if (isLoadingUserId) {
    return <CircularProgress />;
  }

  return (
    <Box sx={{ maxWidth: 800, margin: 'auto', mt: 4, p: 3 }}>
      <Typography variant="h4" gutterBottom>
        SSL Certificate Manager
      </Typography>
      <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          Generate New SSL Certificate
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
        <Button
          variant="contained"
          onClick={generateSSL}
          sx={{ mt: 2 }}
          disabled={loading || !domain || !email}
        >
          {loading ? <CircularProgress size={24} /> : 'Generate SSL Certificate'}
        </Button>
      </Paper>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          Existing Certificates
        </Typography>
        <IconButton onClick={fetchCertificates} disabled={loading}>
          <RefreshIcon />
        </IconButton>
      </Box>
      <List>
        {certificates.map((cert, index) => (
          <ListItem key={index}>
            <ListItemText
              primary={cert.domain}
              secondary={`Expires: ${new Date(cert.expiryDate).toLocaleDateString()}`}
            />
            <ListItemSecondaryAction>
              <IconButton edge="end" aria-label="delete" onClick={() => revokeSSL(cert.domain)} disabled={loading}>
                <DeleteIcon />
              </IconButton>
            </ListItemSecondaryAction>
          </ListItem>
        ))}
      </List>
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        message={snackbar.message}
      />
    </Box>
  );
}