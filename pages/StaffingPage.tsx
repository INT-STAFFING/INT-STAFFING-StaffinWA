/**
 * @file StaffingPage.tsx
 * @description Pagina principale per la visualizzazione e la gestione dello staffing delle risorse sui progetti.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { useStaffingContext } from '../context/StaffingContext';
import { Resource, Project, Assignment } from '../types';
import { getCalendarDays, formatDate, addDays } from '../utils/dateUtils';
import { CalendarDaysIcon, PlusCircleIcon, XCircleIcon } from '../components/icons';
import Modal from '../components/Modal';
import SearchableSelect from '../components/SearchableSelect';

/**
 * @interface AllocationCellProps
 * @description Prop per il componente AllocationCell.
 */
interface AllocationCellProps {
    /** @property {Assignment} assignment - L'assegnazione a cui si riferisce la cella. */
    assignment: Assignment;
    /** @property {string} date - La data (YYYY-MM-DD) per questa cella di allocazione. */
    date: string;
    /** @property {boolean} isWeekend - Indica se la data corrisponde a un giorno del weekend. */
    isWeekend: boolean;
}

/**
 * Componente per una singola cella di allocazione nella griglia di staffing.
 * Mostra un menu a tendina per modificare la percentuale di allocazione.
 * @param {AllocationCellProps} props - Le prop del componente.
 * @returns {React.ReactElement} L'elemento `<td>` della cella.
 */
const AllocationCell: React.FC<AllocationCellProps> = ({ assignment, date, isWeekend }) => {
    const { allocations, updateAllocation } = useStaffingContext();
    const percentage = allocations[assignment.id]?.[date] || 0;

    // Se è un weekend, mostra una cella disabilitata con sfondo grigio.
    if (isWeekend) {
        return (
            <td className="border-t border-gray-200 dark:border-gray-700 p-0 text-center bg-gray-50 dark:bg-gray-800/50">
                <span className="text-sm text-gray-400">-</span>
            </td>
        );
    }
    /**
     * Gestisce la modifica del valore nel menu a tendina e chiama l'aggiornamento del contesto.
     * @param {React.ChangeEvent<HTMLSelectElement>} e - L'evento di modifica.
     */
    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        updateAllocation(assignment.id, date, parseInt(e.target.value));
    };

    const percentageOptions = Array.from({ length: 21 }, (_, i) => i * 5);

    return (
        <td className="border-t border-gray-200 dark:border-gray-700 p-0 text-center">
            <select
                value={percentage}
                onChange={handleChange}
                className="w-full h-full bg-transparent border-0 text-center appearance-none text-sm focus:ring-0 focus:outline-none dark:text-gray-300"
            >
                {percentageOptions.map(p => <option key={p} value={p}>{p > 0 ? `${p}%` : '-'}</option>)}
            </select>
        </td>
    );
};

/**
 * @interface DailyTotalCellProps
 * @description Prop per il componente DailyTotalCell.
 */
interface DailyTotalCellProps {
    /** @property {Resource} resource - La risorsa per cui calcolare il totale. */
    resource: Resource;
    /** @property {string} date - La data (YYYY-MM-DD) per cui calcolare il totale. */
    date: string;
    /** @property {boolean} isWeekend - Indica se la data corrisponde a un giorno del weekend. */
    isWeekend: boolean;
}

/**
 * Componente per la cella che mostra il carico totale giornaliero di una risorsa.
 * Cambia colore in base al livello di carico (sottoutilizzo, pieno, sovraccarico).
 * @param {DailyTotalCellProps} props - Le prop del componente.
 * @returns {React.ReactElement} L'elemento `<td>` della cella.
 */
