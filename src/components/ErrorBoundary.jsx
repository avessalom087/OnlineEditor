import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, showStack: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, showStack: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          gap: '20px',
          padding: '40px',
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-mono)',
        }}>
          <div style={{ fontSize: '48px' }}>🛡️</div>

          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontSize: '10px',
              color: 'var(--danger-color)',
              letterSpacing: '2px',
              fontWeight: 'bold',
              marginBottom: '6px',
            }}>
              // COMPONENT_ERROR_BOUNDARY
            </div>
            <h2 style={{
              margin: '0 0 8px 0',
              fontFamily: 'var(--font-heading)',
              color: 'var(--danger-color)',
              fontSize: '22px',
              letterSpacing: '1px',
            }}>
              PANEL RUNTIME ERROR
            </h2>
            <p style={{
              margin: 0,
              fontSize: '13px',
              color: 'var(--text-secondary)',
              maxWidth: '480px',
              lineHeight: '1.6',
            }}>
              This panel crashed unexpectedly. Your unsaved data is safe — all other tabs continue working normally.
            </p>
          </div>

          {/* Error message box */}
          <div style={{
            background: 'rgba(235,103,103,0.06)',
            border: '1px solid var(--danger-color)',
            borderRadius: '2px',
            padding: '12px 16px',
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            color: 'var(--danger-color)',
            maxWidth: '600px',
            width: '100%',
            wordBreak: 'break-word',
          }}>
            {this.state.error?.toString()}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              className="btn btn-accent"
              onClick={this.handleReset}
            >
              ↺ RETRY PANEL
            </button>
            <button
              className="btn"
              onClick={() => this.setState(prev => ({ showStack: !prev.showStack }))}
            >
              {this.state.showStack ? 'HIDE' : 'SHOW'} STACK TRACE
            </button>
          </div>

          {/* Stack trace */}
          {this.state.showStack && this.state.errorInfo && (
            <pre style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '2px',
              padding: '12px',
              fontSize: '10px',
              color: 'var(--text-secondary)',
              maxWidth: '700px',
              width: '100%',
              overflowX: 'auto',
              maxHeight: '200px',
              overflowY: 'auto',
              whiteSpace: 'pre-wrap',
              lineHeight: '1.5',
            }}>
              {this.state.errorInfo.componentStack}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
