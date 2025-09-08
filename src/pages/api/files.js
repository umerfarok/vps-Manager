import { sshManager } from '../../lib/sshManager';
import { pathUtils } from '../../lib/pathUtils';
import formidable from 'formidable';

export const config = {
  api: {
    bodyParser: false, // Disable bodyParser for file uploads
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

    // Use a more robust ls command with better error handling
    const lsCommand = `ls -la "${currentPath}" 2>/dev/null || echo "ERROR: Directory not accessible"`;
    const { code, stdout, stderr } = await sshManager.executeCommand(userId, lsCommand);

    if (code === 0 && !stdout.includes("ERROR:")) {
      let files = parseFileList(stdout);
      files = sortFiles(files, sortBy, sortDirection);

      // Add additional metadata for better UX
      const enhancedFiles = await Promise.all(files.map(async (file) => {
        try {
          // Get more detailed file information
          const fullPath = pathUtils.join(currentPath, file.name);
          const statCommand = `stat -c "%s,%Y,%a,%U,%G" "${fullPath}" 2>/dev/null`;
          const statResult = await sshManager.executeCommand(userId, statCommand);

          if (statResult.code === 0) {
            const [size, mtime, permissions, owner, group] = statResult.stdout.trim().split(',');
            return {
              ...file,
              size: parseInt(size) || file.size,
              lastModified: new Date(parseInt(mtime) * 1000).toISOString(),
              permissions: permissions || file.permissions,
              owner: owner || file.owner,
              group: group || file.group,
              lastModifiedFormatted: formatDate(new Date(parseInt(mtime) * 1000))
            };
          }
        } catch (statError) {
          console.warn(`Failed to get detailed stats for ${file.name}:`, statError);
        }

        // Fallback to basic file info with formatted date
        return {
          ...file,
          lastModifiedFormatted: formatDate(new Date(file.lastModified))
        };
      }));

      res.status(200).json({
        files: enhancedFiles,
        currentPath,
        totalFiles: enhancedFiles.length,
        timestamp: new Date().toISOString()
      });
    } else {
      const errorMsg = stdout.includes("ERROR:") ? stdout.trim() : stderr.trim();
      throw new Error(`Failed to list files: ${errorMsg}`);
    }
  } catch (error) {
    console.error('File listing error:', error);
    handleApiError(res, error, 'Error listing files');
  }
}

async function handlePostRequest(userId, currentPath, body, res) {
  const { name, type, content } = body;
  if (!name || !type) {
    return res.status(400).json({ error: 'Name and type are required' });
  }

  const sanitizedFileName = sanitizeFileName(name);
  const fullPath = pathUtils.join(currentPath, sanitizedFileName);

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

  const fullPath = pathUtils.join(currentPath, name);

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
      const oldPath = pathUtils.join(currentPath, oldName);
      const newPath = pathUtils.join(currentPath, sanitizeFileName(newName));
      await sshManager.executeCommand(userId, `mv "${oldPath}" "${newPath}"`);
      res.status(200).json({ message: 'Item renamed successfully' });
    } else if (name && content !== undefined) {
      // Edit file content
      const fullPath = pathUtils.join(currentPath, name);
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

  const fullPath = pathUtils.join(currentPath, filename);

  try {
    await checkSSHConnection(userId);

    // Use SSH SFTP for downloading files instead of cat command
    const conn = sshManager.getConnection(userId);
    if (!conn) {
      throw new Error('No active SSH connection');
    }

    conn.sftp(async (err, sftp) => {
      if (err) {
        console.error('SFTP initialization error:', err);
        return res.status(500).json({ error: 'SFTP initialization failed', details: err.message });
      }

      try {
        // Get file stats first
        const stats = await new Promise((resolve, reject) => {
          sftp.stat(fullPath, (statErr, fileStats) => {
            if (statErr) {
              reject(new Error(`File not found: ${statErr.message}`));
            } else {
              resolve(fileStats);
            }
          });
        });

        // Check file size limit (100MB)
        const maxSize = 100 * 1024 * 1024;
        if (stats.size > maxSize) {
          sftp.end();
          return res.status(413).json({
            error: 'File too large',
            details: `File size ${stats.size} exceeds maximum download size ${maxSize}`
          });
        }

        // Set appropriate headers
        const contentType = getContentType(filename);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Length', stats.size);
        res.setHeader('Cache-Control', 'no-cache');

        // Stream file content
        const readStream = sftp.createReadStream(fullPath);

        readStream.on('error', (streamErr) => {
          console.error('Download stream error:', streamErr);
          sftp.end();
          if (!res.headersSent) {
            res.status(500).json({ error: 'Download failed', details: streamErr.message });
          }
        });

        readStream.on('end', () => {
          sftp.end();
        });

        // Pipe the file stream to response
        readStream.pipe(res);

      } catch (fileErr) {
        console.error('File download error:', fileErr);
        sftp.end();
        if (!res.headersSent) {
          res.status(404).json({ error: 'File not found', details: fileErr.message });
        }
      }
    });

  } catch (error) {
    console.error('Download setup error:', error);
    if (!res.headersSent) {
      handleApiError(res, error, 'Error downloading file');
    }
  }
}

