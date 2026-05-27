import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

let toastIdCounter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 320);
  }, []);

  const addToast = useCallback((message, type = 'info', duration = 4500) => {
    const id = ++toastIdCounter;
    setToasts(prev => [...prev.slice(-3), { id, message, type, exiting: false }]);
    if (duration > 0) {
      setTimeout(() => dismiss(id), duration);
    }
    return id;
  }, [dismiss]);

  const toast = {
    success: (msg, dur) => addToast(msg, 'success', dur),
    error:   (msg, dur) => addToast(msg, 'error',   dur),
    warning: (msg, dur) => addToast(msg, 'warning', dur),
    info:    (msg, dur) => addToast(msg, 'info',    dur),
    dismiss,
  };

  const TYPE_STYLES = {
    success: { border: '#4a9a4a', icon: '✓', color: '#a6f5a6', bg: 'rgba(74,154,74,0.10)' },
    error:   { border: '#eb6767', icon: '✕', color: '#eb6767', bg: 'rgba(235,103,103,0.10)' },
    warning: { border: '#ebd667', icon: '⚠', color: '#ebd667', bg: 'rgba(235,214,103,0.10)' },
    info:    { border: '#588058', icon: 'ℹ', color: '#95c095', bg: 'rgba(88,128,88,0.10)'  },
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}

      {/* Toast Stack — fixed bottom-right */}
      <div style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 999999,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        pointerEvents: 'none',
      }}>
        {toasts.map(t => {
          const s = TYPE_STYLES[t.type] || TYPE_STYLES.info;
          return (
            <div
              key={t.id}
              style={{
                background: s.bg,
                border: `1px solid ${s.border}`,
                borderLeft: `3px solid ${s.border}`,
                borderRadius: '3px',
                padding: '12px 14px',
                minWidth: '280px',
                maxWidth: '420px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                boxShadow: `0 4px 20px rgba(0,0,0,0.6), 0 0 10px ${s.border}33`,
                pointerEvents: 'all',
                backdropFilter: 'blur(4px)',
                animation: t.exiting
                  ? 'toastOut 0.32s ease forwards'
                  : 'toastIn 0.32s ease',
              }}
            >
              <span style={{ color: s.color, fontSize: '15px', fontWeight: 'bold', flexShrink: 0, marginTop: '1px' }}>
                {s.icon}
              </span>
              <span style={{
                flex: 1,
                fontSize: '13px',
                color: 'var(--text-primary)',
                lineHeight: '1.5',
                fontFamily: 'var(--font-mono)',
                wordBreak: 'break-word',
              }}>
                {t.message}
              </span>
              <button
                onClick={() => dismiss(t.id)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: '16px',
                  padding: '0 0 0 6px',
                  lineHeight: 1,
                  flexShrink: 0,
                }}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
