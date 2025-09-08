import React, { useEffect, useRef } from 'react';
import { Menu, MenuItem, ListItemIcon, ListItemText, Divider } from '@mui/material';
import {
  Folder, InsertDriveFile, Edit, Delete, FileCopy, Download,
  DriveFileMove, Refresh, Info, Share, ContentCut, ContentPaste
} from '@mui/icons-material';

const ContextMenu = ({
  open,
  position,
  onClose,
  items = [],
  onAction,
  isBulkMode = false,
  selectedItems = []
}) => {
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        onClose();
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open, onClose]);

  if (!open || !position) return null;

  const handleAction = (action) => {
    onAction(action, items);
    onClose();
  };

  const getItemIcon = (item) => {
    if (!item) return <InsertDriveFile />;

    if (item.type === 'directory') {
      return <Folder sx={{ color: 'warning.main' }} />;
    }

    const ext = item.name?.split('.').pop()?.toLowerCase();
    const iconMap = {
      'js': <InsertDriveFile sx={{ color: 'yellow' }} />,
      'jsx': <InsertDriveFile sx={{ color: 'blue' }} />,
      'ts': <InsertDriveFile sx={{ color: 'blue' }} />,
      'tsx': <InsertDriveFile sx={{ color: 'blue' }} />,
      'json': <InsertDriveFile sx={{ color: 'green' }} />,
      'html': <InsertDriveFile sx={{ color: 'orange' }} />,
      'css': <InsertDriveFile sx={{ color: 'blue' }} />,
      'md': <InsertDriveFile sx={{ color: 'text.secondary' }} />,
      'txt': <InsertDriveFile sx={{ color: 'text.secondary' }} />,
      'jpg': <InsertDriveFile sx={{ color: 'purple' }} />,
      'png': <InsertDriveFile sx={{ color: 'purple' }} />,
      'pdf': <InsertDriveFile sx={{ color: 'red' }} />,
      'zip': <InsertDriveFile sx={{ color: 'orange' }} />
    };

    return iconMap[ext] || <InsertDriveFile />;
  };

  return (
    <Menu
      ref={menuRef}
      open={open}
      onClose={onClose}
      anchorReference="anchorPosition"
      anchorPosition={position}
      PaperProps={{
        sx: {
          minWidth: 200,
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          borderRadius: 2
        }
      }}
    >
      {/* Single item actions */}
      {items.length === 1 && (
        <>
          {items[0].type === 'file' && (
            <>
              <MenuItem onClick={() => handleAction('open')}>
                <ListItemIcon>
                  <InsertDriveFile />
                </ListItemIcon>
                <ListItemText primary="Open/Edit" />
              </MenuItem>
              <MenuItem onClick={() => handleAction('download')}>
                <ListItemIcon>
                  <Download />
                </ListItemIcon>
                <ListItemText primary="Download" />
              </MenuItem>
            </>
          )}

          <MenuItem onClick={() => handleAction('rename')}>
            <ListItemIcon>
              <Edit />
            </ListItemIcon>
            <ListItemText primary="Rename" />
          </MenuItem>

          <MenuItem onClick={() => handleAction('copy')}>
            <ListItemIcon>
              <FileCopy />
            </ListItemIcon>
            <ListItemText primary="Copy" />
          </MenuItem>

          <MenuItem onClick={() => handleAction('move')}>
            <ListItemIcon>
              <DriveFileMove />
            </ListItemIcon>
            <ListItemText primary="Move" />
          </MenuItem>

          <Divider />

          <MenuItem onClick={() => handleAction('delete')} sx={{ color: 'error.main' }}>
            <ListItemIcon>
              <Delete sx={{ color: 'error.main' }} />
            </ListItemIcon>
            <ListItemText primary="Delete" />
          </MenuItem>
        </>
      )}

      {/* Multiple items actions */}
      {items.length > 1 && (
        <>
          <MenuItem onClick={() => handleAction('bulk_copy')}>
            <ListItemIcon>
              <FileCopy />
            </ListItemIcon>
            <ListItemText primary={`Copy ${items.length} items`} />
          </MenuItem>

          <MenuItem onClick={() => handleAction('bulk_move')}>
            <ListItemIcon>
              <DriveFileMove />
            </ListItemIcon>
            <ListItemText primary={`Move ${items.length} items`} />
          </MenuItem>

          <Divider />

          <MenuItem onClick={() => handleAction('bulk_delete')} sx={{ color: 'error.main' }}>
            <ListItemIcon>
              <Delete sx={{ color: 'error.main' }} />
            </ListItemIcon>
            <ListItemText primary={`Delete ${items.length} items`} />
          </MenuItem>
        </>
      )}

      {/* Directory-specific actions */}
      {items.length === 1 && items[0].type === 'directory' && (
        <>
          <Divider />
          <MenuItem onClick={() => handleAction('open_directory')}>
            <ListItemIcon>
              <Folder />
            </ListItemIcon>
            <ListItemText primary="Open Directory" />
          </MenuItem>
          <MenuItem onClick={() => handleAction('new_file')}>
            <ListItemIcon>
              <InsertDriveFile />
            </ListItemIcon>
            <ListItemText primary="New File Here" />
          </MenuItem>
          <MenuItem onClick={() => handleAction('new_folder')}>
            <ListItemIcon>
              <Folder />
            </ListItemIcon>
            <ListItemText primary="New Folder Here" />
          </MenuItem>
        </>
      )}

      {/* General actions */}
      <Divider />
      <MenuItem onClick={() => handleAction('refresh')}>
        <ListItemIcon>
          <Refresh />
        </ListItemIcon>
        <ListItemText primary="Refresh" />
      </MenuItem>

      <MenuItem onClick={() => handleAction('properties')}>
        <ListItemIcon>
          <Info />
        </ListItemIcon>
        <ListItemText primary="Properties" />
      </MenuItem>

      {/* Clipboard actions */}
      <Divider />
      <MenuItem onClick={() => handleAction('cut')}>
        <ListItemIcon>
          <ContentCut />
        </ListItemIcon>
        <ListItemText primary="Cut" />
      </MenuItem>

      <MenuItem onClick={() => handleAction('paste')}>
        <ListItemIcon>
          <ContentPaste />
        </ListItemIcon>
        <ListItemText primary="Paste" />
      </MenuItem>
    </Menu>
  );
};

export default ContextMenu;
