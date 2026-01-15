import React, { useMemo } from 'react';
import Modal from './Modal';
import { useExportContext } from '../context/ExportContext';
import { useExport } from '../src/hooks/useExport';
import { getExportColumns, normalizeExportData } from '../utils/exportTableUtils';

const formatCellValue = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => formatCellValue(item)).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const ExportModal: React.FC = () => {
  const { isOpen, title, data, closeExport } = useExportContext();
  const { copyToClipboard, isCopying, hasCopied, error } = useExport({ data, title });

  const normalizedData = useMemo(() => normalizeExportData(data), [data]);
  const columns = useMemo(() => getExportColumns(data), [data]);

  return (
    <Modal isOpen={isOpen} onClose={closeExport} title={title || 'Esporta dati'}>
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-on-surface-variant">
              Anteprima del contenuto che verrà copiato in formato ottimizzato per Excel, Outlook e Google Sheets.
            </p>
            <p className="text-xs text-on-surface-variant mt-1">
              Il formato include tabella HTML e testo separato da tabulazioni (TSV).
            </p>
          </div>
          <button
            type="button"
            onClick={copyToClipboard}
            disabled={isCopying || data.length === 0}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-on-primary shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-base">
              {hasCopied ? 'check_circle' : 'content_copy'}
            </span>
            {hasCopied ? 'Copiato' : isCopying ? 'Copiando...' : 'Copia negli appunti'}
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-error/40 bg-error/10 px-3 py-2 text-sm text-error">
            {error}
          </div>
        )}

        <div className="max-h-[60vh] overflow-auto rounded-xl border border-outline-variant bg-surface">
          {normalizedData.length === 0 ? (
            <div className="p-6 text-center text-sm text-on-surface-variant">Nessun dato da esportare.</div>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="bg-surface-container-high text-on-surface">
                <tr>
                  {columns.map((column) => (
                    <th
                      key={column}
                      className="px-4 py-2 text-left font-semibold border-b border-outline-variant whitespace-nowrap"
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {normalizedData.map((row, rowIndex) => (
                  <tr key={`export-row-${rowIndex}`} className="hover:bg-surface-container-low">
                    {columns.map((column) => (
                      <td key={`${column}-${rowIndex}`} className="px-4 py-2 text-on-surface-variant">
                        {formatCellValue(row[column])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default ExportModal;