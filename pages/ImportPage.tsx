import React, { useState, useCallback } from 'react';
import { useEntitiesContext } from '../context/AppContext';
import { ArrowUpOnSquareIcon, ArrowDownOnSquareIcon } from '../components/icons';
import { exportTemplateToExcel } from '../utils/exportUtils';

const ImportPage: React.FC = () => {
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
                const workbook = (window as any).XLSX.read(data, { type: 'array' });
                
                // Estrae i dati da tutti i fogli pertinenti
                const clients = (window as any).XLSX.utils.sheet_to_json(workbook.Sheets['Clienti'] || {});
                const roles = (window as any).XLSX.utils.sheet_to_json(workbook.Sheets['Ruoli'] || {});
                const resources = (window as any).XLSX.utils.sheet_to_json(workbook.Sheets['Risorse'] || {});
                const projects = (window as any).XLSX.utils.sheet_to_json(workbook.Sheets['Progetti'] || {});
                const calendar = (window as any).XLSX.utils.sheet_to_json(workbook.Sheets['Calendario'] || {});
                const horizontals = (window as any).XLSX.utils.sheet_to_json(workbook.Sheets['Config_Horizontals'] || {});
                const seniorityLevels = (window as any).XLSX.utils.sheet_to_json(workbook.Sheets['Config_Seniority'] || {});
                const projectStatuses = (window as any).XLSX.utils.sheet_to_json(workbook.Sheets['Config_ProjectStatus'] || {});
                const clientSectors = (window as any).XLSX.utils.sheet_to_json(workbook.Sheets['Config_ClientSectors'] || {});
                const locations = (window as any).XLSX.utils.sheet_to_json(workbook.Sheets['Config_Locations'] || {});


                const response = await fetch('/api/import', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        clients, 
                        roles, 
                        resources, 
                        projects,
                        calendar,
                        horizontals,
                        seniorityLevels,
                        projectStatuses,
                        clientSectors,
                        locations
                     }),
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
    }, [file, fetchData]);

    const getResultMessageColor = () => {
        if (!importResult) return '';
        return importResult.success ? 'text-accent-teal' : 'text-accent-red';
    };

    return (
        <div>
            <h1 className="text-3xl font-bold text-primary-dark dark:text-primary-light mb-6">Importazione Massiva Dati</h1>
            
            <div className="bg-primary-light dark:bg-primary-dark rounded-lg shadow p-8 max-w-4xl mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Instructions and Template */}
                    <div>
                        <h2 className="text-xl font-semibold mb-3">Istruzioni</h2>
                        <ol className="list-decimal list-inside space-y-2 text-gray-600 dark:text-gray-400 mb-6">
                            <li>Scarica il file template Excel.</li>
                            <li>Compila i fogli con i tuoi dati, rispettando i nomi delle colonne. Non modificare i nomi dei fogli o delle colonne.</li>
                            <li>Carica il file compilato usando il modulo a destra.</li>
                            <li>Avvia l'importazione. I dati esistenti con lo stesso nome/email non verranno sovrascritti.</li>
                        </ol>
                         <button
                            onClick={exportTemplateToExcel}
                            className="inline-flex items-center justify-center px-4 py-2 bg-gray-600 text-white font-semibold rounded-md shadow-sm hover:bg-gray-700 transition-colors duration-200"
                        >
                            <ArrowDownOnSquareIcon className="w-5 h-5 mr-2" />
                            Scarica Template
                        </button>
                    </div>

                    {/* Upload Form */}
                    <div className="border-t md:border-t-0 md:border-l border-gray-200 dark:border-white/20 pt-8 md:pt-0 md:pl-8">
                        <h2 className="text-xl font-semibold mb-3">Carica File</h2>
                        <div className="flex flex-col space-y-4">
                            <div>
                                <label htmlFor="file-upload" className="cursor-pointer inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-primary-light dark:bg-primary-dark hover:bg-gray-50 dark:hover:bg-white/10">
                                    <span>Seleziona un file...</span>
                                    <input id="file-upload" name="file-upload" type="file" className="sr-only" accept=".xlsx, .xls" onChange={handleFileChange} />
                                </label>
                                {file && <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{file.name}</p>}
                            </div>

                            <button
                                onClick={handleImport}
                                disabled={!file || isImporting}
                                className="inline-flex items-center justify-center px-6 py-3 bg-accent-teal text-primary-dark font-semibold rounded-md shadow-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                            >
                                {isImporting ? (
                                    <>
                                       <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Importazione...
                                    </>
                                ) : (
                                    <>
                                        <ArrowUpOnSquareIcon className="w-5 h-5 mr-2" />
                                        Importa Dati
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {importResult && (
                    <div className="mt-8 pt-6 border-t border-gray-200 dark:border-white/20">
                        <h3 className={`text-lg font-semibold ${getResultMessageColor()}`}>{importResult.message}</h3>
                        {importResult.details && importResult.details.length > 0 && (
                             <div className="mt-2 p-3 bg-accent-orange/10 border border-accent-orange/30 rounded-md">
                                <h4 className="font-semibold text-accent-orange">Dettagli e Avvisi:</h4>
                                <ul className="list-disc list-inside mt-1 text-sm text-accent-orange/90 max-h-40 overflow-y-auto">
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