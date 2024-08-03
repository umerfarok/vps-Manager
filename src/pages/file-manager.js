import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions,
  List, ListItem, ListItemIcon, ListItemText, IconButton, Menu, MenuItem, Breadcrumbs, Link,
  Grid, Paper, Divider, Tooltip, CircularProgress, Snackbar, Alert, AppBar, Toolbar
} from '@mui/material';
import {
  Folder, InsertDriveFile, ArrowUpward, CreateNewFolder, NoteAdd, Refresh, MoreVert,
  Edit, Delete, FileCopy, Download, Upload, Save, Cancel
} from '@mui/icons-material';
import axios from 'axios';
import { Editor } from '@monaco-editor/react';
import { useUser } from '../UserContext';

export default function FileManager() {
  const [files, setFiles] = useState([]);
  const [currentPath, setCurrentPath] = useState('/');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogAction, setDialogAction] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [fileContent, setFileContent] = useState('');
  const [anchorEl, setAnchorEl] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sortBy, setSortBy] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');
  const [isNewFileDialogOpen, setIsNewFileDialogOpen] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFileContent, setNewFileContent] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [isEditMode, setIsEditMode] = useState(false);
  const { userId, isLoadingUserId } = useUser();

  const showSnackbar = (message, severity = 'info') => {
    setSnackbar({ open: true, message, severity });
  };

  const closeSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const fetchFiles = useCallback(async (path) => {
    setIsLoading(true);
    if (!userId) {
      console.error("userId is not set");
      setIsLoading(false);
      return;
    }
    try {
      const res = await axios.get(`/api/files?path=${encodeURIComponent(path)}&sortBy=${sortBy}&sortDirection=${sortDirection}`, { headers: { 'x-user-id': userId } });
      setFiles(res.data.files);
      setCurrentPath(res.data.currentPath);
    } catch (error) {
      console.error('Failed to fetch files:', error);
      showSnackbar('Failed to fetch files', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [userId, sortBy, sortDirection]);

  useEffect(() => {
    if (userId) {
      fetchFiles(currentPath);
    }
  }, [fetchFiles, currentPath, userId]);
  const handleFileClick = async (file) => {
    if (file.type === 'directory') {
      setCurrentPath(prevPath => `${prevPath}${file.name}/`);
    } else {
      setSelectedFile(file);
      setIsLoading(true);
      try {
        console.log(`Fetching file: ${currentPath}${file.name}`);
        const res = await axios.get(`/api/files`, {
          params: {
            path: `${currentPath}${file.name}`,
            action: 'read',
            filename: file.name
          },
          headers: { 'x-user-id': userId }
        });
        console.log('File content received:', res.data);
        setFileContent(res.data.content);
        setIsEditMode(true);
      } catch (error) {
        console.error('Failed to read file:', error.response ? error.response.data : error.message);
        showSnackbar(`Failed to read file: ${error.response ? error.response.data.error : error.message}`, 'error');
      } finally {
        setIsLoading(false);
      }
    }
  };


  const handleNewItem = (type) => {
    if (type === 'file') {
      setIsNewFileDialogOpen(true);
    } else {
      setDialogAction(type);
      setIsDialogOpen(true);
    }
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setNewItemName('');
    setFileContent('');
    setSelectedFile(null);
  };

  const handleNewFileDialogClose = () => {
    setIsNewFileDialogOpen(false);
    setNewFileName('');
    setNewFileContent('');
  };

  const handleDialogConfirm = async () => {
    try {
      if (dialogAction === 'directory') {
        await axios.post('/api/files',
          { name: newItemName, type: dialogAction, path: currentPath },
          { headers: { 'x-user-id': userId } }
        );
        showSnackbar(`${dialogAction} created successfully`, 'success');
      } else if (dialogAction === 'delete') {
        await axios.delete('/api/files',
          { data: { name: selectedFile.name, path: currentPath } },
          { headers: { 'x-user-id': userId } }
        );
        showSnackbar('Item deleted successfully', 'success');
      } else if (dialogAction === 'rename') {
        await axios.put('/api/files',
          { oldName: selectedFile.name, newName: newItemName, path: currentPath },
          { headers: { 'x-user-id': userId } }
        );
        showSnackbar('Item renamed successfully', 'success');
      }
      fetchFiles(currentPath);
      handleDialogClose();
    } catch (error) {
      console.error('Operation failed:', error);
      showSnackbar(`Failed to ${dialogAction}`, 'error');
    }
  };

  const handleNewFileConfirm = async () => {
    try {
      await axios.post('/api/files', {
        name: newFileName,
        type: 'file',
        path: currentPath,
        content: newFileContent
      },
        { headers: { 'x-user-id': userId } });
      fetchFiles(currentPath);
      handleNewFileDialogClose();
      showSnackbar('New file created successfully', 'success');
    } catch (error) {
      console.error('Failed to create new file:', error);
      showSnackbar('Failed to create new file', 'error');
    }
  };

  const handleGoUp = () => {
    setCurrentPath(prevPath => {
      const newPath = prevPath.split('/').slice(0, -2).join('/') + '/';
      return newPath === '' ? '/' : newPath;
    });
  };

  const handleMenuOpen = (event, file) => {
    setAnchorEl(event.currentTarget);
    setSelectedFile(file);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleMenuAction = (action) => {
    setDialogAction(action);
    setIsDialogOpen(true);
    handleMenuClose();
  };

  const handleSort = (column) => {
    setSortBy(column);
    setSortDirection(prevDirection => prevDirection === 'asc' ? 'desc' : 'asc');
  };

  const handleDownload = async () => {
    try {
      const response = await axios.get(`/api/files?path=${encodeURIComponent(currentPath + selectedFile.name)}&action=download&filename=${encodeURIComponent(selectedFile.name)}`, {
        responseType: 'blob',
        headers: { 'x-user-id': userId }
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', selectedFile.name);
      document.body.appendChild(link);
      link.click();
      link.remove();
      showSnackbar('File downloaded successfully', 'success');
    } catch (error) {
      console.error('Download failed:', error);
      showSnackbar('Failed to download file', 'error');
    }
  };

  const handleUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('path', currentPath);

    try {
      await axios.post('/api/files?action=upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'x-user-id': userId
        }
      });
      fetchFiles(currentPath);
      showSnackbar('File uploaded successfully', 'success');
    } catch (error) {
      console.error('Upload failed:', error);
      showSnackbar('Failed to upload file', 'error');
    }
  };

  const handleSaveFile = async () => {
    try {
      await axios.put('/api/files',
        { name: selectedFile.name, content: fileContent, path: currentPath },
        { headers: { 'x-user-id': userId } }
      );
      showSnackbar('File updated successfully', 'success');
      setIsEditMode(false);
    } catch (error) {
      console.error('Failed to save file:', error);
      showSnackbar('Failed to save file', 'error');
    }
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
    setSelectedFile(null);
    setFileContent('');
  };

  const renderBreadcrumbs = () => {
    const pathParts = currentPath.split('/').filter(Boolean);
    return (
      <Breadcrumbs aria-label="breadcrumb">
        <Link color="inherit" onClick={() => setCurrentPath('/')}>
          Home
        </Link>
        {pathParts.map((part, index) => (
          <Link
            key={index}
            color="inherit"
            onClick={() => setCurrentPath('/' + pathParts.slice(0, index + 1).join('/') + '/')}
          >
            {part}
          </Link>
        ))}
      </Breadcrumbs>
    );
  };

  if (isLoadingUserId) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ ml: 2 }}>Loading user data...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            File Manager
          </Typography>
        </Toolbar>
      </AppBar>
      <Box sx={{ flexGrow: 1, display: 'flex', p: 2 }}>
        <Paper elevation={3} sx={{ width: '30%', mr: 2, p: 2, overflowY: 'auto' }}>
          {renderBreadcrumbs()}
          <Grid container spacing={2} sx={{ my: 2 }}>
            <Grid item>
              <Button startIcon={<ArrowUpward />} onClick={handleGoUp} disabled={currentPath === '/'}>
                Go Up
              </Button>
            </Grid>
            <Grid item>
              <Button startIcon={<CreateNewFolder />} onClick={() => handleNewItem('directory')}>New Folder</Button>
            </Grid>
            <Grid item>
              <Button startIcon={<NoteAdd />} onClick={() => handleNewItem('file')}>New File</Button>
            </Grid>
            <Grid item>
              <Button startIcon={<Refresh />} onClick={() => fetchFiles(currentPath)}>Refresh</Button>
            </Grid>
            <Grid item>
              <Button
                component="label"
                startIcon={<Upload />}
              >
                Upload File
                <input
                  type="file"
                  hidden
                  onChange={handleUpload}
                />
              </Button>
            </Grid>
          </Grid>
          <List>
            <ListItem>
              <ListItemText primary={<Button onClick={() => handleSort('name')}>Name {sortBy === 'name' && (sortDirection === 'asc' ? '▲' : '▼')}</Button>} />
              <ListItemText primary={<Button onClick={() => handleSort('size')}>Size {sortBy === 'size' && (sortDirection === 'asc' ? '▲' : '▼')}</Button>} />
              <ListItemText primary={<Button onClick={() => handleSort('lastModified')}>Modified {sortBy === 'lastModified' && (sortDirection === 'asc' ? '▲' : '▼')}</Button>} />
            </ListItem>
            <Divider />
            {isLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                <CircularProgress />
              </Box>
            ) : (
              files.map((file, index) => (
                <ListItem key={index} button onClick={() => handleFileClick(file)}>
                  <ListItemIcon>
                    {file.type === 'directory' ? <Folder /> : <InsertDriveFile />}
                  </ListItemIcon>
                  <ListItemText primary={file.name} secondary={`${file.size} | ${file.lastModified}`} />
                  <IconButton onClick={(e) => handleMenuOpen(e, file)}>
                    <MoreVert />
                  </IconButton>
                </ListItem>
              ))
            )}
          </List>
        </Paper>
        <Paper elevation={3} sx={{ flexGrow: 1, p: 2, display: 'flex', flexDirection: 'column' }}>
          {isEditMode ? (
            <>
              <Box sx={{ mb: 2 }}>
                <Typography variant="h6">{selectedFile?.name}</Typography>
                <Button startIcon={<Save />} onClick={handleSaveFile} sx={{ mr: 1 }}>Save</Button>
                <Button startIcon={<Cancel />} onClick={handleCancelEdit}>Cancel</Button>
              </Box>
              <Box sx={{ flexGrow: 1 }}>
                {isLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                    <CircularProgress />
                  </Box>
                ) : (
                  <Editor
                    height="100%"
                    language="javascript"
                    value={fileContent}
                    onChange={setFileContent}
                    options={{
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                      fontSize: 14,
                    }}
                  />
                )}
              </Box>
            </>
          ) : (
            <Typography variant="body1">Select a file to edit</Typography>
          )}
        </Paper>
      </Box>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => handleMenuAction('rename')}><Edit fontSize="small" sx={{ mr: 1 }} /> Rename</MenuItem>
        <MenuItem onClick={() => handleMenuAction('delete')}><Delete fontSize="small" sx={{ mr: 1 }} /> Delete</MenuItem>
        {selectedFile && selectedFile.type === 'file' && (
          <MenuItem onClick={handleDownload}><Download fontSize="small" sx={{ mr: 1 }} /> Download</MenuItem>
        )}
      </Menu>
      <Dialog open={isDialogOpen} onClose={handleDialogClose}>
        <DialogTitle>{dialogAction === 'delete' ? 'Delete Item' : dialogAction === 'rename' ? 'Rename Item' : `New ${dialogAction}`}</DialogTitle>
        <DialogContent>
          {dialogAction === 'delete' ? (
            <Typography>Are you sure you want to delete {selectedFile?.name}?</Typography>
          ) : (
            <TextField
              autoFocus
              margin="dense"
              label="Name"
              fullWidth
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClose}>Cancel</Button>
          <Button onClick={handleDialogConfirm}>Confirm</Button>
        </DialogActions>
      </Dialog>
      <NewFileDialog
        isOpen={isNewFileDialogOpen}
        handleClose={handleNewFileDialogClose}
        handleConfirm={handleNewFileConfirm}
        setNewFileName={setNewFileName}
        setNewFileContent={setNewFileContent}
      />
      <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={closeSnackbar}>
        <Alert onClose={closeSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

const NewFileDialog = ({ isOpen, handleClose, handleConfirm, setNewFileName, setNewFileContent }) => {
  const handleEditorChange = (value) => {
    setNewFileContent(value || '');
  };

  return (
    <Dialog open={isOpen} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>Create New File</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          label="File Name"
          fullWidth
          onChange={(e) => setNewFileName(e.target.value)}
          sx={{ mb: 2 }}
        />
        <Box sx={{ height: 400 }}>
          <Editor
            height="100%"
            language="javascript"
            onChange={handleEditorChange}
            options={{
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              fontSize: 14,
            }}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button onClick={handleConfirm}>Create File</Button>
      </DialogActions>
    </Dialog>
  );
};
