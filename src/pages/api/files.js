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

  switch (method) {
    case 'GET':
      if (query.action === 'download') {
        return handleDownload(userId, currentPath, query.filename, res);
      }
      return handleGetRequest(userId, currentPath, query, res);
    case 'POST':
      return handlePostRequest(userId, currentPath, body, res);
    case 'DELETE':
      return handleDeleteRequest(userId, currentPath, body, res);
    case 'PUT':
      return handlePutRequest(userId, currentPath, body, res);
    default:
      res.setHeader('Allow', ['GET', 'POST', 'DELETE', 'PUT']);
      res.status(405).end(`Method ${method} Not Allowed`);
  }
}

async function handleGetRequest(userId, currentPath, query, res) {
  try {
    const { sortBy = 'name', sortDirection = 'asc' } = query;
    const { code, data } = await sshManager.executeCommand(userId, `ls -la "${currentPath}"`);
    if (code === 0) {
      let files = parseFileList(data);
      files = sortFiles(files, sortBy, sortDirection);
      res.status(200).json({ files, currentPath });
    } else {
      res.status(500).json({ error: 'Failed to list files' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function handlePostRequest(userId, currentPath, body, res) {
  const { name, type } = body;
  if (!name || !type) {
    return res.status(400).json({ error: 'Name and type are required' });
  }

  const fullPath = path.join(currentPath, name);
  let command = type === 'directory' ? `mkdir "${fullPath}"` : `touch "${fullPath}"`;

  try {
    const { code } = await sshManager.executeCommand(userId, command);
    if (code === 0) {
      res.status(201).json({ message: `${type} created successfully` });
    } else {
      res.status(500).json({ error: `Failed to create ${type}` });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
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
    const { code } = await sshManager.executeCommand(userId, command);
    if (code === 0) {
      res.status(200).json({ message: 'Item deleted successfully' });
    } else {
      res.status(500).json({ error: 'Failed to delete item' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function handlePutRequest(userId, currentPath, body, res) {
  const { name, content, oldName, newName } = body;

  if (oldName && newName) {
    // Rename operation
    const oldPath = path.join(currentPath, oldName);
    const newPath = path.join(currentPath, newName);
    const command = `mv "${oldPath}" "${newPath}"`;

    try {
      const { code } = await sshManager.executeCommand(userId, command);
      if (code === 0) {
        res.status(200).json({ message: 'Item renamed successfully' });
      } else {
        res.status(500).json({ error: 'Failed to rename item' });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  } else if (name && content !== undefined) {
    // Edit file content
    const fullPath = path.join(currentPath, name);
    const command = `echo "${content}" > "${fullPath}"`;

    try {
      const { code } = await sshManager.executeCommand(userId, command);
      if (code === 0) {
        res.status(200).json({ message: 'File updated successfully' });
      } else {
        res.status(500).json({ error: 'Failed to update file' });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  } else {
    res.status(400).json({ error: 'Invalid request body' });
  }
}

async function handleDownload(userId, currentPath, filename, res) {
  const fullPath = path.join(currentPath, filename);
  
  try {
    const { code, data } = await sshManager.executeCommand(userId, `cat "${fullPath}"`);
    if (code === 0) {
      res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
      res.setHeader('Content-Type', 'application/octet-stream');
      res.status(200).send(data);
    } else {
      res.status(500).json({ error: 'Failed to download file' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

function parseFileList(data) {
  return data.split('\n')
    .slice(1)
    .map(line => {
      const parts = line.split(/\s+/);
      return {
        name: parts[8],
        type: parts[0].charAt(0) === 'd' ? 'directory' : 'file',
        permissions: parts[0],
        owner: parts[2],
        group: parts[3],
        size: parseInt(parts[4], 10),
        lastModified: `${parts[5]} ${parts[6]} ${parts[7]}`
      };
    })
    .filter(file => file.name);
}

function sortFiles(files, sortBy, sortDirection) {
  return files.sort((a, b) => {
    if (a[sortBy] < b[sortBy]) return sortDirection === 'asc' ? -1 : 1;
    if (a[sortBy] > b[sortBy]) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });
}