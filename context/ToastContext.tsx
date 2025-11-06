/**
 * @file ToastContext.tsx
 * @description Contesto e provider per un sistema di notifiche "toast" a livello di applicazione.
 */
import React, { createContext, useState, useCallback, useContext, ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';
import Toast from '../components/Toast';
import { useTheme } from './ThemeContext';

type ToastType = 'success' | 'error';

interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  addToast: (message: string, type: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const getPositionClasses = (position: string) => {
    switch(position) {
        case 'top-right': return 'top-5 right-5';
        case 'top-left': return 'top-5 left-5';
        case 'bottom-center': return 'bottom-5 left-1/2 -translate-x-1/2';
        case 'bottom-right': return 'bottom-5 right-5';
        case 'bottom-left': return 'bottom-5 left-5';
        case 'top-center':
        default:
            return 'top-5 left-1/2 -translate-x-1/2';
    }
}
/**
 * Fornisce la funzionalità di notifica a tutti i componenti figli.
 * Renderizza anche il contenitore in cui verranno visualizzati i toast.
 * @param {object} props - Le prop del componente.
 * @param {ReactNode} props.children - I componenti figli da renderizzare.
 * @returns {React.ReactElement} Il provider del contesto con il contenitore dei toast.
 */
export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const { theme } = useTheme();

  /**
   * Aggiunge una nuova notifica alla coda.
   * @param {string} message - Il testo del messaggio.
   * @param {ToastType} type - Il tipo di notifica ('success' o 'error').
   */
  const addToast = useCallback((message: string, type: ToastType) => {
    const id = uuidv4();
    setToasts(prevToasts => [...prevToasts, { id, message, type }]);
  }, []);

  /**
   * Rimuove una notifica dalla coda.
   * @param {string} id - L'ID della notifica da rimuovere.
   */
  const removeToast = useCallback((id: string) => {
    setToasts(prevToasts => prevToasts.filter(toast => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      {/* Contenitore dei toast, posizionato dinamicamente in base al tema */}
      <div className={`fixed z-[100] w-full max-w-lg space-y-3 ${getPositionClasses(theme.toastPosition)}`}>
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

/**
 * Hook personalizzato per accedere facilmente alla funzione `addToast` del contesto.
 * @returns {ToastContextType} L'oggetto del contesto.
 * @throws {Error} Se l'hook viene utilizzato al di fuori di un `ToastProvider`.
 */
export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};