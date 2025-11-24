
import React, { createContext, useState, useCallback, useContext, ReactNode } from 'react';
import Toast from '../components/Toast';
import { useTheme } from './ThemeContext';

interface ToastMessage {
  id: number;
  message: string;
  type: 'success' | 'error';
}

interface ToastContextType {
  addToast: (message: string, type: 'success' | 'error') => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const { theme } = useTheme();

  const addToast = useCallback((message: string, type: 'success' | 'error') => {
    const id = Date.now();
    setToasts(currentToasts => [...currentToasts, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts(currentToasts => currentToasts.filter(toast => toast.id !== id));
  }, []);
  
  const getPositionClass = () => {
      // Logic for toast position is now handled inside AdminSettings, this is a fallback.
      const position = theme.toastPosition || 'top-center';
      switch(position) {
          case 'top-right': return 'top-5 right-5';
          case 'top-left': return 'top-5 left-5';
          case 'bottom-right': return 'bottom-5 right-5';
          case 'bottom-left': return 'bottom-5 left-5';
          case 'bottom-center': return 'bottom-5 left-1/2 -translate-x-1/2';
          case 'top-center':
          default:
            return 'top-5 left-1/2 -translate-x-1/2';
      }
  }

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className={`fixed z-[100] w-full max-w-lg p-4 space-y-2 pointer-events-none ${getPositionClass()}`}>
        {toasts.map(toast => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onDismiss={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
