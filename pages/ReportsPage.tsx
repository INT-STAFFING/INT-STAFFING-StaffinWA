/**
 * @file ReportsPage.tsx
 * @description Pagina per la visualizzazione di report analitici su costi e utilizzo.
 */

import React, { useState, useMemo } from 'react';
// Fix: Use useEntitiesContext and useAllocationsContext from AppContext
import { useEntitiesContext, useAllocationsContext } from '../context/AppContext';
import SearchableSelect from '../components/SearchableSelect';
import { getWorkingDaysBetween, isHoliday } from '../utils/dateUtils';
import { ArrowsUpDownIcon, ArrowDownOnSquareIcon } from '../components/icons';

// --- Tipi e Interfacce Locali ---
type ReportTab = 'projectCosts' | 'resourceUtilization';
type ProjectCostSortKey = 'projectName' | 'clientName' | 'budget' | 'allocatedCost' | 'variance' | 'personDays' | 'avgCostPerDay';
type ResourceUtilizationSortKey = 'resourceName' | 'roleName' | 'availableDays' | 'allocatedDays' | 'utilization' | 'allocatedCost';
type SortDirection = 'ascending' | 'descending';

// --- Funzioni di Utilità ---
const formatCurrency = (value: number) => (value || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
const downloadCSV = (csvContent: string, fileName: string) => {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', fileName);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
};

// --- Componenti di Supporto ---

/**
 * Hook generico per la gestione dell'ordinamento di una tabella.
 * @template T - Il tipo di chiave di ordinamento.
 */
const useSort = <T extends string>() => {
    const [sortConfig, setSortConfig] = useState<{ key: T; direction: SortDirection } | null>(null);

    const requestSort = (key: T) => {
        let direction: SortDirection = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const SortableHeader: React.FC<{ label: string; sortKey: T }> = ({ label, sortKey }) => (
        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground dark:text-dark-muted-foreground uppercase tracking-wider">
            <button type="button" onClick={() => requestSort(sortKey)} className="flex items-center space-x-1 hover:text-foreground dark:hover:text-dark-foreground">
                <span className={sortConfig?.key === sortKey ? 'font-bold text-foreground dark:text-dark-foreground' : ''}>{label}</span>
                <ArrowsUpDownIcon className="w-4 h-4 text-gray-400" />
            </button>
        </th>
    );

    return { sortConfig, SortableHeader };
};

// --- Componenti Principali dei Report ---

const ProjectCostsReport: React.FC = () => {
    // Fix: Use useEntitiesContext and useAllocationsContext from AppContext
    const { projects, clients, assignments, resources, roles, projectStatuses, companyCalendar } = useEntitiesContext();
    const { allocations } = useAllocationsContext();
    const [filters, setFilters] = useState({ clientId: '', status: '' });
    const { sortConfig, SortableHeader } = useSort<ProjectCostSortKey>();

    const reportData = useMemo(() => {
        return projects
            .filter(p => (!filters.clientId || p.clientId === filters.clientId) && (!filters.status || p.status === filters.status))
            .map(project => {
                let allocatedCost = 0;
                let personDays = 0;
                const projectAssignments = assignments.filter(a => a.projectId === project.id);
                
                projectAssignments.forEach(assignment => {
                    const resource = resources.find(r => r.id === assignment.resourceId);
                    const role = roles.find(ro => ro.id === resource?.roleId);
                    const dailyRate = role?.dailyCost || 0;
                    
                    const assignmentAllocations = allocations[assignment.id];
                    if (assignmentAllocations) {
                        for (const dateStr in assignmentAllocations) {
                             if (!isHoliday(new Date(dateStr), resource?.location || null, companyCalendar) && new Date(dateStr).getDay() !== 0 && new Date(dateStr).getDay() !== 6) {
                                const dayFraction = (assignmentAllocations[dateStr] || 0) / 100;
                                personDays += dayFraction;
                                allocatedCost += dayFraction * dailyRate;
                             }
                        }
                    }
                });
                
                const budget = Number(project.budget || 0);
                const variance = budget - allocatedCost;

                return {
                    id: project.id,
                    projectName: project.name,
                    clientName: clients.find(c => c.id === project.clientId)?.name || 'N/A',
                    budget,
                    allocatedCost,
                    variance,
                    personDays,
                    avgCostPerDay: personDays > 0 ? allocatedCost / personDays : 0,
                };
            });
    }, [projects, filters, clients, assignments, resources, roles, companyCalendar, allocations]);
    
    const sortedData = useMemo(() => {
        if (!sortConfig) return reportData;
        return [...reportData].sort((a, b) => {
            const valA = a[sortConfig.key];
            const valB = b[sortConfig.key];
            if (typeof valA === 'string' && typeof valB === 'string') {
                return sortConfig.direction === 'ascending' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            }
             if (typeof valA === 'number' && typeof valB === 'number') {
                return sortConfig.direction === 'ascending' ? valA - valB : valB - valA;
            }
            return 0;
        });
    }, [reportData, sortConfig]);

    const exportToCSV = () => {
        const headers = ["Progetto", "Cliente", "Budget", "Costo Allocato", "Varianza", "Giorni/Uomo", "Costo Medio G/U"];
        const rows = sortedData.map(d => [
            `"${d.projectName}"`,
            `"${d.clientName}"`,
            d.budget.toFixed(2),
            d.allocatedCost.toFixed(2),
            d.variance.toFixed(2),
            d.personDays.toFixed(2),
            d.avgCostPerDay.toFixed(2)
        ]);
        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        downloadCSV(csvContent, 'report_costi_progetto.csv');
    };

    const clientOptions = useMemo(() => clients.map(c => ({ value: c.id!, label: c.name })), [clients]);
    const statusOptions = useMemo(() => projectStatuses.map(s => ({ value: s.value, label: s.value })), [projectStatuses]);

    return (
        <div>
            <div className="p-4 bg-muted dark:bg-dark-muted rounded-lg mb-6">
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <SearchableSelect name="clientId" value={filters.clientId} onChange={(_, v) => setFilters(f => ({...f, clientId: v}))} options={clientOptions} placeholder="Tutti i Clienti"/>
                    <SearchableSelect name="status" value={filters.status} onChange={(_, v) => setFilters(f => ({...f, status: v}))} options={statusOptions} placeholder="Tutti gli Stati"/>
                    <button onClick={exportToCSV} className="inline-flex items-center justify-center px-4 py-2 bg-primary text-white font-semibold rounded-md shadow-sm hover:bg-primary-darker">
                        <ArrowDownOnSquareIcon className="w-5 h-5 mr-2" /> Esporta CSV
                    </button>
                 </div>
            </div>
             <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border dark:divide-dark-border">
                    <thead className="bg-muted dark:bg-dark-muted"><tr><SortableHeader label="Progetto" sortKey="projectName" /><SortableHeader label="Cliente" sortKey="clientName" /><SortableHeader label="Budget" sortKey="budget" /><SortableHeader label="Costo Allocato" sortKey="allocatedCost" /><SortableHeader label="Varianza" sortKey="variance" /><SortableHeader label="G/U Allocati" sortKey="personDays" /><SortableHeader label="Costo Medio G/U" sortKey="avgCostPerDay" /></tr></thead>
                    <tbody className="bg-card dark:bg-dark-card divide-y divide-border dark:divide-dark-border">
                        {sortedData.map(d => (
                        <tr key={d.id}><td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-foreground dark:text-dark-foreground">{d.projectName}</td><td className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground dark:text-dark-muted-foreground">{d.clientName}</td><td className="px-4 py-3 whitespace-nowrap text-sm">{formatCurrency(d.budget)}</td><td className="px-4 py-3 whitespace-nowrap text-sm">{formatCurrency(d.allocatedCost)}</td><td className={`px-4 py-3 whitespace-nowrap text-sm font-semibold ${d.variance >= 0 ? 'text-success' : 'text-destructive'}`}>{formatCurrency(d.variance)}</td><td className="px-4 py-3 whitespace-nowrap text-sm">{d.personDays.toFixed(2)}</td><td className="px-4 py-3 whitespace-nowrap text-sm">{formatCurrency(d.avgCostPerDay)}</td></tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};


const ResourceUtilizationReport: React.FC = () => {
    // Fix: Use useEntitiesContext and useAllocationsContext from AppContext
    const { resources, roles, assignments, companyCalendar, horizontals } = useEntitiesContext();
    const { allocations } = useAllocationsContext();
    const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
    const [filters, setFilters] = useState({ roleId: '', horizontal: '' });
    const { sortConfig, SortableHeader } = useSort<ResourceUtilizationSortKey>();

    const reportData = useMemo(() => {
        const [year, monthNum] = month.split('-').map(Number);
        const firstDay = new Date(year, monthNum - 1, 1);
        const lastDay = new Date(year, monthNum, 0);

        return resources
            .filter(r => (!filters.roleId || r.roleId === filters.roleId) && (!filters.horizontal || r.horizontal === filters.horizontal))
            .map(resource => {
                const role = roles.find(ro => ro.id === resource.roleId);
                const availableDays = getWorkingDaysBetween(firstDay, lastDay, companyCalendar, resource.location);
                
                let allocatedDays = 0;
                let allocatedCost = 0;
                const resourceAssignments = assignments.filter(a => a.resourceId === resource.id);
                
                resourceAssignments.forEach(assignment => {
                    const assignmentAllocations = allocations[assignment.id];
                    if (assignmentAllocations) {
                        for (const dateStr in assignmentAllocations) {
                            const allocDate = new Date(dateStr);
                            if (allocDate >= firstDay && allocDate <= lastDay && !isHoliday(allocDate, resource.location, companyCalendar) && allocDate.getDay() !== 0 && allocDate.getDay() !== 6) {
                                const dayFraction = (assignmentAllocations[dateStr] || 0) / 100;
                                allocatedDays += dayFraction;
                                allocatedCost += dayFraction * (role?.dailyCost || 0);
                            }
                        }
                    }
                });

                const utilization = availableDays > 0 ? (allocatedDays / availableDays) * 100 : 0;
                
                return {
                    id: resource.id,
                    resourceName: resource.name,
                    roleName: role?.name || 'N/A',
                    availableDays,
                    allocatedDays,
                    utilization,
                    allocatedCost,
                };
            });
    }, [resources, roles, assignments, companyCalendar, month, filters, allocations]);
    
    const sortedData = useMemo(() => {
        if (!sortConfig) return reportData;
        return [...reportData].sort((a, b) => {
            const valA = a[sortConfig.key];
            const valB = b[sortConfig.key];
            if (typeof valA === 'string' && typeof valB === 'string') {
                return sortConfig.direction === 'ascending' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            }
             if (typeof valA === 'number' && typeof valB === 'number') {
                return sortConfig.direction === 'ascending' ? valA - valB : valB - valA;
            }
            return 0;
        });
    }, [reportData, sortConfig]);
    
    const exportToCSV = () => {
        const headers = ["Risorsa", "Ruolo", "Giorni Disponibili", "Giorni Allocati", "Utilizzo (%)", "Costo Allocato"];
        const rows = sortedData.map(d => [
            `"${d.resourceName}"`, `"${d.roleName}"`, d.availableDays.toFixed(1), d.allocatedDays.toFixed(2), d.utilization.toFixed(2), d.allocatedCost.toFixed(2)
        ]);
        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        downloadCSV(csvContent, `report_utilizzo_${month}.csv`);
    };
    
    const roleOptions = useMemo(() => roles.map(r => ({ value: r.id!, label: r.name })), [roles]);
    const horizontalOptions = useMemo(() => horizontals.map(h => ({ value: h.value, label: h.value })), [horizontals]);

    return (
        <div>
            <div className="p-4 bg-muted dark:bg-dark-muted rounded-lg mb-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="form-input"/>
                    <SearchableSelect name="roleId" value={filters.roleId} onChange={(_, v) => setFilters(f => ({...f, roleId: v}))} options={roleOptions} placeholder="Tutti i Ruoli"/>
                    <SearchableSelect name="horizontal" value={filters.horizontal} onChange={(_, v) => setFilters(f => ({...f, horizontal: v}))} options={horizontalOptions} placeholder="Tutti gli Horizontal"/>
                    <button onClick={exportToCSV} className="inline-flex items-center justify-center px-4 py-2 bg-primary text-white font-semibold rounded-md shadow-sm hover:bg-primary-darker">
                        <ArrowDownOnSquareIcon className="w-5 h-5 mr-2" /> Esporta CSV
                    </button>
                </div>
            </div>
             <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border dark:divide-dark-border">
                    <thead className="bg-muted dark:bg-dark-muted"><tr><SortableHeader label="Risorsa" sortKey="resourceName" /><SortableHeader label="Ruolo" sortKey="roleName" /><SortableHeader label="G/U Disponibili" sortKey="availableDays" /><SortableHeader label="G/U Allocati" sortKey="allocatedDays" /><SortableHeader label="Utilizzo" sortKey="utilization" /><SortableHeader label="Costo Allocato" sortKey="allocatedCost" /></tr></thead>
                    <tbody className="bg-card dark:bg-dark-card divide-y divide-border dark:divide-dark-border">
                         {sortedData.map(d => (
                        <tr key={d.id}><td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-foreground dark:text-dark-foreground">{d.resourceName}</td><td className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground dark:text-dark-muted-foreground">{d.roleName}</td><td className="px-4 py-3 whitespace-nowrap text-sm">{d.availableDays.toFixed(1)}</td><td className="px-4 py-3 whitespace-nowrap text-sm">{d.allocatedDays.toFixed(2)}</td><td className={`px-4 py-3 whitespace-nowrap text-sm font-semibold ${d.utilization > 100 ? 'text-destructive' : d.utilization >= 90 ? 'text-warning' : 'text-success'}`}>{d.utilization.toFixed(1)}%</td><td className="px-4 py-3 whitespace-nowrap text-sm">{formatCurrency(d.allocatedCost)}</td></tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const ReportsPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<ReportTab>('projectCosts');

    return (
        <div>
            <h1 className="text-3xl font-bold text-foreground dark:text-dark-foreground mb-6">Report</h1>

            <div className="mb-6 border-b border-border dark:border-dark-border">
                <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                    <button onClick={() => setActiveTab('projectCosts')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'projectCosts' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300'}`}>
                        Report Costi Progetto
                    </button>
                    <button onClick={() => setActiveTab('resourceUtilization')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'resourceUtilization' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300'}`}>
                        Report Utilizzo Risorse
                    </button>
                </nav>
            </div>
            
            <div className="bg-card dark:bg-dark-card rounded-lg shadow p-6">
                {activeTab === 'projectCosts' && <ProjectCostsReport />}
                {activeTab === 'resourceUtilization' && <ResourceUtilizationReport />}
            </div>
             <style>{`
                .form-input, .form-select {
                   display: block; width: 100%; border-radius: 0.375rem; border-width: 1px;
                   background-color: transparent;
                   padding: 0.5rem 0.75rem; font-size: 0.875rem; line-height: 1.25rem;
                   --tw-border-opacity: 1;
                   border-color: rgb(226 232 240 / var(--tw-border-opacity));
                }
                .dark .form-input, .dark .form-select {
                    --tw-border-opacity: 1;
                    border-color: rgb(30 41 59 / var(--tw-border-opacity));
                }
                .form-input:focus, .form-select:focus {
                    --tw-ring-color: #2563eb;
                    border-color: #2563eb;
                }
            `}</style>
        </div>
    );
};

export default ReportsPage;