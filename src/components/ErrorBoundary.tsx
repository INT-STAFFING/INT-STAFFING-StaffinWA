
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children?: ReactNode;
  fallback?: ReactNode;
  label?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary cattura errori JavaScript ovunque nel tree dei componenti figli,
 * logga quegli errori, e visualizza una UI di fallback invece del componente che è andato in crash.
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Aggiorna lo stato in modo che il prossimo render mostri la UI di fallback.
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="p-6 bg-error-container rounded-xl border border-error/20 flex flex-col items-center justify-center text-center space-y-2 animate-fade-in my-4">
          <span className="material-symbols-outlined text-4xl text-on-error-container">error_outline</span>
          <h3 className="text-lg font-bold text-on-error-container">
            {this.props.label || 'Qualcosa è andato storto'}
          </h3>
          <p className="text-sm text-on-error-container/80 max-w-md">
            Impossibile visualizzare questo componente. Prova a ricaricare la pagina o contatta il supporto se il problema persiste.
          </p>
          {this.state.error && (
            <details className="mt-4 text-xs text-left w-full bg-white/50 dark:bg-black/20 p-2 rounded overflow-auto max-h-32">
              <summary className="cursor-pointer font-mono mb-1">Dettagli errore</summary>
              <pre className="whitespace-pre-wrap font-mono">{this.state.error.message}</pre>
            </details>
          )}
          <button 
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-4 px-4 py-2 bg-error text-on-error rounded-full text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Riprova
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
