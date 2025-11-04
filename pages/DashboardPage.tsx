/**
 * @file DashboardPage.tsx
 * @description Pagina della dashboard che visualizza varie metriche e analisi aggregate sui dati di staffing.
 */

import React, { useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import DashboardCard from '../components/DashboardCard';
import DataTable, { DataTableColumn } from '../components/dashboard/DataTable';
import SearchableSelect from '../components/SearchableSelect';
import { useEntitiesContext, useAllocationsContext } from '../context/AppContext';
import { getWorkingDaysBetween, isHoliday } from '../utils/dateUtils';

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

    const activeResources = useMemo(() => resources.filter(r => !r.resigned), [resources]);

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
             if (!resource) continue;

            for (const dateStr in allocations[assignmentId]) {
                const allocDate = new Date(dateStr);
                 if (resource.lastDayOfWork && dateStr > resource.lastDayOfWork) continue;

                const day = allocDate.getDay();
                 if (day !== 0 && day !== 6 && !isHoliday(allocDate, resource?.location ?? null, companyCalendar)) {
                    totalPersonDays += (allocations[assignmentId][dateStr] / 100);
                }
            }
        }
        
        const assignedResourceIds = new Set(assignments.map(a => a.resourceId));
        const unassignedResources = activeResources.filter(r => !assignedResourceIds.has(r.id!));

        const staffedProjectIds = new Set(assignments.map(a => a.projectId));
        const unstaffedProjects = projects.filter(p => p.status === 'In corso' && !staffedProjectIds.has(p.id!));


        return { totalBudget, totalPersonDays, unassignedResources, unstaffedProjects };
    }, [projects, allocations, assignments, resources, activeResources, companyCalendar]);

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
            if (!resource || resource.resigned) continue;
            
            const role = roles.find(ro => ro.id === resource?.roleId);
            const dailyRate = role?.dailyCost || 0;
            const project = projects.find(p => p.id === assignment.projectId);

            for (const dateStr in allocations[assignmentId]) {
                const allocDate = new Date(dateStr);
                const day = allocDate.getDay();
                
                if (resource.lastDayOfWork && dateStr > resource.lastDayOfWork) continue;

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
        
        let results = activeResources.map(resource => {
            // Current month
            const currentMonthFirstDay = new Date(now.getFullYear(), now.getMonth(), 1);
            const currentMonthLastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            const effectiveCurrentEnd = resource.lastDayOfWork && new Date(resource.lastDayOfWork) < currentMonthLastDay ? new Date(resource.lastDayOfWork) : currentMonthLastDay;
            const workingDaysCurrentMonth = getWorkingDaysBetween(currentMonthFirstDay, effectiveCurrentEnd, companyCalendar, resource.location);

            // Next month
            const nextMonthFirstDay = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            const nextMonthLastDay = new Date(now.getFullYear(), now.getMonth() + 2, 0);
            const effectiveNextEnd = resource.lastDayOfWork && new Date(resource.lastDayOfWork) < nextMonthLastDay ? new Date(resource.lastDayOfWork) : nextMonthLastDay;
            const workingDaysNextMonth = getWorkingDaysBetween(nextMonthFirstDay, effectiveNextEnd, companyCalendar, resource.location);

            const resourceAssignments = assignments.filter(a => a.resourceId === resource.id);
            
            let totalPersonDaysCurrentMonth = 0;
            let totalPersonDaysNextMonth = 0;

            resourceAssignments.forEach(assignment => {
                const assignmentAllocations = allocations[assignment.id];
                if (assignmentAllocations) {
                    for (const dateStr in assignmentAllocations) {
                        const allocDate = new Date(dateStr);
                         if (isHoliday(allocDate, resource.location, companyCalendar)) continue;
                         if (resource.lastDayOfWork && dateStr > resource.lastDayOfWork) continue;

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

    }, [activeResources, assignments, allocations, roles, companyCalendar, avgAllocFilter]);


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
                let projectWorkingDays = 0;

                projectAssignments.forEach(assignment => {
                     const resource = resources.find(r => r.id === assignment.resourceId);
                     if (!resource) return;

                     const effectiveStartDate = resource.hireDate && new Date(resource.hireDate) > projectStartDate ? new Date(resource.hireDate) : projectStartDate;
                     const effectiveEndDate = resource.lastDayOfWork && new Date(resource.lastDayOfWork) < projectEndDate ? new Date(resource.lastDayOfWork) : projectEndDate;

                     if(effectiveStartDate > effectiveEndDate) return;

                     projectWorkingDays += getWorkingDaysBetween(effectiveStartDate, effectiveEndDate, companyCalendar, resource.location);

                    const assignmentAllocations = allocations[assignment.id];
                    if(assignmentAllocations){
                        for (const dateStr in assignmentAllocations) {
                            const allocDate = new Date(dateStr);
                             if (resource.lastDayOfWork && dateStr > resource.lastDayOfWork) continue;
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
                    if (!resource) return;

                    const role = roles.find(ro => ro.id === resource?.roleId);
                    const dailyRate = role?.dailyCost || 0;

                    const assignmentAllocations = allocations[assignment.id];
                    let allocatedPersonDays = 0;
                    if (assignmentAllocations) {
                        for (const dateStr in assignmentAllocations) {
                            if (resource.lastDayOfWork && dateStr > resource.lastDayOfWork) continue;
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

        return activeResources.map(resource => {
             const effectiveLastDay = resource.lastDayOfWork && new Date(resource.lastDayOfWork) < lastDay ? new Date(resource.lastDayOfWork) : lastDay;
             if (firstDay > effectiveLastDay) return null;

             const workingDaysInMonth = getWorkingDaysBetween(firstDay, effectiveLastDay, companyCalendar, resource.location);
             if (workingDaysInMonth === 0) return { ...resource, avgAllocation: 0, role: roles.find(r => r.id === resource.roleId)?.name || 'N/A' };

            const resourceAssignments = assignments.filter(a => a.resourceId === resource.id);
            let totalPersonDays = 0;
            resourceAssignments.forEach(assignment => {
                const assignmentAllocations = allocations[assignment.id];
                if (assignmentAllocations) {
                    for (const dateStr in assignmentAllocations) {
                        const allocDate = new Date(dateStr);
                         if (allocDate >= firstDay && allocDate <= effectiveLastDay && !isHoliday(allocDate, resource.location, companyCalendar)) {
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
        .filter(Boolean)
        .filter((r): r is Exclude<typeof r, null> => r !== null)
        .filter(r => r.avgAllocation < 100)
        .sort((a,b) => a.avgAllocation - b.avgAllocation);
    }, [activeResources, assignments, allocations, roles, companyCalendar, underutilizedFilter]);
    
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
                     if (!resource) return;
                    const assignmentAllocations = allocations[assignment.id];
                    if (assignmentAllocations) {
                         for (const dateStr in assignmentAllocations) {
                            if (resource.lastDayOfWork && dateStr > resource.lastDayOfWork) continue;
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
                        if (resource.lastDayOfWork && dateStr > resource.lastDayOfWork) continue;
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
        activeResources.forEach(res => {
            if (res.location && !locationData[res.location]) {
                locationData[res.location] = { resourceCount: 0, personDays: 0, availablePersonDays: 0 };
            }
        });
        
        activeResources.forEach(resource => {
            if(resource.location) {
                locationData[resource.location].resourceCount++;
                const effectiveEnd = resource.lastDayOfWork && new Date(resource.lastDayOfWork) < lastDay ? new Date(resource.lastDayOfWork) : lastDay;
                if(firstDay > effectiveEnd) return;
                locationData[resource.location].availablePersonDays += getWorkingDaysBetween(firstDay, effectiveEnd, companyCalendar, resource.location);
            }
        });

        assignments.forEach(assignment => {
            const resource = activeResources.find(r => r.id === assignment.resourceId);
            if (resource && resource.location) {
                const assignmentAllocations = allocations[assignment.id];
                if (assignmentAllocations) {
                    for (const dateStr in assignmentAllocations) {
                        const allocDate = new Date(dateStr);
                         if (resource.lastDayOfWork && dateStr > resource.lastDayOfWork) continue;
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
    }, [activeResources, assignments, allocations, locations, companyCalendar]);

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

    const resourceOptions = useMemo(() => activeResources.map(r => ({ value: r.id!, label: r.name })), [activeResources]);
    const clientOptions = useMemo(() => clients.map(c => ({ value: c.id!, label: c.name })), [clients]);
    const sectorOptions = useMemo(() => clientSectors.map(s => ({ value: s.value, label: s.value })), [clientSectors]);

    const averageAllocationColumns: DataTableColumn<(typeof averageAllocationData)[number]>[] = [
        {
            key: 'resource',
            header: 'Risorsa',
            sortable: true,
            sortAccessor: item => item.resource?.name?.toLowerCase() ?? '',
            className: 'whitespace-nowrap',
            render: item => (
                <div className="flex flex-col gap-1">
                    <Link to={`/workload?resourceId=${item.resource?.id ?? ''}`} className="text-primary hover:underline">
                        {item.resource?.name}
                    </Link>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{item.role?.name ?? 'N/A'}</span>
                </div>
            )
        },
        {
            key: 'avgCurrentMonth',
            header: 'Alloc. Mese Corrente',
            sortable: true,
            sortAccessor: item => item.avgCurrentMonth,
            className: 'whitespace-nowrap',
            headerClassName: 'text-right md:text-left',
            render: item => (
                <span className={`font-semibold ${getAvgAllocationColor(item.avgCurrentMonth)}`}>
                    {item.avgCurrentMonth.toLocaleString('it-IT', { maximumFractionDigits: 0 })}%
                </span>
            )
        },
        {
            key: 'avgNextMonth',
            header: 'Alloc. Mese Prossimo',
            sortable: true,
            sortAccessor: item => item.avgNextMonth,
            className: 'whitespace-nowrap',
            headerClassName: 'text-right md:text-left',
            render: item => (
                <span className={`font-semibold ${getAvgAllocationColor(item.avgNextMonth)}`}>
                    {item.avgNextMonth.toLocaleString('it-IT', { maximumFractionDigits: 0 })}%
                </span>
            )
        }
    ];

    const fteColumns: DataTableColumn<(typeof fteData)[number]>[] = [
        {
            key: 'name',
            header: 'Progetto',
            sortable: true,
            sortAccessor: item => item?.name?.toLowerCase() ?? '',
            className: 'whitespace-nowrap',
            render: item => (
                <div className="flex flex-col gap-1">
                    <Link to={`/projects?projectId=${item?.id ?? ''}`} className="text-primary hover:underline">
                        {item?.name}
                    </Link>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{item?.clientName ?? 'N/A'}</span>
                </div>
            )
        },
        {
            key: 'totalAllocatedDays',
            header: 'Giorni Alloc.',
            sortable: true,
            sortAccessor: item => item?.totalAllocatedDays ?? 0,
            className: 'text-center whitespace-nowrap',
            render: item => item?.totalAllocatedDays.toLocaleString('it-IT', { maximumFractionDigits: 1 })
        },
        {
            key: 'fte',
            header: 'FTE',
            sortable: true,
            sortAccessor: item => item?.fte ?? 0,
            className: 'text-center font-bold text-primary dark:text-blue-400 whitespace-nowrap',
            render: item => item?.fte.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        }
    ];

    const budgetColumns: DataTableColumn<(typeof budgetAnalysisData)[number]>[] = [
        {
            key: 'name',
            header: 'Progetto',
            sortable: true,
            sortAccessor: item => item.name?.toLowerCase() ?? '',
            className: 'whitespace-nowrap font-medium',
            render: item => (
                <Link to={`/projects?projectId=${item.id ?? ''}`} className="text-primary hover:underline">
                    {item.name}
                </Link>
            )
        },
        {
            key: 'fullBudget',
            header: 'Budget',
            sortable: true,
            sortAccessor: item => item.fullBudget ?? 0,
            className: 'whitespace-nowrap text-gray-600 dark:text-gray-300',
            render: item => formatCurrency(item.fullBudget)
        },
        {
            key: 'estimatedCost',
            header: 'Costo Stimato',
            sortable: true,
            sortAccessor: item => item.estimatedCost ?? 0,
            className: 'whitespace-nowrap text-gray-600 dark:text-gray-300',
            render: item => formatCurrency(item.estimatedCost)
        },
        {
            key: 'variance',
            header: 'Varianza',
            sortable: true,
            sortAccessor: item => item.variance ?? 0,
            className: 'whitespace-nowrap font-semibold',
            render: item => (
                <span className={item.variance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                    {formatCurrency(item.variance)}
                </span>
            )
        }
    ];

    const underutilizedColumns: DataTableColumn<(typeof underutilizedResourcesData)[number]>[] = [
        {
            key: 'name',
            header: 'Risorsa',
            sortable: true,
            sortAccessor: item => item.name?.toLowerCase() ?? '',
            className: 'whitespace-nowrap',
            render: item => (
                <div className="flex flex-col gap-1">
                    <Link to={`/workload?resourceId=${item.id ?? ''}`} className="text-primary hover:underline">
                        {item.name}
                    </Link>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{item.role}</span>
                </div>
            )
        },
        {
            key: 'avgAllocation',
            header: 'Alloc. Media',
            sortable: true,
            sortAccessor: item => item.avgAllocation ?? 0,
            className: 'whitespace-nowrap font-semibold text-yellow-600 dark:text-yellow-400',
            render: item => `${item.avgAllocation.toLocaleString('it-IT')}%`
        }
    ];

    const effortByClientColumns: DataTableColumn<(typeof effortByClientData)[number]>[] = [
        {
            key: 'name',
            header: 'Cliente',
            sortable: true,
            sortAccessor: item => item.name?.toLowerCase() ?? '',
            className: 'whitespace-nowrap font-medium',
            render: item => (
                <Link to={`/projects?clientId=${item.id ?? ''}`} className="text-primary hover:underline">
                    {item.name}
                </Link>
            )
        },
        {
            key: 'totalPersonDays',
            header: 'Giorni-Uomo',
            sortable: true,
            sortAccessor: item => item.totalPersonDays ?? 0,
            className: 'whitespace-nowrap text-center',
            render: item => item.totalPersonDays.toLocaleString('it-IT', { maximumFractionDigits: 0 })
        },
        {
            key: 'totalBudget',
            header: 'Valore Budget',
            sortable: true,
            sortAccessor: item => item.totalBudget ?? 0,
            className: 'whitespace-nowrap',
            render: item => formatCurrency(item.totalBudget)
        }
    ];

    const clientCostColumns: DataTableColumn<(typeof currentMonthKPIs.clientCostArray)[number]>[] = [
        {
            key: 'name',
            header: 'Cliente',
            sortable: true,
            sortAccessor: item => item.name?.toLowerCase() ?? '',
            className: 'whitespace-nowrap font-medium',
            render: item => (
                <Link to={`/projects?clientId=${item.id ?? ''}`} className="text-primary hover:underline">
                    {item.name}
                </Link>
            )
        },
        {
            key: 'cost',
            header: 'Costo Stimato',
            sortable: true,
            sortAccessor: item => item.cost ?? 0,
            className: 'whitespace-nowrap',
            render: item => formatCurrency(item.cost)
        }
    ];

    const effortByHorizontalColumns: DataTableColumn<(typeof effortByHorizontalData)[number]>[] = [
        {
            key: 'name',
            header: 'Horizontal',
            sortable: true,
            sortAccessor: item => item.name?.toLowerCase() ?? '',
            className: 'whitespace-nowrap font-medium',
            render: item => item.name
        },
        {
            key: 'totalPersonDays',
            header: 'Giorni-Uomo',
            sortable: true,
            sortAccessor: item => item.totalPersonDays ?? 0,
            className: 'whitespace-nowrap text-center',
            render: item => item.totalPersonDays.toLocaleString('it-IT', { maximumFractionDigits: 0 })
        }
    ];

    const locationColumns: DataTableColumn<(typeof analysisByLocationData)[number]>[] = [
        {
            key: 'locationName',
            header: 'Sede',
            sortable: true,
            sortAccessor: item => item.locationName?.toLowerCase() ?? '',
            className: 'whitespace-nowrap font-medium',
            render: item => item.locationName
        },
        {
            key: 'resourceCount',
            header: 'N. Risorse',
            sortable: true,
            sortAccessor: item => item.resourceCount ?? 0,
            className: 'whitespace-nowrap text-center',
            render: item => item.resourceCount
        },
        {
            key: 'personDays',
            header: 'G/U Allocati',
            sortable: true,
            sortAccessor: item => item.personDays ?? 0,
            className: 'whitespace-nowrap text-center',
            render: item => item.personDays.toFixed(1)
        },
        {
            key: 'utilization',
            header: 'Utilizzo Medio',
            sortable: true,
            sortAccessor: item => item.utilization ?? 0,
            className: 'whitespace-nowrap text-center font-semibold',
            render: item => (
                <span className={getAvgAllocationColor(item.utilization)}>
                    {item.utilization.toFixed(1)}%
                </span>
            )
        }
    ];

    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-8">Dashboard</h1>
            
            {/* Nuove Card Aggregate */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 mb-8">
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Budget Complessivo</h3>
                    <p className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">{formatCurrency(overallKPIs.totalBudget)}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Costo Stimato (Mese Corrente)</h3>
                    <p className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">{formatCurrency(currentMonthKPIs.totalCost)}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Giorni Allocati (Mese Corrente)</h3>
                    <p className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">{currentMonthKPIs.totalPersonDays.toLocaleString('it-IT', { maximumFractionDigits: 0 })}</p>
                </div>

                <div
                    className="bg-amber-100 dark:bg-amber-900/50 rounded-xl shadow p-6 flex flex-col justify-start cursor-pointer hover:bg-amber-200 dark:hover:bg-amber-900/80 min-h-[150px]"
                    onClick={() => navigate('/resources?filter=unassigned')}
                >
                    <div className="flex justify-between items-start w-full">
                        <div>
                            <h3 className="text-sm font-medium text-amber-800 dark:text-amber-200">Risorse Non Allocate</h3>
                            <p className="mt-1 text-3xl font-semibold text-amber-900 dark:text-amber-100">{overallKPIs.unassignedResources.length}</p>
                        </div>
                        <span className="text-3xl opacity-50">👥</span>
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
                    className="bg-amber-100 dark:bg-amber-900/50 rounded-xl shadow p-6 flex flex-col justify-start cursor-pointer hover:bg-amber-200 dark:hover:bg-amber-900/80 min-h-[150px]"
                    onClick={() => navigate('/projects?filter=unstaffed')}
                >
                    <div className="flex justify-between items-start w-full">
                        <div>
                            <h3 className="text-sm font-medium text-amber-800 dark:text-amber-200">Progetti Senza Staff</h3>
                            <p className="mt-1 text-3xl font-semibold text-amber-900 dark:text-amber-100">{overallKPIs.unstaffedProjects.length}</p>
                        </div>
                        <span className="text-3xl opacity-50">💼</span>
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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
                <DashboardCard
                    title="Allocazione Media"
                    actions={(
                        <div className="w-full md:w-48">
                            <SearchableSelect
                                name="resourceId"
                                value={avgAllocFilter.resourceId}
                                onChange={(_, v) => setAvgAllocFilter({ resourceId: v })}
                                options={resourceOptions}
                                placeholder="Tutte le Risorse"
                            />
                        </div>
                    )}
                >
                    <DataTable
                        data={averageAllocationData}
                        columns={averageAllocationColumns}
                        rowKey={(item, index) => item.resource?.id ?? item.resource?.name ?? `avg-${index}`}
                        initialSort={{ columnKey: 'resource' }}
                        footer={(
                            <tr className="font-semibold">
                                <td className="px-4 py-3 text-left">Media Totale</td>
                                <td className={`px-4 py-3 ${getAvgAllocationColor(avgAllocationTotals.currentMonth)}`}>
                                    {avgAllocationTotals.currentMonth.toLocaleString('it-IT', { maximumFractionDigits: 0 })}%
                                </td>
                                <td className={`px-4 py-3 ${getAvgAllocationColor(avgAllocationTotals.nextMonth)}`}>
                                    {avgAllocationTotals.nextMonth.toLocaleString('it-IT', { maximumFractionDigits: 0 })}%
                                </td>
                            </tr>
                        )}
                    />
                </DashboardCard>

                <DashboardCard
                    title="FTE per Progetto"
                    actions={(
                        <div className="w-full md:w-48">
                            <SearchableSelect
                                name="clientId"
                                value={fteFilter.clientId}
                                onChange={(_, v) => setFteFilter({ clientId: v })}
                                options={clientOptions}
                                placeholder="Tutti i Clienti"
                            />
                        </div>
                    )}
                >
                    <DataTable
                        data={fteData}
                        columns={fteColumns}
                        rowKey={(item, index) => item?.id ?? item?.name ?? `fte-${index}`}
                        initialSort={{ columnKey: 'name' }}
                        footer={(
                            <tr className="font-semibold">
                                <td className="px-4 py-3 text-left">Totale / Media FTE</td>
                                <td className="px-4 py-3 text-center">
                                    {fteTotals.totalDays.toLocaleString('it-IT', { maximumFractionDigits: 1 })}
                                </td>
                                <td className="px-4 py-3 text-center">
                                    {fteTotals.avgFte.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                            </tr>
                        )}
                    />
                </DashboardCard>

                <DashboardCard
                    title="Analisi Budget"
                    actions={(
                        <div className="w-full md:w-48">
                            <SearchableSelect
                                name="clientId"
                                value={budgetFilter.clientId}
                                onChange={(_, v) => setBudgetFilter({ clientId: v })}
                                options={clientOptions}
                                placeholder="Tutti i Clienti"
                            />
                        </div>
                    )}
                >
                    <DataTable
                        data={budgetAnalysisData}
                        columns={budgetColumns}
                        rowKey={(item, index) => item.id ?? `${item.name}-${index}`}
                        initialSort={{ columnKey: 'name' }}
                        footer={(
                            <tr className="font-semibold">
                                <td className="px-4 py-3 text-left">Totali</td>
                                <td className="px-4 py-3">{formatCurrency(budgetTotals.budget)}</td>
                                <td className="px-4 py-3">{formatCurrency(budgetTotals.cost)}</td>
                                <td className={`px-4 py-3 ${budgetTotals.variance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                    {formatCurrency(budgetTotals.variance)}
                                </td>
                            </tr>
                        )}
                    />
                </DashboardCard>

                <DashboardCard
                    title="Risorse Sottoutilizzate"
                    actions={(
                        <div className="w-full md:w-48">
                            <input
                                type="month"
                                value={underutilizedFilter}
                                onChange={(e) => setUnderutilizedFilter(e.target.value)}
                                className="form-input text-sm py-1 w-full"
                            />
                        </div>
                    )}
                >
                    <DataTable
                        data={underutilizedResourcesData}
                        columns={underutilizedColumns}
                        rowKey={(item, index) => item.id ?? `${item.name}-${index}`}
                        initialSort={{ columnKey: 'avgAllocation' }}
                    />
                </DashboardCard>

                <DashboardCard
                    title="Analisi Sforzo per Cliente"
                    actions={(
                        <div className="w-full md:w-48">
                            <SearchableSelect
                                name="sector"
                                value={effortByClientFilter.sector}
                                onChange={(_, v) => setEffortByClientFilter({ sector: v })}
                                options={sectorOptions}
                                placeholder="Tutti i Settori"
                            />
                        </div>
                    )}
                >
                    <DataTable
                        data={effortByClientData}
                        columns={effortByClientColumns}
                        rowKey={(item, index) => item.id ?? `${item.name}-${index}`}
                        initialSort={{ columnKey: 'totalBudget', direction: 'desc' }}
                        footer={(
                            <tr className="font-semibold">
                                <td className="px-4 py-3 text-left">Totali</td>
                                <td className="px-4 py-3 text-center">
                                    {effortByClientTotals.days.toLocaleString('it-IT', { maximumFractionDigits: 0 })}
                                </td>
                                <td className="px-4 py-3">{formatCurrency(effortByClientTotals.budget)}</td>
                            </tr>
                        )}
                    />
                </DashboardCard>

                <DashboardCard title="Costo Mensile per Cliente">
                    <DataTable
                        data={currentMonthKPIs.clientCostArray}
                        columns={clientCostColumns}
                        rowKey={(item, index) => item.id ?? `${item.name}-${index}`}
                        initialSort={{ columnKey: 'cost', direction: 'desc' }}
                        footer={(
                            <tr className="font-semibold">
                                <td className="px-4 py-3 text-left">Costo Totale Mese</td>
                                <td className="px-4 py-3">{formatCurrency(currentMonthKPIs.totalCost)}</td>
                            </tr>
                        )}
                    />
                </DashboardCard>

                <DashboardCard title="Analisi Sforzo per Horizontal">
                    <DataTable
                        data={effortByHorizontalData}
                        columns={effortByHorizontalColumns}
                        rowKey={(item, index) => item.name ?? `horizontal-${index}`}
                        initialSort={{ columnKey: 'totalPersonDays', direction: 'desc' }}
                        footer={(
                            <tr className="font-semibold">
                                <td className="px-4 py-3 text-left">Totale</td>
                                <td className="px-4 py-3 text-center">
                                    {effortByHorizontalTotal.toLocaleString('it-IT', { maximumFractionDigits: 0 })}
                                </td>
                            </tr>
                        )}
                    />
                </DashboardCard>

                <DashboardCard title="Analisi per Sede (Mese Corrente)">
                    <DataTable
                        data={analysisByLocationData}
                        columns={locationColumns}
                        rowKey={(item, index) => item.locationName ?? `location-${index}`}
                        initialSort={{ columnKey: 'resourceCount', direction: 'desc' }}
                    />
                </DashboardCard>
            </div>

            <style>{`.form-input, .form-select { display: block; width: 100%; border-radius: 0.375rem; border: 1px solid #D1D5DB; background-color: #FFFFFF; padding: 0.5rem 0.75rem; font-size: 0.875rem; line-height: 1.25rem; } .dark .form-input, .dark .form-select { border-color: #4B5563; background-color: #374151; color: #F9FAFB; }`}</style>
        </div>
    );
};

export default DashboardPage;