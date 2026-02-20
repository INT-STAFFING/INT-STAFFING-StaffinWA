
import React, { useState, useCallback, useRef } from 'react';
import { useFetchData } from '../context/AppContext';
import { exportTemplate } from '../utils/exportUtils';
import { SpinnerIcon } from '../components/icons';
import { useAuth } from '../context/AuthContext';

type ImportType = 'core_entities' | 'staffing' | 'resource_requests' | 'interviews' | 'skills' | 'leaves' | 'users_permissions' | 'tutor_mapping';

const importOptions: { value: ImportType; label: string; sheetName: string; adminOnly?: boolean }[] = [
    { value: 'core_entities', label: 'Entità Principali (Risorse, Progetti, etc.)', sheetName: 'Multiple' },
    { value: 'staffing', label: 'Staffing (Allocazioni)', sheetName: 'Staffing' },
    { value: 'resource_requests', label: 'Richieste Risorse', sheetName: 'Richieste_Risorse' },
    { value: 'interviews', label: 'Colloqui', sheetName: 'Colloqui' },
    { value: 'skills', label: 'Competenze e Associazioni', sheetName: 'Competenze' },
    { value: 'leaves', label: 'Assenze (Leaves)', sheetName: 'Assenze' },
    { value: 'users_permissions', label: 'Utenti e Permessi (Admin)', sheetName: 'Utenti', adminOnly: true },
    { value: 'tutor_mapping', label: 'Mappatura Tutor', sheetName: 'Mappatura_Tutor' },
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
    const fetchData = useFetchData();
    const { isAdmin } = useAuth();
    
    // Ref per l'input file
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelectClick = () => {
        fileInputRef.current?.click();
    };

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

        try {
            const XLSX = await import('xlsx');
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = new Uint8Array(e.target?.result as ArrayBuffer);
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
                        case 'skills':
                            body = { 
                                skills: XLSX.utils.sheet_to_json(workbook.Sheets['Competenze'] || {}),
                                associations: XLSX.utils.sheet_to_json(workbook.Sheets['Associazioni_Risorse'] || {}) 
                            };
                            break;
                        case 'leaves':
                            body = { leaves: XLSX.utils.sheet_to_json(workbook.Sheets['Assenze'] || {}) };
                            break;
                        case 'users_permissions':
                            body = {
                                users: XLSX.utils.sheet_to_json(workbook.Sheets['Utenti'] || {}),
                                permissions: XLSX.utils.sheet_to_json(workbook.Sheets['Permessi'] || {})
                            };
                            break;
                        case 'tutor_mapping':
                            body = {
                                mapping: XLSX.utils.sheet_to_json(workbook.Sheets['Mappatura_Tutor'] || {})
                            };
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
        } catch (error) {
            setImportResult({ success: false, message: `Errore nel caricamento della libreria XLSX: ${(error as Error).message}` });
            setIsImporting(false);
        }
    }, [file, fetchData, importType]);

    const getResultMessageColor = () => {
        if (!importResult) return '';
        return importResult.success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
    };

    const handleDownloadTemplate = async () => {
        await exportTemplate(importType);
    };

    return (
        <div>
            <h1 className="text-3xl font-bold text-on-surface mb-6">Importazione Massiva Dati</h1>
            
            <div className="bg-surface rounded-2xl shadow p-8 max-w-4xl mx-auto space-y-8">
                {/* Step 1: Select Type */}
                <div>
                    <h2 className="text-xl font-semibold mb-3 flex items-center"><span className="bg-primary text-on-primary rounded-full h-8 w-8 text-sm flex items-center justify-center mr-3">1</span> Seleziona il tipo di dati</h2>
                    <select
                        value={importType}
                        onChange={(e) => {
                            setImportType(e.target.value as ImportType);
                            setFile(null);
                            setImportResult(null);
                        }}
                        className="form-select w-full md:w-1/2"
                    >
                        {importOptions.filter(opt => !opt.adminOnly || isAdmin).map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                </div>
                
                 {/* Step 2: Download Template */}
                 <div>
                    <h2 className="text-xl font-semibold mb-3 flex items-center"><span className="bg-primary text-on-primary rounded-full h-8 w-8 text-sm flex items-center justify-center mr-3">2</span> Scarica e compila il template</h2>
                    <p className="text-on-surface-variant mb-4 text-sm">Scarica il file Excel, compilalo con i tuoi dati e salvalo. Non modificare i nomi dei fogli o delle colonne.</p>
                     <button
                        onClick={handleDownloadTemplate}
                        className="inline-flex items-center justify-center px-4 py-2 bg-secondary text-on-secondary font-semibold rounded-full shadow-sm hover:opacity-90 transition-colors duration-200"
                    >
                        <span className="material-symbols-outlined mr-2">download</span>
                        Scarica Template
                    </button>
                </div>

                {/* Step 3: Upload and Import */}
                <div>
                     <h2 className="text-xl font-semibold mb-3 flex items-center"><span className="bg-primary text-on-primary rounded-full h-8 w-8 text-sm flex items-center justify-center mr-3">3</span> Carica e importa il file</h2>
                     <div className="flex flex-col md:flex-row md:items-center md:space-x-4 space-y-4 md:space-y-0">
                        <div>
                            {/* Input nascosto */}
                            <input 
                                ref={fileInputRef}
                                type="file" 
                                className="hidden" 
                                accept=".xlsx, .xls" 
                                onChange={handleFileChange} 
                            />
                            {/* Pulsante custom per triggerare l'input */}
                            <button 
                                onClick={handleFileSelectClick}
                                className="cursor-pointer inline-flex items-center px-4 py-2 border border-outline rounded-full shadow-sm text-sm font-medium text-on-surface bg-surface hover:bg-surface-container"
                            >
                                <span className="material-symbols-outlined mr-2">upload_file</span>
                                <span>{file ? 'Cambia file...' : 'Seleziona un file...'}</span>
                            </button>
                            {file && <p className="mt-2 text-sm text-on-surface-variant">{file.name}</p>}
                        </div>

                        <button
                            onClick={handleImport}
                            disabled={!file || isImporting}
                            className="inline-flex items-center justify-center px-6 py-3 bg-primary text-on-primary font-semibold rounded-full shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                        >
                            {isImporting ? (
                                <>
                                    <SpinnerIcon className="animate-spin -ml-1 mr-3 h-5 w-5"/>
                                    Importazione...
                                </>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined mr-2">upload</span>
                                    Importa Dati
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {importResult && (
                    <div className="mt-4 pt-6 border-t border-outline-variant">
                        <h3 className={`text-lg font-semibold ${getResultMessageColor()}`}>{importResult.message}</h3>
                        {importResult.details && importResult.details.length > 0 && (
                             <div className="mt-2 p-3 bg-yellow-container/50 border border-yellow-container rounded-md">
                                <h4 className="font-semibold text-on-yellow-container">Dettagli e Avvisi:</h4>
                                <ul className="list-disc list-inside mt-1 text-sm text-on-yellow-container max-h-40 overflow-y-auto">
                                    {importResult.details.map((detail, i) => <li key={i}>{detail}</li>)}
                                </ul>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ImportPage;