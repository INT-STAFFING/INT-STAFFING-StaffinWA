import React, { useCallback } from 'react';
import { useExportContext } from '../context/ExportContext';
import { ExportableInput } from '../types';

interface ExportButtonProps {
  data: ExportableInput[];
  title: string;
  label?: string;
  showLabel?: boolean;
  icon?: string;
  className?: string;
  disabled?: boolean;
}

const ExportButtonComponent: React.FC<ExportButtonProps> = ({
  data,
  title,
  label = 'Esporta',
  showLabel = true,
  icon = 'content_copy',
  className,
  disabled = false,
}) => {
  const { openExport } = useExportContext();

  const handleClick = useCallback(() => {
    openExport({ title, data });
  }, [openExport, title, data]);

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || data.length === 0}
      className={[
        'inline-flex items-center gap-2 rounded-full border border-outline-variant bg-surface px-3 py-2 text-sm font-medium text-on-surface shadow-sm transition hover:bg-surface-container focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label={showLabel ? undefined : label}
    >
      <span className="material-symbols-outlined text-base">{icon}</span>
      {showLabel && <span>{label}</span>}
    </button>
  );
};

const ExportButton = React.memo(ExportButtonComponent);

export default ExportButton;