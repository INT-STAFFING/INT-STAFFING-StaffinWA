/**
 * @file WorkloadPage.tsx
 * @description Pagina di visualizzazione del carico totale per risorsa (sola lettura).
 */

import React, { useState, useMemo } from 'react';
import { useStaffingContext } from '../context/StaffingContext';
import { Resource } from '../types';
import { getCalendarDays, formatDate, addDays, isHoliday } from '../utils/dateUtils';
import SearchableSelect from '../components/SearchableSelect';

/**
 * @interface DailyTotalCellProps
 * @description Prop per il componente DailyTotalCell.
 */
interface DailyTotalCellProps {
    /** @property {Resource} resource - La risorsa per cui calcolare il totale. */
    resource: Resource;
    /** @property {string} date - La data (YYYY-MM-DD) per cui calcolare il totale. */
    date: string;
    /** @property {boolean} isNonWorkingDay - Indica se la data corrisponde a un giorno non lavorativo. */
    isNonWorkingDay: boolean;
}

/**
 * Componente per la cella che mostra il carico totale giornaliero di una risorsa (sola lettura).
 * Cambia colore in base al livello di carico.
 * @param {DailyTotalCellProps} props - Le prop del componente.
 * @returns {React.ReactElement} L'elemento `<td>` della cella.
 */
const ReadonlyDailyTotalCell: React.FC<DailyTotalCellProps> = ({ resource, date, isNonWorkingDay }) => {
    const { assignments, allocations } = useStaffingContext();

    if (isNonWorkingDay) {
        return (
            <td className="border-t border-gray-200 dark:border-gray-700 px-2 py-3 text-center text-sm font-semibold bg-gray-100 dark:bg-gray-900/50 text-gray-400">
                -
            </td>
        );
    }
    
    const total = useMemo(() => {
        const resourceAssignments = assignments.filter(a => a.resourceId === resource.id);
        return resourceAssignments.reduce((sum, a) => {
            return sum + (allocations[a.id]?.[date] || 0);
        }, 0);
    }, [assignments, allocations, resource.id, date]);

    const cellColor = useMemo(() => {
        if (total > 100) return 'bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200';
        if (total === 100) return 'bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200';
        if (total > 0 && total < 100) return 'bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200';
        return 'bg-transparent';
    }, [total]);

    return (
        <td className={`border-t border-gray-200 dark:border-gray-700 px-2 py-3 text-center text-sm font-semibold ${cellColor}`}>
            {total > 0 ? `${total}%` : '-'}
        </td>
    );
};

/**
 * Componente principale della pagina Carico Risorse.
 * Gestisce la navigazione temporale, i filtri e il rendering della griglia di carico.
 * @returns {React.ReactElement} La pagina Carico Risorse.
 */
