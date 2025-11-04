/**
 * @file WorkloadPage.tsx
 * @description Pagina di visualizzazione del carico totale per risorsa (sola lettura).
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useEntitiesContext, useAllocationsContext } from '../context/AppContext';
import { Resource } from '../types';
import { getCalendarDays, formatDate, addDays, isHoliday, getWorkingDaysBetween } from '../utils/dateUtils';
import SearchableSelect from '../components/SearchableSelect';
import MultiSelectDropdown from '../components/MultiSelectDropdown';
import { useSearchParams } from 'react-router-dom';

type ViewMode = 'day' | 'week' | 'month';

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
    const { assignments } = useEntitiesContext();
    const { allocations } = useAllocationsContext();
    
    if (resource.lastDayOfWork && date > resource.lastDayOfWork) {
        isNonWorkingDay = true;
    }

    if (isNonWorkingDay) {
        return (
            // MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza.
            <td className="border-t border-gray-200 dark:border-gray-700 px-[var(--space-2)] py-[var(--space-3)] text-center text-[var(--font-size-sm)] font-semibold bg-gray-100 dark:bg-gray-900/50 text-gray-400">
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

    // MODIFICA: Logica colori unificata.
    // Determina il colore di sfondo della cella in base al carico totale e alla percentuale massima di staffing della risorsa.
    // - Rosso: sovraccarico (> maxStaffingPercentage)
    // - Verde: utilizzo ottimale (= maxStaffingPercentage)
    // - Giallo: sottoutilizzo (< maxStaffingPercentage)
    const cellColor = useMemo(() => {
        const maxPercentage = resource.maxStaffingPercentage ?? 100;
        if (total > maxPercentage) return 'bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200';
        if (total === maxPercentage) return 'bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200';
        if (total > 0 && total < maxPercentage) return 'bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200';
        return 'bg-transparent';
    }, [total, resource.maxStaffingPercentage]);


    return (
        // MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza.
        <td className={`border-t border-gray-200 dark:border-gray-700 px-[var(--space-2)] py-[var(--space-3)] text-center text-[var(--font-size-sm)] font-semibold ${cellColor}`}>
            {total > 0 ? `${total}%` : '-'}
        </td>
    );
};

/**
 * @interface AggregatedWorkloadCellProps
 * @description Prop per la cella di carico aggregato (settimana/mese).
 */
interface AggregatedWorkloadCellProps {
    resource: Resource;
    startDate: Date;
    endDate: Date;
}

/**
 * Componente cella per visualizzare il carico di lavoro medio aggregato su un periodo (settimana o mese).
 * @param {AggregatedWorkloadCellProps} props - Le prop del componente.
 * @returns {React.ReactElement} L'elemento `<td>` della cella.
 */
