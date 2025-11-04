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
        return importResult.success ? 'text-success dark:text-success' : 'text-destructive dark:text-destructive';
    };

    return (
        <div>
            <h1 className="text-3xl font-bold text-foreground dark:text-dark-foreground mb-6">Importazione Massiva Dati</h1>
            
            <div className="bg-card dark:bg-dark-card rounded-lg shadow p-8 max-w-4xl mx-auto space-y-8">
                {/* Step 1: Select Type */}
                <div>
                    <h2 className="text-xl font-semibold mb-3 flex items-center"><span className="bg-primary text-dark-foreground dark:text-dark-sidebar-foreground rounded-full h-8 w-8 text-sm flex items-center justify-center mr-3">1</span> Seleziona il tipo di dati</h2>
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
                    <h2 className="text-xl font-semibold mb-3 flex items-center"><span className="bg-primary text-dark-foreground dark:text-dark-sidebar-foreground rounded-full h-8 w-8 text-sm flex items-center justify-center mr-3">2</span> Scarica e compila il template</h2>
                    <p className="text-muted-foreground mb-4 text-sm">Scarica il file Excel, compilalo con i tuoi dati e salvalo. Non modificare i nomi dei fogli o delle colonne.</p>
                    <button
                        onClick={() => exportTemplate(importType)}
                        className="inline-flex items-center justify-center px-4 py-2 bg-primary text-dark-foreground dark:text-dark-sidebar-foreground font-semibold rounded-md shadow-sm hover:bg-primary/80 transition-colors duration-200"
                    >
                        <span className="mr-2 text-xl">📥</span>
                        Scarica Template
                    </button>
                </div>

                {/* Step 3: Upload and Import */}
                <div>
                     <h2 className="text-xl font-semibold mb-3 flex items-center"><span className="bg-primary text-dark-foreground dark:text-dark-sidebar-foreground rounded-full h-8 w-8 text-sm flex items-center justify-center mr-3">3</span> Carica e importa il file</h2>
                     <div className="flex flex-col md:flex-row md:items-center md:space-x-4 space-y-4 md:space-y-0">
                        <div>
                            <label htmlFor="file-upload" className="cursor-pointer inline-flex items-center px-4 py-2 border border-border dark:border-dark-border rounded-md shadow-sm text-sm font-medium text-foreground dark:text-dark-foreground bg-card dark:bg-dark-muted hover:bg-muted dark:hover:bg-dark-muted">
                                <span>{file ? 'Cambia file...' : 'Seleziona un file...'}</span>
                                <input id="file-upload" name="file-upload" type="file" className="sr-only" accept=".xlsx, .xls" onChange={handleFileChange} />
                            </label>
                            {file && <p className="mt-2 text-sm text-muted-foreground dark:text-dark-muted-foreground">{file.name}</p>}
                        </div>

                        <button
                            onClick={handleImport}
                            disabled={!file || isImporting}
                            className="inline-flex items-center justify-center px-6 py-3 bg-primary text-dark-foreground dark:text-dark-sidebar-foreground font-semibold rounded-md shadow-sm hover:bg-primary/80 disabled:bg-primary/50 disabled:text-dark-foreground/70 disabled:cursor-not-allowed transition-colors duration-200"
                        >
                            {isImporting ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-dark-foreground dark:text-dark-sidebar-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Importazione...
                                </>
                            ) : (
                                <>
                                    <span className="mr-2 text-xl">📤</span>
                                    Importa Dati
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {importResult && (
                    <div className="mt-4 pt-6 border-t border-border dark:border-dark-border">
                        <h3 className={`text-lg font-semibold ${getResultMessageColor()}`}>{importResult.message}</h3>
                        {importResult.details && importResult.details.length > 0 && (
                             <div className="mt-2 p-3 bg-warning/10 dark:bg-warning/30 border border-warning dark:border-warning rounded-md">
                                <h4 className="font-semibold text-warning dark:text-warning">Dettagli e Avvisi:</h4>
                                <ul className="list-disc list-inside mt-1 text-sm text-warning dark:text-warning max-h-40 overflow-y-auto">
                                    {importResult.details.map((detail, i) => <li key={i}>{detail}</li>)}
                                </ul>
                            </div>
                        )}
                    </div>
                )}
            </div>
             <style>{`.form-select { display: block; width: 100%; border-radius: 0.375rem; border: 1px solid var(--color-border); background-color: var(--color-card); padding: 0.5rem 0.75rem; font-size: 0.875rem; line-height: 1.25rem; } .dark .form-select { border-color: var(--color-dark-border); background-color: var(--color-dark-card); color: var(--color-dark-foreground); }`}</style>
        </div>
    );
};

export default ImportPage;