const DailyTotalCell: React.FC<DailyTotalCellProps> = ({ resource, date, isWeekend }) => {
    const { assignments, allocations } = useStaffingContext();

    // Se è un weekend, il totale è 0 e la cella è stilizzata di conseguenza.
     if (isWeekend) {
        return (
            <td className="border-t border-gray-200 dark:border-gray-700 px-2 py-3 text-center text-sm font-semibold bg-gray-100 dark:bg-gray-900/50 text-gray-400">
                -
            </td>
        );
    }
    
    // Calcola il totale giornaliero per la risorsa sommando tutte le sue allocazioni.
    const total = useMemo(() => {
        const resourceAssignments = assignments.filter(a => a.resourceId === resource.id);
        return resourceAssignments.reduce((sum, a) => {
            return sum + (allocations[a.id]?.[date] || 0);
        }, 0);
    }, [assignments, allocations, resource.id, date]);

    // Determina il colore di sfondo della cella in base al carico totale.
    const cellColor = useMemo(() => {
        if (total > 100) return 'bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200';
        if (total === 100) return 'bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200';
        if (total > 0 && total < 100) return 'bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200';
        return 'bg-gray-100 dark:bg-gray-800';
    }, [total]);

    return (
        <td className={`border-t border-gray-200 dark:border-gray-700 px-2 py-3 text-center text-sm font-semibold ${cellColor}`}>
            {total > 0 ? `${total}%` : '-'}
        </td>
    );
};

/**
 * Componente principale della pagina di Staffing.
 * Gestisce la navigazione temporale, i filtri, l'apertura delle modali e il rendering della griglia di allocazione.
 * @returns {React.ReactElement} La pagina di Staffing.
 */
