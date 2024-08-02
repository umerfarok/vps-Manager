import React, { useState, useEffect } from 'react';
import {
  Button,
  TextField,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Typography,
  Paper,
  Container,
  Snackbar,
  CircularProgress
} from '@mui/material';
import { Delete as DeleteIcon } from '@mui/icons-material';
import { styled } from '@mui/system';
import { useUser } from './UserContext';

const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  marginTop: theme.spacing(4),
}));

const FormContainer = styled('div')(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(2),
  marginBottom: theme.spacing(3),
}));

export default function DomainManager() {
  const [domains, setDomains] = useState([]);
  const [newDomain, setNewDomain] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { userId, isLoadingUserId } = useUser();

  useEffect(() => {
    if (!isLoadingUserId && userId) {
      fetchDomains();
    }
  }, [isLoadingUserId, userId]);

  const fetchDomains = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/domains', {
        headers: { 'x-user-id': userId },
      });
      if (!response.ok) throw new Error('Failed to fetch domains');
      const data = await response.json();
      setDomains(data.domains);
    } catch (error) {
      setError('Failed to fetch domains: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const addDomain = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/domains', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({ domain: newDomain }),
      });
      if (!response.ok) throw new Error('Failed to add domain');
      setNewDomain('');
      setSuccess('Domain added successfully');
      fetchDomains();
    } catch (error) {
      setError('Failed to add domain: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteDomain = async (domain) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/domains?domain=${encodeURIComponent(domain)}`, {
        method: 'DELETE',
        headers: { 'x-user-id': userId },
      });
      if (!response.ok) throw new Error('Failed to delete domain');
      setSuccess('Domain deleted successfully');
      fetchDomains();
    } catch (error) {
      setError('Failed to delete domain: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoadingUserId) {
    return <CircularProgress />;
  }

  return (
    <Container maxWidth="md">
      <StyledPaper elevation={3}>
        <Typography variant="h4" gutterBottom>
          Domain Manager
        </Typography>

        <FormContainer>
          <TextField
            fullWidth
            variant="outlined"
            label="Enter new domain"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
          />
          <Button
            variant="contained"
            onClick={addDomain}
            disabled={isLoading}
          >
            Add Domain
          </Button>
        </FormContainer>

        <List>
          {domains.map((domain, index) => (
            <ListItem
              key={index}
              secondaryAction={
                <IconButton
                  edge="end"
                  aria-label="delete"
                  onClick={() => deleteDomain(domain)}
                  disabled={isLoading}
                >
                  <DeleteIcon />
                </IconButton>
              }
            >
              <ListItemText primary={domain} />
            </ListItem>
          ))}
        </List>

        {isLoading && <CircularProgress />}
      </StyledPaper>

      <Snackbar
        open={!!error || !!success}
        autoHideDuration={6000}
        onClose={() => {
          setError('');
          setSuccess('');
        }}
        message={error || success}
      />
    </Container>
  );
}