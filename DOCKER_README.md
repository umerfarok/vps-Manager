# VPS Manager Docker Development Setup

This Docker setup provides a complete development environment for the VPS Manager application with a test SSH server.

## Quick Start

1. **Clone the repository and navigate to the project directory**

2. **Start the development environment:**
   ```bash
   docker-compose up --build
   ```

3. **Access the application:**
   - VPS Manager: http://localhost:3000
   - SSH Server: localhost:2222

## Services

### VPS Manager (Port 3000)
- Next.js application
- Auto-reloads on code changes in development
- Volume mounted for live development

### SSH Test Server (Port 2222)
- Ubuntu 22.04 with OpenSSH server
- Test user: `testuser` / `testpass123`
- Root user: `root` / `rootpass123`
- Pre-populated with test files in `/home/testuser/test-files/`

### PostgreSQL (Port 5432) - Optional
- Database for future features
- User: `vps_dev` / Password: `dev_password`
- Database: `vps_manager_dev`

### Redis (Port 6379) - Optional
- Caching and session storage
- Ready for future enhancements

## Testing the Application

### Connect to the test SSH server:
- **Host:** `localhost`
- **Port:** `2222`
- **Username:** `testuser`
- **Password:** `testpass123`

### Test files available:
- `/home/testuser/test-files/hello.txt` - Small text file
- `/home/testuser/test-files/test.txt` - Another text file
- `/home/testuser/test-files/subdir/nested.txt` - File in subdirectory
- `/home/testuser/test-files/large-file.bin` - 50MB test file

## Development Commands

```bash
# Start all services
docker-compose up

# Start in detached mode
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Rebuild and restart
docker-compose up --build --force-recreate

# Access SSH server directly
docker-compose exec ssh-server bash

# Access application container
docker-compose exec vps-manager sh
```

## Adding Test Files

You can add files to the `test-files/` directory in the project root, and they will be available in the SSH server at `/home/testuser/test-files/`.

## Environment Variables

The application supports these environment variables:

- `NODE_ENV` - Set to `development` or `production`
- `NEXT_PUBLIC_API_URL` - API base URL (default: http://localhost:3000)
- `CHOKIDAR_USEPOLLING` - Enable file watching in Docker (set to `true`)

## Troubleshooting

### SSH Connection Issues
1. Ensure the SSH server is healthy: `docker-compose ps`
2. Check SSH server logs: `docker-compose logs ssh-server`
3. Verify the test credentials are correct

### Application Issues
1. Check application logs: `docker-compose logs vps-manager`
2. Verify all dependencies are installed: `docker-compose exec vps-manager npm install`
3. Clear Next.js cache: `docker-compose exec vps-manager rm -rf .next`

### Port Conflicts
If ports 3000, 2222, 5432, or 6379 are already in use, you can modify the port mappings in `docker-compose.override.yml`.

## Security Note

This Docker setup is designed for development and testing purposes only. The test SSH server uses simple passwords and should never be used in production environments.

## File Structure

```
.
├── docker-compose.yml          # Main compose file
├── docker-compose.override.yml # Development overrides
├── Dockerfile                  # VPS Manager container
├── Dockerfile.ssh             # SSH test server
├── test-files/                # Test files for SSH server
└── DOCKER_README.md           # This file
```