const StaffingPage: React.FC = () => {
    // Stato per la data di inizio della finestra temporale visualizzata.
    const [currentDate, setCurrentDate] = useState(new Date());
    const { resources, projects, assignments, roles, clients, addAssignment, deleteAssignment, bulkUpdateAllocations } = useStaffingContext();
    
    // Stati per la gestione delle modali.
    const [isBulkModalOpen, setBulkModalOpen] = useState(false);
    const [isAssignmentModalOpen, setAssignmentModalOpen] = useState(false);
    const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
    const [bulkFormData, setBulkFormData] = useState({ startDate: '', endDate: '', percentage: 50 });
    const [newAssignmentData, setNewAssignmentData] = useState<{ resourceId: string, projectId: string }>({ resourceId: '', projectId: '' });
    
    // Stato per i filtri applicati alla griglia.
    const [filters, setFilters] = useState({ resourceId: '', projectId: '', clientId: '' });

    const timeWindow = 35; // Numero di giorni da visualizzare (5 settimane).
    const calendarDays = useMemo(() => getCalendarDays(currentDate, timeWindow), [currentDate]);

    // Progetti a cui è possibile assegnare risorse (esclusi quelli completati).
    const assignableProjects = useMemo(() => projects.filter(p => p.status !== 'Completato'), [projects]);

    const handlePrevWeek = () => setCurrentDate(prev => addDays(prev, -7));
    const handleNextWeek = () => setCurrentDate(prev => addDays(prev, 7));
    const handleToday = () => setCurrentDate(new Date());

    /**
     * Apre la modale per l'assegnazione massiva.
     * @param {Assignment} assignment - L'assegnazione selezionata.
     */
    const openBulkModal = (assignment: Assignment) => {
        setSelectedAssignment(assignment);
        setBulkModalOpen(true);
    };

    /**
     * Gestisce l'invio del form di assegnazione massiva.
     * @param {React.FormEvent} e - L'evento di invio del form.
     */
    const handleBulkSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedAssignment && bulkFormData.startDate && bulkFormData.endDate) {
            bulkUpdateAllocations(selectedAssignment.id, bulkFormData.startDate, bulkFormData.endDate, bulkFormData.percentage);
            setBulkModalOpen(false);
            setSelectedAssignment(null);
        }
    };

    /**
     * Gestisce l'invio del form per una nuova assegnazione.
     * @param {React.FormEvent} e - L'evento di invio del form.
     */
    const handleNewAssignmentSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (newAssignmentData.resourceId && newAssignmentData.projectId) {
            addAssignment(newAssignmentData);
            setAssignmentModalOpen(false);
            setNewAssignmentData({ resourceId: '', projectId: '' });
        }
    };
    
    const handleNewAssignmentChange = (name: string, value: string) => {
        setNewAssignmentData(d => ({ ...d, [name]: value }));
    };

    const handleFilterChange = (name: string, value: string) => {
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const clearFilters = () => {
        setFilters({ resourceId: '', projectId: '', clientId: '' });
    };

    // Funzioni memoizzate per trovare entità per ID, per ottimizzare le performance.
    const getResourceById = useCallback((id: string) => resources.find(r => r.id === id), [resources]);
    const getProjectById = useCallback((id: string) => projects.find(p => p.id === id), [projects]);
    const getRoleById = useCallback((id: string) => roles.find(r => r.id === id), [roles]);
    const getClientById = useCallback((id: string) => clients.find(c => c.id === id), [clients]);

    // Calcola e memoizza i dati da visualizzare, applicando i filtri e raggruppando per risorsa.
    const displayData = useMemo(() => {
        let filteredAssignments = [...assignments];

        if (filters.resourceId) {
            filteredAssignments = filteredAssignments.filter(a => a.resourceId === filters.resourceId);
        }
        if (filters.projectId) {
            filteredAssignments = filteredAssignments.filter(a => a.projectId === filters.projectId);
        }
        if (filters.clientId) {
            const clientProjectIds = new Set(projects.filter(p => p.clientId === filters.clientId).map(p => p.id));
            filteredAssignments = filteredAssignments.filter(a => clientProjectIds.has(a.projectId));
        }
        
        const groupedByResource: { [resourceId: string]: Assignment[] } = {};
        filteredAssignments.forEach(a => {
            if (!groupedByResource[a.resourceId]) {
                groupedByResource[a.resourceId] = [];
            }
            groupedByResource[a.resourceId].push(a);
        });

        return Object.entries(groupedByResource)
            .map(([resourceId, resourceAssignments]) => ({
                resource: getResourceById(resourceId)!,
                assignments: resourceAssignments
            }))
            .filter(item => item.resource)
            .sort((a,b) => a.resource.name.localeCompare(b.resource.name));

    }, [assignments, filters, getResourceById, projects]);

    const resourceOptions = useMemo(() => resources.map(r => ({ value: r.id!, label: r.name })), [resources]);
    const projectOptions = useMemo(() => projects.map(p => ({ value: p.id!, label: p.name })), [projects]);
    const clientOptions = useMemo(() => clients.map(c => ({ value: c.id!, label: c.name })), [clients]);

    return (
        <div>
            {/* La barra dei controlli è stata resa responsive. Su mobile, gli elementi si impilano verticalmente. */}
            <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
                <div className="flex items-center justify-center space-x-2">
                    <button onClick={handlePrevWeek} className="px-3 py-2 bg-white dark:bg-gray-700 border dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 text-sm">← Prec.</button>
                    <button onClick={handleToday} className="px-4 py-2 bg-white dark:bg-gray-700 border dark:border-gray-600 rounded-md shadow-sm font-semibold text-blue-600 dark:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-600">Oggi</button>
                    <button onClick={handleNextWeek} className="px-3 py-2 bg-white dark:bg-gray-700 border dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 text-sm">Succ. →</button>
                </div>
                 <button onClick={() => setAssignmentModalOpen(true)} className="flex items-center justify-center w-full md:w-auto px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700">
                    <PlusCircleIcon className="w-5 h-5 mr-2"/>
                    Assegna Risorsa
                </button>
            </div>

            {/* Sezione Filtri */}
            <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow relative z-20">
                 <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div>
                        <label htmlFor="resource-filter" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Risorsa</label>
                        <SearchableSelect name="resourceId" value={filters.resourceId} onChange={handleFilterChange} options={resourceOptions} placeholder="Tutte le Risorse"/>
                    </div>
                     <div>
                        <label htmlFor="project-filter" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Progetto</label>
                        <SearchableSelect name="projectId" value={filters.projectId} onChange={handleFilterChange} options={projectOptions} placeholder="Tutti i Progetti"/>
                    </div>
                     <div>
                        <label htmlFor="client-filter" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Cliente</label>
                        <SearchableSelect name="clientId" value={filters.clientId} onChange={handleFilterChange} options={clientOptions} placeholder="Tutti i Clienti"/>
                    </div>
                    <button onClick={clearFilters} className="px-4 py-2 bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 w-full md:w-auto">Reset Filtri</button>
                 </div>
            </div>

            {/* Griglia di Staffing */}
            <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10">
                        <tr>
                            {/* Le colonne fisse (sticky) sono state ottimizzate per mobile, riducendo gli offset per prevenire sovrapposizioni. */}
                            <th className="sticky left-0 bg-gray-50 dark:bg-gray-700 px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white" style={{ minWidth: '150px' }}>Risorsa</th>
                            <th className="sticky left-[150px] bg-gray-50 dark:bg-gray-700 px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white" style={{ minWidth: '150px' }}>Ruolo</th>
                            <th className="hidden md:table-cell sticky left-[300px] bg-gray-50 dark:bg-gray-700 px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white" style={{ minWidth: '150px' }}>Cliente</th>
                            <th className="sticky left-[300px] md:left-[450px] bg-gray-50 dark:bg-gray-700 px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white" style={{ minWidth: '200px' }}>Progetto</th>
                            <th className="px-2 py-3.5 text-center text-sm font-semibold text-gray-900 dark:text-white">Azioni</th>
                            {calendarDays.map(date => {
                                const day = date.getDay();
                                const isWeekend = day === 0 || day === 6;
                                return (
                                <th key={date.toISOString()} className={`px-2 py-3.5 text-center text-sm font-semibold w-20 md:w-24 ${isWeekend ? 'bg-gray-100 dark:bg-gray-700/50' : ''}`}>
                                    <div className="flex flex-col items-center">
                                        <span className={isWeekend ? 'text-gray-500' : 'text-gray-900 dark:text-white'}>{formatDate(date, 'short')}</span>
                                        <span className="text-xs text-gray-500">{formatDate(date, 'day')}</span>
                                    </div>
                                </th>
                            )})}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                         {displayData.map(({ resource, assignments: resourceAssignments }) => (
                             <React.Fragment key={resource.id}>
                                {resourceAssignments.map((assignment, assignIndex) => {
                                    const project = getProjectById(assignment.projectId);
                                    if (!project) return null;
                                    const client = getClientById(project.clientId);
                                    const role = getRoleById(resource.roleId);
                                    const isFirstAssignmentOfResource = assignIndex === 0;

                                    return (
                                        <tr key={assignment.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                            {isFirstAssignmentOfResource ? (
                                                <td rowSpan={resourceAssignments.length} className="sticky left-0 bg-white dark:bg-gray-800 px-3 py-4 text-sm font-medium text-gray-900 dark:text-white border-t border-gray-200 dark:border-gray-700 align-top" style={{ minWidth: '150px' }}>{resource.name}</td>
                                            ) : null}
                                             {isFirstAssignmentOfResource ? (
                                                <td rowSpan={resourceAssignments.length} className="sticky left-[150px] bg-white dark:bg-gray-800 px-3 py-4 text-sm text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 align-top" style={{ minWidth: '150px' }}>{role?.name || 'N/A'}</td>
                                             ): null}
                                            <td className="hidden md:table-cell sticky left-[300px] bg-white dark:bg-gray-800 px-3 py-4 text-sm text-gray-500 dark:text-gray-400" style={{ minWidth: '150px' }}>{client?.name || 'N/A'}</td>
                                            <td className="sticky left-[300px] md:left-[450px] bg-white dark:bg-gray-800 px-3 py-4 text-sm font-medium text-gray-900 dark:text-white" style={{ minWidth: '200px' }}>{project.name}</td>
                                            <td className="px-2 py-3 text-center">
                                                <div className="flex items-center justify-center space-x-2">
                                                     <button onClick={() => openBulkModal(assignment)} title="Assegnazione Massiva" className="text-blue-500 hover:text-blue-700 dark:hover:text-blue-300">
                                                        <CalendarDaysIcon className="w-5 h-5"/>
                                                    </button>
                                                     <button onClick={() => deleteAssignment(assignment.id)} title="Rimuovi Assegnazione" className="text-red-500 hover:text-red-700 dark:hover:text-red-300">
                                                        <XCircleIcon className="w-5 h-5"/>
                                                    </button>
                                                </div>
                                            </td>
                                            {calendarDays.map(date => {
                                                const day = date.getDay();
                                                const isWeekend = day === 0 || day === 6;
                                                return (
                                                <AllocationCell key={date.toISOString()} assignment={assignment} date={formatDate(date, 'iso')} isWeekend={isWeekend}/>
                                            )})}
                                        </tr>
                                    );
                                })}
                                {/* Riga del Totale */}
                                <tr className="bg-gray-100 dark:bg-gray-900 font-bold">
                                    <td colSpan={5} className="sticky left-0 bg-gray-100 dark:bg-gray-900 px-3 py-3 text-right text-sm text-gray-600 dark:text-gray-300">
                                        Carico Totale {resource.name}
                                    </td>
                                    {calendarDays.map(date => {
                                        const day = date.getDay();
                                        const isWeekend = day === 0 || day === 6;
                                        return (
                                        <DailyTotalCell key={date.toISOString()} resource={resource} date={formatDate(date, 'iso')} isWeekend={isWeekend} />
                                    )})}
                                </tr>
                             </React.Fragment>
                         ))}
                    </tbody>
                </table>
            </div>

            {/* Modale per Assegnazione Massiva */}
            <Modal isOpen={isBulkModalOpen} onClose={() => setBulkModalOpen(false)} title="Assegnazione Massiva">
                 <form onSubmit={handleBulkSubmit}>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Data Inizio</label>
                            <input type="date" required value={bulkFormData.startDate} onChange={e => setBulkFormData(f => ({...f, startDate: e.target.value}))} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm bg-white dark:bg-gray-700 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Data Fine</label>
                            <input type="date" required value={bulkFormData.endDate} onChange={e => setBulkFormData(f => ({...f, endDate: e.target.value}))} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm bg-white dark:bg-gray-700 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Percentuale ({bulkFormData.percentage}%)</label>
                            <input type="range" min="0" max="100" step="5" value={bulkFormData.percentage} onChange={e => setBulkFormData(f => ({...f, percentage: parseInt(e.target.value)}))} className="mt-1 block w-full"/>
                        </div>
                    </div>
                    <div className="mt-6 flex justify-end space-x-3">
                        <button type="button" onClick={() => setBulkModalOpen(false)} className="px-4 py-2 bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500">Annulla</button>
                        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Salva</button>
                    </div>
                </form>
            </Modal>
             
            {/* Modale per Nuova Assegnazione */}
            <Modal isOpen={isAssignmentModalOpen} onClose={() => setAssignmentModalOpen(false)} title="Assegna Risorsa a Progetto">
                <form onSubmit={handleNewAssignmentSubmit}>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Risorsa</label>
                            <SearchableSelect
                                name="resourceId"
                                value={newAssignmentData.resourceId}
                                onChange={handleNewAssignmentChange}
                                options={resources.map(r => ({ value: r.id!, label: r.name }))}
                                placeholder="Seleziona una risorsa"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Progetto</label>
                            <SearchableSelect
                                name="projectId"
                                value={newAssignmentData.projectId}
                                onChange={handleNewAssignmentChange}
                                options={assignableProjects.map(p => ({ value: p.id!, label: p.name }))}
                                placeholder="Seleziona un progetto"
                                required
                            />
                        </div>
                    </div>
                    <div className="mt-6 flex justify-end space-x-3">
                        <button type="button" onClick={() => setAssignmentModalOpen(false)} className="px-4 py-2 bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500">Annulla</button>
                        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Aggiungi Assegnazione</button>
                    </div>
                </form>
            </Modal>
             <style>{`
                .form-select {
                    display: block;
                    width: 100%;
                    border-radius: 0.375rem;
                    border: 1px solid #D1D5DB;
                    background-color: #FFFFFF;
                    padding: 0.5rem 0.75rem;
                    font-size: 0.875rem;
                    line-height: 1.25rem;
                }
                .dark .form-select {
                    border-color: #4B5563;
                    background-color: #374151;
                    color: #F9FAFB;
                }
                .form-input { 
                    display: block; 
                    width: 100%; 
                    border-radius: 0.375rem; 
                    border: 1px solid #D1D5DB; 
                    background-color: #FFFFFF; 
                    padding: 0.5rem 0.75rem; 
                    font-size: 0.875rem; 
                    line-height: 1.25rem; 
                } 
                .dark .form-input { 
                    border-color: #4B5563; 
                    background-color: #374151; 
                    color: #F9FAFB; 
                }
            `}</style>
        </div>
    );
};

export default StaffingPage;