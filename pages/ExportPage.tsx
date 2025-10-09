/**
 * @file ExportPage.tsx
 * @description Pagina dedicata all'esportazione dei dati dell'applicazione in un file Excel.
 */

import React, { useState } from 'react';
import { useStaffingContext } from '../context/StaffingContext';
import { exportDataToExcel } from '../utils/exportUtils';
import { ArrowDownOnSquareIcon } from '../components/icons';

/**
 * Componente per la pagina di esportazione.
 * Fornisce un pulsante per scaricare tutti i dati dell'applicazione in un file Excel.
 * @returns {React.ReactElement} La pagina di esportazione.
 */
const ExportPage: React.FC = () => {
    // Ottiene l'intero stato dell'applicazione dal contesto.
    const staffingData = useStaffingContext();
    // Stato per gestire la visualizzazione del feedback durante l'esportazione.
    const [isExporting, setIsExporting] = useState(false);
    // Stato per mostrare un messaggio di successo o fallimento dopo il tentativo di esportazione.
    const [exportSuccess, setExportSuccess] = useState<boolean | null>(null);

    /**
     * Gestisce il click sul pulsante di esportazione.
     * Chiama la funzione di utility per creare e scaricare il file Excel.
     * Aggiorna lo stato per fornire feedback all'utente.
     */
    const handleExport = () => {
        setIsExporting(true);
        setExportSuccess(null);
        try {
            exportDataToExcel(staffingData);
            setExportSuccess(true);
        } catch (error) {
            console.error("Failed to export data:", error);
            setExportSuccess(false);
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-6">Esporta Dati</h1>
            
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 max-w-2xl mx-auto text-center">
                <h2 className="text-xl font-semibold mb-2">Esporta in Formato Excel</h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                    Scarica tutti i dati dell'applicazione in un singolo file Excel. Il file conterrà fogli separati per Clienti, Ruoli, Risorse, Progetti, Assegnazioni e Allocazioni giornaliere.
                </p>

                <button
                    onClick={handleExport}
                    disabled={isExporting}
                    className="inline-flex items-center justify-center px-6 py-3 bg-green-600 text-white font-semibold rounded-md shadow-sm hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed transition-colors duration-200"
                >
                    {isExporting ? (
                        <>
                           <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Esportazione...
                        </>
                    ) : (
                        <>
                            <ArrowDownOnSquareIcon className="w-5 h-5 mr-2" />
                            Scarica File Excel
                        </>
                    )}
                </button>

                {exportSuccess === true && (
                    <p className="mt-4 text-green-600 dark:text-green-400">Esportazione completata con successo!</p>
                )}
                {exportSuccess === false && (
                    <p className="mt-4 text-red-600 dark:text-red-400">Errore durante l'esportazione. Controlla la console per i dettagli.</p>
                )}
            </div>
        </div>
    );
};

export default ExportPage;