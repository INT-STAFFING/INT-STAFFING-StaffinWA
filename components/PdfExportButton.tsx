/**
 * @file PdfExportButton.tsx
 * @description Pulsante riutilizzabile per l'esportazione di dati in formato PDF
 * con grafici QuickChart.io e tabelle. Usa la stessa stilistica dell'ExportButton esistente.
 */

import React, { useState, useCallback } from 'react';
import { generatePdf, PdfExportConfig } from '../utils/pdfExportUtils';
import { useToast } from '../context/ToastContext';

interface PdfExportButtonProps {
  /** Funzione che costruisce la configurazione PDF al momento del click */
  buildConfig: () => PdfExportConfig;
  /** Etichetta del pulsante */
  label?: string;
  /** Se mostrare l'etichetta testuale */
  showLabel?: boolean;
  /** Classi CSS aggiuntive */
  className?: string;
  /** Disabilita il pulsante */
  disabled?: boolean;
}

const PdfExportButtonComponent: React.FC<PdfExportButtonProps> = ({
  buildConfig,
  label = 'Esporta PDF',
  showLabel = true,
  className,
  disabled = false,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const { addToast } = useToast();

  const handleClick = useCallback(async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const config = buildConfig();
      if (!config.tables.length && !config.charts.length) {
        addToast('Nessun dato da esportare', 'warning');
        return;
      }
      await generatePdf(config);
      addToast('PDF esportato con successo', 'success');
    } catch (error) {
      console.error('Errore durante la generazione del PDF:', error);
      addToast('Errore durante la generazione del PDF', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [buildConfig, addToast, isLoading]);

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || isLoading}
      className={[
        'inline-flex items-center gap-2 rounded-full border border-outline-variant bg-surface px-3 py-2 text-sm font-medium text-on-surface shadow-sm transition hover:bg-surface-container focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label={showLabel ? undefined : label}
      title={label}
    >
      {isLoading ? (
        <span className="material-symbols-outlined text-base" style={{ animation: 'spin 1s linear infinite' }}>
          refresh
        </span>
      ) : (
        <span className="material-symbols-outlined text-base">picture_as_pdf</span>
      )}
      {showLabel && <span>{isLoading ? 'Generazione...' : label}</span>}
    </button>
  );
};

const PdfExportButton = React.memo(PdfExportButtonComponent);
export default PdfExportButton;
