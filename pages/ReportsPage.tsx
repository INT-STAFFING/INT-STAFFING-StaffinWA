/**
 * @file ReportsPage.tsx
 * @description Pagina per la visualizzazione di report analitici su costi e utilizzo.
 */

import React, { useState, useMemo } from 'react';
import { useEntitiesContext, useAllocationsContext } from '../context/AppContext';
import SearchableSelect from '../components/SearchableSelect';
import { getWorkingDaysBetween, isHoliday } from '../utils/dateUtils';
import { formatCurrency } from '../utils/formatters';

// --- Tipi e Interfacce Locali ---
type ReportTab = 'projectCosts' | 'resourceUtilization';
type ProjectCostSortKey = 'projectName' | 'clientName' | 'budget' | 'allocatedCost' | 'variance' | 'personDays' | 'avgCostPerDay';
type ResourceUtilizationSortKey = 'resourceName' | 'roleName' | 'availableDays' | 'allocatedDays' | 'utilization' | 'allocatedCost';
type SortDirection = 'ascending' | 'descending';

// --- Funzioni di Utilità ---
const downloadCSV = (csvContent: string, fileName: string) => {
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' }); // Add BOM for Excel
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
        <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">
            <button type="button" onClick={() => requestSort(sortKey)} className="flex items-center space-x-1 hover:text-on-surface">
                <span className={sortConfig?.key === sortKey ? 'font-bold text-on-surface' : ''}>{label}</span>
                <span className="material-symbols-outlined text-sm">{sortConfig?.key === sortKey ? (sortConfig.direction === 'ascending' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more'}</span>
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
                    if (!resource || !assignment.id) return;

                    const role = roles.find(ro => ro.id === resource.roleId);
                    const dailyRate = role?.dailyCost || 0;
                    
                    const assignmentAllocations = allocations[assignment.id];
                    if (assignmentAllocations) {
                        for (const dateStr in assignmentAllocations) {
                             if (resource.lastDayOfWork && dateStr > resource.lastDayOfWork) continue;
                             const allocDate = new Date(dateStr);
                             if (!isHoliday(allocDate, resource.location, companyCalendar) && allocDate.getUTCDay() !== 0 && allocDate.getUTCDay() !== 6) {
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
            `"${d.projectName || ''}"`,
            `"${d.clientName || ''}"`,
            (d.budget || 0).toFixed(2),
            (d.allocatedCost || 0).toFixed(2),
            (d.variance || 0).toFixed(2),
            (d.personDays || 0).toFixed(2),
            (d.avgCostPerDay || 0).toFixed(2)
        ]);
        const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        downloadCSV(csvContent, 'report_costi_progetto.csv');
    };

    const clientOptions = useMemo(() => clients.map(c => ({ value: c.id!, label: c.name })), [clients]);
    const statusOptions = useMemo(() => projectStatuses.map(s => ({ value: s.value, label: s.value })), [projectStatuses]);

    return (
        <div>
            <div className="p-4 bg-surface-container rounded-2xl mb-6">
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <SearchableSelect name="clientId" value={filters.clientId} onChange={(_, v) => setFilters(f => ({...f, clientId: v}))} options={clientOptions} placeholder="Tutti i Clienti"/>
                    <SearchableSelect name="status" value={filters.status} onChange={(_, v) => setFilters(f => ({...f, status: v}))} options={statusOptions} placeholder="Tutti gli Stati"/>
                    <button onClick={exportToCSV} className="inline-flex items-center justify-center px-4 py-2 bg-secondary-container text-on-secondary-container font-semibold rounded-full shadow-sm hover:opacity-90">
                        <span className="material-symbols-outlined mr-2">download</span> Esporta CSV
                    </button>
                 </div>
            </div>
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
                            <SortableHeader label="Progetto" sortKey="projectName" />
                            <SortableHeader label="Cliente" sortKey="clientName" />
                            <SortableHeader label="Budget" sortKey="budget" />
                            <SortableHeader label="Costo Allocato" sortKey="allocatedCost" />
                            <SortableHeader label="Varianza" sortKey="variance" />
                            <SortableHeader label="G/U Allocati" sortKey="personDays" />
                            <SortableHeader label="Costo Medio G/U" sortKey="avgCostPerDay" />
                        </tr>
                    </thead>
                    <tbody className="bg-surface divide-y divide-outline-variant">
                        {sortedData.length > 0 ? (
                            sortedData.map(d => (
                                <tr
                                    key={d.id}
                                    className="h-8 hover:bg-surface-container-low"
                                >
                                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-on-surface">
                                        {d.projectName}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-on-surface-variant">
                                        {d.clientName}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-on-surface-variant">
                                        {formatCurrency(d.budget)}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-on-surface-variant">
                                        {formatCurrency(d.allocatedCost)}
                                    </td>
                                    <td
                                        className={`
                                            px-4 py-3 whitespace-nowrap text-sm font-semibold
                                            ${d.variance >= 0 ? 'text-tertiary' : 'text-error'}
                                        `}
                                    >
                                        {formatCurrency(d.variance)}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-on-surface-variant">
                                        {(d.personDays || 0).toFixed(2)}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-on-surface-variant">
                                        {formatCurrency(d.avgCostPerDay)}
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={7} className="px-6 py-8 text-center text-sm text-on-surface-variant">
                                    Nessun dato trovato per i filtri correnti.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
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

                const workingDays = getWorkingDaysBetween(effectiveStartDate, effectiveEndDate, companyCalendar, resource.location);
                const staffingFactor = (resource.maxStaffingPercentage || 100) / 100;
                const availableDays = workingDays * staffingFactor;
                
                let allocatedDays = 0;
                let allocatedCost = 0;
                const resourceAssignments = assignments.filter(a => a.resourceId === resource.id);
                
                resourceAssignments.forEach(assignment => {
                    if (!assignment.id) return;
                    const assignmentAllocations = allocations[assignment.id];
                    if (assignmentAllocations) {
                        for (const dateStr in assignmentAllocations) {
                            const allocDate = new Date(dateStr);
                            if (allocDate >= firstDay && allocDate <= lastDay && !isHoliday(allocDate, resource.location, companyCalendar) && allocDate.getUTCDay() !== 0 && allocDate.getUTCDay() !== 6) {
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
            }).filter(Boolean) as Exclude<ReturnType<typeof reportData[0]>, null>[];
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
            `"${d.resourceName || ''}"`, 
            `"${d.roleName || ''}"`, 
            (d.availableDays || 0).toFixed(1), 
            (d.allocatedDays || 0).toFixed(2), 
            (d.utilization || 0).toFixed(2), 
            (d.allocatedCost || 0).toFixed(2)
        ]);
        const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        downloadCSV(csvContent, `report_utilizzo_${month}.csv`);
    };
    
    const roleOptions = useMemo(() => roles.map(r => ({ value: r.id!, label: r.name })), [roles]);
    const horizontalOptions = useMemo(() => horizontals.map(h => ({ value: h.value, label: h.value })), [horizontals]);

    return (
        <div>
            <div className="p-4 bg-surface-container rounded-2xl mb-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="form-input"/>
                    <SearchableSelect name="roleId" value={filters.roleId} onChange={(_, v) => setFilters(f => ({...f, roleId: v}))} options={roleOptions} placeholder="Tutti i Ruoli"/>
                    <SearchableSelect name="horizontal" value={filters.horizontal} onChange={(_, v) => setFilters(f => ({...f, horizontal: v}))} options={horizontalOptions} placeholder="Tutti gli Horizontal"/>
                    <button onClick={exportToCSV} className="inline-flex items-center justify-center px-4 py-2 bg-secondary-container text-on-secondary-container font-semibold rounded-full shadow-sm hover:opacity-90">
                        <span className="material-symbols-outlined mr-2">download</span> Esporta CSV
                    </button>
                </div>
            </div>
             <div
                className="
                    max-h-[640px]    // ~20 righe */
                    overflow-y-auto  // scroll verticale interno */
                    overflow-x-auto  // scroll orizzontale quando serve */
                "
            >
                <table className="min-w-full divide-y divide-outline-variant table-fixed">
                    <thead className="sticky top-0 z-10 bg-surface-container-low">
                        <tr>
                            <SortableHeader label="Risorsa" sortKey="resourceName" />
                            <SortableHeader label="Ruolo" sortKey="roleName" />
                            <SortableHeader label="G/U Disponibili" sortKey="availableDays" />
                            <SortableHeader label="G/U Allocati" sortKey="allocatedDays" />
                            <SortableHeader label="Utilizzo" sortKey="utilization" />
                            <SortableHeader label="Costo Allocato" sortKey="allocatedCost" />
                        </tr>
                    </thead>
                    <tbody className="bg-surface divide-y divide-outline-variant">
                       {sortedData.length > 0 ? (
                            sortedData.map(d => (
                                <tr
                                    key={d.id}
                                    className="h-8 hover:bg-surface-container-low"
                                >
                                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-on-surface">
                                        {d.resourceName}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-on-surface-variant">
                                        {d.roleName}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-on-surface-variant">
                                        {(d.availableDays || 0).toFixed(1)}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-on-surface-variant">
                                        {(d.allocatedDays || 0).toFixed(2)}
                                    </td>
                                    <td
                                        className={`
                                            px-4 py-3 whitespace-nowrap text-sm font-semibold
                                            ${
                                                d.utilization > 100
                                                    ? 'text-error'
                                                    : d.utilization >= 90
                                                    ? 'text-on-yellow-container'
                                                    : 'text-tertiary'
                                            }
                                        `}
                                    >
                                        {(d.utilization || 0).toFixed(1)}%
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-on-surface-variant">
                                        {formatCurrency(d.allocatedCost)}
                                    </td>
                                </tr>
                            ))
                        ) : (
                             <tr>
                                <td colSpan={6} className="px-6 py-8 text-center text-sm text-on-surface-variant">
                                    Nessun dato trovato per i filtri correnti.
                                </td>
                            </tr>
                        )}
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
            <h1 className="text-3xl font-bold text-on-background mb-6">Report</h1>

            <div className="mb-6 border-b border-outline-variant">
                <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                    <button onClick={() => setActiveTab('projectCosts')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'projectCosts' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface hover:border-outline'}`}>
                        Report Costi Progetto
                    </button>
                    <button onClick={() => setActiveTab('resourceUtilization')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'resourceUtilization' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface hover:border-outline'}`}>
                        Report Utilizzo Risorse
                    </button>
                </nav>
            </div>
            
            <div className="bg-surface rounded-2xl shadow p-6">
                {activeTab === 'projectCosts' && <ProjectCostsReport />}
                {activeTab === 'resourceUtilization' && <ResourceUtilizationReport />}
            </div>
        </div>
    );
};

export default ReportsPage;