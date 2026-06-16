
/**
 * @file DashboardPage.tsx
 * @description Pagina della dashboard che visualizza varie metriche e analisi aggregate sui dati di staffing.
 */

import React, { useMemo, useState, useEffect } from 'react';
import { useAllocationsContext, useAppState } from '../context/AppContext';
import { useResourcesContext } from '../context/ResourcesContext';
import { useProjectsContext } from '../context/ProjectsContext';
import { useLookupContext } from '../context/LookupContext';
import { useUIConfigContext } from '../context/UIConfigContext';
import { getWorkingDaysBetween, isHoliday } from '../utils/dateUtils';
import { useNavigate } from 'react-router-dom';
import {
  DASHBOARD_CARDS_CONFIG,
} from '../config/dashboardLayout';
import {
  KpiHeaderCards,
  AttentionCards,
  UnallocatedFteCard,
  NoWbsLeakageCard,
  LeavesOverviewCard,
  AverageAllocationCard,
  FtePerProjectCard,
  BudgetAnalysisCard,
  TemporalBudgetAnalysisCard,
  AverageDailyRateCard,
  UnderutilizedResourcesCard,
  MonthlyClientCostCard,
  EffortByFunctionCard,
  EffortByIndustryCard,
  LocationAnalysisCard,
  SaturationTrendCard,
  CostForecastCard,
  AllocationMatrixCard,
  RevenueByIndustryCard,
  BenchByFunctionCard,
  BenchByIndustryCard,
  WbsSaturationCard,
  ContractExpirationsCard,
  RevenueMixCard,
  BillingPipelineCard,
  TopMarginProjectsCard,
} from './dashboard/DashboardCards';

const dateCache = new Map<string, Date>();
const parseISODate = (s: string): Date => {
  const cached = dateCache.get(s);
  if (cached) return cached;
  const d = new Date(s);
  dateCache.set(s, d);
  return d;
};


/**
 * Componente principale della pagina Dashboard.
 * Mostra una serie di "card" con analisi dei dati, ora renderizzate dinamicamente in base a una configurazione.
 */
