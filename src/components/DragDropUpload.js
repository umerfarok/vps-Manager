import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Box, Typography, LinearProgress, IconButton, List, ListItem,
  ListItemText, ListItemSecondaryAction, Chip, Paper
} from '@mui/material';
import {
  CloudUpload, CheckCircle, Error, Close, InsertDriveFile
} from '@mui/icons-material';
import axios from 'axios';
import { useUser } from '../UserContext';
import { useConnectionStatus } from '../useConnectionStatus';

const DragDropUpload = ({ currentPath, onUploadComplete }) => {
  const [uploadQueue, setUploadQueue] = useState([]);
  const { userId } = useUser();
  const { requireConnection } = useConnectionStatus();

  const onDrop = useCallback(async (acceptedFiles) => {
    try {
      await requireConnection();
    } catch (error) {
      console.error('Connection check failed:', error);
      return; // Connection check failed, don't proceed
    }

    // Validate file sizes before processing
    const maxFileSize = 100 * 1024 * 1024; // 100MB
    const oversizedFiles = acceptedFiles.filter(file => file.size > maxFileSize);

    if (oversizedFiles.length > 0) {
      console.error(`Files too large: ${oversizedFiles.map(f => f.name).join(', ')}`);
      // Could show user notification here
      return;
    }

    const newUploads = acceptedFiles.map((file, index) => ({
      id: `${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
      file,
      progress: 0,
      status: 'pending', // pending, uploading, completed, error
      error: null,
      startTime: null,
      endTime: null
    }));

    setUploadQueue(prev => [...prev, ...newUploads]);

    // Start uploading files sequentially to avoid overwhelming the server
    let uploadIndex = 0;
    const processNextUpload = async () => {
      if (uploadIndex >= newUploads.length) return;

      const upload = newUploads[uploadIndex];
      upload.startTime = new Date();
      await uploadFile(upload);
      upload.endTime = new Date();

      uploadIndex++;
      // Add small delay between uploads
      setTimeout(processNextUpload, 100);
    };

    processNextUpload();
  }, [requireConnection, currentPath, userId]);

  const uploadFile = async (upload) => {
    try {
      setUploadQueue(prev => prev.map(u =>
        u.id === upload.id ? { ...u, status: 'uploading' } : u
      ));

      const formData = new FormData();
      formData.append('file', upload.file);
      formData.append('path', currentPath);

      const response = await axios.post('/api/files?action=upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'x-user-id': userId
        },
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded / progressEvent.total) * 100);
          setUploadQueue(prev => prev.map(u =>
            u.id === upload.id ? { ...u, progress } : u
          ));
        }
      });

      setUploadQueue(prev => prev.map(u =>
        u.id === upload.id ? { ...u, status: 'completed', progress: 100 } : u
      ));

      // Remove completed upload after 2 seconds
      setTimeout(() => {
        setUploadQueue(prev => prev.filter(u => u.id !== upload.id));
        onUploadComplete && onUploadComplete();
      }, 2000);

    } catch (error) {
      console.error('Upload failed:', error);
      setUploadQueue(prev => prev.map(u =>
        u.id === upload.id ? {
          ...u,
          status: 'error',
          error: error.message || 'Upload failed'
        } : u
      ));
    }
  };

  const removeUpload = (uploadId) => {
    setUploadQueue(prev => prev.filter(u => u.id !== uploadId));
  };

  const retryUpload = (upload) => {
    setUploadQueue(prev => prev.map(u =>
      u.id === upload.id ? { ...u, status: 'pending', progress: 0, error: null } : u
    ));
    uploadFile(upload);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    maxSize: 100 * 1024 * 1024, // 100MB
    onDropRejected: (fileRejections) => {
      fileRejections.forEach(({ file, errors }) => {
        const errorMessage = errors.map(e => e.message).join(', ');
        setUploadQueue(prev => [...prev, {
          id: `${Date.now()}-${Math.random()}`,
          file,
          progress: 0,
          status: 'error',
          error: errorMessage
        }]);
      });
    }
  });

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle color="success" />;
      case 'error':
        return <Error color="error" />;
      case 'uploading':
        return <CloudUpload color="primary" />;
      default:
        return <InsertDriveFile color="action" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'error':
        return 'error';
      case 'uploading':
        return 'primary';
      default:
        return 'default';
    }
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Paper
        {...getRootProps()}
        sx={{
          p: 3,
          border: '2px dashed',
          borderColor: isDragActive ? 'primary.main' : 'grey.400',
          borderRadius: 2,
          bgcolor: isDragActive ? 'primary.50' : 'grey.50',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          '&:hover': {
            borderColor: 'primary.main',
            bgcolor: 'primary.50'
          }
        }}
      >
        <input {...getInputProps()} />
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
            py: 2
          }}
        >
          <CloudUpload
            sx={{
              fontSize: 48,
              color: isDragActive ? 'primary.main' : 'grey.500'
            }}
          />
          <Typography variant="h6" color="text.secondary">
            {isDragActive ? 'Drop files here...' : 'Drag & drop files here, or click to select'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Maximum file size: 100MB
          </Typography>
        </Box>
      </Paper>

      {uploadQueue.length > 0 && (
        <Paper sx={{ mt: 2, p: 2 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Upload Progress ({uploadQueue.length} file{uploadQueue.length !== 1 ? 's' : ''})
          </Typography>
          <List>
            {uploadQueue.map((upload) => (
              <ListItem key={upload.id} sx={{ px: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', gap: 1 }}>
                  {getStatusIcon(upload.status)}
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                          {upload.file.name}
                        </Typography>
                        <Chip
                          label={formatFileSize(upload.file.size)}
                          size="small"
                          variant="outlined"
                        />
                      </Box>
                    }
                    secondary={
                      upload.status === 'uploading' && (
                        <Box sx={{ mt: 1 }}>
                          <LinearProgress
                            variant="determinate"
                            value={upload.progress}
                            sx={{ height: 6, borderRadius: 3 }}
                          />
                          <Typography variant="caption" color="text.secondary">
                            {upload.progress}% uploaded
                          </Typography>
                        </Box>
                      )
                    }
                  />
                  <ListItemSecondaryAction>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip
                        label={upload.status}
                        color={getStatusColor(upload.status)}
                        size="small"
                      />
                      {upload.status === 'error' && (
                        <IconButton
                          size="small"
                          onClick={() => retryUpload(upload)}
                          color="primary"
                        >
                          <CloudUpload fontSize="small" />
                        </IconButton>
                      )}
                      <IconButton
                        size="small"
                        onClick={() => removeUpload(upload.id)}
                        color="default"
                      >
                        <Close fontSize="small" />
                      </IconButton>
                    </Box>
                  </ListItemSecondaryAction>
                </Box>
                {upload.error && (
                  <Typography variant="caption" color="error" sx={{ mt: 1 }}>
                    {upload.error}
                  </Typography>
                )}
              </ListItem>
            ))}
          </List>
        </Paper>
      )}
    </Box>
  );
};

export default DragDropUpload;
