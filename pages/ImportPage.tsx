import React, { useState, useCallback } from 'react';
import { useEntitiesContext } from '../context/AppContext';
import { exportTemplate } from '../utils/exportUtils';

type ImportType = 'core_entities' | 'staffing' | 'resource_requests' | 'interviews';

const importOptions: { value: ImportType; label: string; sheetName: string }[] = [
    { value: 'core_entities', label: 'Entità Principali (Risorse, Progetti, etc.)', sheetName: 'Multiple' },
    { value: 'staffing', label: 'Staffing (Allocazioni)', sheetName: 'Staffing' },
    { value: 'resource_requests', label: 'Richieste Risorse', sheetName: 'Richieste_Risorse' },
    { value: 'interviews', label: 'Colloqui', sheetName: 'Colloqui' },
];

const ImportPage: React.FC = () => {
    const [importType, setImportType] = useState<ImportType>('core_entities');
    const [file, setFile] = useState<File | null>(null);
    const [isImporting, setIsImporting] = useState(false);
    const [importResult, setImportResult] = useState<{
        success: boolean;
        message: string;
        details?: string[];
    } | null>(null);
    const { fetchData } = useEntitiesContext(); 

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFile(e.target.files[0]);
            setImportResult(null);
        }
    };

    const handleImport = useCallback(async () => {
        if (!file) return;

        setIsImporting(true);
        setImportResult(null);

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                // This assumes the xlsx library is loaded from a CDN in index.html
                const XLSX = (window as any).XLSX;
                const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                
                let body: any = {};
                
                // Extract data based on the selected import type
                switch(importType) {
                    case 'core_entities':
                        body = {
                            clients: XLSX.utils.sheet_to_json(workbook.Sheets['Clienti'] || {}),
                            roles: XLSX.utils.sheet_to_json(workbook.Sheets['Ruoli'] || {}),
                            resources: XLSX.utils.sheet_to_json(workbook.Sheets['Risorse'] || {}),
                            projects: XLSX.utils.sheet_to_json(workbook.Sheets['Progetti'] || {}),
                            calendar: XLSX.utils.sheet_to_json(workbook.Sheets['Calendario'] || {}),
                            horizontals: XLSX.utils.sheet_to_json(workbook.Sheets['Config_Horizontals'] || {}),
                            seniorityLevels: XLSX.utils.sheet_to_json(workbook.Sheets['Config_Seniority'] || {}),
                            projectStatuses: XLSX.utils.sheet_to_json(workbook.Sheets['Config_ProjectStatus'] || {}),
                            clientSectors: XLSX.utils.sheet_to_json(workbook.Sheets['Config_ClientSectors'] || {}),
                            locations: XLSX.utils.sheet_to_json(workbook.Sheets['Config_Locations'] || {}),
                        };
                        break;
                    case 'staffing':
                        body = { staffing: XLSX.utils.sheet_to_json(workbook.Sheets['Staffing'] || {}) };
                        break;
                    case 'resource_requests':
                        body = { resource_requests: XLSX.utils.sheet_to_json(workbook.Sheets['Richieste_Risorse'] || {}) };
                        break;
                    case 'interviews':
                        body = { interviews: XLSX.utils.sheet_to_json(workbook.Sheets['Colloqui'] || {}) };
                        break;
                }

                const response = await fetch(`/api/import?type=${importType}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.error || 'Errore sconosciuto dal server.');
                }
                
                setImportResult({ success: true, message: result.message, details: result.warnings });
                fetchData(); // Refresh all app data
            } catch (error) {
                setImportResult({ success: false, message: `Importazione fallita: ${(error as Error).message}` });
            } finally {
                setIsImporting(false);
            }
        };
        reader.readAsArrayBuffer(file);
    }, [file, fetchData, importType]);

    const getResultMessageColor = () => {
        if (!importResult) return '';
        return importResult.success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
    };

    return (
        <div>
            {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
            <h1 className="text-[var(--font-size-3xl)] font-bold text-gray-800 dark:text-white mb-[var(--space-6)]">Importazione Massiva Dati</h1>
            
            {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-[var(--space-8)] max-w-4xl mx-auto space-y-[var(--space-8)]">
                {/* Step 1: Select Type */}
                <div>
                    {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
                    <h2 className="text-[var(--font-size-xl)] font-semibold mb-[var(--space-3)] flex items-center"><span className="bg-primary text-white rounded-full h-[var(--space-8)] w-[var(--space-8)] text-[var(--font-size-sm)] flex items-center justify-center mr-[var(--space-3)]">1</span> Seleziona il tipo di dati</h2>
                    <select
                        value={importType}
                        onChange={(e) => {
                            setImportType(e.target.value as ImportType);
                            setFile(null);
                            setImportResult(null);
                        }}
                        className="form-select w-full md:w-1/2"
                    >
                        {importOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                </div>
                
                 {/* Step 2: Download Template */}
                 <div>
                    {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
                    <h2 className="text-[var(--font-size-xl)] font-semibold mb-[var(--space-3)] flex items-center"><span className="bg-primary text-white rounded-full h-[var(--space-8)] w-[var(--space-8)] text-[var(--font-size-sm)] flex items-center justify-center mr-[var(--space-3)]">2</span> Scarica e compila il template</h2>
                    {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
                    <p className="text-muted-foreground mb-[var(--space-4)] text-[var(--font-size-sm)]">Scarica il file Excel, compilalo con i tuoi dati e salvalo. Non modificare i nomi dei fogli o delle colonne.</p>
                     <button
                        onClick={() => exportTemplate(importType)}
                        // MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza.
                        className="inline-flex items-center justify-center px-[var(--space-4)] py-[var(--space-2)] bg-gray-600 text-white font-semibold rounded-md shadow-sm hover:bg-gray-700 transition-colors duration-200"
                    >
                        {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
                        <span className="mr-[var(--space-2)] text-[var(--font-size-xl)]">📥</span>
                        Scarica Template
                    </button>
                </div>

                {/* Step 3: Upload and Import */}
                <div>
                     {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
                     <h2 className="text-[var(--font-size-xl)] font-semibold mb-[var(--space-3)] flex items-center"><span className="bg-primary text-white rounded-full h-[var(--space-8)] w-[var(--space-8)] text-[var(--font-size-sm)] flex items-center justify-center mr-[var(--space-3)]">3</span> Carica e importa il file</h2>
                     {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
                     <div className="flex flex-col md:flex-row md:items-center md:space-x-[var(--space-4)] space-y-[var(--space-4)] md:space-y-0">
                        <div>
                            {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
                            <label htmlFor="file-upload" className="cursor-pointer inline-flex items-center px-[var(--space-4)] py-[var(--space-2)] border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-[var(--font-size-sm)] font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                <span>{file ? 'Cambia file...' : 'Seleziona un file...'}</span>
                                <input id="file-upload" name="file-upload" type="file" className="sr-only" accept=".xlsx, .xls" onChange={handleFileChange} />
                            </label>
                            {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
                            {file && <p className="mt-[var(--space-2)] text-[var(--font-size-sm)] text-gray-500 dark:text-gray-400">{file.name}</p>}
                        </div>

                        <button
                            onClick={handleImport}
                            disabled={!file || isImporting}
                            // MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza.
                            className="inline-flex items-center justify-center px-[var(--space-6)] py-[var(--space-3)] bg-blue-600 text-white font-semibold rounded-md shadow-sm hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors duration-200"
                        >
                            {isImporting ? (
                                <>
                                    {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
                                    <svg className="animate-spin -ml-[var(--space-1)] mr-[var(--space-3)] h-[var(--space-5)] w-[var(--space-5)] text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Importazione...
                                </>
                            ) : (
                                <>
                                    {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
                                    <span className="mr-[var(--space-2)] text-[var(--font-size-xl)]">📤</span>
                                    Importa Dati
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {importResult && (
                    // MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza.
                    <div className="mt-[var(--space-4)] pt-[var(--space-6)] border-t border-gray-200 dark:border-gray-700">
                        {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
                        <h3 className={`text-[var(--font-size-lg)] font-semibold ${getResultMessageColor()}`}>{importResult.message}</h3>
                        {importResult.details && importResult.details.length > 0 && (
                             // MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza.
                             <div className="mt-[var(--space-2)] p-[var(--space-3)] bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
                                <h4 className="font-semibold text-yellow-800 dark:text-yellow-200">Dettagli e Avvisi:</h4>
                                {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
                                <ul className="list-disc list-inside mt-[var(--space-1)] text-[var(--font-size-sm)] text-yellow-700 dark:text-yellow-300 max-h-40 overflow-y-auto">
                                    {importResult.details.map((detail, i) => <li key={i}>{detail}</li>)}
                                </ul>
                            </div>
                        )}
                    </div>
                )}
            </div>
             <style>{`.form-select { display: block; width: 100%; border-radius: 0.375rem; border: 1px solid #D1D5DB; background-color: #FFFFFF; padding: 0.5rem 0.75rem; font-size: 0.875rem; line-height: 1.25rem; } .dark .form-select { border-color: #4B5563; background-color: #374151; color: #F9FAFB; }`}</style>
        </div>
    );
};

export default ImportPage;