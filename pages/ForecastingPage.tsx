/**
 * @file ForecastingPage.tsx
 * @description Pagina di forecasting e capacity planning per analizzare il carico di lavoro futuro con proiezioni intelligenti.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useAllocationsContext } from '../context/AppContext';
import { useResourcesContext } from '../context/ResourcesContext';
import { useProjectsContext } from '../context/ProjectsContext';
import { useLookupContext } from '../context/LookupContext';
import { useHRContext } from '../context/HRContext';
import { LeaveRequest, Project, Assignment } from '../types';
import { getWorkingDaysBetween, getLeaveDurationInWorkingDays, parseISODate, isHoliday, buildHolidaySet, isHolidayInSet, getWorkingDaysBetweenWithSet } from '../utils/dateUtils';
import { isProjectVisibleInStaffing } from '../utils/allocationUtils';
import MultiSelectDropdown from '../components/MultiSelectDropdown';

/**
 * Componente per la pagina di Forecasting e Capacity Planning.
 * Mostra una vista aggregata e previsionale del carico di lavoro del team.
 * @returns {React.ReactElement} La pagina di Forecasting.
 */
const ForecastingPage: React.FC = () => {
    // Corrected destructuring using functions instead of horizontals
    const { resources } = useResourcesContext();
    const { assignments, clients, projects } = useProjectsContext();
    const { functions, companyCalendar } = useLookupContext();
    const { leaveRequests, leaveTypes } = useHRContext();
    const { allocations } = useAllocationsContext();
    const [forecastHorizon] = useState(12); // Orizzonte temporale in mesi
    // Updated filters state horizontal -> function
    const [filters, setFilters] = useState({ function: [] as string[], clientId: [] as string[], projectId: [] as string[] });
    const [enableProjections, setEnableProjections] = useState(true); // Toggle per attivare l'algoritmo predittivo
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    
    const availableProjects = useMemo(() => {
        // I progetti "Completato" non partecipano al forecast: inutile poterli filtrare.
        const plannableProjects = projects.filter(isProjectVisibleInStaffing);
        if (filters.clientId.length === 0) {
            return plannableProjects;
        }
        return plannableProjects.filter(p => filters.clientId.includes(p.clientId || ''));
    }, [projects, filters.clientId]);

    const handleFilterChange = (name: string, values: string[]) => {
        setFilters(prev => {
            const newFilters = { ...prev, [name]: values };
            // Reset project filter if client changes
            if (name === 'clientId') {
                newFilters.projectId = [];
            }
            return newFilters;
        });
    };

    const resetFilters = () => {
        setFilters({ function: [], clientId: [], projectId: [] });
    };

    // OPTIMIZATION: Set di festività precompilato per lookup O(1) nei loop caldi.
    // Usa l'utility condivisa in dateUtils, così la semantica (festività
    // nazionali/locali, normalizzazione date UTC) è IDENTICA a getWorkingDaysBetween
    // usato in Dashboard/Report — evita divergenze tra i KPI delle diverse pagine.
    const holidaySet = useMemo(() => buildHolidaySet(companyCalendar), [companyCalendar]);

    const checkIsHolidayOptimized = (date: Date, location: string | null) =>
        isHolidayInSet(date, location, holidaySet);

    const getWorkingDaysOptimized = (startDate: Date, endDate: Date, location: string | null): number =>
        getWorkingDaysBetweenWithSet(startDate, endDate, holidaySet, location);

    // 1. Pre-calcolo della media storica per ogni assegnazione
    const historicalAverages = useMemo(() => {
        const averages: Record<string, number> = {}; // assignmentId -> avgPercentage (0-100)
        const todayStr = new Date().toISOString().split('T')[0];

        assignments.forEach(assignment => {
            const assignmentAllocations = allocations[assignment.id!];
            if (!assignmentAllocations) {
                averages[assignment.id!] = 0;
                return;
            }

            let totalPercentage = 0;
            let countDays = 0;

            // Analizziamo tutto lo storico fino ad oggi
            for (const [dateStr, percentage] of Object.entries(assignmentAllocations)) {
                if (dateStr <= todayStr) {
                    totalPercentage += (percentage as number);
                    countDays++;
                }
            }

            // Se abbiamo dati storici, calcoliamo la media
            if (countDays > 0) {
                averages[assignment.id!] = totalPercentage / countDays;
            } else {
                averages[assignment.id!] = 0; 
            }
        });

        return averages;
    }, [assignments, allocations]);

    // OPTIMIZATION: Heavy Calculation Area
    const forecastData = useMemo(() => {
        const results = [];
        const today = new Date();
        today.setUTCHours(0,0,0,0);
        
        // Pre-filter resources and assignments to reduce inner loop iterations
        let filteredResources = resources.filter(r => !r.resigned);
        // Corrected filter resource.function instead of resource.horizontal
        if (filters.function.length > 0) {
            filteredResources = filteredResources.filter(r => filters.function.includes(r.function));
        }

        // Mappa rapida progetti per accesso veloce alle date
        const projectMap = new Map<string, Project>();
        projects.forEach(p => {
            if (p.id) projectMap.set(p.id, p);
        });

        // Allineamento con Staffing/Workload: i progetti "Completato" non partecipano
        // al forecast, né con le allocazioni residue né con le proiezioni predittive.
        let assignmentsToConsider = assignments.filter(a => isProjectVisibleInStaffing(projectMap.get(a.projectId)));

        if (filters.projectId.length > 0) {
            assignmentsToConsider = assignmentsToConsider.filter(a => filters.projectId.includes(a.projectId || ''));
            const resourceIdsInProject = new Set(assignmentsToConsider.map(a => a.resourceId));
            filteredResources = filteredResources.filter(r => resourceIdsInProject.has(r.id!));
        } else if (filters.clientId.length > 0) {
            const projectIdsForClient = new Set(
                projects.filter(p => filters.clientId.includes(p.clientId || '')).map(p => p.id)
            );
            assignmentsToConsider = assignmentsToConsider.filter(a => projectIdsForClient.has(a.projectId!));
            const resourceIdsForClient = new Set(assignmentsToConsider.map(a => a.resourceId));
            filteredResources = filteredResources.filter(r => resourceIdsForClient.has(r.id!));
        }
        
        // Create efficient lookup for assignments by resource
        const assignmentsByResource = new Map<string, Assignment[]>();
        assignmentsToConsider.forEach(a => {
             if (!assignmentsByResource.has(a.resourceId)) assignmentsByResource.set(a.resourceId, []);
             assignmentsByResource.get(a.resourceId)?.push(a);
        });

        // Group Leaves by Resource for faster access
        const leavesByResource = new Map<string, LeaveRequest[]>();
        leaveRequests.forEach(l => {
            if (l.status === 'APPROVED') {
                if (!leavesByResource.has(l.resourceId)) leavesByResource.set(l.resourceId, []);
                leavesByResource.get(l.resourceId)?.push(l);
            }
        });

        for (let i = 0; i < forecastHorizon; i++) {
            // Construct Month Boundaries using UTC to ensure month alignment
            const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + i, 1));
            const monthName = date.toLocaleString('it-IT', { month: 'long', year: 'numeric', timeZone: 'UTC' });
            
            // ISO Month String for fast filtering (YYYY-MM)
            const y = date.getUTCFullYear();
            const m = String(date.getUTCMonth() + 1).padStart(2, '0');
            const targetMonthIso = `${y}-${m}`;

            const firstDayOfMonth = new Date(Date.UTC(y, date.getUTCMonth(), 1));
            const lastDayOfMonth = new Date(Date.UTC(y, date.getUTCMonth() + 1, 0));

            // 1. Calcolo Capacità (Available Person Days)
            let availablePersonDays = 0;
            filteredResources.forEach(resource => {
                const hireDate = parseISODate(resource.hireDate);
                const effectiveStartDate = hireDate > firstDayOfMonth ? hireDate : firstDayOfMonth;
                
                const resourceLastDay = resource.lastDayOfWork ? parseISODate(resource.lastDayOfWork) : null;
                const effectiveEndDate = resourceLastDay && resourceLastDay < lastDayOfMonth ? resourceLastDay : lastDayOfMonth;

                if (effectiveStartDate > effectiveEndDate) return;
                
                // Standard capacity based on contract
                const workingDays = getWorkingDaysOptimized(effectiveStartDate, effectiveEndDate, resource.location);
                
                // Subtract LEAVES impact
                const resourceLeaves = leavesByResource.get(resource.id!) || [];
                let leaveDaysLost = 0;
                resourceLeaves.forEach(leave => {
                    const type = leaveTypes.find(t => t.id === leave.typeId);
                    // Use utility to calculate overlap in working days
                    leaveDaysLost += getLeaveDurationInWorkingDays(firstDayOfMonth, lastDayOfMonth, leave, type, companyCalendar, resource.location);
                });

                const staffingFactor = (resource.maxStaffingPercentage || 100) / 100;
                // Ensure capacity doesn't go negative
                availablePersonDays += Math.max(0, workingDays - leaveDaysLost) * staffingFactor;
            });

            // 2. Calcolo Allocazioni (Reali + Proiettate)
            let allocatedPersonDays = 0;
            let projectedPersonDays = 0;

            filteredResources.forEach(resource => {
                const resourceAssignments = assignmentsByResource.get(resource.id!) || [];
                
                resourceAssignments.forEach(assignment => {
                    const project = projectMap.get(assignment.projectId);
                    if (!project) return;

                    // Date limite del progetto (Parse safely)
                    const projStart = project.startDate ? parseISODate(project.startDate) : null;
                    const projEnd = project.endDate ? parseISODate(project.endDate) : null;

                    // If project ends before this month, skip
                    if (projEnd && projEnd < firstDayOfMonth) return;
                    // If project starts after this month, skip
                    if (projStart && projStart > lastDayOfMonth) return;

                    const activeStart = projStart && projStart > firstDayOfMonth ? projStart : firstDayOfMonth;
                    const activeEnd = projEnd && projEnd < lastDayOfMonth ? projEnd : lastDayOfMonth;

                    const resourceEnd = resource.lastDayOfWork ? parseISODate(resource.lastDayOfWork) : null;
                    const effectiveEnd = resourceEnd && resourceEnd < activeEnd ? resourceEnd : activeEnd;
                    
                    if (activeStart > effectiveEnd) return;

                    const assignmentAllocations = allocations[assignment.id!];
                    let hasHardBookingInMonth = false;

                    // FIX: Direct string comparison for allocations instead of Date objects
                    if (assignmentAllocations) {
                        for (const dateStr in assignmentAllocations) {
                            if (dateStr.startsWith(targetMonthIso)) {
                                const allocDate = parseISODate(dateStr);
                                
                                // Check if it is a working day (allocations on weekends shouldn't count towards working days usage usually, but we check holiday map)
                                if (!checkIsHolidayOptimized(allocDate, resource.location)) {
                                     // Also check strict UTC day for weekends (0=Sun, 6=Sat)
                                    const day = allocDate.getUTCDay();
                                    if (day !== 0 && day !== 6) {
                                        allocatedPersonDays += (assignmentAllocations[dateStr] / 100);
                                        hasHardBookingInMonth = true;
                                    }
                                }
                            }
                        }
                    }

                    // --- ALGORITMO PREDITTIVO ---
                    const isFutureMonth = firstDayOfMonth > today;
                    
                    if (enableProjections && isFutureMonth && !hasHardBookingInMonth) {
                        const avgPercent = historicalAverages[assignment.id!] || 0;
                        
                        if (avgPercent > 0) {
                            const potentialWorkingDays = getWorkingDaysOptimized(activeStart, effectiveEnd, resource.location);
                            const projectedLoad = potentialWorkingDays * (avgPercent / 100);
                            allocatedPersonDays += projectedLoad;
                            projectedPersonDays += projectedLoad;
                        }
                    }
                });
            });

            const utilization = availablePersonDays > 0 ? (allocatedPersonDays / availablePersonDays) * 100 : 0;
            const isProjected = projectedPersonDays > 0;
            
            results.push({
                monthName,
                availablePersonDays,
                allocatedPersonDays,
                projectedPersonDays,
                utilization,
                surplusDeficit: availablePersonDays - allocatedPersonDays,
                isProjected
            });
        }

        return results;

    }, [resources, assignments, allocations, forecastHorizon, filters, projects, holidaySet, historicalAverages, enableProjections, leaveRequests, leaveTypes, companyCalendar]);

    const maxUtilization = Math.max(...forecastData.map(d => d.utilization), 100);

    const getUtilizationColor = (utilization: number) => {
        if (utilization > 100) return 'bg-error';
        if (utilization > 90) return 'bg-yellow-container';
        return 'bg-tertiary';
    };

    // Corrected functionOptions instead of horizontalOptions
    const functionOptions = useMemo(() => functions.sort((a,b) => a.value.localeCompare(b.value)).map(h => ({ value: h.value, label: h.value })), [functions]);
    const clientOptions = useMemo(() => clients.sort((a,b) => a.name.localeCompare(b.name)).map(c => ({ value: c.id!, label: c.name })), [clients]);
    const projectOptions = useMemo(() => availableProjects.sort((a,b) => a.name.localeCompare(b.name)).map(p => ({ value: p.id!, label: p.name })), [availableProjects]);

    // --- Mobile Components ---
    
    const MobileForecastCard: React.FC<{ data: any }> = ({ data }) => {
        return (
            <div className="bg-surface rounded-2xl shadow p-4 mb-4 flex flex-col gap-3">
                 <div className="flex justify-between items-center">
                    <div>
                        <h3 className="font-bold text-lg text-on-surface capitalize">{data.monthName}</h3>
                        {data.isProjected && <span className="text-xs text-primary font-medium">(Include Proiezione)</span>}
                    </div>
                    <div className={`px-2 py-1 rounded text-xs font-bold ${data.utilization > 100 ? 'bg-error text-on-error' : 'bg-surface-variant text-on-surface-variant'}`}>
                        {data.utilization.toFixed(0)}% Utilizzo
                    </div>
                </div>

                {/* Utilization Bar */}
                <div className="w-full bg-surface-container-highest rounded-full h-2.5 mt-1">
                     <div 
                        className={`h-2.5 rounded-full ${getUtilizationColor(data.utilization)}`} 
                        style={{ width: `${Math.min(data.utilization, 100)}%` }}
                    ></div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-2 text-sm">
                    <div className="bg-surface-container-low p-2 rounded border border-outline-variant text-center">
                        <span className="block text-xs text-on-surface-variant">Disponibili</span>
                        <span className="font-semibold text-on-surface">{data.availablePersonDays.toFixed(1)} G/U</span>
                    </div>
                    <div className="bg-surface-container-low p-2 rounded border border-outline-variant text-center">
                        <span className="block text-xs text-on-surface-variant">Allocati</span>
                        <span className="font-semibold text-on-surface">{data.allocatedPersonDays.toFixed(1)} G/U</span>
                    </div>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-outline-variant">
                     <span className="text-sm text-on-surface-variant">Surplus/Deficit</span>
                     <span className={`font-bold text-lg ${data.surplusDeficit < 0 ? 'text-error' : 'text-tertiary'}`}>
                        {data.surplusDeficit > 0 ? '+' : ''}{data.surplusDeficit.toFixed(1)}
                     </span>
                </div>
            </div>
        );
    };

    return (
        <div>
            <div className="flex flex-col md:flex-row justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-on-background">Forecasting & Capacity</h1>
                <div className="flex items-center space-x-3 bg-surface-container p-2 rounded-lg mt-4 md:mt-0">
                    <span className="text-sm font-medium text-on-surface-variant">Includi Proiezioni Future</span>
                    <button 
                        onClick={() => setEnableProjections(!enableProjections)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${enableProjections ? 'bg-primary' : 'bg-surface-variant'}`}
                    >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enableProjections ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                </div>
            </div>

            <div className="mb-6 p-4 bg-surface rounded-2xl shadow">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div>
                        <label className="block text-sm font-medium text-on-surface-variant">Function</label>
                        <MultiSelectDropdown name="function" selectedValues={filters.function} onChange={handleFilterChange} options={functionOptions} placeholder="Tutte le Function"/>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-on-surface-variant">Cliente</label>
                        <MultiSelectDropdown name="clientId" selectedValues={filters.clientId} onChange={handleFilterChange} options={clientOptions} placeholder="Tutti i Clienti"/>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-on-surface-variant">Progetto</label>
                        <MultiSelectDropdown name="projectId" selectedValues={filters.projectId} onChange={handleFilterChange} options={projectOptions} placeholder="Tutti i Progetti"/>
                    </div>
                    <button onClick={resetFilters} className="px-6 py-2 bg-secondary-container text-on-secondary-container font-semibold rounded-full hover:opacity-90 w-full md:w-auto">Reset Filtri</button>
                </div>
            </div>


            {/* Grafico Utilizzo */}
            <div className="bg-surface rounded-2xl shadow p-6 mb-8 hidden md:block">
                <h2 className="text-xl font-semibold mb-4 text-on-surface">Utilizzo Mensile Previsto (%)</h2>
                {enableProjections && <p className="text-xs text-on-surface-variant mb-4">Il grafico include le proiezioni basate sulla media storica delle allocazioni per i progetti attivi.</p>}
                <div className="flex space-x-2 md:space-x-4 h-64 overflow-x-auto pb-4">
                    {forecastData.map((data, index) => (
                        <div key={index} className="flex-1 min-w-[50px] text-center flex flex-col">
                            <div className="w-full flex-grow flex items-end justify-center">
                                <div
                                    className={`group relative w-full rounded-t-md transition-all duration-300 ${getUtilizationColor(data.utilization)} ${data.isProjected ? 'opacity-80' : ''}`}
                                    style={{ 
                                        height: `${(data.utilization / maxUtilization) * 100}%`,
                                        backgroundImage: data.isProjected ? 'linear-gradient(45deg,rgba(255,255,255,.15) 25%,transparent 25%,transparent 50%,rgba(255,255,255,.15) 50%,rgba(255,255,255,.15) 75%,transparent 75%,transparent)' : 'none',
                                        backgroundSize: '1rem 1rem'
                                    }}
                                >
                                    <div className="absolute bottom-full mb-2 w-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
                                        <div className="bg-inverse-surface text-inverse-on-surface text-xs rounded py-1 px-2 mx-auto w-max">
                                            {data.utilization.toFixed(1)}%
                                            {data.isProjected && <span className="block text-[10px] opacity-80">(Stimato)</span>}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <p className="text-xs text-on-surface-variant mt-2">
                                {data.monthName.split(' ')[0]}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Data View: Table (Desktop) / Cards (Mobile) */}
            {isMobile ? (
                <div className="space-y-4">
                    {forecastData.map((data, index) => (
                        <MobileForecastCard key={index} data={data} />
                    ))}
                </div>
            ) : (
                <div className="bg-surface rounded-2xl shadow">
                    <div className="max-h-[640px] overflow-y-auto overflow-x-auto">
                        <table className="min-w-full divide-y divide-outline-variant table-fixed">
                            <thead className="sticky top-0 z-10 bg-surface-container-low">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                                        Mese
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                                        G/U Disponibili
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                                        G/U Allocati
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                                        Utilizzo
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                                        Surplus/Deficit (G/U)
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-surface divide-y divide-outline-variant">
                                {forecastData.map((data, index) => (
                                    <tr key={index} className="h-8 hover:bg-surface-container-low">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-on-surface">
                                            {data.monthName} {data.isProjected && <span className="text-xs text-primary ml-1">(Proiezione)</span>}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-on-surface-variant">
                                            {data.availablePersonDays.toFixed(1)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-on-surface-variant">
                                            {data.allocatedPersonDays.toFixed(1)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold">
                                            <span className={data.utilization > 100 ? 'text-error' : data.utilization > 95 ? 'text-tertiary' : 'text-yellow-600 dark:text-yellow-400'}>
                                                {data.utilization.toFixed(1)}%
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold">
                                            <span className={data.surplusDeficit >= 0 ? 'text-tertiary' : 'text-error'}>
                                                {data.surplusDeficit.toFixed(1)}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ForecastingPage;