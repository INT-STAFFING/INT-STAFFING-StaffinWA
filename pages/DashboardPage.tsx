/**
 * @file DashboardPage.tsx
 * @description Pagina della dashboard che visualizza varie metriche e analisi aggregate sui dati di staffing.
 */

import React, { useMemo } from 'react';
import { useStaffingContext } from '../context/StaffingContext';
import { getWorkingDaysBetween } from '../utils/dateUtils';
import { Allocation } from '../types';

/**
 * Formatta un valore numerico come valuta EUR.
 * @param {number} value - Il valore numerico da formattare.
 * @returns {string} La stringa formattata (es. "€ 1.234,56").
 */
const formatCurrency = (value: number): string => {
    return value.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
};

/**
 * Componente per la pagina Dashboard.
 * Mostra una serie di "card" con analisi dei dati, come allocazione media,
 * FTE per progetto, analisi dei budget e altro.
 * @returns {React.ReactElement} La pagina della dashboard.
 */
const DashboardPage: React.FC = () => {
    const { resources, roles, projects, clients, assignments, allocations } = useStaffingContext();

    /**
     * @description Calcola l'allocazione media mensile per ogni risorsa.
     */
    const monthlyAllocationData = useMemo(() => {
        const data: { [key: string]: { total: number, count: number } } = {};
        
        for (const assignmentId in allocations) {
            const assignment = assignments.find(a => a.id === assignmentId);
            if (!assignment) continue;
            
            for (const dateStr in allocations[assignmentId]) {
                const percentage = allocations[assignmentId][dateStr];
                const monthKey = `${assignment.resourceId}|${dateStr.substring(0, 7)}`;
                if (!data[monthKey]) {
                    data[monthKey] = { total: 0, count: 0 };
                }
                data[monthKey].total += percentage;
                data[monthKey].count += 1;
            }
        }

        return Object.entries(data).map(([key, value]) => {
            const [resourceId, month] = key.split('|');
            const resource = resources.find(r => r.id === resourceId);
            const role = roles.find(r => r.id === resource?.roleId);
            const avg = value.total > 0 ? value.total / value.count : 0;
            return { resource, role, month, avg: Math.round(avg) };
        }).filter(item => item.resource).sort((a,b) => b.month.localeCompare(a.month) || a.resource!.name.localeCompare(b.resource!.name));

    }, [allocations, assignments, resources, roles]);

    /**
     * @description Calcola il Full-Time Equivalent (FTE) per ciascun progetto.
     */
    const fteData = useMemo(() => {
        return projects.map(project => {
            if (!project.startDate || !project.endDate) return null;

            const client = clients.find(c => c.id === project.clientId);
            const projectWorkingDays = getWorkingDaysBetween(new Date(project.startDate), new Date(project.endDate));
            
            if (projectWorkingDays === 0) {
                 return { ...project, clientName: client?.name || 'N/A', fte: (0).toFixed(2), totalAllocatedDays: (0).toFixed(2), projectWorkingDays: 0 };
            }

            const projectAssignments = assignments.filter(a => a.projectId === project.id);
            let totalAllocatedDays = 0;

            projectAssignments.forEach(assignment => {
                const assignmentAllocations = allocations[assignment.id!];
                if(assignmentAllocations){
                    Object.values(assignmentAllocations).forEach(percentage => {
                        totalAllocatedDays += percentage / 100;
                    });
                }
            });

            const fte = projectWorkingDays > 0 ? (totalAllocatedDays / projectWorkingDays) : 0;

            return { ...project, clientName: client?.name || 'N/A', fte: fte.toFixed(2), totalAllocatedDays: totalAllocatedDays.toFixed(2), projectWorkingDays };
        }).filter(Boolean);
    }, [projects, assignments, allocations, clients]);

    /**
     * @description Esegue un'analisi dei costi per ogni progetto.
     */
    const budgetAnalysisData = useMemo(() => {
        return projects.map(project => {
            let rawEstimatedCost = 0;
            const projectAssignments = assignments.filter(a => a.projectId === project.id);

            projectAssignments.forEach(assignment => {
                const resource = resources.find(r => r.id === assignment.resourceId);
                const role = roles.find(ro => ro.id === resource?.roleId);
                const dailyRate = role?.dailyCost || 0;

                const assignmentAllocations = allocations[assignment.id!];
                if (assignmentAllocations) {
                    const allocatedPersonDays = Object.values(assignmentAllocations).reduce((sum, p) => sum + (p / 100), 0);
                    rawEstimatedCost += allocatedPersonDays * dailyRate;
                }
            });
            
            const estimatedCost = rawEstimatedCost * (project.realizationPercentage / 100);
            const variance = project.budget - estimatedCost;

            return { ...project, fullBudget: project.budget, estimatedCost, variance };
        }).sort((a,b) => a.name.localeCompare(b.name));
    }, [projects, assignments, allocations, resources, roles]);

    /**
     * @description Identifica le risorse sottoutilizzate (< 100%) nel mese corrente.
     */
    const underutilizedResourcesData = useMemo(() => {
        const today = new Date();
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        const workingDaysInMonth = getWorkingDaysBetween(firstDayOfMonth, lastDayOfMonth);

        if (workingDaysInMonth === 0) return [];

        return resources.map(resource => {
            const resourceAssignments = assignments.filter(a => a.resourceId === resource.id);
            let totalPersonDays = 0;
            resourceAssignments.forEach(assignment => {
                const assignmentAllocations = allocations[assignment.id!];
                if (assignmentAllocations) {
                     for (const dateStr in assignmentAllocations) {
                        const allocDate = new Date(dateStr);
                        if (allocDate >= firstDayOfMonth && allocDate <= lastDayOfMonth) {
                             totalPersonDays += (assignmentAllocations as any)[dateStr] / 100;
                        }
                    }
                }
            });
            const avgAllocation = Math.round((totalPersonDays / workingDaysInMonth) * 100);
            return { ...resource, avgAllocation, role: roles.find(r => r.id === resource.roleId)?.name || 'N/A' };
        })
        .filter(r => r.avgAllocation < 100)
        .sort((a,b) => a.avgAllocation - b.avgAllocation);
    }, [resources, assignments, allocations, roles]);
    
    /**
     * @description Aggrega i dati di sforzo (giorni-uomo) e budget per cliente.
     */
    const effortByClientData = useMemo(() => {
        const clientData: { [clientId: string]: { name: string, projectCount: number, totalPersonDays: number, totalBudget: number } } = {};
        
        clients.forEach(client => {
            clientData[client.id!] = { name: client.name, projectCount: 0, totalPersonDays: 0, totalBudget: 0 };
        });

        projects.forEach(project => {
            if (project.clientId && clientData[project.clientId]) {
                if(project.status === 'In corso') clientData[project.clientId].projectCount++;
                clientData[project.clientId].totalBudget += project.budget;

                const projectAssignments = assignments.filter(a => a.projectId === project.id);
                let projectPersonDays = 0;
                projectAssignments.forEach(assignment => {
                    const assignmentAllocations = allocations[assignment.id!];
                    if (assignmentAllocations) {
                        projectPersonDays += Object.values(assignmentAllocations).reduce((sum, p) => sum + (p / 100), 0);
                    }
                });
                clientData[project.clientId].totalPersonDays += projectPersonDays;
            }
        });
        
        const finalData = Object.values(clientData).filter(c => c.projectCount > 0 || c.totalPersonDays > 0 || c.totalBudget > 0);
        return finalData.sort((a,b) => b.totalBudget - a.totalBudget);
    }, [clients, projects, assignments, allocations]);

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
                
                const assignmentAllocations = allocations[assignment.id!];
                if (assignmentAllocations) {
                    const personDays = Object.values(assignmentAllocations).reduce((sum, p) => sum + (p / 100), 0);
                    horizontalData[horizontal] += personDays;
                }
            }
        });

        return Object.entries(horizontalData)
            .map(([name, totalPersonDays]) => ({ name, totalPersonDays: Math.round(totalPersonDays) }))
            .sort((a,b) => b.totalPersonDays - a.totalPersonDays);
    }, [assignments, resources, allocations]);

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

    return (
        <div>
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white self-start">Dashboard</h1>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Card Allocazione Mensile */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <h2 className="text-xl font-semibold mb-4">Allocazione Media Mensile (sui giorni lavorati)</h2>
                    <div className="overflow-y-auto max-h-96">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                                <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Risorsa</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Mese</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Alloc. Media</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {monthlyAllocationData.map((data, index) => (
                                    <tr key={index}>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm">
                                            <div>{data.resource?.name}</div>
                                            <div className="text-xs text-gray-500">{data.role?.name}</div>
                                        </td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm">{data.month}</td>
                                        <td className={`px-4 py-2 whitespace-nowrap text-sm ${getAvgAllocationColor(data.avg)}`}>
                                            {data.avg}%
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Card FTE per Progetto */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <h2 className="text-xl font-semibold mb-4">FTE allocati per Progetto</h2>
                     <div className="overflow-y-auto max-h-96">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                                <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Progetto</th>
                                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Giorni Alloc.</th>
                                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Giorni Lav.</th>
                                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">FTE</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {fteData.map((data) => data && (
                                    <tr key={data.id}>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm">
                                             <div>{data.name}</div>
                                             <div className="text-xs text-gray-500">{data.clientName} | PM: {data.projectManager}</div>
                                        </td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-center">{data.totalAllocatedDays}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-center">{data.projectWorkingDays}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-center font-bold text-blue-600 dark:text-blue-400">{data.fte}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Card Analisi Budget */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <h2 className="text-xl font-semibold mb-4">Analisi: Budget vs. Costo Stimato</h2>
                    <div className="overflow-y-auto max-h-96">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                                <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Progetto</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Budget</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Costo (Realizzato)</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Variazione</th>
                                </tr>
                            </thead>
                             <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {budgetAnalysisData.map(p => (
                                    <tr key={p.id}>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm font-medium dark:text-white">{p.name}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{formatCurrency(p.fullBudget)}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{formatCurrency(p.estimatedCost)}</td>
                                        <td className={`px-4 py-2 whitespace-nowrap text-sm font-semibold ${p.variance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                            {formatCurrency(p.variance)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Card Risorse Sottoutilizzate */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <h2 className="text-xl font-semibold mb-4">Risorse Sottoutilizzate (&lt;100% nel mese corrente)</h2>
                    <div className="overflow-y-auto max-h-96">
                         <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                             <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                                <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Risorsa</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Alloc. Media</th>
                                </tr>
                            </thead>
                             <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {underutilizedResourcesData.map(r => (
                                    <tr key={r.id}>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm">
                                            <div>{r.name}</div>
                                            <div className="text-xs text-gray-500">{r.role}</div>
                                        </td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-yellow-600 dark:text-yellow-400 font-semibold">{r.avgAllocation}%</td>
                                    </tr>
                                ))}
                            </tbody>
                         </table>
                    </div>
                </div>

                {/* Card Sforzo per Cliente */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <h2 className="text-xl font-semibold mb-4">Analisi Sforzo per Cliente</h2>
                     <div className="overflow-y-auto max-h-96">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                                <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Cliente</th>
                                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Progetti Attivi</th>
                                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Giorni-Uomo</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Valore Budget</th>
                                </tr>
                            </thead>
                             <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {effortByClientData.map(c => (
                                    <tr key={c.name}>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm font-medium dark:text-white">{c.name}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-center">{c.projectCount}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-center">{Math.round(c.totalPersonDays)}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm">{formatCurrency(c.totalBudget)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
                
                {/* Card Sforzo per Horizontal */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <h2 className="text-xl font-semibold mb-4">Analisi Sforzo per Horizontal</h2>
                     <div className="overflow-y-auto max-h-96">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                                <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Horizontal</th>
                                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Giorni-Uomo</th>
                                </tr>
                            </thead>
                             <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {effortByHorizontalData.map(h => (
                                    <tr key={h.name}>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm font-medium dark:text-white">{h.name}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-center font-semibold">{h.totalPersonDays}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
             <style>{`
                .form-input, .form-select { display: block; width: 100%; border-radius: 0.375rem; border: 1px solid #D1D5DB; background-color: #FFFFFF; padding: 0.5rem 0.75rem; font-size: 0.875rem; line-height: 1.25rem; }
                .dark .form-input, .dark .form-select { border-color: #4B5563; background-color: #374151; color: #F9FAFB; }
            `}</style>
        </div>
    );
};

export default DashboardPage;
