
/**
 * @file ExportPage.tsx
 * @description Pagina dedicata all'esportazione dei dati dell'applicazione in file Excel separati.
 */

import React, { useState } from 'react';
import { useEntitiesContext, useAllocationsContext } from '../context/AppContext';
import { exportCoreEntities, exportStaffing, exportResourceRequests, exportInterviews, exportSkills, exportLeaves, exportUsersPermissions, exportTutorMapping, exportMonthlyAllocations } from '../utils/exportUtils';
import { SpinnerIcon } from '../components/icons';
import { useAuth } from '../context/AuthContext';
import { AppUser, RolePermission } from '../types';
import { authorizedJsonFetch } from '../utils/api';

type ExportType = 'core' | 'staffing' | 'requests' | 'interviews' | 'skills' | 'leaves' | 'users' | 'tutor' | 'monthly_allocations';

interface ExportCardProps {
    title: string;
    description: string;
    onExport: () => void;
    isExporting: boolean;
    icon: string;
}

const ExportCard: React.FC<ExportCardProps> = ({ title, description, onExport, isExporting, icon }) => (
    <div className="bg-surface-container-low rounded-2xl shadow p-6 flex flex-col border-l-4 border-primary">
        <div className="flex items-start gap-4">
            <div className="flex-shrink-0 text-primary">
                <span className="material-symbols-outlined text-3xl">{icon}</span>
            </div>
            <div>
                <h2 className="text-xl font-semibold mb-2 text-on-surface">{title}</h2>
                <p className="text-on-surface-variant text-sm flex-grow">{description}</p>
            </div>
        </div>
        <div className="mt-6 text-right">
            <button
                onClick={onExport}
                disabled={isExporting}
                className="inline-flex items-center justify-center px-6 py-2 bg-primary text-on-primary font-semibold rounded-full shadow-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
                {isExporting ? (
                    <>
                        <SpinnerIcon className="animate-spin -ml-1 mr-3 h-5 w-5"/>
                        Esportazione...
                    </>
                ) : (
                    <>
                        <span className="material-symbols-outlined mr-2">download</span>
                        Scarica File
                    </>
                )}
            </button>
        </div>
    </div>
);


const ExportPage: React.FC = () => {
    const allData = useEntitiesContext();
    const { allocations } = useAllocationsContext();
    const { isAdmin } = useAuth();
    const [exportingType, setExportingType] = useState<ExportType | null>(null);

    const handleExport = async (type: ExportType) => {
        setExportingType(type);
        try {
            switch (type) {
                case 'core':
                    await exportCoreEntities(allData);
                    break;
                case 'staffing':
                    await exportStaffing({ ...allData, allocations });
                    break;
                case 'requests':
                    await exportResourceRequests(allData);
                    break;
                case 'interviews':
                    await exportInterviews(allData);
                    break;
                case 'skills':
                    await exportSkills(allData);
                    break;
                case 'leaves':
                    await exportLeaves(allData);
                    break;
                case 'users':
                    await handleExportUsers();
                    break;
                case 'tutor':
                    await exportTutorMapping(allData);
                    break;
                case 'monthly_allocations':
                    await exportMonthlyAllocations({ ...allData, allocations });
                    break;
            }
        } catch (error) {
            console.error(`Failed to export ${type}:`, error);
            alert(`Errore durante l'esportazione di ${type}. Controlla la console.`);
        } finally {
            setExportingType(null);
        }
    };

    const handleExportUsers = async () => {
        try {
            const users = await authorizedJsonFetch<AppUser[]>('/api/resources?entity=app-users');
            const permissions = await authorizedJsonFetch<RolePermission[]>('/api/resources?entity=role-permissions');

            // Export
            await exportUsersPermissions(users, permissions, allData.resources);

        } catch (e) {
            console.error(e);
            throw e;
        }
    };

    return (
        <div>
            <h1 className="text-3xl font-bold text-on-surface mb-8">Esportazione Dati</h1>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <ExportCard
                    title="Allocazioni Mensili (3 Mesi)"
                    description="Esporta le percentuali di allocazione distinte per il mese corrente e i due successivi (3 colonne). Ideale per analizzare il carico mese per mese."
                    onExport={() => handleExport('monthly_allocations')}
                    isExporting={exportingType === 'monthly_allocations'}
                    icon="date_range"
                />
                <ExportCard
                    title="Entità Principali"
                    description="Esporta un file contenente Risorse, Progetti, Clienti, Ruoli, Calendario e tutte le opzioni di configurazione. Ideale per un backup completo."
                    onExport={() => handleExport('core')}
                    isExporting={exportingType === 'core'}
                    icon="business_center"
                />
                <ExportCard
                    title="Staffing"
                    description="Esporta la griglia di staffing con le allocazioni giornaliere. Utile per modifiche massicce e re-importazione delle allocazioni."
                    onExport={() => handleExport('staffing')}
                    isExporting={exportingType === 'staffing'}
                    icon="calendar_month"
                />
                 <ExportCard
                    title="Richieste Risorse"
                    description="Esporta l'elenco completo di tutte le richieste di risorse aperte e chiuse, con tutti i dettagli associati."
                    onExport={() => handleExport('requests')}
                    isExporting={exportingType === 'requests'}
                    icon="assignment"
                />
                 <ExportCard
                    title="Colloqui"
                    description="Esporta l'elenco completo di tutte le colloqui di selezione registrati nel sistema, inclusi feedback e stati."
                    onExport={() => handleExport('interviews')}
                    isExporting={exportingType === 'interviews'}
                    icon="groups"
                />
                 <ExportCard
                    title="Competenze e Associazioni"
                    description="Esporta l'elenco delle competenze (Skills) e tutte le associazioni con le risorse, incluse date di conseguimento e scadenza."
                    onExport={() => handleExport('skills')}
                    isExporting={exportingType === 'skills'}
                    icon="school"
                />
                <ExportCard
                    title="Assenze (Leaves)"
                    description="Esporta l'elenco di tutte le richieste di assenza (ferie, permessi, etc.) con relativo stato e note."
                    onExport={() => handleExport('leaves')}
                    isExporting={exportingType === 'leaves'}
                    icon="event_busy"
                />
                <ExportCard
                    title="Mappatura Tutor"
                    description="Esporta un elenco di tutte le risorse e il loro Tutor assegnato."
                    onExport={() => handleExport('tutor')}
                    isExporting={exportingType === 'tutor'}
                    icon="supervisor_account"
                />
                {isAdmin && (
                    <ExportCard
                        title="Utenti e Sicurezza"
                        description="Esporta l'elenco degli utenti di sistema e la matrice dei permessi (RBAC). Le password NON vengono esportate."
                        onExport={() => handleExport('users')}
                        isExporting={exportingType === 'users'}
                        icon="security"
                    />
                )}
            </div>
        </div>
    );
};

export default ExportPage;
