/**
 * @file ExportPage.tsx
 * @description Pagina dedicata all'esportazione dei dati dell'applicazione in file Excel separati.
 */

import React, { useState } from 'react';
// Fix: Import useAllocationsContext to get allocations data.
import { useEntitiesContext, useAllocationsContext } from '../context/AppContext';
import { exportCoreEntities, exportStaffing, exportResourceRequests, exportInterviews } from '../utils/exportUtils';

type ExportType = 'core' | 'staffing' | 'requests' | 'interviews';

interface ExportCardProps {
    title: string;
    description: string;
    onExport: () => void;
    isExporting: boolean;
    icon: React.ReactNode;
}

const ExportCard: React.FC<ExportCardProps> = ({ title, description, onExport, isExporting, icon }) => (
    // MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza.
    <div className="bg-card dark:bg-dark-card rounded-lg shadow p-[var(--space-6)] flex flex-col">
        {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
        <div className="flex items-start gap-[var(--space-4)]">
            <div className="flex-shrink-0 text-primary">{icon}</div>
            <div>
                {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
                <h2 className="text-[var(--font-size-xl)] font-semibold mb-[var(--space-2)]">{title}</h2>
                {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
                <p className="text-muted-foreground text-[var(--font-size-sm)] flex-grow">{description}</p>
            </div>
        </div>
        {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
        <div className="mt-[var(--space-6)] text-right">
            <button
                onClick={onExport}
                disabled={isExporting}
                // MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza.
                className="inline-flex items-center justify-center px-[var(--space-4)] py-[var(--space-2)] bg-primary text-white font-semibold rounded-md shadow-sm hover:bg-primary-darker disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors duration-200"
            >
                {isExporting ? (
                    <>
                        {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
                        <svg className="animate-spin -ml-[var(--space-1)] mr-[var(--space-3)] h-[var(--space-5)] w-[var(--space-5)] text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Esportazione...
                    </>
                ) : (
                    <>
                        {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
                        <span className="mr-[var(--space-2)] text-[var(--font-size-xl)]">📥</span>
                        Scarica File
                    </>
                )}
            </button>
        </div>
    </div>
);


const ExportPage: React.FC = () => {
    const allData = useEntitiesContext();
    // Fix: Get allocations from context.
    const { allocations } = useAllocationsContext();
    const [exportingType, setExportingType] = useState<ExportType | null>(null);

    const handleExport = async (type: ExportType) => {
        setExportingType(type);
        try {
            switch (type) {
                case 'core':
                    await exportCoreEntities(allData);
                    break;
                case 'staffing':
                    // Fix: Pass allocations data to the export function.
                    await exportStaffing({ ...allData, allocations });
                    break;
                case 'requests':
                    await exportResourceRequests(allData);
                    break;
                case 'interviews':
                    await exportInterviews(allData);
                    break;
            }
        } catch (error) {
            console.error(`Failed to export ${type}:`, error);
            // In un'app reale, useremmo un sistema di notifiche (toast)
            alert(`Errore durante l'esportazione di ${type}. Controlla la console.`);
        } finally {
            setExportingType(null);
        }
    };

    return (
        <div>
            {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
            <h1 className="text-[var(--font-size-3xl)] font-bold text-foreground dark:text-dark-foreground mb-[var(--space-8)]">Esportazione Dati</h1>
            
            {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-[var(--space-8)]">
                <ExportCard
                    title="Entità Principali"
                    description="Esporta un file contenente Risorse, Progetti, Clienti, Ruoli, Calendario e tutte le opzioni di configurazione. Ideale per un backup completo."
                    onExport={() => handleExport('core')}
                    isExporting={exportingType === 'core'}
                    // MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza.
                    icon={<span className="text-[var(--font-size-3xl)]">💼</span>}
                />
                <ExportCard
                    title="Staffing"
                    description="Esporta la griglia di staffing con le allocazioni giornaliere. Utile per modifiche massicce e re-importazione delle allocazioni."
                    onExport={() => handleExport('staffing')}
                    isExporting={exportingType === 'staffing'}
                    // MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza.
                    icon={<span className="text-[var(--font-size-3xl)]">🗓️</span>}
                />
                 <ExportCard
                    title="Richieste Risorse"
                    description="Esporta l'elenco completo di tutte le richieste di risorse aperte e chiuse, con tutti i dettagli associati."
                    onExport={() => handleExport('requests')}
                    isExporting={exportingType === 'requests'}
                    // MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza.
                    icon={<span className="text-[var(--font-size-3xl)]">📋</span>}
                />
                 <ExportCard
                    title="Colloqui"
                    description="Esporta l'elenco completo di tutti i colloqui di selezione registrati nel sistema, inclusi feedback e stati."
                    onExport={() => handleExport('interviews')}
                    isExporting={exportingType === 'interviews'}
                    // MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza.
                    icon={<span className="text-[var(--font-size-3xl)]">👥</span>}
                />
            </div>
        </div>
    );
};

export default ExportPage;