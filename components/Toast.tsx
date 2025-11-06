/**
 * @file Toast.tsx
 * @description Componente per una singola notifica "toast".
 */
import React, { useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';

interface ToastProps {
  message: string;
  type: 'success' | 'error';
  onDismiss: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, type, onDismiss }) => {
  const { theme } = useTheme();

  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, 5000); // Auto-dismiss after 5 seconds

    return () => {
      clearTimeout(timer);
    };
  }, [onDismiss]);

  const isSuccess = type === 'success';
  const styleProps = {
    backgroundColor: isSuccess ? theme.toastSuccessBackground : theme.toastErrorBackground,
    color: isSuccess ? theme.toastSuccessForeground : theme.toastErrorForeground,
    borderColor: isSuccess ? theme.success : theme.destructive,
  };
  const emoji = isSuccess ? '✅' : '❌';

  return (
    <div 
      style={styleProps}
      className={`w-full max-w-lg p-4 rounded-lg shadow-lg border flex items-start space-x-4 animate-scale-in`}
    >
      <div className="flex-shrink-0 text-2xl">
        {emoji}
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium" style={{ color: styleProps.color }}>{message}</p>
      </div>
      <div className="flex-shrink-0">
        <button onClick={onDismiss} style={{ color: styleProps.color, opacity: 0.7 }} className="hover:opacity-100">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default Toast;