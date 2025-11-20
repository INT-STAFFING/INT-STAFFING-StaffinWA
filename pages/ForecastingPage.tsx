/**
 * @file ForecastingPage.tsx
 * @description Pagina di forecasting e capacity planning per analizzare il carico di lavoro futuro con proiezioni intelligenti.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useEntitiesContext, useAllocationsContext } from '../context/AppContext';
import { getWorkingDaysBetween, isHoliday } from '../utils/dateUtils';
import SearchableSelect from '../components/SearchableSelect';

/**
 * Componente per la pagina di Forecasting e Capacity Planning.
 * Mostra una vista aggregata e previsionale del carico di lavoro del team.
 * @returns {React.ReactElement} La pagina di Forecasting.
 */
const ForecastingPage: React.FC = () => {
    const { resources, assignments, horizontals, clients, projects, companyCalendar } = useEntitiesContext();
    const { allocations } = useAllocationsContext();
    const [forecastHorizon] = useState(12); // Orizzonte temporale in mesi
    const [filters, setFilters] = useState({ horizontal: '', clientId: '', projectId: ''});
    const [enableProjections, setEnableProjections] = useState(true); // Toggle per attivare l'algoritmo predittivo
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    
    const availableProjects = useMemo(() => {
        if (!filters.clientId) {
            return projects;
        }
        return projects.filter(p => p.clientId === filters.clientId);
    }, [projects, filters.clientId]);

    const handleFilterChange = (name: string, value: string) => {
        setFilters(prev => {
            const newFilters = { ...prev, [name]: value };
            // Reset project filter if client changes
            if (name === 'clientId') {
                newFilters.projectId = '';
            }
            return newFilters;
        });
    };

    const resetFilters = () => {
        setFilters({ horizontal: '', clientId: '', projectId: ''});
    };

    // 1. Pre-calcolo della media storica per ogni assegnazione
    const historicalAverages = useMemo(() => {
        const averages: Record<string, number> = {}; // assignmentId -> avgPercentage (0-100)
        const today = new Date();

        assignments.forEach(assignment => {
            const assignmentAllocations = allocations[assignment.id!];
            if (!assignmentAllocations) {
                averages[assignment.id!] = 0;
                return;
            }

            let totalPercentage = 0;
            let countDays = 0;

            // Analizziamo tutto lo storico fino ad oggi
            Object.entries(assignmentAllocations).forEach(([dateStr, percentage]) => {
                const date = new Date(dateStr);
                if (date <= today) {
                    totalPercentage += percentage;
                    countDays++;
                }
            });

            // Se abbiamo dati storici, calcoliamo la media
            if (countDays > 0) {
                averages[assignment.id!] = totalPercentage / countDays;
            } else {
                // Se non c'è storico (es. assegnazione futura), potremmo usare un default
                // Per ora lasciamo 0, l'algoritmo proietterà solo se c'è una "velocità" storica consolidata
                averages[assignment.id!] = 0; 
            }
        });

        return averages;
    }, [assignments, allocations]);

    const forecastData = useMemo(() => {
        const results = [];
        const today = new Date();
        // Normalizziamo "oggi" all'inizio della giornata per confronti corretti
        today.setHours(0,0,0,0);

        let filteredResources = resources.filter(r => !r.resigned);

        if (filters.horizontal) {
            filteredResources = filteredResources.filter(r => r.horizontal === filters.horizontal);
        }
        
        let assignmentsToConsider = [...assignments];

        if (filters.projectId) {
            assignmentsToConsider = assignmentsToConsider.filter(a => a.projectId === filters.projectId);
            const resourceIdsInProject = new Set(assignmentsToConsider.map(a => a.resourceId));
            filteredResources = filteredResources.filter(r => resourceIdsInProject.has(r.id!));
        } else if (filters.clientId) {
            const projectIdsForClient = new Set(
                projects.filter(p => p.clientId === filters.clientId).map(p => p.id)
            );
            assignmentsToConsider = assignmentsToConsider.filter(a => projectIdsForClient.has(a.projectId!));
            const resourceIdsForClient = new Set(assignmentsToConsider.map(a => a.resourceId));
            filteredResources = filteredResources.filter(r => resourceIdsForClient.has(r.id!));
        }
        
        // Mappa rapida progetti per accesso veloce alle date
        const projectMap = new Map(projects.map(p => [p.id, p]));

        for (let i = 0; i < forecastHorizon; i++) {
            const date = new Date(today.getFullYear(), today.getMonth() + i, 1);
            const monthName = date.toLocaleString('it-IT', { month: 'long', year: 'numeric' });
            const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
            const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);

            // 1. Calcolo Capacità (Available Person Days)
            let availablePersonDays = 0;
            filteredResources.forEach(resource => {
                const effectiveStartDate = new Date(resource.hireDate) > firstDayOfMonth ? new Date(resource.hireDate) : firstDayOfMonth;
                const effectiveEndDate = resource.lastDayOfWork && new Date(resource.lastDayOfWork) < lastDayOfMonth ? new Date(resource.lastDayOfWork) : lastDayOfMonth;

                if (effectiveStartDate > effectiveEndDate) return;
                
                const workingDays = getWorkingDaysBetween(effectiveStartDate, effectiveEndDate, companyCalendar, resource.location);
                const staffingFactor = (resource.maxStaffingPercentage || 100) / 100;
                availablePersonDays += workingDays * staffingFactor;
            });

            // 2. Calcolo Allocazioni (Reali + Proiettate)
            let allocatedPersonDays = 0;
            let projectedPersonDays = 0; // Solo per tracciamento interno

            const relevantAssignmentIds = new Set(assignmentsToConsider.map(a => a.id));

            filteredResources.forEach(resource => {
                const resourceAssignments = assignments.filter(a => a.resourceId === resource.id && relevantAssignmentIds.has(a.id!));
                
                resourceAssignments.forEach(assignment => {
                    const project = projectMap.get(assignment.projectId);
                    if (!project) return;

                    // Date limite del progetto
                    const projStart = project.startDate ? new Date(project.startDate) : null;
                    const projEnd = project.endDate ? new Date(project.endDate) : null;

                    // Se il progetto finisce prima di questo mese o inizia dopo, saltalo
                    if (projEnd && projEnd < firstDayOfMonth) return;
                    if (projStart && projStart > lastDayOfMonth) return;

                    // Determina l'intervallo effettivo di attività del progetto in questo mese
                    const activeStart = projStart && projStart > firstDayOfMonth ? projStart : firstDayOfMonth;
                    const activeEnd = projEnd && projEnd < lastDayOfMonth ? projEnd : lastDayOfMonth;

                    // Se la risorsa termina di lavorare, tronca l'allocazione
                    const resourceEnd = resource.lastDayOfWork ? new Date(resource.lastDayOfWork) : null;
                    const effectiveEnd = resourceEnd && resourceEnd < activeEnd ? resourceEnd : activeEnd;
                    
                    if (activeStart > effectiveEnd) return;

                    // --- Calcolo Allocazione ---
                    
                    const assignmentAllocations = allocations[assignment.id!];
                    let hasHardBookingInMonth = false;
                    let hardBookingDays = 0;

                    // Controlliamo se esistono allocazioni "hard" (inserite manualmente) nel DB per questo mese
                    if (assignmentAllocations) {
                        for (const dateStr in assignmentAllocations) {
                            const allocDate = new Date(dateStr);
                            if (allocDate >= firstDayOfMonth && allocDate <= lastDayOfMonth) {
                                if (!isHoliday(allocDate, resource.location, companyCalendar) && allocDate.getDay() !== 0 && allocDate.getDay() !== 6) {
                                    allocatedPersonDays += (assignmentAllocations[dateStr] / 100);
                                    hardBookingDays++;
                                    hasHardBookingInMonth = true;
                                }
                            }
                        }
                    }

                    // --- ALGORITMO PREDITTIVO ---
                    // Se abilitato, il mese è futuro, e NON ci sono allocazioni manuali ("Hard Booking")
                    // allora usiamo la media storica proiettata.
                    const isFutureMonth = firstDayOfMonth > today;
                    
                    if (enableProjections && isFutureMonth && !hasHardBookingInMonth) {
                        const avgPercent = historicalAverages[assignment.id!] || 0;
                        
                        if (avgPercent > 0) {
                            // Calcola giorni lavorativi nell'intervallo attivo del progetto/risorsa
                            const potentialWorkingDays = getWorkingDaysBetween(activeStart, effectiveEnd, companyCalendar, resource.location);
                            
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

    }, [resources, assignments, allocations, forecastHorizon, filters, projects, companyCalendar, historicalAverages, enableProjections]);

    const maxUtilization = Math.max(...forecastData.map(d => d.utilization), 100);

    const getUtilizationColor = (utilization: number) => {
        if (utilization > 100) return 'bg-error';
        if (utilization > 90) return 'bg-yellow-container';
        return 'bg-tertiary';
    };

    const horizontalOptions = useMemo(() => horizontals.sort((a,b) => a.value.localeCompare(b.value)).map(h => ({ value: h.value, label: h.value })), [horizontals]);
    const clientOptions = useMemo(() => clients.sort((a,b) => a.name.localeCompare(b.name)).map(c => ({ value: c.id!, label: c.name })), [clients]);
    const projectOptions = useMemo(() => availableProjects.sort((a,b) => a.name.localeCompare(b.name)).map(p => ({ value: p.id!, label: p.name })), [availableProjects]);

    // --- Mobile Components ---
    
    const MobileForecastCard: React.FC<{ data: any }> = ({ data }) => {
        const getBorderColor = (surplus: number) => {
            if (surplus < 0) return 'border-error';
            if (surplus < 10) return 'border-yellow-500';
            return 'border-primary';
        };

        return (
            <div className={`bg-surface rounded-2xl shadow p-4 mb-4 border-l-4 ${getBorderColor(data.surplusDeficit)} flex flex-col gap-3`}>
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
                        <label className="block text-sm font-medium text-on-surface-variant">Horizontal</label>
                        <SearchableSelect name="horizontal" value={filters.horizontal} onChange={handleFilterChange} options={horizontalOptions} placeholder="Tutti gli Horizontal"/>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-on-surface-variant">Cliente</label>
                        <SearchableSelect name="clientId" value={filters.clientId} onChange={handleFilterChange} options={clientOptions} placeholder="Tutti i Clienti"/>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-on-surface-variant">Progetto</label>
                        <SearchableSelect name="projectId" value={filters.projectId} onChange={handleFilterChange} options={projectOptions} placeholder="Tutti i Progetti"/>
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