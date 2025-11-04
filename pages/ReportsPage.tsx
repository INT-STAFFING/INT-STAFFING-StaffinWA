/**
 * @file ReportsPage.tsx
 * @description Pagina per la visualizzazione di report analitici su costi e utilizzo.
 */

import React, { useState, useMemo } from 'react';
import { useEntitiesContext, useAllocationsContext } from '../context/AppContext';
import SearchableSelect from '../components/SearchableSelect';
import { getWorkingDaysBetween, isHoliday } from '../utils/dateUtils';
import EmptyState from '../components/FeedbackState';
import { CloudArrowDownIcon, ChartBarIcon, UsersIcon } from '../components/icons';

// --- Tipi e Interfacce Locali ---
type ReportTab = 'projectCosts' | 'resourceUtilization';
type ProjectCostSortKey = 'projectName' | 'clientName' | 'budget' | 'allocatedCost' | 'variance' | 'personDays' | 'avgCostPerDay';
type ResourceUtilizationSortKey = 'resourceName' | 'roleName' | 'availableDays' | 'allocatedDays' | 'utilization' | 'allocatedCost' | 'horizontal';
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
        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
            <button type="button" onClick={() => requestSort(sortKey)} className="flex items-center space-x-1 hover:text-gray-900 dark:hover:text-white">
                <span className={sortConfig?.key === sortKey ? 'font-bold text-gray-800 dark:text-white' : ''}>{label}</span>
                <span className="text-gray-400">↕️</span>
            </button>
        </th>
    );

    return { sortConfig, SortableHeader };
};

// --- Componenti Principali dei Report ---

