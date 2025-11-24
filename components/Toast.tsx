
/**
 * @file Toast.tsx
 * @description Componente per una singola notifica "toast".
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
    }, 5000); // Auto-dismiss after 5 seconds

    return () => {
      clearTimeout(timer);
    };
  }, [onDismiss]);

  const isSuccess = type === 'success';
  // Added pointer-events-auto to ensure the toast itself can receive clicks (e.g. close button)
  const baseClasses = "w-full max-w-lg p-4 rounded-2xl shadow-lg border flex items-start space-x-4 animate-scale-in pointer-events-auto";
  const typeClasses = isSuccess
    ? "bg-tertiary-container border-tertiary text-on-tertiary-container"
    : "bg-error-container border-error text-on-error-container";
  
  const icon = isSuccess ? 'check_circle' : 'error';

  return (
    <div className={`${baseClasses} ${typeClasses}`}>
      <div className="flex-shrink-0 text-2xl">
        <span className="material-symbols-outlined">{icon}</span>
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium">{message}</p>
      </div>
      <div className="flex-shrink-0">
        <button onClick={onDismiss} className="opacity-70 hover:opacity-100">
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>
    </div>
  );
};

export default Toast;
