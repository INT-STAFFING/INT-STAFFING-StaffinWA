/**
 * @file Toast.tsx
 * @description Componente per una singola notifica "toast".
 */
import React, { useEffect } from 'react';
import Icon from './Icon';

interface ToastProps {
  message: string;
  type: 'success' | 'error';
  onDismiss: () => void;
}

const icons = {
  success: (
    <Icon name="CircleCheck" size={24} className="text-success" />
  ),
  error: (
    <Icon name="CircleX" size={24} className="text-destructive" />
  ),
};

const Toast: React.FC<ToastProps> = ({ message, type, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, 5000); // Auto-dismiss after 5 seconds

    return () => {
      clearTimeout(timer);
    };
  }, [onDismiss]);

  const bgColor = type === 'success' ? 'bg-success/10 dark:bg-success/20' : 'bg-destructive/10 dark:bg-destructive/20';
  const borderColor = type === 'success' ? 'border-success/30 dark:border-success/40' : 'border-destructive/30 dark:border-destructive/40';

  return (
    // MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza.
    <div className={`w-full max-w-lg p-[var(--space-4)] rounded-lg shadow-lg border ${bgColor} ${borderColor} flex items-start space-x-[var(--space-4)] animate-fade-in-right`}>
      <div className="flex-shrink-0">
        {icons[type]}
      </div>
      <div className="flex-1">
        {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
        <p className="text-[var(--font-size-sm)] font-medium text-foreground dark:text-dark-foreground">{message}</p>
      </div>
      <div className="flex-shrink-0">
        <button onClick={onDismiss} className="text-muted-foreground hover:text-foreground dark:hover:text-dark-foreground">
          {/* MODIFICA: Sostituita emoji con icona vettoriale per coerenza. */}
          <Icon name="X" size={20} />
        </button>
      </div>
    </div>
  );
};

export default Toast;