async function handleReadFile(userId, currentPath, filename, res) {
  if (!filename) {
    return res.status(400).json({ error: 'Filename is required' });
  }
  const basePath = currentPath.endsWith(filename)
  ? path.posix.dirname(currentPath)
  : currentPath;

const fullPath = pathUtils.join(basePath, filename);

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
  const form = formidable({
    maxFileSize: 100 * 1024 * 1024, // 100MB limit
    keepExtensions: true,
    multiples: true
  });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('Form parsing error:', err);
      return res.status(400).json({
        error: 'File upload failed',
        details: err.message,
        code: err.code
      });
    }

    const uploadedFile = files.file;
    if (!uploadedFile) {
      return res.status(400).json({ error: 'No file was uploaded.' });
    }

    // Handle single file (formidable returns array for multiples: true)
    const file = Array.isArray(uploadedFile) ? uploadedFile[0] : uploadedFile;

    if (!file || !file.originalFilename) {
      return res.status(400).json({ error: 'Invalid file data.' });
    }

    const sanitizedFileName = sanitizeFileName(file.originalFilename);
    const uploadPath = pathUtils.join(currentPath, sanitizedFileName);

    try {
      await checkSSHConnection(userId);

      // Read file data
      const fs = require('fs');
      const fileData = await fs.promises.readFile(file.filepath);

      // Upload via SSH
      await sshManager.uploadFile(userId, fileData, uploadPath);

      // Clean up temp file
      fs.unlinkSync(file.filepath);

      res.status(200).json({
        message: 'File uploaded successfully',
        filename: sanitizedFileName,
        size: fileData.length
      });
    } catch (error) {
      console.error('Upload error:', error);

      // Clean up temp file on error
      try {
        const fs = require('fs');
        if (file.filepath && fs.existsSync(file.filepath)) {
          fs.unlinkSync(file.filepath);
        }
      } catch (cleanupError) {
        console.error('Error cleaning up temp file:', cleanupError);
      }

      handleApiError(res, error, 'Error uploading file');
    }
  });
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

function formatDate(date) {
  if (!(date instanceof Date) || isNaN(date)) {
    return 'Unknown';
  }

  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: 'short' });
  } else if (diffDays < 365) {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } else {
    return date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
  }
}

function getContentType(filename) {
  const ext = filename.toLowerCase().split('.').pop();
  const mimeTypes = {
    'txt': 'text/plain',
    'html': 'text/html',
    'css': 'text/css',
    'js': 'application/javascript',
    'json': 'application/json',
    'xml': 'application/xml',
    'pdf': 'application/pdf',
    'zip': 'application/zip',
    'tar': 'application/x-tar',
    'gz': 'application/gzip',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
    'ico': 'image/x-icon',
    'mp4': 'video/mp4',
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
  };

  return mimeTypes[ext] || 'application/octet-stream';
}

function handleApiError(res, error, message) {
  console.error(message, error);
  res.status(500).json({ error: message, details: error.message });
}