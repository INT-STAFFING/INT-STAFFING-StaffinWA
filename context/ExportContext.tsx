import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { ExportableData } from '../types';
import ExportModal from '../components/ExportModal';

interface ExportPayload {
  title: string;
  data: ExportableData[];
}

interface ExportContextValue {
  isOpen: boolean;
  title: string;
  data: ExportableData[];
  openExport: (payload: ExportPayload) => void;
  closeExport: () => void;
}

const ExportContext = createContext<ExportContextValue | undefined>(undefined);

export const ExportProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [data, setData] = useState<ExportableData[]>([]);

  const openExport = useCallback((payload: ExportPayload) => {
    setTitle(payload.title);
    setData(payload.data);
    setIsOpen(true);
  }, []);

  const closeExport = useCallback(() => {
    setIsOpen(false);
  }, []);

  const value = useMemo<ExportContextValue>(
    () => ({
      isOpen,
      title,
      data,
      openExport,
      closeExport,
    }),
    [isOpen, title, data, openExport, closeExport]
  );

  return (
    <ExportContext.Provider value={value}>
      {children}
      <ExportModal />
    </ExportContext.Provider>
  );
};

export const useExportContext = (): ExportContextValue => {
  const context = useContext(ExportContext);
  if (!context) {
    throw new Error('useExportContext must be used within an ExportProvider');
  }
  return context;
};
