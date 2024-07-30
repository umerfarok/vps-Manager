import { useState, useEffect } from 'react';
import { Box, Typography, TextField, Button, List, ListItem, ListItemText, IconButton } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import axios from 'axios';

export default function DomainManager() {
  const [domains, setDomains] = useState([]);
  const [newDomain, setNewDomain] = useState('');

  useEffect(() => {
    fetchDomains();
  }, []);

  const fetchDomains = async () => {
    try {
      const res = await axios.get('/api/domains');
      setDomains(res.data.domains);
    } catch (error) {
      console.error('Failed to fetch domains:', error);
    }
  };

  const addDomain = async () => {
    try {
      await axios.post('/api/domains', { domain: newDomain });
      setNewDomain('');
      fetchDomains();
    } catch (error) {
      alert('Failed to add domain: ' + error.response.data.error);
    }
  };

  const deleteDomain = async (domain) => {
    try {
      await axios.delete(`/api/domains?domain=${domain}`);
      fetchDomains();
    } catch (error) {
      alert('Failed to delete domain: ' + error.response.data.error);
    }
  };

  return (
    <Box sx={{ maxWidth: 600, margin: 'auto', mt: 4 }}>
      <Typography variant="h4" gutterBottom>
        Domain Manager
      </Typography>
      <Box sx={{ display: 'flex', mb: 2 }}>
        <TextField
          fullWidth
          label="New Domain"
          value={newDomain}
          onChange={(e) => setNewDomain(e.target.value)}
        />
        <Button variant="contained" onClick={addDomain} sx={{ ml: 2 }}>
          Add
        </Button>
      </Box>
      <List>
        {domains.map((domain, index) => (
          <ListItem
            key={index}
            secondaryAction={
              <IconButton edge="end" aria-label="delete" onClick={() => deleteDomain(domain)}>
                <DeleteIcon />
              </IconButton>
            }
          >
            <ListItemText primary={domain} />
          </ListItem>
        ))}
      </List>
    </Box>
  );
}