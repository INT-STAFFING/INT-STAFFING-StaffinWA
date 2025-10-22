/**
 * @file DashboardPage.tsx
 * @description Pagina della dashboard che visualizza varie metriche e analisi aggregate sui dati di staffing.
 */

import React, { useMemo, useState } from 'react';
import { useEntitiesContext, useAllocationsContext } from '../context/AppContext';
import { getWorkingDaysBetween, isHoliday } from '../utils/dateUtils';
import SearchableSelect from '../components/SearchableSelect';
import { useNavigate, Link } from 'react-router-dom';
import { UsersIcon, BriefcaseIcon } from '../components/icons';


/**
 * Formatta un valore numerico o stringa come valuta EUR in formato italiano.
 * @param {number | string} value - Il valore da formattare.
 * @returns {string} La stringa formattata (es. "€ 1.234,56").
 */
const formatCurrency = (value: number | string): string => {
    // Assicura che il valore sia un numero, con fallback a 0 in caso di input non valido.
    const numValue = Number(value) || 0;
    return numValue.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
};

/**
 * Componente per la pagina Dashboard.
 * Mostra una serie di "card" con analisi dei dati, come allocazione media,
 * FTE per progetto, analisi dei budget e altro, ora dotate di filtri individuali.
 * @returns {React.ReactElement} La pagina della dashboard.
 */
