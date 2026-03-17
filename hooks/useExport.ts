
import { useCallback, useState } from 'react';
import { ExportableInput } from '../types';
import { buildHtmlTable, buildTsv, buildCsv, buildJson } from '../utils/exportTableUtils';

interface UseExportOptions {
  data: ExportableInput[];
  title?: string;
  filename?: string;
}

interface UseExportState {
  copyToClipboard: () => Promise<void>;
  downloadAsCsv: () => void;
  downloadAsJson: () => void;
  isCopying: boolean;
  hasCopied: boolean;
  error: string | null;
}

export const useExport = ({ data, title, filename = 'export' }: UseExportOptions): UseExportState => {
  const [isCopying, setIsCopying] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const downloadFile = (content: string, type: string, extension: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadAsCsv = useCallback(() => {
    try {
      const csv = buildCsv(data);
      downloadFile(csv, 'text/csv;charset=utf-8;', 'csv');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore durante il download CSV.');
    }
  }, [data, filename]);

  const downloadAsJson = useCallback(() => {
    try {
      const json = buildJson(data);
      downloadFile(json, 'application/json;charset=utf-8;', 'json');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore durante il download JSON.');
    }
  }, [data, filename]);

  const copyToClipboard = useCallback(async () => {
    if (!navigator?.clipboard?.write) {
      setError('Clipboard API non disponibile in questo browser.');
      return;
    }

    setIsCopying(true);
    setHasCopied(false);
    setError(null);

    try {
      const tsv = buildTsv(data);
      const html = buildHtmlTable(data, { title });
      const clipboardItem = new ClipboardItem({
        'text/plain': new Blob([tsv], { type: 'text/plain' }),
        'text/html': new Blob([html], { type: 'text/html' }),
      });
      await navigator.clipboard.write([clipboardItem]);
      setHasCopied(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Errore durante la copia.';
      setError(message);
    } finally {
      setIsCopying(false);
    }
  }, [data, title]);

  return { copyToClipboard, downloadAsCsv, downloadAsJson, isCopying, hasCopied, error };
};
