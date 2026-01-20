
/**
 * @file Toast.tsx
 * @description Componente per una singola notifica "toast" con supporto a colori dinamici.
 */
import React, { useEffect } from 'react';

interface ToastProps {
  message: string;
  type: 'success' | 'error';
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

  const isSuccess = type === 'success';
  const baseClasses = "w-full max-w-lg p-4 rounded-2xl shadow-xl border flex items-start space-x-4 animate-scale-in pointer-events-auto transition-all duration-300";
  
  // Usiamo variabili CSS iniettate dal ThemeContext
  const dynamicStyles = {
      backgroundColor: isSuccess ? 'var(--toast-success-bg)' : 'var(--toast-error-bg)',
      borderColor: isSuccess ? 'var(--color-tertiary)' : 'var(--color-error)',
      color: isSuccess ? 'var(--toast-success-fg)' : 'var(--toast-error-fg)',
  };
  
  const icon = isSuccess ? 'check_circle' : 'error';

  return (
    <div className={baseClasses} style={dynamicStyles}>
      <div className="flex-shrink-0 text-2xl flex items-center">
        <span className="material-symbols-outlined">{icon}</span>
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
