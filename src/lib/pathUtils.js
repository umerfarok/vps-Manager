// Browser-compatible path utilities to replace Node.js path module
export const pathUtils = {
  // Join path segments
  join(...segments) {
    const filtered = segments.filter(segment => segment && segment !== '.');
    if (filtered.length === 0) return '';

    // Handle absolute paths
    if (filtered[0].startsWith('/')) {
      return '/' + filtered.slice(1).filter(s => s).join('/').replace(/\/+/g, '/');
    }

    return filtered.join('/').replace(/\/+/g, '/');
  },

  // Get directory name from path
  dirname(path) {
    if (!path || path === '/') return '/';

    // Remove trailing slash if not root
    const cleanPath = path.replace(/\/$/, '');

    // If it's just a filename in root, return root
    if (!cleanPath.includes('/')) return '/';

    // Get everything before the last slash
    return cleanPath.substring(0, cleanPath.lastIndexOf('/')) || '/';
  },

  // Get basename (filename) from path
  basename(path, ext = '') {
    if (!path || path === '/') return '';

    const fullName = path.split('/').pop() || '';
    if (!ext) return fullName;

    // Remove extension if it matches
    if (fullName.endsWith(ext)) {
      return fullName.slice(0, -ext.length);
    }

    return fullName;
  },

  // Get file extension
  extname(path) {
    if (!path) return '';

    const basename = this.basename(path);
    const dotIndex = basename.lastIndexOf('.');

    if (dotIndex === 0 || dotIndex === -1) return '';

    return basename.substring(dotIndex);
  },

  // Normalize path
  normalize(path) {
    if (!path) return '';

    // Handle absolute paths
    const isAbsolute = path.startsWith('/');
    const segments = path.split('/').filter(segment => segment && segment !== '.');

    // Remove empty segments and handle ..
    const normalized = [];
    for (const segment of segments) {
      if (segment === '..') {
        normalized.pop();
      } else if (segment !== '.') {
        normalized.push(segment);
      }
    }

    const result = normalized.join('/');
    return isAbsolute ? '/' + result : result;
  },

  // Check if path is absolute
  isAbsolute(path) {
    return path.startsWith('/');
  },

  // Resolve path relative to base
  resolve(base, ...paths) {
    let resolved = base;

    for (const path of paths) {
      if (!path) continue;

      if (this.isAbsolute(path)) {
        resolved = path;
      } else {
        resolved = this.join(resolved, path);
      }
    }

    return this.normalize(resolved);
  }
};

export default pathUtils;
