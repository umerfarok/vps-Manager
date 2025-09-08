# VPS Manager Test Website

This directory contains test files for the VPS Manager Docker development environment.

## Files

- `index.html` - Test HTML website
- `README.md` - This documentation file

## Testing Features

Use these files to test:

1. **File Browsing** - Navigate through directories
2. **File Editing** - Edit HTML and Markdown files
3. **File Downloads** - Download files to local machine
4. **Directory Operations** - Create, delete, rename directories
5. **File Permissions** - Check and modify file permissions

## Connection Details

- **SSH Host:** localhost
- **SSH Port:** 2222
- **Username:** testuser
- **Password:** testpass123

## Docker Commands

```bash
# Start development environment
docker-compose up --build

# View SSH server logs
docker-compose logs -f ssh-server

# Access SSH server directly
docker-compose exec ssh-server bash
```
