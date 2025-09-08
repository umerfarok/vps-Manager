// Centralized error handling utility for VPS Manager
export class ErrorHandler {
  static getErrorMessage(error, context = '') {
    // Handle different types of errors
    if (typeof error === 'string') {
      return this.categorizeError(error, context);
    }

    if (error.response) {
      // Server responded with error status
      return this.handleServerError(error, context);
    }

    if (error.request) {
      // Network error
      return this.handleNetworkError(error, context);
    }

    // Generic error
    return this.handleGenericError(error, context);
  }

  static categorizeError(errorMessage, context) {
    const lowerMessage = errorMessage.toLowerCase();

    // Connection related errors
    if (lowerMessage.includes('connection') || lowerMessage.includes('connect')) {
      if (lowerMessage.includes('timeout')) {
        return {
          title: 'Connection Timeout',
          message: 'The connection to your VPS timed out. Please check your network and try again.',
          severity: 'warning',
          suggestion: 'Try reconnecting or check if your VPS is accessible.'
        };
      }
      if (lowerMessage.includes('refused') || lowerMessage.includes('failed')) {
        return {
          title: 'Connection Failed',
          message: 'Unable to connect to your VPS. Please verify your connection details.',
          severity: 'error',
          suggestion: 'Check your host, port, and credentials.'
        };
      }
    }

    // File system errors
    if (lowerMessage.includes('permission') || lowerMessage.includes('access')) {
      return {
        title: 'Permission Denied',
        message: 'You don\'t have permission to perform this operation.',
        severity: 'warning',
        suggestion: 'Check file permissions or contact your system administrator.'
      };
    }

    if (lowerMessage.includes('not found') || lowerMessage.includes('no such file')) {
      return {
        title: 'File Not Found',
        message: 'The requested file or directory was not found.',
        severity: 'warning',
        suggestion: 'Verify the path and try again.'
      };
    }

    if (lowerMessage.includes('disk') || lowerMessage.includes('space')) {
      return {
        title: 'Storage Error',
        message: 'There\'s not enough disk space for this operation.',
        severity: 'error',
        suggestion: 'Free up disk space and try again.'
      };
    }

    // SSH specific errors
    if (lowerMessage.includes('authentication') || lowerMessage.includes('password')) {
      return {
        title: 'Authentication Failed',
        message: 'Unable to authenticate with your VPS.',
        severity: 'error',
        suggestion: 'Verify your username and password/private key.'
      };
    }

    // Default categorization
    return {
      title: 'Operation Failed',
      message: errorMessage,
      severity: 'error',
      suggestion: 'Please try again or contact support if the issue persists.'
    };
  }

  static handleServerError(error, context) {
    const status = error.response.status;
    const data = error.response.data;

    switch (status) {
      case 400:
        return {
          title: 'Bad Request',
          message: data.error || 'Invalid request parameters.',
          severity: 'warning',
          suggestion: 'Check your input and try again.'
        };

      case 401:
        return {
          title: 'Unauthorized',
          message: 'You are not authorized to perform this action.',
          severity: 'error',
          suggestion: 'Please log in and try again.'
        };

      case 403:
        return {
          title: 'Forbidden',
          message: 'Access to this resource is forbidden.',
          severity: 'error',
          suggestion: 'You may not have permission for this operation.'
        };

      case 404:
        return {
          title: 'Not Found',
          message: 'The requested resource was not found.',
          severity: 'warning',
          suggestion: 'Verify the path or resource exists.'
        };

      case 413:
        return {
          title: 'File Too Large',
          message: 'The file you\'re trying to upload is too large.',
          severity: 'warning',
          suggestion: 'Try uploading a smaller file or contact support.'
        };

      case 500:
        return {
          title: 'Server Error',
          message: 'An internal server error occurred.',
          severity: 'error',
          suggestion: 'Please try again later or contact support.'
        };

      default:
        return {
          title: 'Request Failed',
          message: data.error || `Server responded with status ${status}`,
          severity: 'error',
          suggestion: 'Please try again or contact support.'
        };
    }
  }

  static handleNetworkError(error, context) {
    if (error.code === 'ECONNABORTED') {
      return {
        title: 'Request Timeout',
        message: 'The request took too long to complete.',
        severity: 'warning',
        suggestion: 'Check your internet connection and try again.'
      };
    }

    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return {
        title: 'Connection Error',
        message: 'Unable to reach the server.',
        severity: 'error',
        suggestion: 'Check your internet connection and server status.'
      };
    }

    return {
      title: 'Network Error',
      message: 'A network error occurred while processing your request.',
      severity: 'error',
      suggestion: 'Check your internet connection and try again.'
    };
  }

  static handleGenericError(error, context) {
    return {
      title: 'Unexpected Error',
      message: error.message || 'An unexpected error occurred.',
      severity: 'error',
      suggestion: 'Please try again. If the issue persists, contact support.'
    };
  }

  static getUserFriendlyError(error, context = '') {
    const errorInfo = this.getErrorMessage(error, context);
    return {
      ...errorInfo,
      fullMessage: `${errorInfo.title}: ${errorInfo.message}`,
      context: context ? `Context: ${context}` : ''
    };
  }
}

// React hook for error handling
export function useErrorHandler() {
  const handleError = (error, context = '') => {
    const errorInfo = ErrorHandler.getUserFriendlyError(error, context);
    console.error(`[${context}] ${errorInfo.fullMessage}`, error);

    return errorInfo;
  };

  return { handleError };
}
