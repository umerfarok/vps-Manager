import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Typography, Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions,
  List, ListItem, ListItemIcon, ListItemText, IconButton, Menu, MenuItem, Breadcrumbs, Link,
  Grid, Paper, Divider, Tooltip, CircularProgress, Snackbar, Alert, AppBar, Toolbar, Checkbox
} from '@mui/material';
import {
  Folder, InsertDriveFile, ArrowUpward, CreateNewFolder, NoteAdd, Refresh, MoreVert,
  Edit, Delete, FileCopy, Download, Upload, Save, Cancel, Description, Image,
  Code, Settings, PictureAsPdf, AudioFile, VideoFile, Archive, TextSnippet,
  Home, ChevronRight, CheckBox, CheckBoxOutlineBlank, SelectAll, DeleteSweep, ContentCopy, DriveFileMove,
  Keyboard
} from '@mui/icons-material';
import axios from 'axios';
import { format } from 'date-fns';
import { useHotkeys } from 'react-hotkeys-hook';
import clsx from 'clsx';
import { Editor } from '@monaco-editor/react';
import { useUser } from '../UserContext';
import { useConnectionStatus } from '../useConnectionStatus';
import { sshManager } from '../lib/sshManager';
import { useErrorHandler } from '../lib/errorHandler';
import { pathUtils } from '../lib/pathUtils';
import DragDropUpload from '../components/DragDropUpload';
import ConfirmationDialog from '../components/ConfirmationDialog';
import ContextMenu from '../components/ContextMenu';

