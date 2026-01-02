import React from 'react';

interface ErrorScreenProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

const ErrorScreen: React.FC<ErrorScreenProps> = ({
  title = 'Si è verificato un errore',
  message = 'Non è stato possibile caricare i contenuti. Riprova ad aggiornare la pagina.',
  onRetry = () => window.location.reload(),
}) => (
  <div className="flex h-screen w-screen items-center justify-center bg-background px-4" role="alert">
    <div className="w-full max-w-lg space-y-4 rounded-2xl border border-outline-variant bg-surface p-6 text-center shadow-lg">
      <div className="flex items-center justify-center">
        <span className="material-symbols-outlined text-5xl text-error">error</span>
      </div>
      <h1 className="text-2xl font-bold text-on-surface">{title}</h1>
      <p className="text-on-surface-variant">{message}</p>
      <div className="flex justify-center gap-3">
        <button
          type="button"
          onClick={onRetry}
          className="rounded-full bg-primary px-4 py-2 text-on-primary font-semibold hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          Riprova
        </button>
        <button
          type="button"
          onClick={() => window.location.assign('/')}
          className="rounded-full border border-outline px-4 py-2 text-on-surface font-semibold hover:bg-surface-container-high focus:outline-none focus:ring-2 focus:ring-outline/50"
        >
          Torna alla home
        </button>
      </div>
    </div>
  </div>
);

export default ErrorScreen;