const DashboardPage: React.FC = () => {
    const { resources, roles, getRoleCost } = useResourcesContext();
    const { projects, clients, assignments, getSellRate, contracts, rateCards, billingMilestones, projectExpenses } = useProjectsContext();
    const { functions, industries, locations, companyCalendar } = useLookupContext();
    const { dashboardLayout } = useUIConfigContext();
    const { loading } = useAppState();
    const { allocations } = useAllocationsContext();
    const navigate = useNavigate();

    // Tabs State
    const [activeTab, setActiveTab] = useState<string>('');

    // Set initial active tab once layout is loaded
    useEffect(() => {
        if (dashboardLayout.length > 0 && !activeTab) {
            setActiveTab(dashboardLayout[0].id);
        }
    }, [dashboardLayout, activeTab]);

    // Stati dei filtri per ogni card
    const [avgAllocFilter, setAvgAllocFilter] = useState({ resourceId: '' });
    const [fteFilter, setFteFilter] = useState({ clientId: '' });
    const [budgetFilter, setBudgetFilter] = useState({ clientId: '' });
    
    // Corrected UTC date initialization for filters
    const [temporalBudgetFilter, setTemporalBudgetFilter] = useState({
        clientId: '',
        startDate: new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString().slice(0, 10),
        endDate: new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 0)).toISOString().slice(0, 10),
    });
    const [avgDailyRateFilter, setAvgDailyRateFilter] = useState({
        clientId: '',
        startDate: new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString().slice(0, 10),
        endDate: new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 0)).toISOString().slice(0, 10),
    });
    
    const [underutilizedFilter, setUnderutilizedFilter] = useState(new Date().toISOString().slice(0, 7));
    const [trendResource, setTrendResource] = useState<string>('');

    const activeResources = useMemo(() => resources.filter(r => !r.resigned), [resources]);

    const overallKPIs = useMemo(() => {
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);

        // --- Resources ---
        const totalActiveResources = activeResources.length;
        const assignedResourceIds = new Set(assignments.map(a => a.resourceId));
        const unassignedResources = activeResources.filter(r => r.id && !assignedResourceIds.has(r.id) && r.maxStaffingPercentage > 0);

        // --- Projects ---
        const activeProjects = projects.filter(p => {
            if (p.endDate) {
                const endDate = new Date(p.endDate);
                if (endDate < today) {
                    return false;
                }
            }
            return true;
        });
        const totalActiveProjects = activeProjects.length;

        const unstaffedProjects = activeProjects.filter(p => {
            const isStaffed = assignments.some(a => a.projectId === p.id);
            return p.status === 'In corso' && !isStaffed;
        });

        const totalBudget = projects.reduce((sum, p) => sum + Number(p.budget || 0), 0);

        return {
            totalBudget,
            unassignedResources,
            totalActiveResources,
            unstaffedProjects,
            totalActiveProjects,
        };
    }, [projects, assignments, activeResources]);

    const currentMonthKPIs = useMemo(() => {
        const now = new Date();
        const firstDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
        const lastDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
        let totalCost = 0;
        let totalPersonDays = 0;
        const costByClient: { [clientId: string]: { id: string; name: string; cost: number } } = {};
        clients.forEach(c => { if(c.id) costByClient[c.id] = { id: c.id, name: c.name, cost: 0 }; });

        for (const assignment of assignments) {
            const resource = resources.find(r => r.id === assignment.resourceId);
            if (!resource || resource.resigned) continue;
            
            const project = projects.find(p => p.id === assignment.projectId);
            const realization = (project?.realizationPercentage ?? 100) / 100;

            const assignmentAllocations = allocations[assignment.id!];
            if (assignmentAllocations) {
                for (const dateStr in assignmentAllocations) {
                    const allocDate = parseISODate(dateStr);
                    if (allocDate >= firstDay && allocDate <= lastDay) {
                        if (!isHoliday(allocDate, resource.location, companyCalendar) && allocDate.getUTCDay() !== 0 && allocDate.getUTCDay() !== 6) {
                            const personDayFraction = (assignmentAllocations[dateStr] / 100);
                            
                            // Use historical cost
                            const dailyRate = getRoleCost(resource.roleId, allocDate);
                            
                            const dailyCost = personDayFraction * dailyRate * realization;
                            totalCost += dailyCost;
                            totalPersonDays += personDayFraction;
                            if (project?.clientId && costByClient[project.clientId]) {
                                costByClient[project.clientId].cost += dailyCost;
                            }
                        }
                    }
                }
            }
        }
        
        const totalAvailableFTE = activeResources.reduce((sum, r) => sum + (r.maxStaffingPercentage / 100), 0);
        const workingDaysInMonth = getWorkingDaysBetween(firstDay, lastDay, companyCalendar, null);
        const totalAllocatedFTE = workingDaysInMonth > 0 ? totalPersonDays / workingDaysInMonth : 0;
        const unallocatedFTE = totalAvailableFTE - totalAllocatedFTE;

        return { 
            totalCost, 
            totalPersonDays, 
            clientCostArray: Object.values(costByClient).filter(c => c.cost > 0),
            unallocatedFTE,
            totalAvailableFTE
        };
    }, [assignments, resources, roles, projects, allocations, companyCalendar, clients, activeResources, getRoleCost]);

    const averageAllocationData = useMemo(() => {
        const filteredResources = avgAllocFilter.resourceId
            ? activeResources.filter(r => r.id === avgAllocFilter.resourceId)
            : activeResources;

        return filteredResources.map(resource => {
            const calculateAvgForMonth = (monthOffset: number) => {
                const now = new Date();
                const firstDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + monthOffset, 1));
                const lastDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + monthOffset + 1, 0));
                const workingDays = getWorkingDaysBetween(firstDay, lastDay, companyCalendar, resource.location);
                if (workingDays === 0) return 0;
                
                const resourceAssignments = assignments.filter(a => a.resourceId === resource.id);
                let totalPersonDays = 0;
                resourceAssignments.forEach(assignment => {
                    const assignmentAllocations = allocations[assignment.id!];
                    if(assignmentAllocations){
                        for(const dateStr in assignmentAllocations){
                            const allocDate = parseISODate(dateStr);
                            if(allocDate >= firstDay && allocDate <= lastDay && !isHoliday(allocDate, resource.location, companyCalendar) && allocDate.getUTCDay() !== 0 && allocDate.getUTCDay() !== 6){
                                totalPersonDays += (assignmentAllocations[dateStr] / 100);
                            }
                        }
                    }
                });
                return (totalPersonDays / workingDays) * 100;
            };

            return {
                id: resource.id,
                resource,
                currentMonth: calculateAvgForMonth(0),
                nextMonth: calculateAvgForMonth(1),
            };
        });
    }, [activeResources, assignments, allocations, companyCalendar, avgAllocFilter]);

    const fteData = useMemo(() => {
        const filteredProjects = fteFilter.clientId
            ? projects.filter(p => p.clientId === fteFilter.clientId)
            : projects;

        return filteredProjects.map(project => {
            if (!project.startDate || !project.endDate) return { ...project, totalPersonDays: 0, fte: 0 };
            
            const firstDay = parseISODate(project.startDate);
            const lastDay = parseISODate(project.endDate);
            const totalWorkingDays = getWorkingDaysBetween(firstDay, lastDay, companyCalendar, null);
            if (totalWorkingDays === 0) return { ...project, totalPersonDays: 0, fte: 0 };

            const projectAssignments = assignments.filter(a => a.projectId === project.id);
            let totalPersonDays = 0;
            projectAssignments.forEach(assignment => {
                const resource = resources.find(r => r.id === assignment.resourceId);
                if(!resource) return;

                const assignmentAllocations = allocations[assignment.id!];
                if (assignmentAllocations) {
                    for (const dateStr in assignmentAllocations) {
                        const allocDate = parseISODate(dateStr);
                        if (allocDate >= firstDay && allocDate <= lastDay && !isHoliday(allocDate, resource.location, companyCalendar) && allocDate.getUTCDay() !== 0 && allocDate.getUTCDay() !== 6) {
                            totalPersonDays += (assignmentAllocations[dateStr] / 100);
                        }
                    }
                }
            });

            return { ...project, totalPersonDays, fte: totalPersonDays / totalWorkingDays };
        }).filter(p => p.totalPersonDays > 0);
    }, [projects, assignments, allocations, companyCalendar, resources, fteFilter]);

    const budgetAnalysisData = useMemo(() => {
        const filteredProjects = budgetFilter.clientId
            ? projects.filter(p => p.clientId === budgetFilter.clientId)
            : projects;

        return filteredProjects.map(project => {
            const projectAssignments = assignments.filter(a => a.projectId === project.id);
            let estimatedCost = 0;
            projectAssignments.forEach(assignment => {
                const resource = resources.find(r => r.id === assignment.resourceId);
                if (!resource) return;
                
                const assignmentAllocations = allocations[assignment.id!];
                if (assignmentAllocations) {
                    for (const dateStr in assignmentAllocations) {
                        const allocDate = parseISODate(dateStr);
                         if (!isHoliday(allocDate, resource.location, companyCalendar) && allocDate.getUTCDay() !== 0 && allocDate.getUTCDay() !== 6) {
                            const dailyRate = getRoleCost(resource.roleId, allocDate);
                            estimatedCost += ((assignmentAllocations[dateStr] / 100) * dailyRate);
                        }
                    }
                }
            });
            const budget = Number(project.budget || 0);
            estimatedCost = estimatedCost * (project.realizationPercentage / 100);
            return { ...project, budget, estimatedCost, variance: budget - estimatedCost };
        });
    }, [projects, assignments, allocations, resources, roles, companyCalendar, budgetFilter, getRoleCost]);

    const temporalBudgetAnalysisData = useMemo(() => {
        const filteredProjects = temporalBudgetFilter.clientId
            ? projects.filter(p => p.clientId === temporalBudgetFilter.clientId)
            : projects;
    
        const filterStartDate = parseISODate(temporalBudgetFilter.startDate);
        const filterEndDate = parseISODate(temporalBudgetFilter.endDate);
        if (isNaN(filterStartDate.getTime()) || isNaN(filterEndDate.getTime())) {
            return []; 
        }
    
        return filteredProjects.map(project => {
            if (!project.startDate || !project.endDate || !project.budget) {
                return { ...project, name: project.name, periodBudget: 0, estimatedCost: 0, variance: 0 };
            }
    
            const projectStartDate = parseISODate(project.startDate);
            const projectEndDate = parseISODate(project.endDate);
            
            const totalProjectWorkingDays = getWorkingDaysBetween(projectStartDate, projectEndDate, companyCalendar, null);
            const dailyBudget = totalProjectWorkingDays > 0 ? project.budget / totalProjectWorkingDays : 0;
            
            const overlapStartDate = new Date(Math.max(projectStartDate.getTime(), filterStartDate.getTime()));
            const overlapEndDate = new Date(Math.min(projectEndDate.getTime(), filterEndDate.getTime()));
            
            let periodBudget = 0;
            if (overlapStartDate <= overlapEndDate) {
                const workingDaysInOverlap = getWorkingDaysBetween(overlapStartDate, overlapEndDate, companyCalendar, null);
                periodBudget = workingDaysInOverlap * dailyBudget;
            }
    
            const projectAssignments = assignments.filter(a => a.projectId === project.id);
            let estimatedCost = 0;
            projectAssignments.forEach(assignment => {
                const resource = resources.find(r => r.id === assignment.resourceId);
                if (!resource) return;
                
                const assignmentAllocations = allocations[assignment.id!];
                if (assignmentAllocations) {
                    for (const dateStr in assignmentAllocations) {
                        const allocDate = parseISODate(dateStr);
                        if (allocDate >= filterStartDate && allocDate <= filterEndDate) {
                             if (!isHoliday(allocDate, resource.location, companyCalendar) && allocDate.getUTCDay() !== 0 && allocDate.getUTCDay() !== 6) {
                                const dailyRate = getRoleCost(resource.roleId, allocDate);
                                estimatedCost += ((assignmentAllocations[dateStr] / 100) * dailyRate);
                            }
                        }
                    }
                }
            });
            estimatedCost = estimatedCost * (project.realizationPercentage / 100);
            
            const variance = periodBudget - estimatedCost;
    
            return { ...project, periodBudget, estimatedCost, variance };
        });
    }, [projects, assignments, allocations, resources, roles, companyCalendar, temporalBudgetFilter, getRoleCost]);

    const averageDailyRateData = useMemo(() => {
        const filteredProjects = avgDailyRateFilter.clientId
            ? projects.filter(p => p.clientId === avgDailyRateFilter.clientId)
            : projects;
    
        const filterStartDate = parseISODate(avgDailyRateFilter.startDate);
        const filterEndDate = parseISODate(avgDailyRateFilter.endDate);
        if (isNaN(filterStartDate.getTime()) || isNaN(filterEndDate.getTime())) {
            return [];
        }
    
        return filteredProjects.map(project => {
            const projectAssignments = assignments.filter(a => a.projectId === project.id);
            let totalCost = 0;
            let totalPersonDays = 0;
    
            projectAssignments.forEach(assignment => {
                const resource = resources.find(r => r.id === assignment.resourceId);
                if (!resource) return;
                
                const assignmentAllocations = allocations[assignment.id!];
                if (assignmentAllocations) {
                    const currentDate = new Date(filterStartDate);
                    while (currentDate.getTime() <= filterEndDate.getTime()) {
                        const dateStr = currentDate.toISOString().slice(0, 10);
                        if (assignmentAllocations[dateStr] && !isHoliday(currentDate, resource.location, companyCalendar) && currentDate.getUTCDay() !== 0 && currentDate.getUTCDay() !== 6) {
                            const personDayFraction = (assignmentAllocations[dateStr] / 100);
                            const dailyRate = getRoleCost(resource.roleId, currentDate);
                            
                            totalPersonDays += personDayFraction;
                            totalCost += personDayFraction * dailyRate * (project.realizationPercentage / 100);
                        }
                        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
                    }
                }
            });
    
            return {
                id: project.id,
                name: project.name,
                clientName: clients.find(c => c.id === project.clientId)?.name || 'N/A',
                totalPersonDays,
                totalCost,
                avgDailyRate: totalPersonDays > 0 ? totalCost / totalPersonDays : 0,
            };
        }).filter(p => p.totalPersonDays > 0);
    }, [projects, assignments, allocations, resources, roles, clients, companyCalendar, avgDailyRateFilter, getRoleCost]);
    
    const underutilizedResourcesData = useMemo(() => {
        const [year, monthNum] = underutilizedFilter.split('-').map(Number);
        const firstDay = new Date(Date.UTC(year, monthNum - 1, 1));
        const lastDay = new Date(Date.UTC(year, monthNum, 0));

        return activeResources.map(resource => {
            const workingDays = getWorkingDaysBetween(firstDay, lastDay, companyCalendar, resource.location);
            if (workingDays === 0) return { id: resource.id, resource, avgAllocation: 0 };
            
            const resourceAssignments = assignments.filter(a => a.resourceId === resource.id);
            let totalPersonDays = 0;
            resourceAssignments.forEach(assignment => {
                const assignmentAllocations = allocations[assignment.id!];
                if (assignmentAllocations) {
                    for (const dateStr in assignmentAllocations) {
                        const allocDate = parseISODate(dateStr);
                        if(allocDate >= firstDay && allocDate <= lastDay && !isHoliday(allocDate, resource.location, companyCalendar) && allocDate.getUTCDay() !== 0 && allocDate.getUTCDay() !== 6){
                           totalPersonDays += (assignmentAllocations[dateStr] / 100);
                        }
                    }
                }
            });
            return { id: resource.id, resource, avgAllocation: (totalPersonDays / workingDays) * 100 };
        }).filter(d => d.avgAllocation < 100);
    }, [activeResources, assignments, allocations, companyCalendar, underutilizedFilter]);

    const effortByFunctionData = useMemo(() => {
        const data: {[key: string]: number} = {};
        functions.forEach(h => data[h.value] = 0);

        assignments.forEach(assignment => {
            const resource = resources.find(r => r.id === assignment.resourceId);
            if(!resource || !resource.function || !data.hasOwnProperty(resource.function)) return;

            const assignmentAllocations = allocations[assignment.id!];
            if(assignmentAllocations) {
                for(const dateStr in assignmentAllocations) {
                    const allocDate = parseISODate(dateStr);
                     if (!isHoliday(allocDate, resource.location, companyCalendar) && allocDate.getUTCDay() !== 0 && allocDate.getUTCDay() !== 6) {
                        data[resource.function] += (assignmentAllocations[dateStr] / 100);
                    }
                }
            }
        });
        return Object.entries(data).map(([name, totalPersonDays]) => ({ id: name, name, totalPersonDays }));
    }, [functions, resources, assignments, allocations, companyCalendar]);

    const effortByIndustryData = useMemo(() => {
        const data: {[key: string]: number} = {};
        industries.forEach(i => data[i.value] = 0);

        assignments.forEach(assignment => {
            const resource = resources.find(r => r.id === assignment.resourceId);
            if(!resource || !resource.industry || !data.hasOwnProperty(resource.industry)) return;

            const assignmentAllocations = allocations[assignment.id!];
            if(assignmentAllocations) {
                for(const dateStr in assignmentAllocations) {
                    const allocDate = parseISODate(dateStr);
                     if (!isHoliday(allocDate, resource.location, companyCalendar) && allocDate.getUTCDay() !== 0 && allocDate.getUTCDay() !== 6) {
                        data[resource.industry] += (assignmentAllocations[dateStr] / 100);
                    }
                }
            }
        });
        return Object.entries(data).map(([name, totalPersonDays]) => ({ id: name, name, totalPersonDays }));
    }, [industries, resources, assignments, allocations, companyCalendar]);

    const analysisByLocationData = useMemo(() => {
        const now = new Date();
        const firstDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
        const lastDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));

        return locations.map(location => {
            const resourcesInLocation = activeResources.filter(r => r.location === location.value);
            const resourceCount = resourcesInLocation.length;
            
            let allocatedDays = 0;
            let availableDays = 0;

            resourcesInLocation.forEach(resource => {
                const workingDays = getWorkingDaysBetween(firstDay, lastDay, companyCalendar, resource.location);
                const staffingFactor = (resource.maxStaffingPercentage || 100) / 100;
                availableDays += workingDays * staffingFactor;

                const resourceAssignments = assignments.filter(a => a.resourceId === resource.id);
                resourceAssignments.forEach(assignment => {
                    const assignmentAllocations = allocations[assignment.id!];
                    if (assignmentAllocations) {
                        for (const dateStr in assignmentAllocations) {
                            const allocDate = parseISODate(dateStr);
                             if (allocDate >= firstDay && allocDate <= lastDay && !isHoliday(allocDate, resource.location, companyCalendar) && allocDate.getUTCDay() !== 0 && allocDate.getUTCDay() !== 6) {
                                allocatedDays += (assignmentAllocations[dateStr] / 100);
                            }
                        }
                    }
                });
            });

            return {
                id: location.value,
                name: location.value,
                resourceCount,
                allocatedDays,
                avgUtilization: availableDays > 0 ? (allocatedDays / availableDays) * 100 : 0,
            };
        });
    }, [locations, activeResources, assignments, allocations, companyCalendar]);
    
    const saturationTrendData = useMemo(() => {
        if (!trendResource) return [];
        const resource = resources.find(r => r.id === trendResource);
        if (!resource) return [];

        const data = [];
        const today = new Date();
        for (let i = -6; i <= 3; i++) {
            const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + i, 1));
            const firstDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
            const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));

            const workingDays = getWorkingDaysBetween(firstDay, lastDay, companyCalendar, resource.location);
            let totalPersonDays = 0;
            
            if (workingDays > 0) {
                const resourceAssignments = assignments.filter(a => a.resourceId === resource.id);
                resourceAssignments.forEach(assignment => {
                    const assignmentAllocations = allocations[assignment.id!];
                    if (assignmentAllocations) {
                        for (const dateStr in assignmentAllocations) {
                            const allocDate = parseISODate(dateStr);
                             if (allocDate >= firstDay && allocDate <= lastDay && !isHoliday(allocDate, resource.location, companyCalendar) && allocDate.getUTCDay() !== 0 && allocDate.getUTCDay() !== 6) {
                                totalPersonDays += (assignmentAllocations[dateStr] / 100);
                            }
                        }
                    }
                });
            }
            data.push({ month: date, value: workingDays > 0 ? (totalPersonDays / workingDays) * 100 : 0 });
        }
        return data;
    }, [trendResource, resources, assignments, allocations, companyCalendar]);
    
     const monthlyCostForecastData = useMemo(() => {
        const calculateCostForMonth = (monthOffset: number): number => {
            const now = new Date();
            const firstDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + monthOffset, 1));
            const lastDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + monthOffset + 1, 0));
            let totalCost = 0;
            
            for (const assignment of assignments) {
                const resource = activeResources.find(r => r.id === assignment.resourceId);
                if (!resource) continue;
                
                const project = projects.find(p => p.id === assignment.projectId);
                const realization = (project?.realizationPercentage ?? 100) / 100;
                
                const assignmentAllocations = allocations[assignment.id!];
                if (assignmentAllocations) {
                    for (const dateStr in assignmentAllocations) {
                        const allocDate = parseISODate(dateStr);
                        if (allocDate >= firstDay && allocDate <= lastDay && !isHoliday(allocDate, resource.location, companyCalendar) && allocDate.getUTCDay() !== 0 && allocDate.getUTCDay() !== 6) {
                            const dailyRate = getRoleCost(resource.roleId, allocDate);
                            totalCost += ((assignmentAllocations[dateStr] / 100) * dailyRate * realization);
                        }
                    }
                }
            }
            return totalCost;
        };

        const historicCosts = Array.from({ length: 6 }, (_, i) => calculateCostForMonth(-6 + i));
        const avgHistoricCost = historicCosts.reduce((a, b) => a + b, 0) / 6;

        const forecastData = [];
        for (let i = 0; i <= 3; i++) {
            const n = new Date();
            const date = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth() + i, 1));
            forecastData.push({
                month: date,
                historic: avgHistoricCost,
                forecast: calculateCostForMonth(i),
            });
        }
        return forecastData;

    }, [activeResources, assignments, allocations, roles, projects, companyCalendar, getRoleCost]);

    // --- New Data Logic ---
    const allocationMatrixData = useMemo(() => {
        const matrix: Record<string, Record<string, number>> = {}; // Func -> Industry -> FTE
        const now = new Date();
        const firstDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
        const lastDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
        const workingDaysInMonth = getWorkingDaysBetween(firstDay, lastDay, companyCalendar, null); // Approx without location

        // Init matrix
        functions.forEach(f => {
            matrix[f.value] = {};
            industries.forEach(i => matrix[f.value][i.value] = 0);
        });

        assignments.forEach(assignment => {
            const resource = resources.find(r => r.id === assignment.resourceId);
            if (!resource || !resource.function || !resource.industry) return;

            const assignmentAllocations = allocations[assignment.id!];
            if (assignmentAllocations) {
                let totalPersonDays = 0;
                for (const dateStr in assignmentAllocations) {
                    const allocDate = parseISODate(dateStr);
                    if (allocDate >= firstDay && allocDate <= lastDay) {
                        if (!isHoliday(allocDate, resource.location, companyCalendar) && allocDate.getUTCDay() !== 0 && allocDate.getUTCDay() !== 6) {
                            totalPersonDays += (assignmentAllocations[dateStr] / 100);
                        }
                    }
                }
                // Accumulate FTE
                if (workingDaysInMonth > 0) {
                     // Ensure keys exist (handling data dirtiness)
                    if (!matrix[resource.function]) matrix[resource.function] = {};
                    if (matrix[resource.function][resource.industry] === undefined) matrix[resource.function][resource.industry] = 0;
                    
                    matrix[resource.function][resource.industry] += (totalPersonDays / workingDaysInMonth);
                }
            }
        });
        
        return { 
            matrix, 
            functions: functions.map(f => f.value), 
            industries: industries.map(i => i.value) 
        };
    }, [assignments, resources, allocations, functions, industries, companyCalendar]);

    const revenueByIndustryData = useMemo(() => {
        const revenueMap: Record<string, number> = {};
        const now = new Date();
        const firstDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
        const lastDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));

        assignments.forEach(assignment => {
            const project = projects.find(p => p.id === assignment.projectId);
            const client = clients.find(c => c.id === project?.clientId);
            if (!client || !client.sector) return; // Use Client Sector as Industry proxy

            const resource = resources.find(r => r.id === assignment.resourceId);
            if (!resource) return;

            const contract = contracts.find(c => c.id === project?.contractId);
            const rateCardId = contract?.rateCardId;

            const assignmentAllocations = allocations[assignment.id!];
            if (assignmentAllocations) {
                 for (const dateStr in assignmentAllocations) {
                    const allocDate = parseISODate(dateStr);
                    if (allocDate >= firstDay && allocDate <= lastDay) {
                        if (!isHoliday(allocDate, resource.location, companyCalendar) && allocDate.getUTCDay() !== 0 && allocDate.getUTCDay() !== 6) {
                             const fraction = assignmentAllocations[dateStr] / 100;
                             const sellRate = getSellRate(rateCardId, resource.id!);
                             const revenue = fraction * sellRate;
                             
                             revenueMap[client.sector] = (revenueMap[client.sector] || 0) + revenue;
                        }
                    }
                }
            }
        });

        return Object.entries(revenueMap).map(([name, value]) => ({ name, value }));
    }, [assignments, projects, clients, resources, contracts, allocations, companyCalendar, getSellRate]);
    
    const benchData = useMemo(() => {
        const now = new Date();
        const firstDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
        const lastDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));

        const funcStats: Record<string, { capacity: number, allocated: number }> = {};
        const indStats: Record<string, { capacity: number, allocated: number }> = {};
        
        functions.forEach(f => funcStats[f.value] = { capacity: 0, allocated: 0 });
        industries.forEach(i => indStats[i.value] = { capacity: 0, allocated: 0 });

        activeResources.forEach(resource => {
             const workingDays = getWorkingDaysBetween(firstDay, lastDay, companyCalendar, resource.location);
             const capacity = workingDays * (resource.maxStaffingPercentage / 100);

             if (resource.function) {
                 if (!funcStats[resource.function]) funcStats[resource.function] = { capacity: 0, allocated: 0 };
                 funcStats[resource.function].capacity += capacity;
             }
             if (resource.industry) {
                 if (!indStats[resource.industry]) indStats[resource.industry] = { capacity: 0, allocated: 0 };
                 indStats[resource.industry].capacity += capacity;
             }

             const resourceAssignments = assignments.filter(a => a.resourceId === resource.id);
             let allocated = 0;
             resourceAssignments.forEach(a => {
                  const assignmentAllocations = allocations[a.id!];
                  if (assignmentAllocations) {
                        for (const dateStr in assignmentAllocations) {
                            const allocDate = parseISODate(dateStr);
                            if (allocDate >= firstDay && allocDate <= lastDay) {
                                if (!isHoliday(allocDate, resource.location, companyCalendar) && allocDate.getUTCDay() !== 0 && allocDate.getUTCDay() !== 6) {
                                     allocated += (assignmentAllocations[dateStr] / 100);
                                }
                            }
                        }
                  }
             });

             if (resource.function) funcStats[resource.function].allocated += allocated;
             if (resource.industry) indStats[resource.industry].allocated += allocated;
        });
        
        const byFunction = Object.entries(funcStats)
            .map(([name, stats]) => ({
                name,
                value: stats.capacity > 0 ? ((stats.capacity - stats.allocated) / stats.capacity) * 100 : 0
            }))
            .filter(d => d.value > 0); // Only show relevant bench

        const byIndustry = Object.entries(indStats)
             .map(([name, stats]) => ({
                name,
                value: stats.capacity > 0 ? ((stats.capacity - stats.allocated) / stats.capacity) * 100 : 0
            }))
            .filter(d => d.value > 0);

        return { byFunction, byIndustry };

    }, [activeResources, assignments, allocations, companyCalendar, functions, industries]);


    // --- New WBS Calculations ---
    const wbsSaturationData = useMemo(() => {
        return contracts
            .map(c => {
                const consumed = Number(c.capienza) - (Number(c.backlog) || 0);
                const saturation = c.capienza > 0 ? (consumed / c.capienza) * 100 : 0;
                return { ...c, consumed, saturation };
            })
            .filter(c => c.saturation > 80)
            .sort((a, b) => b.saturation - a.saturation)
            .slice(0, 5);
    }, [contracts]);

    const noWbsLeakageAmount = useMemo(() => {
        let leakage = 0;
        const now = new Date();
        const firstDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
        const lastDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));

        assignments.forEach(assignment => {
            const project = projects.find(p => p.id === assignment.projectId);
            const contract = contracts.find(c => c.id === project?.contractId);
            
            // Check leak condition: No Contract OR No WBS on Contract
            if (!project?.contractId || (contract && !contract.wbs)) {
                const resource = resources.find(r => r.id === assignment.resourceId);
                if (!resource) return;

                const assignmentAllocations = allocations[assignment.id!];
                if (assignmentAllocations) {
                     for (const dateStr in assignmentAllocations) {
                        const allocDate = parseISODate(dateStr);
                        if (allocDate >= firstDay && allocDate <= lastDay) {
                             if (!isHoliday(allocDate, resource.location, companyCalendar) && allocDate.getUTCDay() !== 0 && allocDate.getUTCDay() !== 6) {
                                 const fraction = assignmentAllocations[dateStr] / 100;
                                 // Using COST as metric for "money spent" without cover
                                 const dailyRate = getRoleCost(resource.roleId, allocDate);
                                 leakage += fraction * dailyRate;
                            }
                        }
                    }
                }
            }
        });
        return leakage;
    }, [assignments, projects, contracts, resources, allocations, companyCalendar, getRoleCost]);

    const contractExpirationsData = useMemo(() => {
        const today = new Date();
        const future90 = new Date(); 
        future90.setDate(today.getDate() + 90);
        
        return contracts.filter(c => {
            if (!c.endDate) return false;
            const d = parseISODate(c.endDate);
            return d >= today && d <= future90;
        }).sort((a, b) => {
            const da = a.endDate ? parseISODate(a.endDate).getTime() : 0;
            const db = b.endDate ? parseISODate(b.endDate).getTime() : 0;
            return da - db;
        });
    }, [contracts]);

    // --- REVENUE MIX & PIPELINE & TOP MARGIN DATA ---
    const { revenueMixData, billingPipelineData, topMarginProjectsData } = useMemo(() => {
        const today = new Date();
        const currentYear = today.getUTCFullYear();
        const currentMonthIdx = today.getUTCMonth(); // 0-11
        const startOfYear = new Date(Date.UTC(currentYear, 0, 1));
        const endOfYear = new Date(Date.UTC(currentYear, 11, 31));
        
        // Init Revenue Mix Data for current year
        const mixData: { month: string, tm: number, fixed: number }[] = [];
        for (let m = 0; m < 12; m++) {
            mixData.push({ 
                month: `${currentYear}-${String(m + 1).padStart(2, '0')}`,
                tm: 0,
                fixed: 0
            });
        }
        
        // Init Pipeline (Next 6 months)
        const pipelineData: { month: string, amount: number }[] = [];
        for (let m = 0; m < 6; m++) {
            const d = new Date(Date.UTC(currentYear, currentMonthIdx + m, 1));
            pipelineData.push({
                month: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`,
                amount: 0
            });
        }

        // Project Margin Calc (Current Month)
        const projectMargins: Record<string, { revenue: number, cost: number, name: string }> = {};
        const cmStart = new Date(Date.UTC(currentYear, currentMonthIdx, 1));
        const cmEnd = new Date(Date.UTC(currentYear, currentMonthIdx + 1, 0));
        
        // 1. Process Assignments (T&M Revenue & Labor Cost)
        assignments.forEach(assign => {
            const project = projects.find(p => p.id === assign.projectId);
            const resource = resources.find(r => r.id === assign.resourceId);
            if (!project || !resource) return;

            const contract = contracts.find(c => c.id === project.contractId);
            const rateCardId = contract?.rateCardId;
            const assignAlloc = allocations[assign.id!];

            if (assignAlloc) {
                for (const dateStr in assignAlloc) {
                    const d = parseISODate(dateStr);
                    // Filter within current year for Mix
                    if (d < startOfYear || d > endOfYear) continue;
                    
                    const pct = assignAlloc[dateStr] / 100;
                    if (pct <= 0) continue;
                    if (isHoliday(d, resource.location, companyCalendar) || d.getUTCDay() === 0 || d.getUTCDay() === 6) continue;

                    const monthKey = dateStr.substring(0, 7);
                    
                    // REVENUE MIX: T&M
                    if (project.billingType === 'TIME_MATERIAL' || !project.billingType) {
                        const sellRate = getSellRate(rateCardId, resource.id!);
                        const revenue = pct * sellRate;
                        const mixEntry = mixData.find(m => m.month === monthKey);
                        if (mixEntry) mixEntry.tm += revenue;
                        
                         // TOP MARGIN (Current Month Only)
                        if (d >= cmStart && d <= cmEnd) {
                             if (!projectMargins[project.id!]) projectMargins[project.id!] = { revenue: 0, cost: 0, name: project.name };
                             projectMargins[project.id!].revenue += revenue;
                        }
                    }

                    // TOP MARGIN: Cost (Current Month Only)
                    if (d >= cmStart && d <= cmEnd) {
                         if (!projectMargins[project.id!]) projectMargins[project.id!] = { revenue: 0, cost: 0, name: project.name };
                         const dailyCost = getRoleCost(resource.roleId, d);
                         // Cost is recognized regardless of billing type
                         projectMargins[project.id!].cost += (pct * dailyCost);
                    }
                }
            }
        });

        // 2. Process Milestones (Fixed Revenue & Pipeline)
        billingMilestones.forEach(bm => {
            const dateStr = bm.date; // YYYY-MM-DD
            const amount = Number(bm.amount);
            const monthKey = dateStr.substring(0, 7);
            const project = projects.find(p => p.id === bm.projectId);
            
            // REVENUE MIX: Fixed Price (Historical & Future within year)
            if (dateStr >= startOfYear.toISOString() && dateStr <= endOfYear.toISOString()) {
                if (project?.billingType === 'FIXED_PRICE') {
                    const mixEntry = mixData.find(m => m.month === monthKey);
                    if (mixEntry) mixEntry.fixed += amount;
                    
                     // TOP MARGIN (Current Month Only) - Recognized Revenue
                     if (dateStr >= cmStart.toISOString() && dateStr <= cmEnd.toISOString()) {
                        if (!projectMargins[project.id!]) projectMargins[project.id!] = { revenue: 0, cost: 0, name: project.name };
                        projectMargins[project.id!].revenue += amount;
                     }
                }
            }

            // BILLING PIPELINE: Planned Milestones >= Today
            if (bm.status === 'PLANNED' && dateStr >= today.toISOString().split('T')[0]) {
                 const pipeEntry = pipelineData.find(p => p.month === monthKey);
                 if (pipeEntry) pipeEntry.amount += amount;
            }
        });
        
        // 3. Process Expenses (Top Margin Cost)
        projectExpenses.forEach(exp => {
             const dateStr = exp.date;
             if (dateStr >= cmStart.toISOString() && dateStr <= cmEnd.toISOString()) {
                 const project = projects.find(p => p.id === exp.projectId);
                 if (project) {
                    if (!projectMargins[project.id!]) projectMargins[project.id!] = { revenue: 0, cost: 0, name: project.name };
                    projectMargins[project.id!].cost += Number(exp.amount);
                 }
             }
        });

        const topMarginList = Object.values(projectMargins)
            .map(p => ({
                name: p.name,
                revenue: p.revenue,
                cost: p.cost,
                margin: p.revenue - p.cost,
                marginPct: p.revenue > 0 ? ((p.revenue - p.cost) / p.revenue) * 100 : 0
            }))
            .sort((a,b) => b.margin - a.margin)
            .slice(0, 10);

        return {
            revenueMixData: mixData,
            billingPipelineData: pipelineData,
            topMarginProjectsData: topMarginList
        };
    }, [assignments, allocations, billingMilestones, projects, resources, contracts, rateCards, getRoleCost, getSellRate, companyCalendar, projectExpenses]);


    // Totals
    const avgAllocationTotals = useMemo(() => {
        const totalCurrent = averageAllocationData.reduce((sum, d) => sum + d.currentMonth, 0);
        const totalNext = averageAllocationData.reduce((sum, d) => sum + d.nextMonth, 0);
        const count = averageAllocationData.length || 1;
        return { currentMonth: totalCurrent / count, nextMonth: totalNext / count };
    }, [averageAllocationData]);

    const fteTotals = useMemo(() => {
        const totalDays = fteData.reduce((sum, d) => sum + d.totalPersonDays, 0);
        const totalFte = fteData.reduce((sum, d) => sum + d.fte, 0);
        return { totalDays, totalFte };
    }, [fteData]);

    const budgetTotals = useMemo(() => {
        const budget = budgetAnalysisData.reduce((sum, d) => sum + d.budget, 0);
        const cost = budgetAnalysisData.reduce((sum, d) => sum + d.estimatedCost, 0);
        const variance = budgetAnalysisData.reduce((sum, d) => sum + d.variance, 0);
        return { budget, cost, variance };
    }, [budgetAnalysisData]);

    const temporalBudgetTotals = useMemo(() => {
        const budget = temporalBudgetAnalysisData.reduce((sum, d) => sum + d.periodBudget, 0);
        const cost = temporalBudgetAnalysisData.reduce((sum, d) => sum + d.estimatedCost, 0);
        const variance = temporalBudgetAnalysisData.reduce((sum, d) => sum + d.variance, 0);
        return { budget, cost, variance };
    }, [temporalBudgetAnalysisData]);

    const avgDailyRateTotals = useMemo(() => {
        const totalDays = averageDailyRateData.reduce((sum, d) => sum + d.totalPersonDays, 0);
        const totalCost = averageDailyRateData.reduce((sum, d) => sum + d.totalCost, 0);
        return { totalDays, totalCost, weightedAverage: totalDays > 0 ? totalCost / totalDays : 0 };
    }, [averageDailyRateData]);

    const effortByFunctionTotal = useMemo(() => {
        return effortByFunctionData.reduce((sum, d) => sum + d.totalPersonDays, 0);
    }, [effortByFunctionData]);

    const effortByIndustryTotal = useMemo(() => {
        return effortByIndustryData.reduce((sum, d) => sum + d.totalPersonDays, 0);
    }, [effortByIndustryData]);

    // --- Helper function to get icon for category tabs ---
    const getCategoryIcon = (id: string) => {
        switch(id) {
            case 'generale': return 'dashboard';
            case 'staffing': return 'groups';
            case 'progetti': return 'folder';
            case 'contratti': return 'description';
            default: return 'grid_view';
        }
    };

    const renderCard = (cardId: string) => {
        switch (cardId) {
            case 'kpiHeader': return <KpiHeaderCards key={cardId} overallKPIs={overallKPIs} currentMonthKPIs={currentMonthKPIs} />;
            case 'attentionCards': return <AttentionCards key={cardId} overallKPIs={overallKPIs} navigate={navigate} />;
            case 'leavesOverview': return <LeavesOverviewCard key={cardId} navigate={navigate} />;
            case 'unallocatedFte': return <UnallocatedFteCard key={cardId} kpis={currentMonthKPIs} />;
            case 'averageAllocation': return <AverageAllocationCard key={cardId} data={averageAllocationData} filter={avgAllocFilter} setFilter={setAvgAllocFilter} resourceOptions={activeResources.map(r => ({ value: r.id!, label: r.name }))} totals={avgAllocationTotals} isLoading={loading} />;
            case 'ftePerProject': return <FtePerProjectCard key={cardId} data={fteData} filter={fteFilter} setFilter={setFteFilter} clientOptions={clients.map(c => ({ value: c.id!, label: c.name }))} totals={fteTotals} isLoading={loading} />;
            case 'budgetAnalysis': return <BudgetAnalysisCard key={cardId} data={budgetAnalysisData} filter={budgetFilter} setFilter={setBudgetFilter} clientOptions={clients.map(c => ({ value: c.id!, label: c.name }))} totals={budgetTotals} isLoading={loading} />;
            case 'temporalBudgetAnalysis': return <TemporalBudgetAnalysisCard key={cardId} data={temporalBudgetAnalysisData} filter={temporalBudgetFilter} setFilter={setTemporalBudgetFilter} clientOptions={clients.map(c => ({ value: c.id!, label: c.name }))} totals={temporalBudgetTotals} isLoading={loading} />;
            case 'averageDailyRate': return <AverageDailyRateCard key={cardId} data={averageDailyRateData} filter={avgDailyRateFilter} setFilter={setAvgDailyRateFilter} clientOptions={clients.map(c => ({ value: c.id!, label: c.name }))} totals={avgDailyRateTotals} isLoading={loading} />;
            case 'underutilizedResources': return <UnderutilizedResourcesCard key={cardId} data={underutilizedResourcesData} month={underutilizedFilter} setMonth={setUnderutilizedFilter} isLoading={loading} />;
            case 'monthlyClientCost': return <MonthlyClientCostCard key={cardId} data={currentMonthKPIs.clientCostArray} navigate={navigate} isLoading={loading} />;
            case 'effortByFunction': return <EffortByFunctionCard key={cardId} data={effortByFunctionData} total={effortByFunctionTotal} isLoading={loading} />;
            case 'effortByIndustry': return <EffortByIndustryCard key={cardId} data={effortByIndustryData} total={effortByIndustryTotal} isLoading={loading} />;
            case 'locationAnalysis': return <LocationAnalysisCard key={cardId} data={analysisByLocationData} isLoading={loading} />;
            case 'saturationTrend': return <SaturationTrendCard key={cardId} trendResource={trendResource} setTrendResource={setTrendResource} resourceOptions={activeResources.map(r => ({ value: r.id!, label: r.name }))} data={saturationTrendData} />;
            case 'costForecast': return <CostForecastCard key={cardId} data={monthlyCostForecastData} />;
            case 'allocationMatrix': return <AllocationMatrixCard key={cardId} data={allocationMatrixData} isLoading={loading} />;
            case 'revenueByIndustry': return <RevenueByIndustryCard key={cardId} data={revenueByIndustryData} isLoading={loading} />;
            case 'benchByFunction': return <BenchByFunctionCard key={cardId} data={benchData.byFunction} isLoading={loading} />;
            case 'benchByIndustry': return <BenchByIndustryCard key={cardId} data={benchData.byIndustry} isLoading={loading} />;
            case 'wbsSaturation': return <WbsSaturationCard key={cardId} data={wbsSaturationData} isLoading={loading} />;
            case 'noWbsLeakage': return <NoWbsLeakageCard key={cardId} leakageAmount={noWbsLeakageAmount} navigate={navigate} />;
            case 'contractExpirations': return <ContractExpirationsCard key={cardId} data={contractExpirationsData} isLoading={loading} />;
            case 'revenueMix': return <RevenueMixCard key={cardId} data={revenueMixData} isLoading={loading} />;
            case 'billingPipeline': return <BillingPipelineCard key={cardId} data={billingPipelineData} isLoading={loading} />;
            case 'topMarginProjects': return <TopMarginProjectsCard key={cardId} data={topMarginProjectsData} isLoading={loading} />;
            default: return null;
        }
    };

    // If no layout defined (should not happen due to default), fallback
    const activeCategory = dashboardLayout.find(c => c.id === activeTab) || dashboardLayout[0];

    return (
        <div className="space-y-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-on-surface">Dashboard</h1>
            
            {/* Tabs */}
            <div className="flex border-b border-outline-variant overflow-x-auto">
                {dashboardLayout.map(cat => (
                    <button
                        key={cat.id}
                        onClick={() => setActiveTab(cat.id)}
                        className={`flex items-center px-3 sm:px-5 py-3 font-medium text-sm whitespace-nowrap transition-colors ${
                            activeTab === cat.id || (!activeTab && cat.id === dashboardLayout[0].id)
                                ? 'border-b-2 border-primary text-primary' 
                                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
                        }`}
                    >
                        <span className="material-symbols-outlined mr-2 text-lg">{getCategoryIcon(cat.id)}</span>
                        {cat.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
                {activeCategory?.cards.map(cardId => {
                    // Check if card is full-width by config
                    const config = DASHBOARD_CARDS_CONFIG.find(c => c.id === cardId);
                    const isFullWidth = config?.group === 'full-width';

                    // kpiHeader e attentionCards ritornano fragment con più figli:
                    // li rendiamo full-width e usiamo una sub-grid per la spaziatura.
                    let wrapperClass = "";
                    if (isFullWidth) {
                        wrapperClass = "col-span-1 lg:col-span-2";
                    } else if (cardId === 'kpiHeader') {
                        wrapperClass = "col-span-1 lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4";
                    } else if (cardId === 'attentionCards') {
                        wrapperClass = "col-span-1 lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4";
                    }

                    return (
                        <div key={cardId} className={wrapperClass}>
                            {renderCard(cardId)}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default DashboardPage;