export default function FileManager() {
  const [files, setFiles] = useState([]);
  const [currentPath, setCurrentPath] = useState('/');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogAction, setDialogAction] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [fileContent, setFileContent] = useState('');
  const [originalFileContent, setOriginalFileContent] = useState('');
  const [anchorEl, setAnchorEl] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sortBy, setSortBy] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');
  const [isNewFileDialogOpen, setIsNewFileDialogOpen] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFileContent, setNewFileContent] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [isEditMode, setIsEditMode] = useState(false);
  const [fileLanguage, setFileLanguage] = useState('plaintext');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [bulkOperation, setBulkOperation] = useState('');
  const [bulkTargetPath, setBulkTargetPath] = useState('');
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [confirmationDialog, setConfirmationDialog] = useState({
    open: false,
    title: '',
    message: '',
    items: [],
    severity: 'warning'
  });
  const [pendingConfirmationAction, setPendingConfirmationAction] = useState(null);
  const [contextMenu, setContextMenu] = useState({
    open: false,
    position: null,
    items: []
  });
  const { userId, isLoadingUserId } = useUser();
  const { isConnected, requireConnection, connectionState } = useConnectionStatus();
  const { handleError } = useErrorHandler();

  const showSnackbar = (message, severity = 'info') => {
    setSnackbar({ open: true, message, severity });
  };

  const closeSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0 || !bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatFileDate = (dateString) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date)) return 'Unknown';

      const now = new Date();
      const diffMs = now - date;
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        return format(date, 'HH:mm');
      } else if (diffDays === 1) {
        return 'Yesterday';
      } else if (diffDays < 7) {
        return format(date, 'EEEE');
      } else if (diffDays < 365) {
        return format(date, 'MMM d');
      } else {
        return format(date, 'yyyy MMM d');
      }
    } catch (error) {
      return 'Unknown';
    }
  };

  const getFileIcon = (fileName, isDirectory) => {
    if (isDirectory) {
      return <Folder sx={{ color: 'warning.main', fontSize: 28 }} />;
    }

    const ext = fileName.toLowerCase().split('.').pop();

    const iconMap = {
      'txt': <TextSnippet sx={{ color: 'text.secondary', fontSize: 28 }} />,
      'md': <TextSnippet sx={{ color: 'text.secondary', fontSize: 28 }} />,
      'html': <Code sx={{ color: 'orange', fontSize: 28 }} />,
      'css': <Code sx={{ color: 'blue', fontSize: 28 }} />,
      'js': <Code sx={{ color: 'yellow', fontSize: 28 }} />,
      'jsx': <Code sx={{ color: 'blue', fontSize: 28 }} />,
      'ts': <Code sx={{ color: 'blue', fontSize: 28 }} />,
      'tsx': <Code sx={{ color: 'blue', fontSize: 28 }} />,
      'json': <Code sx={{ color: 'green', fontSize: 28 }} />,
      'xml': <Code sx={{ color: 'orange', fontSize: 28 }} />,
      'py': <Code sx={{ color: 'green', fontSize: 28 }} />,
      'java': <Code sx={{ color: 'red', fontSize: 28 }} />,
      'php': <Code sx={{ color: 'purple', fontSize: 28 }} />,
      'rb': <Code sx={{ color: 'red', fontSize: 28 }} />,
      'go': <Code sx={{ color: 'cyan', fontSize: 28 }} />,
      'rs': <Code sx={{ color: 'orange', fontSize: 28 }} />,
      'cpp': <Code sx={{ color: 'blue', fontSize: 28 }} />,
      'c': <Code sx={{ color: 'blue', fontSize: 28 }} />,
      'jpg': <Image sx={{ color: 'purple', fontSize: 28 }} />,
      'jpeg': <Image sx={{ color: 'purple', fontSize: 28 }} />,
      'png': <Image sx={{ color: 'purple', fontSize: 28 }} />,
      'gif': <Image sx={{ color: 'purple', fontSize: 28 }} />,
      'svg': <Image sx={{ color: 'purple', fontSize: 28 }} />,
      'webp': <Image sx={{ color: 'purple', fontSize: 28 }} />,
      'pdf': <PictureAsPdf sx={{ color: 'red', fontSize: 28 }} />,
      'mp3': <AudioFile sx={{ color: 'purple', fontSize: 28 }} />,
      'wav': <AudioFile sx={{ color: 'purple', fontSize: 28 }} />,
      'mp4': <VideoFile sx={{ color: 'purple', fontSize: 28 }} />,
      'avi': <VideoFile sx={{ color: 'purple', fontSize: 28 }} />,
      'mov': <VideoFile sx={{ color: 'purple', fontSize: 28 }} />,
      'zip': <Archive sx={{ color: 'orange', fontSize: 28 }} />,
      'tar': <Archive sx={{ color: 'orange', fontSize: 28 }} />,
      'gz': <Archive sx={{ color: 'orange', fontSize: 28 }} />,
      'rar': <Archive sx={{ color: 'orange', fontSize: 28 }} />,
      '7z': <Archive sx={{ color: 'orange', fontSize: 28 }} />,
      'conf': <Settings sx={{ color: 'grey', fontSize: 28 }} />,
      'config': <Settings sx={{ color: 'grey', fontSize: 28 }} />,
      'log': <Description sx={{ color: 'grey', fontSize: 28 }} />,
    };

    return iconMap[ext] || <InsertDriveFile sx={{ color: 'text.secondary', fontSize: 28 }} />;
  };

  const getFileLanguage = (fileName) => {
    if (!fileName) return 'plaintext';

    const ext = fileName.toLowerCase().split('.').pop();

    const languageMap = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'py': 'python',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'cs': 'csharp',
      'php': 'php',
      'rb': 'ruby',
      'go': 'go',
      'rs': 'rust',
      'swift': 'swift',
      'kt': 'kotlin',
      'scala': 'scala',
      'html': 'html',
      'xml': 'xml',
      'css': 'css',
      'scss': 'scss',
      'sass': 'sass',
      'less': 'less',
      'json': 'json',
      'yaml': 'yaml',
      'yml': 'yaml',
      'md': 'markdown',
      'sql': 'sql',
      'sh': 'shell',
      'bash': 'shell',
      'zsh': 'shell',
      'ps1': 'powershell',
      'dockerfile': 'dockerfile',
      'makefile': 'makefile',
      'toml': 'toml',
      'ini': 'ini',
      'cfg': 'ini',
      'conf': 'ini',
      'log': 'log',
      'txt': 'plaintext'
    };

    return languageMap[ext] || 'plaintext';
  };

  const handleFileContentChange = (value) => {
    setFileContent(value);
    setHasUnsavedChanges(value !== originalFileContent);
  };

  const handleFileSelect = (file, isSelected) => {
    if (isSelected) {
      setSelectedFiles(prev => [...prev, file]);
    } else {
      setSelectedFiles(prev => prev.filter(f => f.name !== file.name));
    }
  };

  const handleSelectAll = () => {
    if (selectedFiles.length === files.length) {
      setSelectedFiles([]);
    } else {
      setSelectedFiles([...files]);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedFiles.length === 0) return;

    const confirmAction = async () => {
      try {
        await requireConnection();

        const deletePromises = selectedFiles.map(async (file) => {
          const fullPath = pathUtils.join(currentPath, file.name);
          return axios.delete('/api/files', {
            data: { name: file.name, path: currentPath },
            headers: { 'x-user-id': userId }
          });
        });

        await Promise.all(deletePromises);

        setSelectedFiles([]);
        setIsBulkMode(false);
        showSnackbar(`${selectedFiles.length} item(s) deleted successfully`, 'success');
        fetchFiles(currentPath);
      } catch (error) {
        const errorInfo = handleError(error, 'Bulk delete');
        showSnackbar(`${errorInfo.title}: ${errorInfo.message}`, errorInfo.severity);
      }
    };

    setPendingConfirmationAction(() => confirmAction);
    setConfirmationDialog({
      open: true,
      title: 'Delete Multiple Items',
      message: `Are you sure you want to delete ${selectedFiles.length} selected item(s)?`,
      items: selectedFiles,
      severity: 'error',
      confirmText: 'Delete',
      additionalInfo: 'This will permanently remove the selected files and folders from your VPS.'
    });
  };

  const handleBulkMove = async (targetPath) => {
    if (selectedFiles.length === 0 || !targetPath) return;

    try {
      await requireConnection();

      const movePromises = selectedFiles.map(async (file) => {
        const fullPath = pathUtils.join(currentPath, file.name);
        const targetFullPath = pathUtils.join(targetPath, file.name);

        return sshManager.executeCommand(userId, `mv "${fullPath}" "${targetFullPath}"`);
      });

      await Promise.all(movePromises);

      setSelectedFiles([]);
      setIsBulkMode(false);
      showSnackbar(`${selectedFiles.length} item(s) moved successfully`, 'success');
      fetchFiles(currentPath);
    } catch (error) {
      const errorInfo = handleError(error, 'Bulk move');
      showSnackbar(`${errorInfo.title}: ${errorInfo.message}`, errorInfo.severity);
    }
  };

  const handleBulkCopy = async (targetPath) => {
    if (selectedFiles.length === 0 || !targetPath) return;

    try {
      await requireConnection();

      const copyPromises = selectedFiles.map(async (file) => {
        if (file.type === 'directory') {
          return sshManager.executeCommand(userId, `cp -r "${pathUtils.join(currentPath, file.name)}" "${pathUtils.join(targetPath, file.name)}"`);
        } else {
          return sshManager.executeCommand(userId, `cp "${pathUtils.join(currentPath, file.name)}" "${pathUtils.join(targetPath, file.name)}"`);
        }
      });

      await Promise.all(copyPromises);

      setSelectedFiles([]);
      setIsBulkMode(false);
      showSnackbar(`${selectedFiles.length} item(s) copied successfully`, 'success');
      fetchFiles(currentPath);
    } catch (error) {
      const errorInfo = handleError(error, 'Bulk copy');
      showSnackbar(`${errorInfo.title}: ${errorInfo.message}`, errorInfo.severity);
    }
  };

  const toggleBulkMode = () => {
    setIsBulkMode(!isBulkMode);
    if (isBulkMode) {
      setSelectedFiles([]);
    }
  };

  const handleContextMenu = (event, file) => {
    event.preventDefault();
    event.stopPropagation();

    const items = file ? [file] : selectedFiles.length > 0 ? selectedFiles : [];

    if (items.length > 0) {
      setContextMenu({
        open: true,
        position: { top: event.clientY, left: event.clientX },
        items: items
      });
    }
  };

  const handleContextMenuAction = (action, items) => {
    switch (action) {
      case 'open':
        if (items[0]) handleFileClick(items[0]);
        break;
      case 'download':
        if (items[0] && items[0].type === 'file') {
          setSelectedFile(items[0]);
          handleDownload();
        }
        break;
      case 'rename':
        if (items[0]) {
          setSelectedFile(items[0]);
          setDialogAction('rename');
          setIsDialogOpen(true);
        }
        break;
      case 'delete':
        if (items[0]) {
          setSelectedFile(items[0]);
          setDialogAction('delete');
          setIsDialogOpen(true);
        }
        break;
      case 'copy':
      case 'bulk_copy':
        if (items.length > 0) {
          setSelectedFiles(items);
          setBulkOperation('copy');
        }
        break;
      case 'move':
      case 'bulk_move':
        if (items.length > 0) {
          setSelectedFiles(items);
          setBulkOperation('move');
        }
        break;
      case 'bulk_delete':
        if (items.length > 0) {
          setSelectedFiles(items);
          handleBulkDelete();
        }
        break;
      case 'open_directory':
        if (items[0] && items[0].type === 'directory') {
          handleFileClick(items[0]);
        }
        break;
      case 'new_file':
        if (items[0] && items[0].type === 'directory') {
          setCurrentPath(prevPath => `${prevPath}${items[0].name}/`);
          handleNewItem('file');
        }
        break;
      case 'new_folder':
        if (items[0] && items[0].type === 'directory') {
          setCurrentPath(prevPath => `${prevPath}${items[0].name}/`);
          handleNewItem('directory');
        }
        break;
      case 'refresh':
        fetchFiles(currentPath);
        showSnackbar('Files refreshed', 'info');
        break;
      case 'properties':
        // TODO: Implement properties dialog
        showSnackbar('Properties feature coming soon', 'info');
        break;
      case 'cut':
      case 'paste':
        // TODO: Implement clipboard operations
        showSnackbar(`${action.charAt(0).toUpperCase() + action.slice(1)} feature coming soon`, 'info');
        break;
      default:
        console.log('Unknown context menu action:', action);
    }
  };

  const fetchFiles = useCallback(async (path) => {
    setIsLoading(true);
    if (!userId) {
      console.error("userId is not set");
      setIsLoading(false);
      return;
    }

    try {
      await requireConnection();
      const startTime = Date.now();
      const res = await axios.get(`/api/files?path=${encodeURIComponent(path)}&sortBy=${sortBy}&sortDirection=${sortDirection}`, {
        headers: { 'x-user-id': userId },
        timeout: 30000 // 30 second timeout for file listing
      });

      const loadTime = Date.now() - startTime;
      console.log(`File listing completed in ${loadTime}ms for path: ${path}`);

      setFiles(res.data.files || []);
      setCurrentPath(res.data.currentPath || path);

      // Show success message for slow operations
      if (loadTime > 2000) {
        showSnackbar(`Loaded ${res.data.totalFiles || res.data.files.length} items`, 'success');
      }
    } catch (error) {
      const errorInfo = handleError(error, 'File listing');
      showSnackbar(`${errorInfo.title}: ${errorInfo.message}`, errorInfo.severity);
      if (errorInfo.suggestion) {
        setTimeout(() => showSnackbar(errorInfo.suggestion, 'info'), 3000);
      }
      setFiles([]); // Clear files on error
    } finally {
      setIsLoading(false);
    }
  }, [userId, sortBy, sortDirection, requireConnection]);

  useEffect(() => {
    if (userId) {
      fetchFiles(currentPath);
    }
  }, [fetchFiles, currentPath, userId]);

  // Keyboard shortcuts using react-hotkeys-hook
  useHotkeys('ctrl+r, cmd+r', (e) => {
    e.preventDefault();
    fetchFiles(currentPath);
    showSnackbar('Files refreshed', 'info');
  }, [currentPath]);

  useHotkeys('ctrl+n', (e) => {
    e.preventDefault();
    handleNewItem('file');
  });

  useHotkeys('ctrl+shift+n', (e) => {
    e.preventDefault();
    handleNewItem('directory');
  });

  useHotkeys('ctrl+a', (e) => {
    if (isBulkMode) {
      e.preventDefault();
      handleSelectAll();
    }
  }, [isBulkMode]);

  useHotkeys('ctrl+u', (e) => {
    e.preventDefault();
    document.getElementById('file-upload-input')?.click();
  });

  useHotkeys('f2', (e) => {
    if (selectedFile && !isBulkMode) {
      e.preventDefault();
      setDialogAction('rename');
      setIsDialogOpen(true);
    }
  }, [selectedFile, isBulkMode]);

  useHotkeys('delete, backspace', (e) => {
    e.preventDefault();
    if (isBulkMode && selectedFiles.length > 0) {
      handleBulkDelete();
    } else if (selectedFile && !isBulkMode) {
      setDialogAction('delete');
      setIsDialogOpen(true);
    }
  }, [isBulkMode, selectedFiles, selectedFile]);

  useHotkeys('f5', (e) => {
    e.preventDefault();
    fetchFiles(currentPath);
    showSnackbar('Files refreshed', 'info');
  }, [currentPath]);

  useHotkeys('escape', (e) => {
    e.preventDefault();
    if (isBulkMode) {
      toggleBulkMode();
    } else if (isEditMode) {
      handleCancelEdit();
    }
  }, [isBulkMode, isEditMode]);

  useHotkeys('arrowup', (e) => {
    if (!isBulkMode && !isEditMode) {
      e.preventDefault();
      handleGoUp();
    }
  }, [isBulkMode, isEditMode]);

  useHotkeys('f1', (e) => {
    e.preventDefault();
    setShowKeyboardHelp(true);
  });
  const handleFileClick = async (file) => {
    if (file.type === 'directory') {
      setCurrentPath(prevPath => `${prevPath}${file.name}/`);
      // Clear selected files when navigating to a directory
      setSelectedFiles([]);
      setIsBulkMode(false);
    } else {
      try {
        await requireConnection();
        setSelectedFile(file);
        // Clear selected files when opening a file for editing
        setSelectedFiles([]);
        setIsBulkMode(false);
        setIsLoading(true);
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
        setOriginalFileContent(res.data.content);
        setFileLanguage(getFileLanguage(file.name));
        setHasUnsavedChanges(false);
        setIsEditMode(true);
      } catch (error) {
        const errorInfo = handleError(error, 'File reading');
        showSnackbar(`${errorInfo.title}: ${errorInfo.message}`, errorInfo.severity);
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
      await requireConnection();

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
      if (error.message.includes('No active connection')) {
        showSnackbar('Please connect to your VPS first', 'warning');
      } else {
        showSnackbar(`Failed to ${dialogAction}`, 'error');
      }
    }
  };

  const handleNewFileConfirm = async () => {
    try {
      await requireConnection();
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
      if (error.message.includes('No active connection')) {
        showSnackbar('Please connect to your VPS first', 'warning');
      } else {
        showSnackbar('Failed to create new file', 'error');
      }
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

    try {
      await requireConnection();
      const formData = new FormData();
      formData.append('file', file);
      formData.append('path', currentPath);

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
      if (error.message.includes('No active connection')) {
        showSnackbar('Please connect to your VPS first', 'warning');
      } else {
        showSnackbar('Failed to upload file', 'error');
      }
    }
  };

  const handleSaveFile = async () => {
    try {
      await requireConnection();
      await axios.put('/api/files',
        { name: selectedFile.name, content: fileContent, path: currentPath },
        { headers: { 'x-user-id': userId } }
      );
      showSnackbar('File updated successfully', 'success');
      setOriginalFileContent(fileContent);
      setHasUnsavedChanges(false);
      setIsEditMode(false);
    } catch (error) {
      console.error('Failed to save file:', error);
      if (error.message.includes('No active connection')) {
        showSnackbar('Please connect to your VPS first', 'warning');
      } else {
        showSnackbar('Failed to save file', 'error');
      }
    }
  };

  const handleCancelEdit = () => {
    if (hasUnsavedChanges) {
      const confirmed = window.confirm('You have unsaved changes. Are you sure you want to discard them?');
      if (!confirmed) return;
    }
    setIsEditMode(false);
    setSelectedFile(null);
    setFileContent('');
    setOriginalFileContent('');
    setHasUnsavedChanges(false);
    setFileLanguage('plaintext');
  };

  const renderBreadcrumbs = () => {
    const pathParts = currentPath.split('/').filter(Boolean);
    const allParts = ['/', ...pathParts];

    return (
      <Box sx={{ mb: 2 }}>
        <Breadcrumbs
          aria-label="breadcrumb"
          separator={<ChevronRight sx={{ color: 'text.secondary' }} />}
          sx={{
            '& .MuiBreadcrumbs-separator': {
              mx: 1
            }
          }}
        >
          {allParts.map((part, index) => {
            const isLast = index === allParts.length - 1;
            const pathToNavigate = index === 0 ? '/' : '/' + pathParts.slice(0, index).join('/') + '/';
            const displayName = index === 0 ? 'Root' : part;

            return (
              <Box
                key={index}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  px: 1,
                  py: 0.5,
                  borderRadius: 1,
                  transition: 'all 0.2s ease-in-out',
                  ...(isLast ? {
                    backgroundColor: 'primary.main',
                    color: 'primary.contrastText',
                    '&:hover': {
                      backgroundColor: 'primary.dark',
                    }
                  } : {
                    '&:hover': {
                      backgroundColor: 'action.hover',
                      cursor: 'pointer',
                    }
                  })
                }}
                onClick={() => !isLast && setCurrentPath(pathToNavigate)}
              >
                {index === 0 ? (
                  <Home sx={{ fontSize: 18 }} />
                ) : (
                  <Folder sx={{ fontSize: 16, color: 'warning.main' }} />
                )}
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: isLast ? 600 : 400,
                    fontSize: '0.875rem'
                  }}
                >
                  {displayName}
                </Typography>
              </Box>
            );
          })}
        </Breadcrumbs>

        {/* Quick navigation buttons */}
        <Box sx={{ display: 'flex', gap: 1, mt: 1, alignItems: 'center' }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<Home />}
            onClick={() => setCurrentPath('/')}
            disabled={currentPath === '/'}
            sx={{ minWidth: 'auto', px: 2 }}
          >
            Root
          </Button>

          {currentPath !== '/' && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<ArrowUpward />}
              onClick={handleGoUp}
              sx={{ minWidth: 'auto', px: 2 }}
            >
              Up
            </Button>
          )}

          <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
            {files.length} items • {currentPath}
          </Typography>
        </Box>
      </Box>
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tooltip title="Keyboard Shortcuts (F1)">
              <IconButton
                onClick={() => setShowKeyboardHelp(true)}
                sx={{ color: 'inherit' }}
                size="small"
              >
                <Keyboard />
              </IconButton>
            </Tooltip>
            <Typography
              variant="body2"
              sx={{
                color: isConnected ? 'success.main' : 'error.main',
                display: { xs: 'none', sm: 'block' }
              }}
            >
              {isConnected ? 'Connected' : 'Disconnected'}
            </Typography>
            <Box
              sx={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                bgcolor: isConnected ? 'success.main' : 'error.main',
                animation: !isConnected ? 'pulse 2s infinite' : 'none',
                '@keyframes pulse': {
                  '0%': { opacity: 1 },
                  '50%': { opacity: 0.5 },
                  '100%': { opacity: 1 },
                },
              }}
            />
          </Box>
        </Toolbar>
      </AppBar>
      <Box sx={{
        flexGrow: 1,
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        p: { xs: 1, sm: 2 }
      }}>
        <Paper
          elevation={3}
          sx={{
            width: { xs: '100%', md: '35%' },
            mb: { xs: 2, md: 0 },
            mr: { xs: 0, md: 2 },
            p: { xs: 1, sm: 2 },
            overflowY: 'auto',
            maxHeight: { xs: '40vh', md: '100%' }
          }}
        >
          {renderBreadcrumbs()}

          {/* Bulk Operations Toolbar */}
          {isBulkMode && (
            <Paper
              elevation={2}
              sx={{
                p: 2,
                mb: 2,
                bgcolor: 'primary.main',
                color: 'primary.contrastText'
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                    Bulk Mode: {selectedFiles.length} selected
                  </Typography>
                  <Button
                    startIcon={<SelectAll />}
                    onClick={handleSelectAll}
                    variant="outlined"
                    size="small"
                    sx={{
                      color: 'inherit',
                      borderColor: 'rgba(255,255,255,0.3)',
                      '&:hover': {
                        borderColor: 'rgba(255,255,255,0.5)',
                        bgcolor: 'rgba(255,255,255,0.1)'
                      }
                    }}
                  >
                    {selectedFiles.length === files.length ? 'Deselect All' : 'Select All'}
                  </Button>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    startIcon={<DeleteSweep />}
                    onClick={handleBulkDelete}
                    disabled={selectedFiles.length === 0}
                    variant="contained"
                    color="error"
                    size="small"
                  >
                    Delete ({selectedFiles.length})
                  </Button>
                  <Button
                    startIcon={<ContentCopy />}
                    onClick={() => setBulkOperation('copy')}
                    disabled={selectedFiles.length === 0}
                    variant="contained"
                    color="secondary"
                    size="small"
                  >
                    Copy ({selectedFiles.length})
                  </Button>
                  <Button
                    startIcon={<DriveFileMove />}
                    onClick={() => setBulkOperation('move')}
                    disabled={selectedFiles.length === 0}
                    variant="contained"
                    color="secondary"
                    size="small"
                  >
                    Move ({selectedFiles.length})
                  </Button>
                  <Button
                    onClick={toggleBulkMode}
                    variant="outlined"
                    size="small"
                    sx={{
                      color: 'inherit',
                      borderColor: 'rgba(255,255,255,0.3)',
                      '&:hover': {
                        borderColor: 'rgba(255,255,255,0.5)',
                        bgcolor: 'rgba(255,255,255,0.1)'
                      }
                    }}
                  >
                    Cancel
                  </Button>
                </Box>
              </Box>
            </Paper>
          )}

          {/* Mobile-friendly action buttons */}
          <Box sx={{
            display: 'flex',
            gap: 1,
            mb: 2,
            flexWrap: 'wrap',
            '& .MuiButton-root': {
              minWidth: { xs: 'auto', sm: '120px' },
              fontSize: { xs: '0.75rem', sm: '0.875rem' }
            }
          }}>
            <Button
              startIcon={<ArrowUpward />}
              onClick={handleGoUp}
              disabled={currentPath === '/'}
              variant="outlined"
              size="small"
            >
              Up
            </Button>
            <Button
              startIcon={<CreateNewFolder />}
              onClick={() => handleNewItem('directory')}
              variant="outlined"
              size="small"
            >
              Folder
            </Button>
            <Button
              startIcon={<NoteAdd />}
              onClick={() => handleNewItem('file')}
              variant="outlined"
              size="small"
            >
              File
            </Button>
            <Button
              startIcon={<Refresh />}
              onClick={() => fetchFiles(currentPath)}
              variant="outlined"
              size="small"
            >
              Refresh
            </Button>
            <Button
              startIcon={isBulkMode ? <CheckBox /> : <CheckBoxOutlineBlank />}
              onClick={toggleBulkMode}
              variant={isBulkMode ? "contained" : "outlined"}
              size="small"
              color={isBulkMode ? "primary" : "default"}
            >
              {isBulkMode ? 'Exit Bulk' : 'Bulk Mode'}
            </Button>
          </Box>

          {/* Mobile-optimized upload area */}
          <Box sx={{ my: 2 }}>
            <Typography variant="h6" sx={{ mb: 1, fontSize: { xs: '1rem', sm: '1.25rem' } }}>
              Upload Files
            </Typography>
            <DragDropUpload
              currentPath={currentPath}
              onUploadComplete={() => fetchFiles(currentPath)}
            />
          </Box>

          <Divider sx={{ my: 2 }} />

          {/* Sort buttons - hidden on very small screens */}
          <Box sx={{
            display: { xs: 'none', sm: 'block' },
            mb: 1
          }}>
            <Box sx={{
              display: 'flex',
              gap: 1,
              '& .MuiButton-root': {
                fontSize: '0.75rem',
                py: 0.5
              }
            }}>
              <Button
                size="small"
                onClick={() => handleSort('name')}
                variant={sortBy === 'name' ? 'contained' : 'outlined'}
              >
                Name {sortBy === 'name' && (sortDirection === 'asc' ? '▲' : '▼')}
              </Button>
              <Button
                size="small"
                onClick={() => handleSort('size')}
                variant={sortBy === 'size' ? 'contained' : 'outlined'}
              >
                Size {sortBy === 'size' && (sortDirection === 'asc' ? '▲' : '▼')}
              </Button>
              <Button
                size="small"
                onClick={() => handleSort('lastModified')}
                variant={sortBy === 'lastModified' ? 'contained' : 'outlined'}
              >
                Date {sortBy === 'lastModified' && (sortDirection === 'asc' ? '▲' : '▼')}
              </Button>
            </Box>
          </Box>

          <List sx={{ py: 0 }}>
            {isLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                <CircularProgress size={24} />
                <Typography variant="body2" sx={{ ml: 1 }}>
                  Loading...
                </Typography>
              </Box>
            ) : files.length === 0 ? (
              <Box sx={{ textAlign: 'center', p: 3 }}>
                <InsertDriveFile sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  No files in this directory
                </Typography>
                <Typography variant="caption" color="text.disabled">
                  Create files or folders to get started
                </Typography>
              </Box>
            ) : (
              files.map((file, index) => (
                <ListItem
                  key={index}
                  button={!isBulkMode}
                  onClick={() => !isBulkMode && handleFileClick(file)}
                  onContextMenu={(e) => handleContextMenu(e, file)}
                  className={clsx(
                    'file-list-item',
                    selectedFiles.some(f => f.name === file.name) && 'selected',
                    file.type === 'directory' && 'directory-item'
                  )}
                  sx={{
                    borderRadius: 2,
                    mb: 1,
                    p: { xs: 1.5, sm: 2 },
                    minHeight: { xs: 60, sm: 70 },
                    transition: 'all 0.2s ease-in-out',
                    border: '1px solid',
                    borderColor: selectedFiles.some(f => f.name === file.name) ? 'primary.main' : 'divider',
                    bgcolor: selectedFiles.some(f => f.name === file.name) ? 'primary.50' : 'transparent',
                    '&:hover': {
                      borderColor: 'primary.main',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                      transform: { xs: 'none', sm: 'translateX(2px)' }
                    },
                    '&:active': {
                      transform: { xs: 'scale(0.98)', sm: 'translateX(2px) scale(0.98)' }
                    }
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {isBulkMode && (
                      <Checkbox
                        checked={selectedFiles.some(f => f.name === file.name)}
                        onChange={(e) => handleFileSelect(file, e.target.checked)}
                        onClick={(e) => e.stopPropagation()}
                        size="small"
                        sx={{
                          p: 0,
                          '& .MuiSvgIcon-root': {
                            fontSize: { xs: 18, sm: 20 }
                          }
                        }}
                      />
                    )}
                    <Box sx={{
                      minWidth: { xs: 30, sm: 40 },
                      display: 'flex',
                      alignItems: 'center'
                    }}>
                      {getFileIcon(file.name, file.type === 'directory')}
                    </Box>
                  </Box>
                  <ListItemText
                    primary={
                      <Typography
                        variant="body1"
                        sx={{
                          fontWeight: file.type === 'directory' ? 600 : 400,
                          color: file.type === 'directory' ? 'warning.main' : 'text.primary',
                          fontSize: { xs: '0.875rem', sm: '1rem' },
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {file.name}
                      </Typography>
                    }
                    secondary={
                      <Box sx={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 0.5,
                        mt: 0.5,
                        alignItems: 'center',
                        fontSize: { xs: '0.7rem', sm: '0.75rem' }
                      }}>
                        <Typography variant="caption" color="text.secondary">
                          {file.type === 'directory' ? '📁 Folder' : `📄 ${formatFileSize(file.size)}`}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                          • {file.lastModifiedFormatted || formatFileDate(file.lastModified)}
                        </Typography>
                      </Box>
                    }
                  />
                  <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    ml: 'auto',
                    opacity: { xs: 1, sm: 0.7 },
                    transition: 'opacity 0.2s ease-in-out',
                    '.MuiListItem-root:hover &': {
                      opacity: 1
                    }
                  }}>
                    {/* Quick Actions */}
                    {file.type === 'file' && (
                      <Tooltip title="Download">
                        <IconButton
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedFile(file);
                            handleDownload();
                          }}
                          size="small"
                          sx={{
                            p: { xs: 0.5, sm: 1 },
                            color: 'primary.main',
                            '&:hover': {
                              bgcolor: 'primary.50',
                              transform: 'scale(1.1)'
                            },
                            transition: 'all 0.2s ease-in-out',
                            '& .MuiSvgIcon-root': {
                              fontSize: { xs: 16, sm: 18 }
                            }
                          }}
                        >
                          <Download />
                        </IconButton>
                      </Tooltip>
                    )}

                    <Tooltip title="Rename">
                      <IconButton
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedFile(file);
                          setDialogAction('rename');
                          setIsDialogOpen(true);
                        }}
                        size="small"
                        sx={{
                          p: { xs: 0.5, sm: 1 },
                          color: 'warning.main',
                          '&:hover': {
                            bgcolor: 'warning.50',
                            transform: 'scale(1.1)'
                          },
                          transition: 'all 0.2s ease-in-out',
                          '& .MuiSvgIcon-root': {
                            fontSize: { xs: 16, sm: 18 }
                          }
                        }}
                      >
                        <Edit />
                      </IconButton>
                    </Tooltip>

                    <Tooltip title="Delete">
                      <IconButton
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedFile(file);
                          setDialogAction('delete');
                          setIsDialogOpen(true);
                        }}
                        size="small"
                        sx={{
                          p: { xs: 0.5, sm: 1 },
                          color: 'error.main',
                          '&:hover': {
                            bgcolor: 'error.50',
                            transform: 'scale(1.1)'
                          },
                          transition: 'all 0.2s ease-in-out',
                          '& .MuiSvgIcon-root': {
                            fontSize: { xs: 16, sm: 18 }
                          }
                        }}
                      >
                        <Delete />
                      </IconButton>
                    </Tooltip>

                    <Tooltip title="More options">
                      <IconButton
                        onClick={(e) => handleMenuOpen(e, file)}
                        size="small"
                        sx={{
                          p: { xs: 0.5, sm: 1 },
                          '&:hover': {
                            bgcolor: 'action.hover',
                            transform: 'scale(1.1)'
                          },
                          transition: 'all 0.2s ease-in-out',
                          '& .MuiSvgIcon-root': {
                            fontSize: { xs: 16, sm: 18 }
                          }
                        }}
                      >
                        <MoreVert />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </ListItem>
              ))
            )}
          </List>
        </Paper>

        {/* File editor - hidden on mobile when not editing */}
        <Paper
          elevation={3}
          sx={{
            flexGrow: 1,
            p: { xs: 1, sm: 2 },
            display: { xs: isEditMode ? 'flex' : 'none', md: 'flex' },
            flexDirection: 'column'
          }}
        >
          {isEditMode ? (
            <>
              <Box sx={{
                mb: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 1
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0 }}>
                  <Typography
                    variant="h6"
                    sx={{
                      fontSize: { xs: '1rem', sm: '1.25rem' },
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1
                    }}
                  >
                    {selectedFile?.name}
                  </Typography>
                  {hasUnsavedChanges && (
                    <Typography variant="caption" sx={{
                      color: 'warning.main',
                      fontWeight: 600,
                      fontSize: '0.75rem',
                      whiteSpace: 'nowrap'
                    }}>
                      • Unsaved
                    </Typography>
                  )}
                  <Chip
                    label={fileLanguage}
                    size="small"
                    variant="outlined"
                    sx={{
                      fontSize: '0.7rem',
                      height: 20,
                      '& .MuiChip-label': {
                        px: 1
                      }
                    }}
                  />
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    startIcon={<Save />}
                    onClick={handleSaveFile}
                    variant="contained"
                    size="small"
                    sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
                  >
                    Save
                  </Button>
                  <Button
                    startIcon={<Cancel />}
                    onClick={handleCancelEdit}
                    variant="outlined"
                    size="small"
                    sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
                  >
                    Cancel
                  </Button>
                </Box>
              </Box>
              <Box sx={{ flexGrow: 1, minHeight: { xs: '50vh', md: 'auto' } }}>
                {isLoading ? (
                  <Box sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '100%',
                    minHeight: 200
                  }}>
                    <CircularProgress />
                  </Box>
                ) : (
                  <Editor
                    height="100%"
                    language={fileLanguage}
                    value={fileContent}
                    onChange={handleFileContentChange}
                    options={{
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                      fontSize: 14,
                      wordWrap: 'on',
                      automaticLayout: true,
                      tabSize: 2,
                      insertSpaces: true,
                      detectIndentation: true,
                      renderWhitespace: 'selection',
                      bracketMatching: 'always',
                      autoClosingBrackets: 'always',
                      autoClosingQuotes: 'always'
                    }}
                  />
                )}
              </Box>
            </>
          ) : (
            <Box sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              minHeight: 200,
              textAlign: 'center',
              p: 2
            }}>
              <InsertDriveFile sx={{ fontSize: 60, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                File Editor
              </Typography>
              <Typography variant="body2" color="text.disabled">
                Select a file from the list to edit its contents
              </Typography>
            </Box>
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

      {/* Bulk Operation Dialog */}
      <Dialog
        open={bulkOperation !== ''}
        onClose={() => {
          setBulkOperation('');
          setBulkTargetPath('');
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {bulkOperation === 'move' ? 'Move Selected Items' : 'Copy Selected Items'}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            {selectedFiles.length} item(s) selected. Enter the target directory path:
          </Typography>
          <TextField
            autoFocus
            fullWidth
            label="Target Directory"
            placeholder="/path/to/destination"
            variant="outlined"
            value={bulkTargetPath}
            onChange={(e) => setBulkTargetPath(e.target.value)}
            helperText="Use absolute path or relative to current directory"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setBulkOperation('');
            setBulkTargetPath('');
          }}>Cancel</Button>
          <Button
            onClick={() => {
              if (bulkOperation === 'move') {
                handleBulkMove(bulkTargetPath);
              } else {
                handleBulkCopy(bulkTargetPath);
              }
              setBulkOperation('');
              setBulkTargetPath('');
            }}
            variant="contained"
            disabled={!bulkTargetPath.trim()}
          >
            {bulkOperation === 'move' ? 'Move' : 'Copy'} Items
          </Button>
        </DialogActions>
      </Dialog>

      {/* Keyboard Shortcuts Help Dialog */}
      <Dialog
        open={showKeyboardHelp}
        onClose={() => setShowKeyboardHelp(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Keyboard />
          Keyboard Shortcuts
        </DialogTitle>
        <DialogContent>
          <Typography variant="h6" sx={{ mb: 2, mt: 1 }}>
            General Shortcuts
          </Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={6} sm={4}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                <Typography variant="body2">Refresh Files</Typography>
                <Typography variant="caption" sx={{ fontFamily: 'monospace', bgcolor: 'grey.100', px: 1, py: 0.5, borderRadius: 0.5 }}>Ctrl+R / F5</Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={4}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                <Typography variant="body2">New File</Typography>
                <Typography variant="caption" sx={{ fontFamily: 'monospace', bgcolor: 'grey.100', px: 1, py: 0.5, borderRadius: 0.5 }}>Ctrl+N</Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={4}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                <Typography variant="body2">New Folder</Typography>
                <Typography variant="caption" sx={{ fontFamily: 'monospace', bgcolor: 'grey.100', px: 1, py: 0.5, borderRadius: 0.5 }}>Ctrl+Shift+N</Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={4}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                <Typography variant="body2">Upload File</Typography>
                <Typography variant="caption" sx={{ fontFamily: 'monospace', bgcolor: 'grey.100', px: 1, py: 0.5, borderRadius: 0.5 }}>Ctrl+U</Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={4}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                <Typography variant="body2">Go Up</Typography>
                <Typography variant="caption" sx={{ fontFamily: 'monospace', bgcolor: 'grey.100', px: 1, py: 0.5, borderRadius: 0.5 }}>↑</Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={4}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                <Typography variant="body2">Help</Typography>
                <Typography variant="caption" sx={{ fontFamily: 'monospace', bgcolor: 'grey.100', px: 1, py: 0.5, borderRadius: 0.5 }}>F1</Typography>
              </Box>
            </Grid>
          </Grid>

          <Typography variant="h6" sx={{ mb: 2 }}>
            File Operations
          </Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={6} sm={4}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                <Typography variant="body2">Rename</Typography>
                <Typography variant="caption" sx={{ fontFamily: 'monospace', bgcolor: 'grey.100', px: 1, py: 0.5, borderRadius: 0.5 }}>F2</Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={4}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                <Typography variant="body2">Delete</Typography>
                <Typography variant="caption" sx={{ fontFamily: 'monospace', bgcolor: 'grey.100', px: 1, py: 0.5, borderRadius: 0.5 }}>Del</Typography>
              </Box>
            </Grid>
          </Grid>

          <Typography variant="h6" sx={{ mb: 2 }}>
            Bulk Mode Shortcuts
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={6} sm={4}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                <Typography variant="body2">Select All</Typography>
                <Typography variant="caption" sx={{ fontFamily: 'monospace', bgcolor: 'grey.100', px: 1, py: 0.5, borderRadius: 0.5 }}>Ctrl+A</Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={4}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                <Typography variant="body2">Delete Selected</Typography>
                <Typography variant="caption" sx={{ fontFamily: 'monospace', bgcolor: 'grey.100', px: 1, py: 0.5, borderRadius: 0.5 }}>Ctrl+Del</Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={4}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                <Typography variant="body2">Exit Bulk Mode</Typography>
                <Typography variant="caption" sx={{ fontFamily: 'monospace', bgcolor: 'grey.100', px: 1, py: 0.5, borderRadius: 0.5 }}>Esc</Typography>
              </Box>
            </Grid>
          </Grid>

          <Typography variant="body2" sx={{ mt: 3, color: 'text.secondary', fontStyle: 'italic' }}>
            💡 Tip: Keyboard shortcuts work when not typing in input fields
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowKeyboardHelp(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Enhanced Confirmation Dialog */}
      <ConfirmationDialog
        open={confirmationDialog.open}
        onClose={() => {
          setConfirmationDialog(prev => ({ ...prev, open: false }));
          setPendingConfirmationAction(null);
        }}
        onConfirm={() => {
          if (pendingConfirmationAction) {
            pendingConfirmationAction();
          }
          setConfirmationDialog(prev => ({ ...prev, open: false }));
          setPendingConfirmationAction(null);
        }}
        title={confirmationDialog.title}
        message={confirmationDialog.message}
        confirmText={confirmationDialog.confirmText || 'Confirm'}
        severity={confirmationDialog.severity}
        items={confirmationDialog.items}
        additionalInfo={confirmationDialog.additionalInfo}
      />

      {/* Enhanced Context Menu */}
      <ContextMenu
        open={contextMenu.open}
        position={contextMenu.position}
        onClose={() => setContextMenu({ open: false, position: null, items: [] })}
        items={contextMenu.items}
        onAction={handleContextMenuAction}
        isBulkMode={isBulkMode}
        selectedItems={selectedFiles}
      />

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
