"use client";
import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions,
  List, ListItem, ListItemIcon, ListItemText, IconButton, Menu, MenuItem, Breadcrumbs, Link,
  Grid, Paper, Divider, Tooltip, CircularProgress
} from '@mui/material';
import {
  Folder, InsertDriveFile, ArrowUpward, CreateNewFolder, NoteAdd, Refresh, MoreVert,
  Edit, Delete, FileCopy, Download
} from '@mui/icons-material';
import axios from 'axios';
import { Editor } from '@monaco-editor/react';
import { useUser } from './UserContext';

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
  const { userId, isLoadingUserId } = useUser();

  useEffect(() => {
    fetchFiles(currentPath);
  }, [currentPath, sortBy, sortDirection]);

  const fetchFiles = async (path) => {
    setIsLoading(true);
    if (!userId) {
      console.error("userId is not set");
      setIsLoading(false);
      return;
    }
    console.log("userId", userId);
    try {
      const res = await axios.get(`/api/files?path=${encodeURIComponent(path)}&sortBy=${sortBy}&sortDirection=${sortDirection}`, { headers: { 'x-user-id': userId } });
      setFiles(res.data.files);
      setCurrentPath(res.data.currentPath);
    } catch (error) {
      console.error('Failed to fetch files:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileClick = (file) => {
    if (file.type === 'directory') {
      setCurrentPath(prevPath => `${prevPath}${file.name}/`);
    } else {
      setSelectedFile(file);
      setDialogAction('edit');
      setIsDialogOpen(true);
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
      if (dialogAction === 'directory' || dialogAction === 'file') {
        await axios.post('/api/files',
          { name: newItemName, type: dialogAction, path: currentPath },
          { headers: { 'x-user-id': userId } }
        );
      } else if (dialogAction === 'edit') {
        await axios.put('/api/files',
          { name: selectedFile.name, content: fileContent, path: currentPath },
          { headers: { 'x-user-id': userId } }
        );
      } else if (dialogAction === 'delete') {
        await axios.delete('/api/files',
          { data: { name: selectedFile.name, path: currentPath } },
          { headers: { 'x-user-id': userId } }
        );
      } else if (dialogAction === 'rename') {
        await axios.put('/api/files',
          { oldName: selectedFile.name, newName: newItemName, path: currentPath },
          { headers: { 'x-user-id': userId } }
        );
      }
      fetchFiles(currentPath);
      handleDialogClose();
    } catch (error) {
      console.error('Operation failed:', error);
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
      { headers: { 'x-user-id': userId }});
      fetchFiles(currentPath);
      handleNewFileDialogClose();
    } catch (error) {
      console.error('Failed to create new file:', error);
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
      const response = await axios.get(`/api/files/download?path=${encodeURIComponent(currentPath + selectedFile.name)}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', selectedFile.name);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Download failed:', error);
    }
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
    <Box sx={{ maxWidth: 800, margin: 'auto', mt: 4 }}>
      <Typography variant="h4" gutterBottom>
        File Manager
      </Typography>
      <Paper elevation={3} sx={{ p: 2, mb: 2 }}>
        {renderBreadcrumbs()}
      </Paper>
      <Grid container spacing={2} sx={{ mb: 2 }}>
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
      </Grid>
      <Paper elevation={3}>
        <List>
          <ListItem>
            <ListItemIcon></ListItemIcon>
            <ListItemText primary={<Button onClick={() => handleSort('name')}>Name {sortBy === 'name' && (sortDirection === 'asc' ? '▲' : '▼')}</Button>} />
            <ListItemText primary={<Button onClick={() => handleSort('size')}>Size {sortBy === 'size' && (sortDirection === 'asc' ? '▲' : '▼')}</Button>} />
            <ListItemText primary={<Button onClick={() => handleSort('lastModified')}>Last Modified {sortBy === 'lastModified' && (sortDirection === 'asc' ? '▲' : '▼')}</Button>} />
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
                <ListItemText primary={file.name} />
                <ListItemText primary={file.size} />
                <ListItemText primary={file.lastModified} />
                <IconButton onClick={(e) => handleMenuOpen(e, file)}>
                  <MoreVert />
                </IconButton>
              </ListItem>
            ))
          )}
        </List>
      </Paper>
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
        <DialogTitle>{dialogAction === 'edit' ? 'Edit File' : dialogAction === 'delete' ? 'Delete Item' : dialogAction === 'rename' ? 'Rename Item' : `New ${dialogAction}`}</DialogTitle>
        <DialogContent>
          {dialogAction === 'edit' ? (
            <TextField
              autoFocus
              margin="dense"
              label="File Content"
              fullWidth
              multiline
              rows={4}
              value={fileContent}
              onChange={(e) => setFileContent(e.target.value)}
            />
          ) : dialogAction === 'delete' ? (
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
      <NewFileDialog isNewFileDialogOpen={isNewFileDialogOpen} handleNewFileDialogClose={handleNewFileDialogClose} handleNewFileConfirm={handleNewFileConfirm} />
    </Box>
  );
}



const NewFileDialog = ({ isNewFileDialogOpen, handleNewFileDialogClose, handleNewFileConfirm }) => {
  const [newFileName, setNewFileName] = useState('');
  const [newFileContent, setNewFileContent] = useState('');

  const handleEditorChange = (value) => {
    setNewFileContent(value || '');
  };

  return (
    <Dialog open={isNewFileDialogOpen} onClose={handleNewFileDialogClose} maxWidth="md" fullWidth>
      <DialogTitle>Create New File</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          label="File Name"
          fullWidth
          value={newFileName}
          onChange={(e) => setNewFileName(e.target.value)}
          sx={{ mb: 2 }}
        />
        <div style={{ height: '500px', width: '100%' }}>
          <Editor
            height="100%"
            width="100%"
            language="javascript" // You can adjust this according to the file type
            value={newFileContent}
            onChange={handleEditorChange}
            options={{
              selectOnLineNumbers: true,
              lineNumbers: 'on',
              fontFamily: 'monospace',
            }}
          />
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleNewFileDialogClose}>Cancel</Button>
        <Button onClick={() => handleNewFileConfirm(newFileName, newFileContent)}>Create File</Button>
      </DialogActions>
    </Dialog>
  );
};

