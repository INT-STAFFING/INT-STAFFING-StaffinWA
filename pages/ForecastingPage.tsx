/**
 * @file ForecastingPage.tsx
 * @description Pagina di forecasting e capacity planning per analizzare il carico di lavoro futuro.
 */

import React, { useState, useMemo } from 'react';
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

    const forecastData = useMemo(() => {
        const results = [];
        const today = new Date();

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
        
        for (let i = 0; i < forecastHorizon; i++) {
            const date = new Date(today.getFullYear(), today.getMonth() + i, 1);
            const monthName = date.toLocaleString('it-IT', { month: 'long', year: 'numeric' });
            const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
            const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);

            let availablePersonDays = 0;
            filteredResources.forEach(resource => {
                const effectiveStartDate = new Date(resource.hireDate) > firstDay ? new Date(resource.hireDate) : firstDay;
                const effectiveEndDate = resource.lastDayOfWork && new Date(resource.lastDayOfWork) < lastDay ? new Date(resource.lastDayOfWork) : lastDay;

                if (effectiveStartDate > effectiveEndDate) return;
                
                const workingDays = getWorkingDaysBetween(effectiveStartDate, effectiveEndDate, companyCalendar, resource.location);
                const staffingFactor = (resource.maxStaffingPercentage || 100) / 100;
                availablePersonDays += workingDays * staffingFactor;
            });

            let allocatedPersonDays = 0;

            const relevantAssignmentIds = new Set(assignmentsToConsider.map(a => a.id));

            filteredResources.forEach(resource => {
                const resourceAssignments = assignments.filter(a => a.resourceId === resource.id && relevantAssignmentIds.has(a.id!));
                resourceAssignments.forEach(assignment => {
                    const assignmentAllocations = allocations[assignment.id];
                    if (assignmentAllocations) {
                        for (const dateStr in assignmentAllocations) {
                            const allocDate = new Date(dateStr);
                            if (resource.lastDayOfWork && dateStr > resource.lastDayOfWork) continue;

                            if (allocDate >= firstDay && allocDate <= lastDay) {
                                if (!isHoliday(allocDate, resource.location, companyCalendar) && allocDate.getDay() !== 0 && allocDate.getDay() !== 6) {
                                    allocatedPersonDays += (assignmentAllocations[dateStr] / 100);
                                }
                            }
                        }
                    }
                });
            });

            const utilization = availablePersonDays > 0 ? (allocatedPersonDays / availablePersonDays) * 100 : 0;
            
            results.push({
                monthName,
                availablePersonDays,
                allocatedPersonDays,
                utilization,
                surplusDeficit: availablePersonDays - allocatedPersonDays,
            });
        }

        return results;

    }, [resources, assignments, allocations, forecastHorizon, filters, projects, companyCalendar]);

    const maxUtilization = Math.max(...forecastData.map(d => d.utilization), 100);

    const getUtilizationColor = (utilization: number) => {
        if (utilization > 100) return 'bg-error';
        if (utilization > 90) return 'bg-yellow-container';
        return 'bg-tertiary';
    };

    const horizontalOptions = useMemo(() => horizontals.sort((a,b) => a.value.localeCompare(b.value)).map(h => ({ value: h.value, label: h.value })), [horizontals]);
    const clientOptions = useMemo(() => clients.sort((a,b) => a.name.localeCompare(b.name)).map(c => ({ value: c.id!, label: c.name })), [clients]);
    const projectOptions = useMemo(() => availableProjects.sort((a,b) => a.name.localeCompare(b.name)).map(p => ({ value: p.id!, label: p.name })), [availableProjects]);


    return (
        <div>
            <h1 className="text-3xl font-bold text-on-background mb-6">Forecasting & Capacity</h1>

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
            <div className="bg-surface rounded-2xl shadow p-6 mb-8">
                <h2 className="text-xl font-semibold mb-4 text-on-surface">Utilizzo Mensile Previsto (%)</h2>
                <div className="flex space-x-2 md:space-x-4 h-64 overflow-x-auto pb-4">
                    {forecastData.map((data, index) => (
                        <div key={index} className="flex-1 min-w-[50px] text-center flex flex-col">
                            <div className="w-full flex-grow flex items-end justify-center">
                                <div
                                    className={`group relative w-full rounded-t-md transition-all duration-300 ${getUtilizationColor(data.utilization)}`}
                                    style={{ height: `${(data.utilization / maxUtilization) * 100}%` }}
                                >
                                    <div className="absolute bottom-full mb-2 w-full opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                        <div className="bg-inverse-surface text-inverse-on-surface text-xs rounded py-1 px-2 mx-auto w-max">
                                            {data.utilization.toFixed(1)}%
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

            
            <div className="bg-surface rounded-2xl shadow">
              
                <div
                    className="
                        max-h-[640px]
                        overflow-y-auto
                        overflow-x-auto
                    "
                >
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
                                <tr
                                    key={index}
                                    className="h-8 hover:bg-surface-container-low"
                                >
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-on-surface">
                                        {data.monthName}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-on-surface-variant">
                                        {data.availablePersonDays.toFixed(1)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-on-surface-variant">
                                        {data.allocatedPersonDays.toFixed(1)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold">
                                        <span
                                            className={
                                                data.utilization > 100
                                                    ? 'text-error'
                                                    : data.utilization > 95
                                                    ? 'text-tertiary'
                                                    : 'text-yellow-600 dark:text-yellow-400'
                                            }
                                        >
                                            {data.utilization.toFixed(1)}%
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold">
                                        <span
                                            className={
                                                data.surplusDeficit >= 0
                                                    ? 'text-tertiary'
                                                    : 'text-error'
                                            }
                                        >
                                            {data.surplusDeficit.toFixed(1)}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ForecastingPage;