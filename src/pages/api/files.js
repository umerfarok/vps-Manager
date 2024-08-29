import { sshManager } from '../../lib/sshManager';
import path from 'path';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

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

  try {
    await checkSSHConnection(userId);
    const { code, stdout, stderr } = await sshManager.executeCommand(userId, `ls -la "${currentPath}"`);

    if (code === 0) {
      let files = parseFileList(stdout);
      files = sortFiles(files, sortBy, sortDirection);
      res.status(200).json({ files, currentPath });
    } else {
      throw new Error(`Failed to list files: ${stderr}`);
    }
  } catch (error) {
    handleApiError(res, error, 'Error listing files');
  }
}

async function handlePostRequest(userId, currentPath, body, res) {
  const { name, type, content } = body;
  if (!name || !type) {
    return res.status(400).json({ error: 'Name and type are required' });
  }

  const sanitizedFileName = sanitizeFileName(name);
  const fullPath = path.posix.join(currentPath, sanitizedFileName);

  try {
    await checkSSHConnection(userId);
    if (type === 'directory') {
      await sshManager.executeCommand(userId, `mkdir -p "${fullPath}"`);
    } else if (type === 'file') {
      await sshManager.executeCommand(userId, `echo "${escapeContent(content || '')}" > "${fullPath}"`);
    } else {
      return res.status(400).json({ error: 'Invalid type' });
    }
    res.status(201).json({ message: `${type} created successfully` });
  } catch (error) {
    handleApiError(res, error, `Error creating ${type}`);
  }
}

async function handleDeleteRequest(userId, currentPath, body, res) {
  const { name } = body;
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  const fullPath = path.posix.join(currentPath, name);

  try {
    await checkSSHConnection(userId);
    await sshManager.executeCommand(userId, `rm -rf "${fullPath}"`);
    res.status(200).json({ message: 'Item deleted successfully' });
  } catch (error) {
    handleApiError(res, error, 'Error deleting item');
  }
}

async function handlePutRequest(userId, currentPath, body, res) {
  const { name, content, oldName, newName } = body;

  try {
    await checkSSHConnection(userId);

    if (oldName && newName) {
      // Rename operation
      const oldPath = path.posix.join(currentPath, oldName);
      const newPath = path.posix.join(currentPath, sanitizeFileName(newName));
      await sshManager.executeCommand(userId, `mv "${oldPath}" "${newPath}"`);
      res.status(200).json({ message: 'Item renamed successfully' });
    } else if (name && content !== undefined) {
      // Edit file content
      const fullPath = path.posix.join(currentPath, name);
      await sshManager.executeCommand(userId, `echo "${escapeContent(content)}" > "${fullPath}"`);
      res.status(200).json({ message: 'File updated successfully' });
    } else {
      res.status(400).json({ error: 'Invalid request body' });
    }
  } catch (error) {
    handleApiError(res, error, 'Error updating file');
  }
}

async function handleDownload(userId, currentPath, filename, res) {
  if (!filename) {
    return res.status(400).json({ error: 'Filename is required' });
  }

  const fullPath = path.posix.join(currentPath, filename);

  try {
    await checkSSHConnection(userId);
    const { code, stdout, stderr } = await executeCommand(userId, `cat "${fullPath}"`);
    if (code === 0) {
      res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
      res.setHeader('Content-Type', 'application/octet-stream');
      res.status(200).send(stdout);
    } else {
      throw new Error(`Failed to download file: ${stderr}`);
    }
  } catch (error) {
    handleApiError(res, error, 'Error downloading file');
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

  try {
    await checkSSHConnection(userId);
    const { code, stdout, stderr } = await executeCommand(userId, `cat "${fullPath}"`);
    if (code === 0) {
      res.status(200).json({ content: stdout });
    } else {
      throw new Error(`Failed to read file: ${stderr}`);
    }
  } catch (error) {
    handleApiError(res, error, 'Error reading file');
  }
}

async function handleUpload(userId, currentPath, req, res) {
  if (!req.files || Object.keys(req.files).length === 0) {
    return res.status(400).json({ error: 'No files were uploaded.' });
  }

  const uploadedFile = req.files.file;
  const sanitizedFileName = sanitizeFileName(uploadedFile.name);
  const uploadPath = path.posix.join(currentPath, sanitizedFileName);

  try {
    await checkSSHConnection(userId);
    // Note: This assumes you have a way to transfer the file via SSH
    // You might need to implement this functionality in your sshManager
    await sshManager.uploadFile(userId, uploadedFile.data, uploadPath);
    res.status(200).json({ message: 'File uploaded successfully' });
  } catch (error) {
    handleApiError(res, error, 'Error uploading file');
  }
}

function parseFileList(data) {
  const lines = data.split('\n');
  return lines
    .slice(1)
    .map(line => {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 9) return null;

      const name = parts.slice(8).join(' ');
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
    .filter(Boolean);
}

function sortFiles(files, sortBy, sortDirection) {
  return files.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'directory' ? -1 : 1;
    }
    if (a[sortBy] < b[sortBy]) return sortDirection === 'asc' ? -1 : 1;
    if (a[sortBy] > b[sortBy]) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });
}

function sanitizeFileName(fileName) {
  return fileName.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
}

function escapeContent(content) {
  return content.replace(/"/g, '\\"').replace(/\$/g, '\\$');
}

function handleApiError(res, error, message) {
  console.error(message, error);
  res.status(500).json({ error: message, details: error.message });
}