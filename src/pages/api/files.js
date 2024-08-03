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
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

async function checkSSHConnection(userId) {
  const conn = sshManager.getConnection(userId);
  if (!conn) {
    console.error('No active SSH connection for user:', userId);
    throw new Error('No active SSH connection');
  }
  return true;
}

async function executeCommand(userId, command) {
  console.log('Executing command:', command);
  try {
    const result = await sshManager.executeCommand(userId, command);
    console.log('Command result:', result);
    return result;
  } catch (error) {
    console.error('Error executing command:', error);
    throw error;
  }
}

async function handleGetRequest(userId, currentPath = '/', query, res) {
  const { sortBy = 'name', sortDirection = 'asc' } = query;
  console.log('Listing directory:', currentPath);

  try {
    await checkSSHConnection(userId);
    const { code, stdout, stderr } = await executeCommand(userId, `ls -la "${currentPath}"`);

    if (code === 0) {
      let files = parseFileList(stdout);
      console.log('Parsed files:', files);

      files = sortFiles(files, sortBy, sortDirection);
      console.log('Sorted files:', files);

      res.status(200).json({ files, currentPath });
    } else {
      console.error(`Failed to list files. Exit code: ${code}, stderr: ${stderr}`);
      res.status(500).json({ error: 'Failed to list files', details: stderr });
    }
  } catch (error) {
    console.error('Error in handleGetRequest:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

async function handlePostRequest(userId, currentPath, body, res) {
  const { name, type, content } = body;
  if (!name || !type) {
    return res.status(400).json({ error: 'Name and type are required' });
  }

  const sanitizedFileName = path.basename(name).replace(/^\/*/, '');
  const sanitizedCurrentPath = currentPath.replace(/\/+$/, '');
  const fullPath = path.join(sanitizedCurrentPath, sanitizedFileName);
  let command;

  if (type === 'directory') {
    command = `mkdir -p "${fullPath}"`;
  } else if (type === 'file') {
    command = `echo "${content || ''}" > "${fullPath}"`;
  } else {
    return res.status(400).json({ error: 'Invalid type' });
  }

  try {
    await checkSSHConnection(userId);
    const { code, stderr } = await executeCommand(userId, command);
    if (code === 0) {
      res.status(201).json({ message: `${type} created successfully` });
    } else {
      res.status(500).json({ error: `Failed to create ${type}`, details: stderr });
    }
  } catch (error) {
    console.error('Error in handlePostRequest:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

async function handleDeleteRequest(userId, currentPath, body, res) {
  const { name } = body;
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  const fullPath = path.join(currentPath, name);
  const command = `rm -rf "${fullPath}"`;

  try {
    await checkSSHConnection(userId);
    const { code, stderr } = await executeCommand(userId, command);
    if (code === 0) {
      res.status(200).json({ message: 'Item deleted successfully' });
    } else {
      res.status(500).json({ error: 'Failed to delete item', details: stderr });
    }
  } catch (error) {
    console.error('Error in handleDeleteRequest:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

async function handlePutRequest(userId, currentPath, body, res) {
  const { name, content, oldName, newName } = body;

  try {
    await checkSSHConnection(userId);

    if (oldName && newName) {
      // Rename operation
      const oldPath = path.join(currentPath, oldName);
      const newPath = path.join(currentPath, newName);
      const command = `mv "${oldPath}" "${newPath}"`;

      const { code, stderr } = await executeCommand(userId, command);
      if (code === 0) {
        res.status(200).json({ message: 'Item renamed successfully' });
      } else {
        res.status(500).json({ error: 'Failed to rename item', details: stderr });
      }
    } else if (name && content !== undefined) {
      // Edit file content
      const fullPath = path.join(currentPath, name);
      const command = `echo "${content}" > "${fullPath}"`;

      const { code, stderr } = await executeCommand(userId, command);
      if (code === 0) {
        res.status(200).json({ message: 'File updated successfully' });
      } else {
        res.status(500).json({ error: 'Failed to update file', details: stderr });
      }
    } else {
      res.status(400).json({ error: 'Invalid request body' });
    }
  } catch (error) {
    console.error('Error in handlePutRequest:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

async function handleDownload(userId, currentPath, filename, res) {
  if (!filename) {
    return res.status(400).json({ error: 'Filename is required' });
  }

  const fullPath = path.join(currentPath, filename);

  try {
    await checkSSHConnection(userId);
    const { code, stdout, stderr } = await executeCommand(userId, `cat "${fullPath}"`);
    if (code === 0) {
      res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
      res.setHeader('Content-Type', 'application/octet-stream');
      res.status(200).send(stdout);
    } else {
      res.status(500).json({ error: 'Failed to download file', details: stderr });
    }
  } catch (error) {
    console.error('Error in handleDownload:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

async function handleReadFile(userId, currentPath, filename, res) {
  if (!filename) {
    return res.status(400).json({ error: 'Filename is required' });
  }

  const basePath = currentPath.endsWith(filename)
    ? path.posix.dirname(currentPath)
    : currentPath;

  const fullPath = path.posix.join(basePath, filename);
  console.log('Reading file:', fullPath);

  try {
    await checkSSHConnection(userId);
    const { code, stdout, stderr } = await executeCommand(userId, `cat "${fullPath}"`);
    if (code === 0) {
      res.status(200).json({ content: stdout });
    } else {
      console.error(`Failed to read file: ${stderr}`);
      res.status(500).json({ error: 'Failed to read file', details: stderr });
    }
  } catch (error) {
    console.error('Error in handleReadFile:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

async function handleUpload(userId, currentPath, req, res) {
  if (!req.files || Object.keys(req.files).length === 0) {
    return res.status(400).json({ error: 'No files were uploaded.' });
  }

  const uploadedFile = req.files.file;
  const uploadPath = path.join(currentPath, uploadedFile.name);

  try {
    await checkSSHConnection(userId);
    // Note: This assumes you have a way to transfer the file via SSH
    // You might need to implement this functionality in your sshManager
    await sshManager.uploadFile(userId, uploadedFile.data, uploadPath);
    res.status(200).json({ message: 'File uploaded successfully' });
  } catch (error) {
    console.error('Error in handleUpload:', error);
    res.status(500).json({ error: 'Failed to upload file', details: error.message });
  }
}

function parseFileList(data) {
  if (!data || typeof data !== 'string') {
    console.warn('Invalid data received in parseFileList:', data);
    return [];
  }

  const lines = data.split('\n');
  console.log('Number of lines:', lines.length);

  return lines
    .slice(1)  // Skip the first line which is usually "total ..."
    .map(line => {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 9) {
        console.warn('Invalid line format:', line);
        return null;
      }

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

function normalizePath(inputPath) {
  let normalizedPath = inputPath.replace(/\\/g, '/');
  if (!normalizedPath.startsWith('/')) {
    normalizedPath = '/' + normalizedPath;
  }
  normalizedPath = normalizedPath.replace(/\/+/g, '/');
  if (normalizedPath.length > 1 && normalizedPath.endsWith('/')) {
    normalizedPath = normalizedPath.slice(0, -1);
  }
  return normalizedPath;
}