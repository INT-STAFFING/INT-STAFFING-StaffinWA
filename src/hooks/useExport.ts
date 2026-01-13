import { useCallback, useState } from 'react';
import { ExportableInput } from '../../types';
import { buildHtmlTable, buildTsv } from '../../utils/exportTableUtils';

interface UseExportOptions {
  data: ExportableInput[];
  title?: string;
}

interface UseExportState {
  copyToClipboard: () => Promise<void>;
  isCopying: boolean;
  hasCopied: boolean;
  error: string | null;
}

export const useExport = ({ data, title }: UseExportOptions): UseExportState => {
  const [isCopying, setIsCopying] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return { copyToClipboard, isCopying, hasCopied, error };
};
