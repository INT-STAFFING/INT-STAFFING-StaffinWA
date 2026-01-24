
/**
 * @file Toast.tsx
 * @description Componente per una singola notifica "toast" con supporto a colori dinamici.
 */
import React, { useEffect } from 'react';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  onDismiss: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, type, onDismiss }) => {

  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, 5000); 

    return () => {
      clearTimeout(timer);
    };
  }, [onDismiss]);

  const baseClasses = "w-full max-w-lg p-4 rounded-2xl shadow-xl border flex items-start space-x-4 animate-scale-in pointer-events-auto transition-all duration-300";
  
  const getStyleConfig = () => {
      switch (type) {
          case 'success':
              return {
                  bg: 'var(--toast-success-bg)',
                  border: 'var(--color-tertiary)',
                  color: 'var(--toast-success-fg)',
                  icon: 'check_circle'
              };
          case 'error':
              return {
                  bg: 'var(--toast-error-bg)',
                  border: 'var(--color-error)',
                  color: 'var(--toast-error-fg)',
                  icon: 'error'
              };
          case 'warning':
              return {
                  bg: 'var(--color-yellow-container)',
                  border: '#eab308', // yellow-500 fallback if var missing
                  color: 'var(--color-on-yellow-container)',
                  icon: 'warning'
              };
          case 'info':
          default:
              return {
                  bg: 'var(--color-surface-container-high)',
                  border: 'var(--color-outline)',
                  color: 'var(--color-on-surface)',
                  icon: 'info'
              };
      }
  }

  const config = getStyleConfig();

  const dynamicStyles = {
      backgroundColor: config.bg,
      borderColor: config.border,
      color: config.color,
  };

  return (
    <div className={baseClasses} style={dynamicStyles}>
      <div className="flex-shrink-0 text-2xl flex items-center">
        <span className="material-symbols-outlined">{config.icon}</span>
      </div>
      <div className="flex-1">
        <p className="text-sm font-bold leading-tight">{message}</p>
      </div>
      <div className="flex-shrink-0 flex items-center">
        <button onClick={onDismiss} className="opacity-60 hover:opacity-100 transition-opacity">
          <span className="material-symbols-outlined text-lg">close</span>
        </button>
      </div>
    </div>
  );
};

export default Toast;
