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
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tab,
  Tabs,
  Box
} from '@mui/material';
import { Delete as DeleteIcon, Add as AddIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { styled } from '@mui/system';
import { useUser } from '../UserContext';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Pie } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  marginTop: theme.spacing(4),
}));

const FormContainer = styled('div')(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(2),
  marginBottom: theme.spacing(3),
}));

const TabPanel = (props) => {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
};

export default function VPSManager() {
  const [domains, setDomains] = useState([]);
  const [newDomain, setNewDomain] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [stats, setStats] = useState(null);
  const { userId, isLoadingUserId } = useUser();

  useEffect(() => {
    if (!isLoadingUserId && userId) {
      fetchDomains();
      fetchStats();
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

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/stats', {
        headers: { 'x-user-id': userId },
      });
      if (!response.ok) throw new Error('Failed to fetch stats');
      const data = await response.json();
      setStats(data);
    } catch (error) {
      setError('Failed to fetch stats: ' + error.message);
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
      setOpenDialog(false);
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

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  if (isLoadingUserId) {
    return <CircularProgress />;
  }

  return (
    <Container maxWidth="md">
      <StyledPaper elevation={3}>
        <Typography variant="h4" gutterBottom>
          VPS Manager
        </Typography>

        <Tabs value={tabValue} onChange={handleTabChange} aria-label="VPS manager tabs">
          <Tab label="Domains" />
          <Tab label="Statistics" />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          <FormContainer>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setOpenDialog(true)}
            >
              Add Domain
            </Button>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={fetchDomains}
              disabled={isLoading}
            >
              Refresh
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
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          {stats && (
            <Box sx={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap' }}>
              <Box sx={{ width: '45%', minWidth: 300 }}>
                <Typography variant="h6" gutterBottom>
                  Disk Usage
                </Typography>
                <Pie
                  data={{
                    labels: ['Used', 'Free'],
                    datasets: [{
                      data: [stats.diskUsed, stats.diskTotal - stats.diskUsed],
                      backgroundColor: ['#FF6384', '#36A2EB'],
                    }],
                  }}
                />
              </Box>
              <Box sx={{ width: '45%', minWidth: 300 }}>
                <Typography variant="h6" gutterBottom>
                  Memory Usage
                </Typography>
                <Pie
                  data={{
                    labels: ['Used', 'Free'],
                    datasets: [{
                      data: [stats.memoryUsed, stats.memoryTotal - stats.memoryUsed],
                      backgroundColor: ['#FFCE56', '#4BC0C0'],
                    }],
                  }}
                />
              </Box>
            </Box>
          )}
        </TabPanel>
      </StyledPaper>

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)}>
        <DialogTitle>Add New Domain</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Domain Name"
            type="text"
            fullWidth
            variant="outlined"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button onClick={addDomain} variant="contained">Add</Button>
        </DialogActions>
      </Dialog>

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