const DashboardPage: React.FC = () => {
    const { resources, roles, projects, clients, assignments, clientSectors, locations, companyCalendar } = useEntitiesContext();
    const { allocations } = useAllocationsContext();
    const navigate = useNavigate();

    // Stati dei filtri per ogni card
    const [avgAllocFilter, setAvgAllocFilter] = useState({ resourceId: '' });
    const [fteFilter, setFteFilter] = useState({ clientId: '' });
    const [budgetFilter, setBudgetFilter] = useState({ clientId: '' });
    const [underutilizedFilter, setUnderutilizedFilter] = useState(new Date().toISOString().slice(0, 7)); // Formato YYYY-MM
    const [effortByClientFilter, setEffortByClientFilter] = useState({ sector: '' });

    // --- Calcoli per le Card Aggregate in Cima ---

    /**
     * @description Calcola i KPI aggregati: budget totale, giorni-uomo totali.
     */
    const overallKPIs = useMemo(() => {
        const totalBudget = projects.reduce((sum, p) => sum + Number(p.budget || 0), 0);

        let totalPersonDays = 0;
        for (const assignmentId in allocations) {
             const assignment = assignments.find(a => a.id === assignmentId);
             if (!assignment) continue;
             const resource = resources.find(r => r.id === assignment.resourceId);

            for (const dateStr in allocations[assignmentId]) {
                const allocDate = new Date(dateStr);
                const day = allocDate.getDay();
                 if (day !== 0 && day !== 6 && !isHoliday(allocDate, resource?.location ?? null, companyCalendar)) {
                    totalPersonDays += (allocations[assignmentId][dateStr] / 100);
                }
            }
        }
        
        const assignedResourceIds = new Set(assignments.map(a => a.resourceId));
        const unassignedResources = resources.filter(r => !assignedResourceIds.has(r.id!));

        const staffedProjectIds = new Set(assignments.map(a => a.projectId));
        const unstaffedProjects = projects.filter(p => p.status === 'In corso' && !staffedProjectIds.has(p.id!));


        return { totalBudget, totalPersonDays, unassignedResources, unstaffedProjects };
    }, [projects, allocations, assignments, resources, companyCalendar]);

    /**
     * @description Calcola i KPI per il mese corrente: costo stimato, giorni-uomo allocati, e costo per cliente.
     */
    const currentMonthKPIs = useMemo(() => {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        let totalCost = 0;
        let totalPersonDays = 0;
        const costByClient: { [clientId: string]: { id: string, name: string, cost: number } } = {};

        clients.forEach(c => {
            if (c.id) costByClient[c.id] = { id: c.id, name: c.name, cost: 0 };
        });

        for (const assignmentId in allocations) {
            const assignment = assignments.find(a => a.id === assignmentId);
            if (!assignment) continue;

            const resource = resources.find(r => r.id === assignment.resourceId);
            const role = roles.find(ro => ro.id === resource?.roleId);
            const dailyRate = role?.dailyCost || 0;
            const project = projects.find(p => p.id === assignment.projectId);

            for (const dateStr in allocations[assignmentId]) {
                const allocDate = new Date(dateStr);
                const day = allocDate.getDay();

                if (allocDate >= firstDay && allocDate <= lastDay && day !== 0 && day !== 6 && !isHoliday(allocDate, resource?.location ?? null, companyCalendar)) {
                    const percentage = allocations[assignmentId][dateStr];
                    const personDayFraction = percentage / 100;
                    const dailyCost = personDayFraction * dailyRate;

                    totalCost += dailyCost;
                    totalPersonDays += personDayFraction;

                    const clientId = project?.clientId;
                    if (clientId && costByClient[clientId]) {
                        costByClient[clientId].cost += dailyCost;
                    }
                }
            }
        }

        const clientCostArray = Object.values(costByClient).filter(c => c.cost > 0).sort((a,b) => b.cost - a.cost);

        return { totalCost, totalPersonDays, clientCostArray };
    }, [allocations, assignments, resources, roles, projects, clients, companyCalendar]);

    // --- Calcoli per le Card di Analisi Dettagliata ---

    /**
     * @description Calcola l'allocazione media per risorsa per il mese corrente e il mese prossimo.
     */
    const averageAllocationData = useMemo(() => {
        const now = new Date();
        
        let results = resources.map(resource => {
            // Current month
            const currentMonthFirstDay = new Date(now.getFullYear(), now.getMonth(), 1);
            const currentMonthLastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            const workingDaysCurrentMonth = getWorkingDaysBetween(currentMonthFirstDay, currentMonthLastDay, companyCalendar, resource.location);

            // Next month
            const nextMonthFirstDay = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            const nextMonthLastDay = new Date(now.getFullYear(), now.getMonth() + 2, 0);
            const workingDaysNextMonth = getWorkingDaysBetween(nextMonthFirstDay, nextMonthLastDay, companyCalendar, resource.location);

            const resourceAssignments = assignments.filter(a => a.resourceId === resource.id);
            
            let totalPersonDaysCurrentMonth = 0;
            let totalPersonDaysNextMonth = 0;

            resourceAssignments.forEach(assignment => {
                const assignmentAllocations = allocations[assignment.id];
                if (assignmentAllocations) {
                    for (const dateStr in assignmentAllocations) {
                        const allocDate = new Date(dateStr);
                         if (isHoliday(allocDate, resource.location, companyCalendar)) continue;

                        const percentage = assignmentAllocations[dateStr];
                        const personDayFraction = percentage / 100;

                        if (allocDate >= currentMonthFirstDay && allocDate <= currentMonthLastDay) {
                            totalPersonDaysCurrentMonth += personDayFraction;
                        }
                        
                        if (allocDate >= nextMonthFirstDay && allocDate <= nextMonthLastDay) {
                            totalPersonDaysNextMonth += personDayFraction;
                        }
                    }
                }
            });

            const avgCurrentMonth = workingDaysCurrentMonth > 0 ? (totalPersonDaysCurrentMonth / workingDaysCurrentMonth) * 100 : 0;
            const avgNextMonth = workingDaysNextMonth > 0 ? (totalPersonDaysNextMonth / workingDaysNextMonth) * 100 : 0;
            
            const role = roles.find(r => r.id === resource?.roleId);

            return { resource, role, avgCurrentMonth, avgNextMonth };
        });

        if (avgAllocFilter.resourceId) {
            results = results.filter(item => item.resource?.id === avgAllocFilter.resourceId);
        }

        return results.sort((a, b) => a.resource!.name.localeCompare(b.resource!.name));

    }, [resources, assignments, allocations, roles, companyCalendar, avgAllocFilter]);


    /**
     * @description Calcola il Full-Time Equivalent (FTE) per progetto, filtrabile per cliente.
     */
    const fteData = useMemo(() => {
        return projects
            .filter(project => !fteFilter.clientId || project.clientId === fteFilter.clientId)
            .map(project => {
                if (!project.startDate || !project.endDate) return null;

                const client = clients.find(c => c.id === project.clientId);
                const projectStartDate = new Date(project.startDate);
                const projectEndDate = new Date(project.endDate);
                
                const projectAssignments = assignments.filter(a => a.projectId === project.id);
                let totalAllocatedDays = 0;
                // FTE is complex with per-resource holidays. We approximate using global holidays for project-level FTE.
                const projectWorkingDays = getWorkingDaysBetween(projectStartDate, projectEndDate, companyCalendar.filter(e => e.type !== 'LOCAL_HOLIDAY'));
                if (projectWorkingDays === 0) return { ...project, clientName: client?.name || 'N/A', fte: 0, totalAllocatedDays: 0, projectWorkingDays: 0 };


                projectAssignments.forEach(assignment => {
                     const resource = resources.find(r => r.id === assignment.resourceId);
                    const assignmentAllocations = allocations[assignment.id];
                    if(assignmentAllocations){
                        for (const dateStr in assignmentAllocations) {
                            const allocDate = new Date(dateStr);
                            // Assicura che l'allocazione sia un giorno lavorativo e rientri nel range del progetto
                            if (!isHoliday(allocDate, resource?.location ?? null, companyCalendar) && allocDate.getDay() !== 0 && allocDate.getDay() !== 6 && allocDate >= projectStartDate && allocDate <= projectEndDate) {
                                totalAllocatedDays += (assignmentAllocations[dateStr] / 100);
                            }
                        }
                    }
                });

                const fte = projectWorkingDays > 0 ? (totalAllocatedDays / projectWorkingDays) : 0;

                return { ...project, clientName: client?.name || 'N/A', fte, totalAllocatedDays, projectWorkingDays };
            }).filter(Boolean);
    }, [projects, assignments, allocations, clients, resources, companyCalendar, fteFilter]);

    /**
     * @description Esegue un'analisi dei costi per progetto, filtrabile per cliente.
     */
    const budgetAnalysisData = useMemo(() => {
        return projects
            .filter(project => !budgetFilter.clientId || project.clientId === budgetFilter.clientId)
            .map(project => {
                let rawEstimatedCost = 0;
                const projectAssignments = assignments.filter(a => a.projectId === project.id);

                projectAssignments.forEach(assignment => {
                    const resource = resources.find(r => r.id === assignment.resourceId);
                    const role = roles.find(ro => ro.id === resource?.roleId);
                    const dailyRate = role?.dailyCost || 0;

                    const assignmentAllocations = allocations[assignment.id];
                    let allocatedPersonDays = 0;
                    if (assignmentAllocations) {
                        for (const dateStr in assignmentAllocations) {
                             const allocDate = new Date(dateStr);
                             const day = allocDate.getDay();
                              if (day !== 0 && day !== 6 && !isHoliday(allocDate, resource?.location ?? null, companyCalendar)) {
                                allocatedPersonDays += (assignmentAllocations[dateStr] / 100);
                            }
                        }
                    }
                    rawEstimatedCost += allocatedPersonDays * dailyRate;
                });
                
                const projectBudget = Number(project.budget || 0);
                const estimatedCost = rawEstimatedCost * (Number(project.realizationPercentage || 100) / 100);
                const variance = projectBudget - estimatedCost;

                return { ...project, fullBudget: projectBudget, estimatedCost, variance };
            }).sort((a,b) => a.name.localeCompare(b.name));
    }, [projects, assignments, allocations, resources, roles, companyCalendar, budgetFilter]);

    /**
     * @description Identifica le risorse sottoutilizzate in un mese specifico (selezionabile).
     */
    const underutilizedResourcesData = useMemo(() => {
        const [year, month] = underutilizedFilter.split('-').map(Number);
        const firstDay = new Date(year, month - 1, 1);
        const lastDay = new Date(year, month, 0);

        return resources.map(resource => {
             const workingDaysInMonth = getWorkingDaysBetween(firstDay, lastDay, companyCalendar, resource.location);
             if (workingDaysInMonth === 0) return { ...resource, avgAllocation: 0, role: roles.find(r => r.id === resource.roleId)?.name || 'N/A' };

            const resourceAssignments = assignments.filter(a => a.resourceId === resource.id);
            let totalPersonDays = 0;
            resourceAssignments.forEach(assignment => {
                const assignmentAllocations = allocations[assignment.id];
                if (assignmentAllocations) {
                    for (const dateStr in assignmentAllocations) {
                        const allocDate = new Date(dateStr);
                         if (allocDate >= firstDay && allocDate <= lastDay && !isHoliday(allocDate, resource.location, companyCalendar)) {
                            totalPersonDays += (assignmentAllocations[dateStr] / 100);
                        }
                    }
                }
            });
            const avgAllocation = Math.round((totalPersonDays / workingDaysInMonth) * 100);
            return {
                ...resource, avgAllocation, role: roles.find(r => r.id === resource.roleId)?.name || 'N/A'
            };
        })
        .filter(r => r.avgAllocation < 100)
        .sort((a,b) => a.avgAllocation - b.avgAllocation);
    }, [resources, assignments, allocations, roles, companyCalendar, underutilizedFilter]);
    
    /**
     * @description Aggrega sforzo e budget per cliente, filtrabile per settore.
     */
    const effortByClientData = useMemo(() => {
        const clientData: { [clientId: string]: { id: string, name: string, projectCount: number, totalPersonDays: number, totalBudget: number } } = {};
        
        clients
            .filter(c => !effortByClientFilter.sector || c.sector === effortByClientFilter.sector)
            .forEach(client => {
                 if (client.id) clientData[client.id] = { id: client.id, name: client.name, projectCount: 0, totalPersonDays: 0, totalBudget: 0 };
            });

        projects.forEach(project => {
            if (project.clientId && clientData[project.clientId]) {
                if(project.status === 'In corso') clientData[project.clientId].projectCount++;
                clientData[project.clientId].totalBudget += Number(project.budget || 0);

                const projectAssignments = assignments.filter(a => a.projectId === project.id);
                let projectPersonDays = 0;
                projectAssignments.forEach(assignment => {
                     const resource = resources.find(r => r.id === assignment.resourceId);
                    const assignmentAllocations = allocations[assignment.id];
                    if (assignmentAllocations) {
                         for (const dateStr in assignmentAllocations) {
                            const allocDate = new Date(dateStr);
                            const day = allocDate.getDay();
                             if (day !== 0 && day !== 6 && !isHoliday(allocDate, resource?.location ?? null, companyCalendar)) {
                                projectPersonDays += (assignmentAllocations[dateStr] / 100);
                            }
                        }
                    }
                });
                clientData[project.clientId].totalPersonDays += projectPersonDays;
            }
        });

        return Object.values(clientData).sort((a,b) => b.totalBudget - a.totalBudget);
    }, [clients, projects, assignments, allocations, resources, companyCalendar, effortByClientFilter]);

    /**
     * @description Aggrega i dati di sforzo (giorni-uomo) per "horizontal".
     */
    const effortByHorizontalData = useMemo(() => {
        const horizontalData: { [key: string]: number } = {};
        
        assignments.forEach(assignment => {
            const resource = resources.find(r => r.id === assignment.resourceId);
            if (resource) {
                const horizontal = resource.horizontal;
                if (!horizontalData[horizontal]) horizontalData[horizontal] = 0;
                
                const assignmentAllocations = allocations[assignment.id];
                let personDays = 0;
                if (assignmentAllocations) {
                    for (const dateStr in assignmentAllocations) {
                        const allocDate = new Date(dateStr);
                        const day = allocDate.getDay();
                         if (day !== 0 && day !== 6 && !isHoliday(allocDate, resource.location, companyCalendar)) {
                           personDays += (assignmentAllocations[dateStr] / 100);
                        }
                    }
                }
                horizontalData[horizontal] += personDays;
            }
        });

        return Object.entries(horizontalData)
            .map(([name, totalPersonDays]) => ({ name, totalPersonDays }))
            .sort((a,b) => b.totalPersonDays - a.totalPersonDays);
    }, [assignments, allocations, resources, companyCalendar]);

    /**
     * @description Aggrega i dati di analisi per Sede (Mese Corrente).
     */
    const analysisByLocationData = useMemo(() => {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        const locationData: { [location: string]: { resourceCount: number, personDays: number, availablePersonDays: number } } = {};

        locations.forEach(loc => {
            locationData[loc.value] = { resourceCount: 0, personDays: 0, availablePersonDays: 0 };
        });
        resources.forEach(res => {
            if (res.location && !locationData[res.location]) {
                locationData[res.location] = { resourceCount: 0, personDays: 0, availablePersonDays: 0 };
            }
        });
        
        resources.forEach(resource => {
            if(resource.location) {
                locationData[resource.location].resourceCount++;
                locationData[resource.location].availablePersonDays += getWorkingDaysBetween(firstDay, lastDay, companyCalendar, resource.location);
            }
        });

        assignments.forEach(assignment => {
            const resource = resources.find(r => r.id === assignment.resourceId);
            if (resource && resource.location) {
                const assignmentAllocations = allocations[assignment.id];
                if (assignmentAllocations) {
                    for (const dateStr in assignmentAllocations) {
                        const allocDate = new Date(dateStr);
                        if (allocDate >= firstDay && allocDate <= lastDay) {
                             if (!isHoliday(allocDate, resource.location, companyCalendar) && allocDate.getDay() !== 0 && allocDate.getDay() !== 6) {
                                locationData[resource.location].personDays += (assignmentAllocations[dateStr] / 100);
                            }
                        }
                    }
                }
            }
        });

        return Object.entries(locationData)
            .map(([locationName, data]) => {
                const utilization = data.availablePersonDays > 0 ? (data.personDays / data.availablePersonDays) * 100 : 0;
                return {
                    locationName,
                    resourceCount: data.resourceCount,
                    personDays: data.personDays,
                    utilization
                };
            })
            .filter(d => d.resourceCount > 0)
            .sort((a, b) => b.resourceCount - a.resourceCount);
    }, [resources, assignments, allocations, locations, companyCalendar]);

    // --- Totali per le tabelle ---
    const fteTotals = useMemo(() => {
        const totalDays = fteData.reduce((sum, d) => sum + d.totalAllocatedDays, 0);
        const totalWorkingDays = fteData.reduce((sum, d) => sum + d.projectWorkingDays, 0);
        const avgFte = totalWorkingDays > 0 ? totalDays / totalWorkingDays : 0;
        return { totalDays, avgFte };
    }, [fteData]);
    const budgetTotals = useMemo(() => budgetAnalysisData.reduce((acc, p) => ({ budget: acc.budget + p.fullBudget, cost: acc.cost + p.estimatedCost, variance: acc.variance + p.variance }), { budget: 0, cost: 0, variance: 0 }), [budgetAnalysisData]);
    const effortByClientTotals = useMemo(() => effortByClientData.reduce((acc, c) => ({ days: acc.days + c.totalPersonDays, budget: acc.budget + c.totalBudget }), { days: 0, budget: 0 }), [effortByClientData]);
    const effortByHorizontalTotal = useMemo(() => effortByHorizontalData.reduce((sum, h) => sum + h.totalPersonDays, 0), [effortByHorizontalData]);
    const avgAllocationTotals = useMemo(() => {
        if (averageAllocationData.length === 0) {
            return { currentMonth: 0, nextMonth: 0 };
        }
        const totalCurrent = averageAllocationData.reduce((sum, d) => sum + d.avgCurrentMonth, 0);
        const totalNext = averageAllocationData.reduce((sum, d) => sum + d.avgNextMonth, 0);
        return {
            currentMonth: totalCurrent / averageAllocationData.length,
            nextMonth: totalNext / averageAllocationData.length,
        };
    }, [averageAllocationData]);

    /**
     * Determina il colore del testo per l'allocazione media.
     * @param {number} avg - La percentuale di allocazione.
     * @returns {string} La classe CSS per il colore.
     */
    const getAvgAllocationColor = (avg: number): string => {
        if (avg > 90) return 'text-red-600 dark:text-red-400 font-bold';
        if (avg >= 70) return 'text-yellow-600 dark:text-yellow-400 font-semibold';
        return 'text-green-600 dark:text-green-400';
    };

    const resourceOptions = useMemo(() => resources.map(r => ({ value: r.id!, label: r.name })), [resources]);
    const clientOptions = useMemo(() => clients.map(c => ({ value: c.id!, label: c.name })), [clients]);
    const sectorOptions = useMemo(() => clientSectors.map(s => ({ value: s.value, label: s.value })), [clientSectors]);

    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-8">Dashboard</h1>
            
            {/* Nuove Card Aggregate */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5">
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Budget Complessivo</h3>
                    <p className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">{formatCurrency(overallKPIs.totalBudget)}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5">
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Costo Stimato (Mese Corrente)</h3>
                    <p className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">{formatCurrency(currentMonthKPIs.totalCost)}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5">
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Giorni Allocati (Mese Corrente)</h3>
                    <p className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">{currentMonthKPIs.totalPersonDays.toLocaleString('it-IT', { maximumFractionDigits: 0 })}</p>
                </div>

                <div 
                    className="bg-amber-100 dark:bg-amber-900/50 rounded-lg shadow p-5 flex flex-col justify-start cursor-pointer hover:bg-amber-200 dark:hover:bg-amber-900/80 min-h-[150px]"
                    onClick={() => navigate('/resources?filter=unassigned')}
                >
                    <div className="flex justify-between items-start w-full">
                        <div>
                            <h3 className="text-sm font-medium text-amber-800 dark:text-amber-200">Risorse Non Allocate</h3>
                            <p className="mt-1 text-3xl font-semibold text-amber-900 dark:text-amber-100">{overallKPIs.unassignedResources.length}</p>
                        </div>
                        <UsersIcon className="w-8 h-8 text-amber-600 dark:text-amber-400 opacity-50"/>
                    </div>
                    {overallKPIs.unassignedResources.length > 0 && (
                        <div className="mt-2 text-xs text-amber-800 dark:text-amber-200 overflow-y-auto max-h-20 pr-2 w-full">
                            <ul className="list-disc list-inside">
                                {overallKPIs.unassignedResources.map(r => <li key={r.id} className="truncate">{r.name}</li>)}
                            </ul>
                        </div>
                    )}
                </div>
                 <div 
                    className="bg-amber-100 dark:bg-amber-900/50 rounded-lg shadow p-5 flex flex-col justify-start cursor-pointer hover:bg-amber-200 dark:hover:bg-amber-900/80 min-h-[150px]"
                    onClick={() => navigate('/projects?filter=unstaffed')}
                >
                    <div className="flex justify-between items-start w-full">
                        <div>
                            <h3 className="text-sm font-medium text-amber-800 dark:text-amber-200">Progetti Senza Staff</h3>
                            <p className="mt-1 text-3xl font-semibold text-amber-900 dark:text-amber-100">{overallKPIs.unstaffedProjects.length}</p>
                        </div>
                        <BriefcaseIcon className="w-8 h-8 text-amber-600 dark:text-amber-400 opacity-50"/>
                    </div>
                     {overallKPIs.unstaffedProjects.length > 0 && (
                        <div className="mt-2 text-xs text-amber-800 dark:text-amber-200 overflow-y-auto max-h-20 pr-2 w-full">
                            <ul className="list-disc list-inside">
                                {overallKPIs.unstaffedProjects.map(p => <li key={p.id} className="truncate">{p.name}</li>)}
                            </ul>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Card Allocazione Media */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <div className="flex justify-between items-start mb-4">
                        <h2 className="text-xl font-semibold">Allocazione Media</h2>
                        <div className="w-48"><SearchableSelect name="resourceId" value={avgAllocFilter.resourceId} onChange={(_, v) => setAvgAllocFilter({ resourceId: v })} options={resourceOptions} placeholder="Tutte le Risorse"/></div>
                    </div>
                    <div className="overflow-y-auto max-h-96">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                                <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Risorsa</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Alloc. Mese Corrente</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Alloc. Mese Prossimo</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {averageAllocationData.map((data, index) => (
                                <tr key={index}>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm">
                                        <div><Link to={`/workload?resourceId=${data.resource.id}`} className="text-blue-600 hover:underline">{data.resource?.name}</Link></div>
                                        <div className="text-xs text-gray-500">{data.role?.name}</div>
                                    </td>
                                    <td className={`px-4 py-2 whitespace-nowrap text-sm ${getAvgAllocationColor(data.avgCurrentMonth)}`}>
                                        {data.avgCurrentMonth.toLocaleString('it-IT', { maximumFractionDigits: 0 })}%
                                    </td>
                                    <td className={`px-4 py-2 whitespace-nowrap text-sm ${getAvgAllocationColor(data.avgNextMonth)}`}>
                                        {data.avgNextMonth.toLocaleString('it-IT', { maximumFractionDigits: 0 })}%
                                    </td>
                                </tr>
                                ))}
                            </tbody>
                             <tfoot>
                                 <tr className="bg-gray-100 dark:bg-gray-700 font-bold">
                                     <td className="px-4 py-2 text-left text-sm">Media Totale</td>
                                     <td className={`px-4 py-2 whitespace-nowrap text-sm ${getAvgAllocationColor(avgAllocationTotals.currentMonth)}`}>
                                        {avgAllocationTotals.currentMonth.toLocaleString('it-IT', { maximumFractionDigits: 0 })}%
                                     </td>
                                     <td className={`px-4 py-2 whitespace-nowrap text-sm ${getAvgAllocationColor(avgAllocationTotals.nextMonth)}`}>
                                        {avgAllocationTotals.nextMonth.toLocaleString('it-IT', { maximumFractionDigits: 0 })}%
                                     </td>
                                 </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                {/* Card FTE per Progetto */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                     <div className="flex justify-between items-start mb-4"><h2 className="text-xl font-semibold">FTE per Progetto</h2><div className="w-48"><SearchableSelect name="clientId" value={fteFilter.clientId} onChange={(_, v) => setFteFilter({ clientId: v })} options={clientOptions} placeholder="Tutti i Clienti"/></div></div>
                     <div className="overflow-y-auto max-h-96">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0"><tr><th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Progetto</th><th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Giorni Alloc.</th><th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">FTE</th></tr></thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">{fteData.map((data) => data && (<tr key={data.id}><td className="px-4 py-2 whitespace-nowrap text-sm"><div><Link to={`/projects?projectId=${data.id}`} className="text-blue-600 hover:underline">{data.name}</Link></div><div className="text-xs text-gray-500">{data.clientName}</div></td><td className="px-4 py-2 whitespace-nowrap text-sm text-center">{data.totalAllocatedDays.toLocaleString('it-IT', { maximumFractionDigits: 1 })}</td><td className="px-4 py-2 whitespace-nowrap text-sm text-center font-bold text-blue-600 dark:text-blue-400">{data.fte.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td></tr>))}</tbody>
                             <tfoot><tr className="bg-gray-100 dark:bg-gray-700 font-bold"><td className="px-4 py-2 text-left text-sm">Totale / Media FTE</td><td className="px-4 py-2 text-center text-sm">{fteTotals.totalDays.toLocaleString('it-IT', { maximumFractionDigits: 1 })}</td><td className="px-4 py-2 text-center text-sm">{fteTotals.avgFte.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td></tr></tfoot>
                        </table>
                    </div>
                </div>

                {/* Card Analisi Budget */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <div className="flex justify-between items-start mb-4"><h2 className="text-xl font-semibold">Analisi Budget</h2><div className="w-48"><SearchableSelect name="clientId" value={budgetFilter.clientId} onChange={(_, v) => setBudgetFilter({ clientId: v })} options={clientOptions} placeholder="Tutti i Clienti"/></div></div>
                    <div className="overflow-y-auto max-h-96">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0"><tr><th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Progetto</th><th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Budget</th><th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Costo Stimato</th><th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Varianza</th></tr></thead>
                             <tbody className="divide-y divide-gray-200 dark:divide-gray-700">{budgetAnalysisData.map(p => (<tr key={p.id}><td className="px-4 py-2 whitespace-nowrap text-sm font-medium"><Link to={`/projects?projectId=${p.id}`} className="text-blue-600 hover:underline">{p.name}</Link></td><td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{formatCurrency(p.fullBudget)}</td><td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{formatCurrency(p.estimatedCost)}</td><td className={`px-4 py-2 whitespace-nowrap text-sm font-semibold ${p.variance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{formatCurrency(p.variance)}</td></tr>))}</tbody>
                             <tfoot><tr className="bg-gray-100 dark:bg-gray-700 font-bold"><td className="px-4 py-2 text-left text-sm">Totali</td><td className="px-4 py-2 text-sm">{formatCurrency(budgetTotals.budget)}</td><td className="px-4 py-2 text-sm">{formatCurrency(budgetTotals.cost)}</td><td className={`px-4 py-2 text-sm ${budgetTotals.variance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{formatCurrency(budgetTotals.variance)}</td></tr></tfoot>
                        </table>
                    </div>
                </div>

                {/* Card Risorse Sottoutilizzate */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <div className="flex justify-between items-start mb-4"><h2 className="text-xl font-semibold">Risorse Sottoutilizzate</h2><input type="month" value={underutilizedFilter} onChange={(e) => setUnderutilizedFilter(e.target.value)} className="form-input text-sm py-1 w-48"/></div>
                    <div className="overflow-y-auto max-h-96">
                         <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                             <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0"><tr><th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Risorsa</th><th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Alloc. Media</th></tr></thead>
                             <tbody className="divide-y divide-gray-200 dark:divide-gray-700">{underutilizedResourcesData.map(r => (<tr key={r.id}><td className="px-4 py-2 whitespace-nowrap text-sm"><div><Link to={`/workload?resourceId=${r.id}`} className="text-blue-600 hover:underline">{r.name}</Link></div><div className="text-xs text-gray-500">{r.role}</div></td><td className="px-4 py-2 whitespace-nowrap text-sm text-yellow-600 dark:text-yellow-400 font-semibold">{r.avgAllocation.toLocaleString('it-IT')}%</td></tr>))}</tbody>
                         </table>
                    </div>
                </div>

                {/* Card Sforzo per Cliente */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                     <div className="flex justify-between items-start mb-4"><h2 className="text-xl font-semibold">Analisi Sforzo per Cliente</h2><div className="w-48"><SearchableSelect name="sector" value={effortByClientFilter.sector} onChange={(_, v) => setEffortByClientFilter({ sector: v })} options={sectorOptions} placeholder="Tutti i Settori"/></div></div>
                     <div className="overflow-y-auto max-h-96">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0"><tr><th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Cliente</th><th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Giorni-Uomo</th><th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Valore Budget</th></tr></thead>
                             <tbody className="divide-y divide-gray-200 dark:divide-gray-700">{effortByClientData.map(c => (<tr key={c.name}><td className="px-4 py-2 whitespace-nowrap text-sm font-medium"><Link to={`/projects?clientId=${c.id}`} className="text-blue-600 hover:underline">{c.name}</Link></td><td className="px-4 py-2 whitespace-nowrap text-sm text-center">{c.totalPersonDays.toLocaleString('it-IT', { maximumFractionDigits: 0 })}</td><td className="px-4 py-2 whitespace-nowrap text-sm">{formatCurrency(c.totalBudget)}</td></tr>))}</tbody>
                             <tfoot><tr className="bg-gray-100 dark:bg-gray-700 font-bold"><td className="px-4 py-2 text-left text-sm">Totali</td><td className="px-4 py-2 text-center text-sm">{effortByClientTotals.days.toLocaleString('it-IT', { maximumFractionDigits: 0 })}</td><td className="px-4 py-2 text-sm">{formatCurrency(effortByClientTotals.budget)}</td></tr></tfoot>
                        </table>
                    </div>
                </div>

                {/* Card Costo Mensile per Cliente */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <h2 className="text-xl font-semibold mb-4">Costo Mensile per Cliente</h2>
                    <div className="overflow-y-auto max-h-96">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0"><tr><th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Cliente</th><th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Costo Stimato</th></tr></thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">{currentMonthKPIs.clientCostArray.map(c => (<tr key={c.name}><td className="px-4 py-2 whitespace-nowrap text-sm font-medium"><Link to={`/projects?clientId=${c.id}`} className="text-blue-600 hover:underline">{c.name}</Link></td><td className="px-4 py-2 whitespace-nowrap text-sm">{formatCurrency(c.cost)}</td></tr>))}</tbody>
                            <tfoot><tr className="bg-gray-100 dark:bg-gray-700 font-bold"><td className="px-4 py-2 text-left text-sm">Costo Totale Mese</td><td className="px-4 py-2 text-sm">{formatCurrency(currentMonthKPIs.totalCost)}</td></tr></tfoot>
                        </table>
                    </div>
                </div>

                {/* Card Sforzo per Horizontal */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <h2 className="text-xl font-semibold mb-4">Analisi Sforzo per Horizontal</h2>
                     <div className="overflow-y-auto max-h-96">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0"><tr><th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Horizontal</th><th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Giorni-Uomo</th></tr></thead>
                             <tbody className="divide-y divide-gray-200 dark:divide-gray-700">{effortByHorizontalData.map(h => (<tr key={h.name}><td className="px-4 py-2 whitespace-nowrap text-sm font-medium dark:text-white">{h.name}</td><td className="px-4 py-2 whitespace-nowrap text-sm text-center font-semibold">{h.totalPersonDays.toLocaleString('it-IT', { maximumFractionDigits: 0 })}</td></tr>))}</tbody>
                             <tfoot><tr className="bg-gray-100 dark:bg-gray-700 font-bold"><td className="px-4 py-2 text-left text-sm">Totale</td><td className="px-4 py-2 text-center text-sm">{effortByHorizontalTotal.toLocaleString('it-IT', { maximumFractionDigits: 0 })}</td></tr></tfoot>
                        </table>
                    </div>
                </div>

                {/* Card Analisi per Sede */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <h2 className="text-xl font-semibold mb-4">Analisi per Sede (Mese Corrente)</h2>
                    <div className="overflow-y-auto max-h-96">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                                <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Sede</th>
                                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Risorse</th>
                                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">G/U Allocati</th>
                                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Utilizzo Medio</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {analysisByLocationData.map(data => (
                                    <tr key={data.locationName}>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm font-medium dark:text-white">{data.locationName}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-center">{data.resourceCount}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-center">{data.personDays.toFixed(1)}</td>
                                        <td className={`px-4 py-2 whitespace-nowrap text-sm text-center font-semibold ${getAvgAllocationColor(data.utilization)}`}>
                                            {data.utilization.toFixed(0)}%
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
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

export default DashboardPage;