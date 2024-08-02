import { sshManager } from '../../lib/sshManager';
import path from 'path';
import fs from 'fs';

export default async function handler(req, res) {
  const userId = req.headers['x-user-id'];
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { method, query, body } = req;
  const currentPath = query.path || '/';

  try {
    switch (method) {
      case 'GET':
        if (query.action === 'download') {
          return await handleDownload(userId, currentPath, query.filename, res);
        } else if (query.action === 'read') {
          return await handleReadFile(userId, currentPath, query.filename, res);
        }
        return await handleGetRequest(userId, currentPath, query, res);
      case 'POST':
        if (query.action === 'upload') {
          return await handleUpload(userId, currentPath, req, res);
        }
        return await handlePostRequest(userId, currentPath, body, res);
      case 'DELETE':
        return await handleDeleteRequest(userId, currentPath, body, res);
      case 'PUT':
        return await handlePutRequest(userId, currentPath, body, res);
      default:
        res.setHeader('Allow', ['GET', 'POST', 'DELETE', 'PUT']);
        res.status(405).end(`Method ${method} Not Allowed`);
    }
  } catch (error) {
    console.error('Error in file manager API:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleGetRequest(userId, currentPath, query, res) {
  const { sortBy = 'name', sortDirection = 'asc' } = query;
  const { code, data } = await sshManager.executeCommand(userId, `ls -la "${currentPath}"`);
  if (code === 0) {
    let files = parseFileList(data);
    files = sortFiles(files, sortBy, sortDirection);
    res.status(200).json({ files, currentPath });
  } else {
    res.status(500).json({ error: 'Failed to list files' });
  }
}

async function handlePostRequest(userId, currentPath, body, res) {
  const { name, type, content } = body;
  if (!name || !type) {
    return res.status(400).json({ error: 'Name and type are required' });
  }

  const fullPath = path.join(currentPath, name);
  let command;

  if (type === 'directory') {
    command = `mkdir -p "${fullPath}"`;
  } else if (type === 'file') {
    command = `echo "${content || ''}" > "${fullPath}"`;
  } else {
    return res.status(400).json({ error: 'Invalid type' });
  }

  const { code } = await sshManager.executeCommand(userId, command);
  if (code === 0) {
    res.status(201).json({ message: `${type} created successfully` });
  } else {
    res.status(500).json({ error: `Failed to create ${type}` });
  }
}

async function handleDeleteRequest(userId, currentPath, body, res) {
  const { name } = body;
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  const fullPath = path.join(currentPath, name);
  const command = `rm -rf "${fullPath}"`;

  const { code } = await sshManager.executeCommand(userId, command);
  if (code === 0) {
    res.status(200).json({ message: 'Item deleted successfully' });
  } else {
    res.status(500).json({ error: 'Failed to delete item' });
  }
}

async function handlePutRequest(userId, currentPath, body, res) {
  const { name, content, oldName, newName } = body;

  if (oldName && newName) {
    // Rename operation
    const oldPath = path.join(currentPath, oldName);
    const newPath = path.join(currentPath, newName);
    const command = `mv "${oldPath}" "${newPath}"`;

    const { code } = await sshManager.executeCommand(userId, command);
    if (code === 0) {
      res.status(200).json({ message: 'Item renamed successfully' });
    } else {
      res.status(500).json({ error: 'Failed to rename item' });
    }
  } else if (name && content !== undefined) {
    // Edit file content
    const fullPath = path.join(currentPath, name);
    const command = `echo "${content}" > "${fullPath}"`;

    const { code } = await sshManager.executeCommand(userId, command);
    if (code === 0) {
      res.status(200).json({ message: 'File updated successfully' });
    } else {
      res.status(500).json({ error: 'Failed to update file' });
    }
  } else {
    res.status(400).json({ error: 'Invalid request body' });
  }
}

async function handleDownload(userId, currentPath, filename, res) {
  if (!filename) {
    return res.status(400).json({ error: 'Filename is required' });
  }

  const fullPath = path.join(currentPath, filename);

  const { code, data } = await sshManager.executeCommand(userId, `cat "${fullPath}"`);
  if (code === 0) {
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.status(200).send(data);
  } else {
    res.status(500).json({ error: 'Failed to download file' });
  }
}

async function handleReadFile(userId, currentPath, filename, res) {
  if (!filename) {
    return res.status(400).json({ error: 'Filename is required' });
  }

  const fullPath = path.join(currentPath, filename);

  const { code, data } = await sshManager.executeCommand(userId, `cat "${fullPath}"`);
  if (code === 0) {
    res.status(200).json({ content: data });
  } else {
    res.status(500).json({ error: 'Failed to read file' });
  }
}

async function handleUpload(userId, currentPath, req, res) {
  if (!req.files || Object.keys(req.files).length === 0) {
    return res.status(400).json({ error: 'No files were uploaded.' });
  }

  const uploadedFile = req.files.file;
  const uploadPath = path.join(currentPath, uploadedFile.name);

  try {
    await uploadedFile.mv(uploadPath);
    res.status(200).json({ message: 'File uploaded successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to upload file' });
  }
}

function parseFileList(data) {
  if (!data || typeof data !== 'string') {
    return [];
  }

  return data.split('\n')
    .slice(1)  // Skip the first line which is usually "total ..."
    .map(line => {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 9) return null;

      const name = parts.slice(8).join(' ');
      // Skip '.' and '..' entries
      if (name === '.' || name === '..') return null;

      return {
        name: name,
        type: parts[0].startsWith('d') ? 'directory' : 'file',
        permissions: parts[0],
        owner: parts[2],
        group: parts[3],
        size: parseInt(parts[4], 10),
        lastModified: `${parts[5]} ${parts[6]} ${parts[7]}`
      };
    })
    .filter(Boolean);  // Remove null entries
}

function sortFiles(files, sortBy, sortDirection) {
  return files.sort((a, b) => {
    // Always put directories first
    if (a.type !== b.type) {
      return a.type === 'directory' ? -1 : 1;
    }

    // For matching types, sort by the specified field
    if (a[sortBy] < b[sortBy]) return sortDirection === 'asc' ? -1 : 1;
    if (a[sortBy] > b[sortBy]) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });
}