const WorkloadPage: React.FC = () => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const { resources, projects, assignments, clients, companyCalendar } = useStaffingContext();
    
    const [filters, setFilters] = useState({ resourceId: '', projectId: '', clientId: '' });

    const timeWindow = 35; // 5 settimane
    const calendarDays = useMemo(() => getCalendarDays(currentDate, timeWindow), [currentDate]);

    const handlePrevWeek = () => setCurrentDate(prev => addDays(prev, -7));
    const handleNextWeek = () => setCurrentDate(prev => addDays(prev, 7));
    const handleToday = () => setCurrentDate(new Date());

    const handleFilterChange = (name: string, value: string) => {
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const clearFilters = () => {
        setFilters({ resourceId: '', projectId: '', clientId: '' });
    };

    // Calcola e memoizza le risorse da visualizzare, applicando i filtri.
    const displayResources = useMemo(() => {
        let finalResources = [...resources];

        // Filtra per risorsa specifica se il filtro è attivo
        if (filters.resourceId) {
            finalResources = finalResources.filter(r => r.id === filters.resourceId);
        }

        // Se è attivo un filtro per progetto o cliente, calcola le risorse pertinenti
        if (filters.projectId || filters.clientId) {
            let relevantResourceIds: Set<string>;

            if (filters.projectId) {
                // Filtra per progetto
                relevantResourceIds = new Set(assignments.filter(a => a.projectId === filters.projectId).map(a => a.resourceId));
            } else { // filters.clientId deve essere attivo
                // Filtra per cliente
                const clientProjectIds = new Set(projects.filter(p => p.clientId === filters.clientId).map(p => p.id));
                relevantResourceIds = new Set(assignments.filter(a => clientProjectIds.has(a.projectId)).map(a => a.resourceId));
            }

            // Applica il filtro delle risorse pertinenti alla lista già filtrata
            finalResources = finalResources.filter(r => relevantResourceIds.has(r.id!));
        }
        
        return finalResources.sort((a,b) => a.name.localeCompare(b.name));

    }, [resources, assignments, projects, filters]);

    const resourceOptions = useMemo(() => resources.map(r => ({ value: r.id!, label: r.name })), [resources]);
    const projectOptions = useMemo(() => projects.map(p => ({ value: p.id!, label: p.name })), [projects]);
    const clientOptions = useMemo(() => clients.map(c => ({ value: c.id!, label: c.name })), [clients]);

    return (
        <div>
            <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
                <div className="flex items-center justify-center space-x-2">
                    <button onClick={handlePrevWeek} className="px-3 py-2 bg-white dark:bg-gray-700 border dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 text-sm">← Prec.</button>
                    <button onClick={handleToday} className="px-4 py-2 bg-white dark:bg-gray-700 border dark:border-gray-600 rounded-md shadow-sm font-semibold text-blue-600 dark:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-600">Oggi</button>
                    <button onClick={handleNextWeek} className="px-3 py-2 bg-white dark:bg-gray-700 border dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 text-sm">Succ. →</button>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                    Vista di sola lettura del carico totale. Per modifiche, vai alla pagina di <a href="/staffing" className="text-blue-500 hover:underline">Staffing</a>.
                </div>
            </div>

            {/* Sezione Filtri */}
            <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow relative z-10">
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

            {/* Griglia Carico */}
            <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10">
                        <tr>
                            <th className="sticky left-0 bg-gray-50 dark:bg-gray-700 px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white" style={{ minWidth: '200px' }}>Carico Totale Risorsa</th>
                            {calendarDays.map(date => {
                                const day = date.getDay();
                                const isWeekend = day === 0 || day === 6;
                                const holiday = companyCalendar.find(e => e.date === formatDate(date, 'iso') && e.type !== 'LOCAL_HOLIDAY');
                                const isNonWorkingHeader = isWeekend || !!holiday;

                                return (
                                <th key={date.toISOString()} className={`px-2 py-3.5 text-center text-sm font-semibold w-20 md:w-24 ${isNonWorkingHeader ? 'bg-gray-100 dark:bg-gray-700/50' : ''}`}>
                                    <div className="flex flex-col items-center">
                                        <span className={isNonWorkingHeader ? 'text-gray-500' : 'text-gray-900 dark:text-white'}>{formatDate(date, 'short')}</span>
                                        <span className="text-xs text-gray-500">{formatDate(date, 'day')}</span>
                                    </div>
                                </th>
                            )})}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {displayResources.map((resource) => (
                            <tr key={resource.id} className="bg-gray-100/50 dark:bg-gray-900/50 font-bold">
                                <td className="sticky left-0 bg-gray-100 dark:bg-gray-900 px-3 py-3 text-left text-sm text-gray-600 dark:text-gray-300">
                                    {resource.name}
                                </td>
                                {calendarDays.map(date => {
                                    const day = date.getDay();
                                    const isWeekend = day === 0 || day === 6;
                                    const isDayHoliday = isHoliday(date, resource.location, companyCalendar);
                                    return (
                                    <ReadonlyDailyTotalCell key={date.toISOString()} resource={resource} date={formatDate(date, 'iso')} isNonWorkingDay={isWeekend || isDayHoliday} />
                                )})}
                            </tr>
                        ))}
                    </tbody>
                </table>
                 {displayResources.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                        Nessuna risorsa trovata con i filtri correnti.
                    </div>
                )}
            </div>
        </div>
    );
};

export default WorkloadPage;
