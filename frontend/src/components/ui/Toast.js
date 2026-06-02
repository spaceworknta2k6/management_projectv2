'use client';

import { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle, WarningCircle, XCircle, Info, X } from '@phosphor-icons/react';

const ToastContext = createContext(null);

const ICONS = {
  success: <CheckCircle size={18} weight="fill" style={{ color: 'var(--success)' }} />,
  warning: <WarningCircle size={18} weight="fill" style={{ color: 'var(--warning)' }} />,
  error: <XCircle size={18} weight="fill" style={{ color: 'var(--error)' }} />,
  info: <Info size={18} weight="fill" style={{ color: 'var(--info)' }} />,
};

const BG = {
  success: 'var(--success-bg)',
  warning: 'var(--warning-bg)',
  error: 'var(--error-bg)',
  info: 'var(--info-bg)',
};

let toastId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback({
    success: (msg, dur) => addToast(msg, 'success', dur),
    warning: (msg, dur) => addToast(msg, 'warning', dur),
    error: (msg, dur) => addToast(msg, 'error', dur),
    info: (msg, dur) => addToast(msg, 'info', dur),
  }, [addToast]);

  return (
    <ToastContext.Provider value={toast}>
      {children}

      {/* Toast Container */}
      <div
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          maxWidth: '380px',
        }}
      >
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 60, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                padding: '12px 14px',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                borderLeft: `3px solid`,
                borderLeftColor: `var(--${t.type === 'success' ? 'success' : t.type === 'warning' ? 'warning' : t.type === 'error' ? 'error' : 'info'})`,
              }}
            >
              <div style={{ flexShrink: 0, marginTop: '1px' }}>
                {ICONS[t.type]}
              </div>
              <p style={{ flex: 1, fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                {t.message}
              </p>
              <button
                onClick={() => removeToast(t.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  padding: '2px',
                  flexShrink: 0,
                }}
                aria-label="Đóng"
              >
                <X size={14} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