const ReadonlyAggregatedWorkloadCell: React.FC<AggregatedWorkloadCellProps> = ({ resource, startDate, endDate }) => {
    const { assignments, companyCalendar } = useEntitiesContext();
    const { allocations } = useAllocationsContext();

    const averageAllocation = useMemo(() => {
        const effectiveEndDate = resource.lastDayOfWork && new Date(resource.lastDayOfWork) < endDate ? new Date(resource.lastDayOfWork) : endDate;
        if (startDate > effectiveEndDate) return 0;

        const workingDays = getWorkingDaysBetween(startDate, effectiveEndDate, companyCalendar, resource.location);
        if (workingDays === 0) return 0;

        const resourceAssignments = assignments.filter(a => a.resourceId === resource.id);
        let totalPersonDays = 0;

        resourceAssignments.forEach(assignment => {
            const assignmentAllocations = allocations[assignment.id];
            if (assignmentAllocations) {
                let currentDate = new Date(startDate);
                while (currentDate <= effectiveEndDate) {
                    const dateStr = formatDate(currentDate, 'iso');
                    if (assignmentAllocations[dateStr]) {
                        if (!isHoliday(currentDate, resource.location, companyCalendar) && currentDate.getDay() !== 0 && currentDate.getDay() !== 6) {
                            totalPersonDays += (assignmentAllocations[dateStr] / 100);
                        }
                    }
                    currentDate.setDate(currentDate.getDate() + 1);
                }
            }
        });
        
        return (totalPersonDays / workingDays) * 100;

    }, [resource, startDate, endDate, assignments, allocations, companyCalendar]);

    // MODIFICA: Logica colori unificata con arrotondamento.
    // Determina il colore della cella in base al carico medio e alla percentuale massima della risorsa.
    // L'allocazione media viene arrotondata per gestire correttamente il caso di uguaglianza esatta (100%).
    // - Rosso: sovraccarico (> maxStaffingPercentage)
    // - Verde: utilizzo ottimale (= maxStaffingPercentage)
    // - Giallo: sottoutilizzo (< maxStaffingPercentage)
    const cellColor = useMemo(() => {
        const maxPercentage = resource.maxStaffingPercentage ?? 100;
        const roundedAverage = Math.round(averageAllocation);
        if (roundedAverage > maxPercentage) return 'bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200';
        if (roundedAverage === maxPercentage) return 'bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200';
        if (roundedAverage > 0 && roundedAverage < maxPercentage) return 'bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200';
        return 'bg-transparent';
    }, [averageAllocation, resource.maxStaffingPercentage]);


    return (
        // MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza.
        <td className={`border-t border-gray-200 dark:border-gray-700 px-[var(--space-2)] py-[var(--space-3)] text-center text-[var(--font-size-sm)] font-semibold ${cellColor}`}>
            {averageAllocation > 0 ? `${averageAllocation.toFixed(0)}%` : '-'}
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
    const [viewMode, setViewMode] = useState<ViewMode>('day');
    const { resources, projects, assignments, clients, companyCalendar, roles } = useEntitiesContext();
    
    const [filters, setFilters] = useState({ resourceId: '', projectId: '', clientId: '', roleIds: [] as string[] });
    const [searchParams, setSearchParams] = useSearchParams();

    useEffect(() => {
        const resourceId = searchParams.get('resourceId');
        if (resourceId) {
            setFilters(prev => ({ ...prev, resourceId }));
            // Rimuovi il parametro dall'URL dopo averlo applicato per non confondere l'utente
            setSearchParams({}, { replace: true });
        }
    }, [searchParams, setSearchParams]);
    
    const timeColumns = useMemo(() => {
        const cols: { label: string; subLabel: string; startDate: Date; endDate: Date; isNonWorkingHeader?: boolean; }[] = [];
        let d = new Date(currentDate);

        if (viewMode === 'day') {
            return getCalendarDays(d, 35).map(day => {
                 const dayOfWeek = day.getDay();
                 const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                 const holiday = companyCalendar.find(e => e.date === formatDate(day, 'iso') && e.type !== 'LOCAL_HOLIDAY');
                 return {
                    label: formatDate(day, 'short'),
                    subLabel: formatDate(day, 'day'),
                    startDate: day,
                    endDate: day,
                    isNonWorkingHeader: isWeekend || !!holiday,
                };
            });
        } else if (viewMode === 'week') {
            d.setDate(d.getDate() - (d.getDay() === 0 ? 6 : d.getDay() - 1)); // Start from Monday
            for (let i = 0; i < 8; i++) {
                const startOfWeek = new Date(d);
                const endOfWeek = addDays(new Date(d), 6);
                cols.push({
                    label: `${formatDate(startOfWeek, 'short')} - ${formatDate(endOfWeek, 'short')}`,
                    subLabel: `Settimana ${i + 1}`,
                    startDate: startOfWeek,
                    endDate: endOfWeek,
                });
                d.setDate(d.getDate() + 7);
            }
        } else { // month
            d.setDate(1); // Start from first day of month
            for (let i = 0; i < 6; i++) {
                const startOfMonth = new Date(d);
                const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0);
                cols.push({
                    label: d.toLocaleString('it-IT', { month: 'long', year: 'numeric' }),
                    subLabel: ``,
                    startDate: startOfMonth,
                    endDate: endOfMonth,
                });
                d.setMonth(d.getMonth() + 1);
            }
        }
        return cols;
    }, [currentDate, viewMode, companyCalendar]);
    
    const handlePrev = useCallback(() => {
        setCurrentDate(prev => {
            const newDate = new Date(prev);
            if (viewMode === 'week') newDate.setDate(newDate.getDate() - 7 * 8);
            else if (viewMode === 'month') newDate.setMonth(newDate.getMonth() - 6);
            else newDate.setDate(newDate.getDate() - 35);
            return newDate;
        });
    }, [viewMode]);

    const handleNext = useCallback(() => {
        setCurrentDate(prev => {
            const newDate = new Date(prev);
            if (viewMode === 'week') newDate.setDate(newDate.getDate() + 7 * 8);
            else if (viewMode === 'month') newDate.setMonth(newDate.getMonth() + 6);
            else newDate.setDate(newDate.getDate() + 35);
            return newDate;
        });
    }, [viewMode]);

    const handleToday = () => setCurrentDate(new Date());

    const handleFilterChange = (name: string, value: string) => {
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const handleFilterMultiSelectChange = (name: string, values: string[]) => {
        setFilters(prev => ({ ...prev, [name]: values }));
    };

    const clearFilters = () => {
        setFilters({ resourceId: '', projectId: '', clientId: '', roleIds: [] });
    };

    const displayData = useMemo(() => {
        let visibleResources = resources.filter(r => !r.resigned);

        if (filters.resourceId) {
            visibleResources = visibleResources.filter(r => r.id === filters.resourceId);
        }
        if (filters.roleIds.length > 0) {
            const roleIdsSet = new Set(filters.roleIds);
            visibleResources = visibleResources.filter(r => roleIdsSet.has(r.roleId));
        }

        if (filters.projectId || filters.clientId) {
            let relevantAssignments = [...assignments];
            if (filters.projectId) {
                relevantAssignments = relevantAssignments.filter(a => a.projectId === filters.projectId);
            }
            if (filters.clientId) {
                const clientProjectIds = new Set(projects.filter(p => p.clientId === filters.clientId).map(p => p.id));
                relevantAssignments = relevantAssignments.filter(a => clientProjectIds.has(a.projectId));
            }
            const resourceIdsFromAssignments = new Set(relevantAssignments.map(a => a.resourceId));
            visibleResources = visibleResources.filter(r => resourceIdsFromAssignments.has(r.id!));
        }

        return visibleResources.sort((a,b) => a.name.localeCompare(b.name));
    }, [resources, assignments, projects, filters]);

    const resourceOptions = useMemo(() => resources.filter(r => !r.resigned).map(r => ({ value: r.id!, label: r.name })), [resources]);
    const projectOptions = useMemo(() => projects.map(p => ({ value: p.id!, label: p.name })), [projects]);
    const clientOptions = useMemo(() => clients.map(c => ({ value: c.id!, label: c.name })), [clients]);
    const roleOptions = useMemo(() => roles.map(r => ({ value: r.id!, label: r.name })), [roles]);

    return (
        <div className="flex flex-col h-full">
            {/* Contenitore fisso per controlli e filtri */}
            <div className="flex-shrink-0">
                {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
                <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-[var(--space-4)] gap-[var(--space-4)]">
                    {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
                    <div className="flex items-center justify-center space-x-[var(--space-2)]">
                        {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
                        <button onClick={handlePrev} className="px-[var(--space-3)] py-[var(--space-2)] bg-white dark:bg-gray-700 border dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 text-[var(--font-size-sm)]">← Prec.</button>
                        {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
                        <button onClick={handleToday} className="px-[var(--space-4)] py-[var(--space-2)] bg-white dark:bg-gray-700 border dark:border-gray-600 rounded-md shadow-sm font-semibold text-primary dark:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-600">Oggi</button>
                        {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
                        <button onClick={handleNext} className="px-[var(--space-3)] py-[var(--space-2)] bg-white dark:bg-gray-700 border dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 text-[var(--font-size-sm)]">Succ. →</button>
                    </div>
                    {/* Selettore della vista temporale (giorno, settimana, mese). */}
                    {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
                    <div className="flex items-center space-x-[var(--space-1)] bg-gray-200 dark:bg-gray-700 p-[var(--space-1)] rounded-md">
                        {(['day', 'week', 'month'] as ViewMode[]).map(level => (
                            <button key={level} onClick={() => setViewMode(level)}
                                // MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza.
                                className={`px-[var(--space-3)] py-[var(--space-1)] text-[var(--font-size-sm)] font-medium rounded-md capitalize ${viewMode === level ? 'bg-white dark:bg-gray-900 text-primary dark:text-blue-400 shadow' : 'text-gray-600 dark:text-gray-300'}`}>
                                {level === 'day' ? 'Giorno' : level === 'week' ? 'Settimana' : 'Mese'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Sezione Filtri */}
                {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
                <div className="mb-[var(--space-4)] p-[var(--space-4)] bg-white dark:bg-gray-800 rounded-lg shadow relative z-10">
                    {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-[var(--space-4)] items-end">
                        {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
                        <div className="md:col-span-2"><label className="block text-[var(--font-size-sm)] font-medium text-gray-700 dark:text-gray-300">Risorsa</label><SearchableSelect name="resourceId" value={filters.resourceId} onChange={handleFilterChange} options={resourceOptions} placeholder="Tutte le Risorse"/></div>
                        {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
                        <div className="md:col-span-2"><label className="block text-[var(--font-size-sm)] font-medium text-gray-700 dark:text-gray-300">Ruolo/i</label><MultiSelectDropdown name="roleIds" selectedValues={filters.roleIds} onChange={handleFilterMultiSelectChange} options={roleOptions} placeholder="Tutti i Ruoli"/></div>
                        {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
                        <div><label className="block text-[var(--font-size-sm)] font-medium text-gray-700 dark:text-gray-300">Cliente</label><SearchableSelect name="clientId" value={filters.clientId} onChange={handleFilterChange} options={clientOptions} placeholder="Tutti i Clienti"/></div>
                        {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
                        <div><label className="block text-[var(--font-size-sm)] font-medium text-gray-700 dark:text-gray-300">Progetto</label><SearchableSelect name="projectId" value={filters.projectId} onChange={handleFilterChange} options={projectOptions} placeholder="Tutti i Progetti"/></div>
                        {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
                        <button onClick={clearFilters} className="px-[var(--space-4)] py-[var(--space-2)] bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 w-full md:col-start-6">Reset Filtri</button>
                    </div>
                </div>
            </div>

            {/* Griglia di Carico */}
            <div className="flex-grow overflow-auto bg-white dark:bg-gray-800 rounded-lg shadow">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-20">
                        <tr>
                            {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
                            <th className="sticky left-0 bg-gray-50 dark:bg-gray-700 px-[var(--space-3)] py-[var(--space-3-5)] text-left text-[var(--font-size-sm)] font-semibold text-gray-900 dark:text-white z-30" style={{ minWidth: '250px' }}>Risorsa</th>
                            {timeColumns.map((col, index) => (
                                // MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza.
                                <th key={index} className={`px-[var(--space-2)] py-[var(--space-3-5)] text-center text-[var(--font-size-sm)] font-semibold w-24 md:w-28 ${col.isNonWorkingHeader ? 'bg-gray-100 dark:bg-gray-700/50' : ''}`}>
                                    <div className="flex flex-col items-center">
                                        <span className={col.isNonWorkingHeader ? 'text-gray-500' : 'text-gray-900 dark:text-white'}>{col.label}</span>
                                        {col.subLabel && <span className="text-[var(--font-size-xs)] text-gray-500">{col.subLabel}</span>}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {displayData.map(resource => {
                            const role = roles.find(r => r.id === resource.roleId);
                            return (
                                <tr key={resource.id} className="group hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                    <td className="sticky left-0 bg-white dark:bg-gray-800 group-hover:bg-gray-50 dark:group-hover:bg-gray-700/50 px-[var(--space-3)] py-[var(--space-4)] text-[var(--font-size-sm)] font-medium z-10" style={{ minWidth: '250px' }}>
                                        <div className="flex flex-col">
                                            <span className="text-gray-900 dark:text-white truncate" title={resource.name}>{resource.name}</span>
                                            <span className="text-[var(--font-size-xs)] text-gray-500 truncate" title={`${role?.name} (Max: ${resource.maxStaffingPercentage}%)`}>{role?.name} (Max: {resource.maxStaffingPercentage}%)</span>
                                        </div>
                                    </td>
                                    {timeColumns.map((col, index) => {
                                        if (viewMode === 'day') {
                                            const day = col.startDate;
                                            const isDayHoliday = isHoliday(day, resource.location, companyCalendar);
                                            return <ReadonlyDailyTotalCell key={index} resource={resource} date={formatDate(day, 'iso')} isNonWorkingDay={col.isNonWorkingHeader || isDayHoliday} />;
                                        } else {
                                            return <ReadonlyAggregatedWorkloadCell key={index} resource={resource} startDate={col.startDate} endDate={col.endDate} />;
                                        }
                                    })}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                 {displayData.length === 0 && (
                    <p className="text-center py-8 text-gray-500">Nessuna risorsa trovata per i filtri correnti.</p>
                )}
            </div>
        </div>
    );
};

export default WorkloadPage;
