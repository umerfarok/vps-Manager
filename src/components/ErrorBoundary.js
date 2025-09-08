import React from 'react';
import { Box, Typography, Button, Paper, Alert } from '@mui/material';
import { Error, Refresh, BugReport } from '@mui/icons-material';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error,
      errorInfo
    });

    // Log error to external service in production
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Could send to error reporting service here
    // reportError(error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const { error, errorInfo } = this.state;
      const isDevelopment = process.env.NODE_ENV === 'development';

      return (
        <Box sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          p: 3,
          bgcolor: 'background.default'
        }}>
          <Paper elevation={3} sx={{ p: 4, maxWidth: 600, width: '100%', textAlign: 'center' }}>
            <Error sx={{ fontSize: 64, color: 'error.main', mb: 2 }} />
            <Typography variant="h4" gutterBottom color="error">
              Oops! Something went wrong
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              We encountered an unexpected error. This has been logged and our team has been notified.
            </Typography>

            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mb: 3 }}>
              <Button
                variant="contained"
                startIcon={<Refresh />}
                onClick={this.handleReset}
              >
                Try Again
              </Button>
              <Button
                variant="outlined"
                startIcon={<Refresh />}
                onClick={this.handleReload}
              >
                Reload Page
              </Button>
            </Box>

            {isDevelopment && (
              <Alert severity="warning" sx={{ mt: 3, textAlign: 'left' }}>
                <Typography variant="subtitle2" gutterBottom>
                  <BugReport sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Development Error Details:
                </Typography>
                <Typography variant="body2" component="pre" sx={{
                  whiteSpace: 'pre-wrap',
                  fontSize: '0.75rem',
                  bgcolor: 'grey.100',
                  p: 1,
                  borderRadius: 1,
                  overflow: 'auto',
                  maxHeight: 200
                }}>
                  {error && error.toString()}
                  {errorInfo.componentStack}
                </Typography>
              </Alert>
            )}

            <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
              If this problem persists, please contact support with the error details above.
            </Typography>
          </Paper>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
