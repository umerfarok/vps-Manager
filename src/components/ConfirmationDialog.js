import React from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Typography, Box, Chip, List, ListItem, ListItemIcon,
  ListItemText, Alert, Divider
} from '@mui/material';
import {
  Warning, Delete, FileCopy, DriveFileMove, Folder,
  InsertDriveFile, ErrorOutline
} from '@mui/icons-material';

const ConfirmationDialog = ({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  severity = 'warning',
  items = [],
  additionalInfo = null,
  confirmButtonColor = 'error'
}) => {
  const getSeverityIcon = () => {
    switch (severity) {
      case 'error':
        return <ErrorOutline color="error" sx={{ fontSize: 28 }} />;
      case 'warning':
        return <Warning color="warning" sx={{ fontSize: 28 }} />;
      default:
        return <ErrorOutline color="action" sx={{ fontSize: 28 }} />;
    }
  };

  const getSeverityColor = () => {
    switch (severity) {
      case 'error':
        return 'error';
      case 'warning':
        return 'warning';
      default:
        return 'info';
    }
  };

  const renderItemsList = () => {
    if (!items || items.length === 0) return null;

    return (
      <Box sx={{ mt: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Affected items ({items.length}):
        </Typography>
        <List dense sx={{
          maxHeight: 200,
          overflow: 'auto',
          bgcolor: 'grey.50',
          borderRadius: 1,
          p: 1
        }}>
          {items.map((item, index) => (
            <ListItem key={index} sx={{ px: 1, py: 0.5 }}>
              <ListItemIcon sx={{ minWidth: 30 }}>
                {item.type === 'directory' ? (
                  <Folder sx={{ color: 'warning.main', fontSize: 18 }} />
                ) : (
                  <InsertDriveFile sx={{ color: 'text.secondary', fontSize: 18 }} />
                )}
              </ListItemIcon>
              <ListItemText
                primary={
                  <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                    {item.name}
                  </Typography>
                }
                secondary={
                  item.type === 'directory' ? (
                    <Chip label="Folder" size="small" variant="outlined" sx={{ height: 16, fontSize: '0.7rem' }} />
                  ) : (
                    <Typography variant="caption" color="text.secondary">
                      {item.size ? `${(item.size / 1024).toFixed(1)} KB` : 'File'}
                    </Typography>
                  )
                }
              />
            </ListItem>
          ))}
        </List>
      </Box>
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 2 }
      }}
    >
      <DialogTitle sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        pb: 1
      }}>
        {getSeverityIcon()}
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          {title}
        </Typography>
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ pt: 2 }}>
        <Typography variant="body1" sx={{ mb: 2 }}>
          {message}
        </Typography>

        {renderItemsList()}

        {additionalInfo && (
          <Alert severity="info" sx={{ mt: 2 }}>
            {additionalInfo}
          </Alert>
        )}

        <Alert severity={getSeverityColor()} sx={{ mt: 2 }}>
          <Typography variant="body2">
            This action cannot be undone. Please confirm you want to proceed.
          </Typography>
        </Alert>
      </DialogContent>

      <Divider />

      <DialogActions sx={{ p: 3, gap: 1 }}>
        <Button
          onClick={onClose}
          variant="outlined"
          sx={{ minWidth: 80 }}
        >
          {cancelText}
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          color={confirmButtonColor}
          sx={{ minWidth: 80 }}
        >
          {confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConfirmationDialog;
