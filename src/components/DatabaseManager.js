import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Paper, Typography, Grid, Card, CardContent, CardActions,
  Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions,
  List, ListItem, ListItemText, ListItemSecondaryAction, IconButton,
  Tooltip, Chip, Tabs, Tab, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Alert, CircularProgress, InputAdornment,
  FormControl, InputLabel, Select, MenuItem, Badge
} from '@mui/material';
import {
  Storage, Add, Edit, Delete, PlayArrow, Stop, Refresh,
  QueryBuilder, TableChart, Settings, Backup, Restore,
  Database, Search, FilterList, Sort, ViewColumn
} from '@mui/icons-material';
import { useConnectionStatus } from '../useConnectionStatus';
import axios from 'axios';
import { useUser } from '../UserContext';

const DatabaseManager = () => {
  const { userId } = useUser();
  const { requireConnection } = useConnectionStatus();
  const [databases, setDatabases] = useState([]);
  const [selectedDatabase, setSelectedDatabase] = useState(null);
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [tableData, setTableData] = useState([]);
  const [query, setQuery] = useState('');
  const [queryResult, setQueryResult] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    type: 'mysql',
    host: 'localhost',
    port: '3306',
    username: '',
    password: '',
    database: ''
  });

  const fetchDatabases = useCallback(async () => {
    try {
      await requireConnection();
      setLoading(true);

      const response = await axios.get('/api/databases', {
        headers: { 'x-user-id': userId }
      });

      setDatabases(response.data.databases);
    } catch (error) {
      console.error('Failed to fetch databases:', error);
    } finally {
      setLoading(false);
    }
  }, [userId, requireConnection]);

  const fetchTables = useCallback(async (databaseId) => {
    try {
      await requireConnection();

      const response = await axios.get(`/api/databases/${databaseId}/tables`, {
        headers: { 'x-user-id': userId }
      });

      setTables(response.data.tables);
    } catch (error) {
      console.error('Failed to fetch tables:', error);
    }
  }, [userId, requireConnection]);

  const fetchTableData = useCallback(async (databaseId, tableName) => {
    try {
      await requireConnection();

      const response = await axios.get(`/api/databases/${databaseId}/tables/${tableName}`, {
        headers: { 'x-user-id': userId }
      });

      setTableData(response.data.data);
    } catch (error) {
      console.error('Failed to fetch table data:', error);
    }
  }, [userId, requireConnection]);

  const executeQuery = async () => {
    if (!query.trim()) return;

    try {
      setLoading(true);
      await requireConnection();

      const response = await axios.post('/api/databases/query', {
        databaseId: selectedDatabase?.id,
        query: query.trim()
      }, {
        headers: { 'x-user-id': userId }
      });

      setQueryResult(response.data);
    } catch (error) {
      console.error('Failed to execute query:', error);
      setQueryResult({
        error: error.response?.data?.error || error.message,
        success: false
      });
    } finally {
      setLoading(false);
    }
  };

  const createDatabase = async () => {
    try {
      await requireConnection();

      await axios.post('/api/databases', formData, {
        headers: { 'x-user-id': userId }
      });

      await fetchDatabases();
      setDialogOpen(false);
    } catch (error) {
      console.error('Failed to create database:', error);
    }
  };

  const deleteDatabase = async (databaseId) => {
    try {
      await requireConnection();

      await axios.delete(`/api/databases/${databaseId}`, {
        headers: { 'x-user-id': userId }
      });

      await fetchDatabases();
      if (selectedDatabase?.id === databaseId) {
        setSelectedDatabase(null);
        setTables([]);
        setTableData([]);
      }
    } catch (error) {
      console.error('Failed to delete database:', error);
    }
  };

  const backupDatabase = async (databaseId) => {
    try {
      await requireConnection();

      const response = await axios.post(`/api/databases/${databaseId}/backup`, {}, {
        headers: { 'x-user-id': userId },
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `database_backup_${databaseId}_${new Date().toISOString().split('T')[0]}.sql`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to backup database:', error);
    }
  };

  const handleDialogOpen = (type, database = null) => {
    setDialogType(type);
    if (database) {
      setFormData({
        name: database.name,
        type: database.type,
        host: database.host,
        port: database.port,
        username: database.username,
        password: '',
        database: database.database
      });
    } else {
      setFormData({
        name: '',
        type: 'mysql',
        host: 'localhost',
        port: '3306',
        username: '',
        password: '',
        database: ''
      });
    }
    setDialogOpen(true);
  };

  const getDatabaseIcon = (type) => {
    switch (type) {
      case 'mysql': return '🗄️';
      case 'postgresql': return '🐘';
      case 'mongodb': return '🍃';
      case 'redis': return '🔴';
      default: return '🗃️';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'connected': return 'success';
      case 'connecting': return 'warning';
      case 'disconnected': return 'error';
      default: return 'default';
    }
  };

  useEffect(() => {
    fetchDatabases();
  }, [fetchDatabases]);

  useEffect(() => {
    if (selectedDatabase) {
      fetchTables(selectedDatabase.id);
    }
  }, [selectedDatabase, fetchTables]);

  useEffect(() => {
    if (selectedTable && selectedDatabase) {
      fetchTableData(selectedDatabase.id, selectedTable);
    }
  }, [selectedTable, selectedDatabase, fetchTableData]);

  return (
    <Box sx={{ width: '100%', p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">
          Database Manager
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => handleDialogOpen('create')}
          >
            Add Database
          </Button>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={fetchDatabases}
            disabled={loading}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Databases List */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, height: 600, overflow: 'auto' }}>
            <Typography variant="h6" gutterBottom>
              Databases
            </Typography>
            <List>
              {databases.map((db) => (
                <ListItem
                  key={db.id}
                  button
                  selected={selectedDatabase?.id === db.id}
                  onClick={() => setSelectedDatabase(db)}
                  sx={{ mb: 1, borderRadius: 1 }}
                >
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <span style={{ fontSize: '1.2rem' }}>{getDatabaseIcon(db.type)}</span>
                        <Typography variant="subtitle1">{db.name}</Typography>
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          {db.type} • {db.host}:{db.port}
                        </Typography>
                        <Chip
                          label={db.status}
                          size="small"
                          color={getStatusColor(db.status)}
                          sx={{ mt: 0.5 }}
                        />
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        backupDatabase(db.id);
                      }}
                    >
                      <Backup />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteDatabase(db.id);
                      }}
                    >
                      <Delete />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </Paper>
        </Grid>

        {/* Tables and Data */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2, height: 600, overflow: 'auto' }}>
            {selectedDatabase ? (
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">
                    {selectedDatabase.name} - Tables
                  </Typography>
                  <Chip label={selectedDatabase.type} color="primary" />
                </Box>

                <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)} sx={{ mb: 2 }}>
                  <Tab label="Tables" />
                  <Tab label="Query" />
                  <Tab label="Settings" />
                </Tabs>

                {activeTab === 0 && (
                  <List>
                    {tables.map((table) => (
                      <ListItem
                        key={table.name}
                        button
                        selected={selectedTable === table.name}
                        onClick={() => setSelectedTable(table.name)}
                        sx={{ mb: 1, borderRadius: 1 }}
                      >
                        <TableChart sx={{ mr: 1, color: 'primary.main' }} />
                        <ListItemText
                          primary={table.name}
                          secondary={`${table.rows} rows • ${table.size}`}
                        />
                      </ListItem>
                    ))}
                  </List>
                )}

                {activeTab === 0 && selectedTable && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="h6" gutterBottom>
                      {selectedTable} Data
                    </Typography>
                    <TableContainer component={Paper} variant="outlined">
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            {tableData.columns?.map((column, index) => (
                              <TableCell key={index} sx={{ fontWeight: 'bold' }}>
                                {column}
                              </TableCell>
                            ))}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {tableData.rows?.slice(0, 100).map((row, index) => (
                            <TableRow key={index}>
                              {row.map((cell, cellIndex) => (
                                <TableCell key={cellIndex}>
                                  {String(cell).length > 50
                                    ? `${String(cell).substring(0, 50)}...`
                                    : String(cell)
                                  }
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                    {tableData.rows?.length > 100 && (
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                        Showing first 100 rows of {tableData.rows.length} total rows
                      </Typography>
                    )}
                  </Box>
                )}

                {activeTab === 1 && (
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      SQL Query
                    </Typography>
                    <TextField
                      multiline
                      rows={6}
                      fullWidth
                      placeholder="Enter your SQL query here..."
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      sx={{ mb: 2 }}
                    />
                    <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                      <Button
                        variant="contained"
                        startIcon={<PlayArrow />}
                        onClick={executeQuery}
                        disabled={!query.trim() || loading}
                      >
                        {loading ? 'Executing...' : 'Execute Query'}
                      </Button>
                      <Button
                        variant="outlined"
                        onClick={() => setQuery('')}
                      >
                        Clear
                      </Button>
                    </Box>

                    {queryResult && (
                      <Box sx={{ mt: 2 }}>
                        {queryResult.error ? (
                          <Alert severity="error">
                            <Typography variant="body2">{queryResult.error}</Typography>
                          </Alert>
                        ) : (
                          <Box>
                            <Typography variant="h6" gutterBottom color="success.main">
                              Query executed successfully
                            </Typography>
                            {queryResult.rows && (
                              <Typography variant="body2" color="text.secondary">
                                Affected rows: {queryResult.rows}
                              </Typography>
                            )}
                            {queryResult.data && queryResult.data.length > 0 && (
                              <TableContainer component={Paper} variant="outlined" sx={{ mt: 2 }}>
                                <Table size="small">
                                  <TableHead>
                                    <TableRow>
                                      {Object.keys(queryResult.data[0]).map((key) => (
                                        <TableCell key={key} sx={{ fontWeight: 'bold' }}>
                                          {key}
                                        </TableCell>
                                      ))}
                                    </TableRow>
                                  </TableHead>
                                  <TableBody>
                                    {queryResult.data.slice(0, 50).map((row, index) => (
                                      <TableRow key={index}>
                                        {Object.values(row).map((value, cellIndex) => (
                                          <TableCell key={cellIndex}>
                                            {String(value).length > 50
                                              ? `${String(value).substring(0, 50)}...`
                                              : String(value)
                                            }
                                          </TableCell>
                                        ))}
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </TableContainer>
                            )}
                          </Box>
                        )}
                      </Box>
                    )}
                  </Box>
                )}

                {activeTab === 2 && (
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      Database Settings
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={6}>
                        <TextField
                          fullWidth
                          label="Host"
                          value={selectedDatabase.host}
                          disabled
                        />
                      </Grid>
                      <Grid item xs={6}>
                        <TextField
                          fullWidth
                          label="Port"
                          value={selectedDatabase.port}
                          disabled
                        />
                      </Grid>
                      <Grid item xs={6}>
                        <TextField
                          fullWidth
                          label="Username"
                          value={selectedDatabase.username}
                          disabled
                        />
                      </Grid>
                      <Grid item xs={6}>
                        <TextField
                          fullWidth
                          label="Database"
                          value={selectedDatabase.database}
                          disabled
                        />
                      </Grid>
                    </Grid>
                  </Box>
                )}
              </Box>
            ) : (
              <Box sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: 'text.secondary'
              }}>
                <Database sx={{ fontSize: 64, mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  No Database Selected
                </Typography>
                <Typography variant="body2">
                  Select a database from the list to view its tables and data
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Database Configuration Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {dialogType === 'create' ? 'Add Database Connection' : 'Edit Database Connection'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Connection Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Database Type</InputLabel>
                <Select
                  value={formData.type}
                  label="Database Type"
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                >
                  <MenuItem value="mysql">MySQL</MenuItem>
                  <MenuItem value="postgresql">PostgreSQL</MenuItem>
                  <MenuItem value="mongodb">MongoDB</MenuItem>
                  <MenuItem value="redis">Redis</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Port"
                value={formData.port}
                onChange={(e) => setFormData({ ...formData, port: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Host"
                value={formData.host}
                onChange={(e) => setFormData({ ...formData, host: e.target.value })}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Username"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Database Name"
                value={formData.database}
                onChange={(e) => setFormData({ ...formData, database: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={createDatabase}
            variant="contained"
            disabled={!formData.name || !formData.host || !formData.username}
          >
            {dialogType === 'create' ? 'Add Database' : 'Update Database'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DatabaseManager;
