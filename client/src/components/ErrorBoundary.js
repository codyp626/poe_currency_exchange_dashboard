import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '20px',
          margin: '20px',
          background: '#1a202c',
          border: '1px solid #e53e3e',
          borderRadius: '8px',
          color: '#fff'
        }}>
          <h2 style={{ color: '#fc8181', marginBottom: '10px' }}>Something went wrong</h2>
          <p>The application encountered an error. Please refresh the page.</p>
          {process.env.NODE_ENV !== 'production' && this.state.error && (
            <details style={{ marginTop: '20px', whiteSpace: 'pre-wrap' }}>
              <summary style={{ cursor: 'pointer', color: '#fc8181' }}>
                Error Details
              </summary>
              <div style={{ marginTop: '10px', fontSize: '12px', fontFamily: 'monospace' }}>
                {this.state.error.toString()}
                <br />
                {this.state.errorInfo?.componentStack}
              </div>
            </details>
          )}
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '20px',
              padding: '10px 20px',
              background: '#4299e1',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