const ProjectCostsReport: React.FC = () => {
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
                    if (!resource) return;

                    const role = roles.find(ro => ro.id === resource?.roleId);
                    const dailyRate = role?.dailyCost || 0;

                    const assignmentAllocations = allocations[assignment.id];
                    if (assignmentAllocations) {
                        for (const dateStr in assignmentAllocations) {
                            if (resource.lastDayOfWork && dateStr > resource.lastDayOfWork) continue;

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
    const hasData = sortedData.length > 0;

    return (
        <div className="space-y-6">
            <div className="surface-card p-5">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:items-end">
                    <SearchableSelect
                        name="clientId"
                        value={filters.clientId}
                        onChange={(_, v) => setFilters(f => ({ ...f, clientId: v }))}
                        options={clientOptions}
                        placeholder="Tutti i Clienti"
                    />
                    <SearchableSelect
                        name="status"
                        value={filters.status}
                        onChange={(_, v) => setFilters(f => ({ ...f, status: v }))}
                        options={statusOptions}
                        placeholder="Tutti gli Stati"
                    />
                    <button
                        onClick={exportToCSV}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-soft hover:bg-primary-darker"
                    >
                        <CloudArrowDownIcon className="w-4 h-4" aria-hidden />
                        Esporta CSV
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto rounded-3xl border border-border/70 dark:border-dark-border/70 bg-card dark:bg-dark-card shadow-soft">
                <table className="min-w-full" style={{ tableLayout: 'auto' }}>
                    <thead className="sticky top-0 z-10 bg-muted/70 backdrop-blur-sm dark:bg-dark-muted/80">
                        <tr>
                            <SortableHeader label="Progetto" sortKey="projectName" />
                            <SortableHeader label="Cliente" sortKey="clientName" />
                            <SortableHeader label="Budget" sortKey="budget" />
                            <SortableHeader label="Costo Allocato" sortKey="allocatedCost" />
                            <SortableHeader label="Varianza" sortKey="variance" />
                            <SortableHeader label="G/U Allocati" sortKey="personDays" />
                            <SortableHeader label="Costo Medio G/U" sortKey="avgCostPerDay" />
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 dark:divide-dark-border/60 text-sm">
                        {sortedData.map(d => (
                            <tr key={d.id} className="odd:bg-muted/40 dark:odd:bg-dark-muted/40">
                                <td className="px-4 py-4 text-sm font-semibold text-foreground dark:text-dark-foreground">{d.projectName}</td>
                                <td className="px-4 py-4 text-sm text-muted-foreground dark:text-dark-muted-foreground">{d.clientName}</td>
                                <td className="px-4 py-4 text-sm">{formatCurrency(d.budget)}</td>
                                <td className="px-4 py-4 text-sm">{formatCurrency(d.allocatedCost)}</td>
                                <td className={`px-4 py-4 text-sm font-semibold ${d.variance >= 0 ? 'text-success' : 'text-destructive'}`}>{formatCurrency(d.variance)}</td>
                                <td className="px-4 py-4 text-sm">{d.personDays.toFixed(2)}</td>
                                <td className="px-4 py-4 text-sm">{formatCurrency(d.avgCostPerDay)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {!hasData && (
                    <div className="px-6 py-10">
                        <EmptyState
                            title="Nessun progetto disponibile"
                            description="Applica filtri differenti o assicurati che i progetti abbiano budget e assegnazioni registrate."
                            icon={<ChartBarIcon className="w-12 h-12" aria-hidden />}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};



const ResourceUtilizationReport: React.FC = () => {
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
            .filter(r => !r.resigned)
            .filter(r => (!filters.roleId || r.roleId === filters.roleId) && (!filters.horizontal || r.horizontal === filters.horizontal))
            .map(resource => {
                const role = roles.find(ro => ro.id === resource.roleId);

                const effectiveStartDate = new Date(resource.hireDate) > firstDay ? new Date(resource.hireDate) : firstDay;
                const effectiveEndDate = resource.lastDayOfWork && new Date(resource.lastDayOfWork) < lastDay ? new Date(resource.lastDayOfWork) : lastDay;

                if (effectiveStartDate > effectiveEndDate) return null;

                const availableDays = getWorkingDaysBetween(effectiveStartDate, effectiveEndDate, companyCalendar, resource.location);

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
                                if (role?.dailyCost) {
                                    allocatedCost += dayFraction * role.dailyCost;
                                }
                            }
                        }
                    }
                });

                const utilization = availableDays > 0 ? (allocatedDays / availableDays) * 100 : 0;

                return {
                    id: resource.id!,
                    resourceName: resource.name,
                    roleName: role?.name || 'N/A',
                    availableDays,
                    allocatedDays,
                    utilization,
                    allocatedCost,
                    horizontal: resource.horizontal || 'N/A',
                };
            })
            .filter(Boolean) as {
                id: string;
                resourceName: string;
                roleName: string;
                availableDays: number;
                allocatedDays: number;
                utilization: number;
                allocatedCost: number;
                horizontal: string;
            }[];
    }, [resources, roles, assignments, allocations, month, companyCalendar, filters, horizontals]);

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

    const roleOptions = useMemo(() => roles.map(r => ({ value: r.id!, label: r.name })), [roles]);
    const horizontalOptions = useMemo(() => horizontals.map(h => ({ value: h.value, label: h.value })), [horizontals]);

    const exportToCSV = () => {
        const headers = ["Risorsa", "Ruolo", "Giorni Disponibili", "Giorni Allocati", "Utilizzo (%)", "Costo Allocato", "Horizontal"];
        const rows = sortedData.map(d => [
            `"${d.resourceName}"`,
            `"${d.roleName}"`,
            d.availableDays.toFixed(2),
            d.allocatedDays.toFixed(2),
            d.utilization.toFixed(2),
            d.allocatedCost.toFixed(2),
            `"${d.horizontal}"`
        ]);
        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
        downloadCSV(csvContent, 'report_utilizzo_risorse.csv');
    };

    const hasData = sortedData.length > 0;

    return (
        <div className="space-y-6">
            <div className="surface-card p-5">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-4 md:items-end">
                    <div className="space-y-1">
                        <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Mese</label>
                        <input
                            type="month"
                            value={month}
                            onChange={e => setMonth(e.target.value)}
                            className="w-full rounded-xl border border-border/70 bg-card px-3 py-2 text-sm shadow-soft focus:border-primary focus:outline-none"
                        />
                    </div>
                    <SearchableSelect
                        name="roleId"
                        value={filters.roleId}
                        onChange={(_, v) => setFilters(f => ({ ...f, roleId: v }))}
                        options={roleOptions}
                        placeholder="Tutti i Ruoli"
                    />
                    <SearchableSelect
                        name="horizontal"
                        value={filters.horizontal}
                        onChange={(_, v) => setFilters(f => ({ ...f, horizontal: v }))}
                        options={horizontalOptions}
                        placeholder="Tutti gli Horizontal"
                    />
                    <button
                        onClick={exportToCSV}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-soft hover:bg-primary-darker"
                    >
                        <CloudArrowDownIcon className="w-4 h-4" aria-hidden />
                        Esporta CSV
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto rounded-3xl border border-border/70 dark:border-dark-border/70 bg-card dark:bg-dark-card shadow-soft">
                <table className="min-w-full" style={{ tableLayout: 'auto' }}>
                    <thead className="sticky top-0 z-10 bg-muted/70 backdrop-blur-sm dark:bg-dark-muted/80">
                        <tr>
                            <SortableHeader label="Risorsa" sortKey="resourceName" />
                            <SortableHeader label="Ruolo" sortKey="roleName" />
                            <SortableHeader label="Disponibilità" sortKey="availableDays" />
                            <SortableHeader label="Allocazione" sortKey="allocatedDays" />
                            <SortableHeader label="Utilizzo" sortKey="utilization" />
                            <SortableHeader label="Costo Allocato" sortKey="allocatedCost" />
                            <SortableHeader label="Horizontal" sortKey="horizontal" />
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 dark:divide-dark-border/60 text-sm">
                        {sortedData.map(d => (
                            <tr key={d.id} className="odd:bg-muted/40 dark:odd:bg-dark-muted/40">
                                <td className="px-4 py-4 text-sm font-semibold text-foreground dark:text-dark-foreground">{d.resourceName}</td>
                                <td className="px-4 py-4 text-sm text-muted-foreground dark:text-dark-muted-foreground">{d.roleName}</td>
                                <td className="px-4 py-4 text-sm">{d.availableDays.toFixed(2)}</td>
                                <td className="px-4 py-4 text-sm">{d.allocatedDays.toFixed(2)}</td>
                                <td className="px-4 py-4">
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm font-semibold">{d.utilization.toFixed(1)}%</span>
                                        <div className="h-2 w-32 rounded-full bg-muted/60 dark:bg-dark-muted/60 overflow-hidden">
                                            <div
                                                className="h-full rounded-full bg-primary"
                                                style={{ width: `${Math.min(d.utilization, 120)}%` }}
                                            />
                                        </div>
                                    </div>
                                </td>
                                <td className="px-4 py-4 text-sm">{formatCurrency(d.allocatedCost)}</td>
                                <td className="px-4 py-4 text-sm">{d.horizontal}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {!hasData && (
                    <div className="px-6 py-10">
                        <EmptyState
                            title="Nessuna risorsa corrisponde ai filtri"
                            description="Seleziona un altro mese o rimuovi i filtri per consultare l'utilizzo del team."
                            icon={<UsersIcon className="w-12 h-12" aria-hidden />}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

const ReportsPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<ReportTab>('projectCosts');

    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-6">Report</h1>

            <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
                <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                    <button onClick={() => setActiveTab('projectCosts')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'projectCosts' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                        Report Costi Progetto
                    </button>
                    <button onClick={() => setActiveTab('resourceUtilization')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'resourceUtilization' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                        Report Utilizzo Risorse
                    </button>
                </nav>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                {activeTab === 'projectCosts' && <ProjectCostsReport />}
                {activeTab === 'resourceUtilization' && <ResourceUtilizationReport />}
            </div>
             <style>{`.form-input, .form-select { display: block; width: 100%; border-radius: 0.375rem; border: 1px solid #D1D5DB; background-color: #FFFFFF; padding: 0.5rem 0.75rem; font-size: 0.875rem; line-height: 1.25rem; } .dark .form-input, .dark .form-select { border-color: #4B5563; background-color: #374151; color: #F9FAFB; }`}</style>
        </div>
    );
};

export default ReportsPage;