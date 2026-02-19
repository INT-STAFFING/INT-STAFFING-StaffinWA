/**
 * @file ReportsPage.tsx
 * @description Pagina per la visualizzazione di report analitici su costi e utilizzo utilizzando il componente DataTable.
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useEntitiesContext, useAllocationsContext } from '../context/AppContext';
import SearchableSelect from '../components/SearchableSelect';
import { getWorkingDaysBetween, isHoliday } from '../utils/dateUtils';
import { formatCurrency } from '../utils/formatters';
import { DataTable, ColumnDef } from '../components/DataTable';
import ExportButton from '../components/ExportButton';
import PdfExportButton from '../components/PdfExportButton';
import { PdfExportConfig, CHART_PALETTE } from '../utils/pdfExportUtils';

// --- Tipi e Interfacce Locali ---
type ReportTab = 'projectCosts' | 'resourceUtilization';

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

// --- Componenti Principali dei Report ---

const ProjectCostsReport: React.FC = () => {
    const { projects, clients, assignments, resources, contracts, projectStatuses, companyCalendar, getRoleCost, getSellRate, loading, projectExpenses } = useEntitiesContext();
    const { allocations } = useAllocationsContext();
    const [filters, setFilters] = useState({ clientId: '', status: '' });

    const reportData = useMemo(() => {
        return projects
            .filter(p => (!filters.clientId || p.clientId === filters.clientId) && (!filters.status || p.status === filters.status))
            .map(project => {
                let allocatedCost = 0;
                let estimatedRevenue = 0;
                let personDays = 0;
                
                // 1. Calculate Staffing (Labor) Costs
                const projectAssignments = assignments.filter(a => a.projectId === project.id);
                
                // Determine rate card ID from contract
                const contract = contracts.find(c => c.id === project.contractId);
                const rateCardId = contract?.rateCardId;

                projectAssignments.forEach(assignment => {
                    const resource = resources.find(r => r.id === assignment.resourceId);
                    if (!resource || !assignment.id) return;
                    
                    const assignmentAllocations = allocations[assignment.id];
                    if (assignmentAllocations) {
                        for (const dateStr in assignmentAllocations) {
                             if (resource.lastDayOfWork && dateStr > resource.lastDayOfWork) continue;
                             const allocDate = new Date(dateStr);
                             if (!isHoliday(allocDate, resource.location, companyCalendar) && allocDate.getUTCDay() !== 0 && allocDate.getUTCDay() !== 6) {
                                const dayFraction = (assignmentAllocations[dateStr] || 0) / 100;
                                
                                // Cost Calculation (Historical)
                                const dailyCostRate = getRoleCost(resource.roleId, allocDate);
                                
                                // Revenue Calculation (Sell Rate)
                                const dailySellRate = getSellRate(rateCardId, resource.roleId);
                                
                                personDays += dayFraction;
                                allocatedCost += dayFraction * dailyCostRate;
                                estimatedRevenue += dayFraction * dailySellRate;
                             }
                        }
                    }
                });

                // 2. Calculate Non-Labor Costs (Expenses)
                const expenses = projectExpenses.filter(e => e.projectId === project.id);
                const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
                
                // 3. Final Aggregation
                const budget = Number(project.budget || 0);
                const totalCost = allocatedCost + totalExpenses;
                
                // Margin = Revenue - (Labor Cost + Expenses)
                const margin = estimatedRevenue - totalCost;
                const marginPercentage = estimatedRevenue > 0 ? (margin / estimatedRevenue) * 100 : 0;
                
                // Variance (Budget Remaining) = Budget - Total Cost
                const variance = budget - totalCost;

                return {
                    id: project.id,
                    projectName: project.name,
                    clientName: clients.find(c => c.id === project.clientId)?.name || 'N/A',
                    budget,
                    laborCost: allocatedCost,
                    expensesCost: totalExpenses,
                    totalCost,
                    estimatedRevenue,
                    margin,
                    marginPercentage,
                    variance,
                    personDays
                };
            });
    }, [projects, filters, clients, assignments, resources, contracts, companyCalendar, allocations, getRoleCost, getSellRate, projectExpenses]);
    
    const exportData = useMemo(() => {
        return reportData.map(d => ({
            'Progetto': d.projectName,
            'Cliente': d.clientName,
            'Budget': formatCurrency(d.budget),
            'Costo Labor': formatCurrency(d.laborCost),
            'Spese Extra': formatCurrency(d.expensesCost),
            'Costo Totale': formatCurrency(d.totalCost),
            'Ricavo Stimato': formatCurrency(d.estimatedRevenue),
            'Margine': formatCurrency(d.margin),
            'Margine %': d.marginPercentage.toFixed(2) + '%',
            'Varianza (Budget Residuo)': formatCurrency(d.variance),
            'G/U Allocati': d.personDays.toFixed(1),
        }));
    }, [reportData]);

    const exportToCSV = () => {
        const headers = ["Progetto", "Cliente", "Budget", "Costo Labor", "Spese Extra", "Costo Totale", "Ricavo Stimato", "Margine", "Margine %", "G/U"];
        const rows = reportData.map(d => [
            `"${d.projectName || ''}"`,
            `"${d.clientName || ''}"`,
            (d.budget || 0).toFixed(2),
            (d.laborCost || 0).toFixed(2),
            (d.expensesCost || 0).toFixed(2),
            (d.totalCost || 0).toFixed(2),
            (d.estimatedRevenue || 0).toFixed(2),
            (d.margin || 0).toFixed(2),
            (d.marginPercentage || 0).toFixed(2),
            (d.personDays || 0).toFixed(2)
        ]);
        const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        downloadCSV(csvContent, 'report_marginalita_progetto.csv');
    };

    const clientOptions = useMemo(() => clients.map(c => ({ value: c.id!, label: c.name })), [clients]);
    const statusOptions = useMemo(() => projectStatuses.map(s => ({ value: s.value, label: s.value })), [projectStatuses]);

    // DataTable Config
    const columns: ColumnDef<typeof reportData[0]>[] = [
        { header: "Progetto", sortKey: "projectName", cell: d => <span className="font-medium text-on-surface sticky left-0 bg-inherit pl-6">{d.projectName}</span> },
        { header: "Cliente", sortKey: "clientName", cell: d => <span className="text-sm text-on-surface-variant">{d.clientName}</span> },
        { header: "Budget", sortKey: "budget", cell: d => <span className="text-sm text-on-surface-variant">{formatCurrency(d.budget)}</span> },
        { header: "Costo Labor", sortKey: "laborCost", cell: d => <span className="text-sm text-on-surface-variant">{formatCurrency(d.laborCost)}</span> },
        { header: "Spese Extra", sortKey: "expensesCost", cell: d => <span className="text-sm text-on-surface-variant">{formatCurrency(d.expensesCost)}</span> },
        { header: "Ricavo (T&M)", sortKey: "estimatedRevenue", cell: d => <span className="text-sm font-semibold text-primary">{formatCurrency(d.estimatedRevenue)}</span> },
        { header: "Margine", sortKey: "margin", cell: d => <span className={`text-sm font-bold ${d.margin >= 0 ? 'text-tertiary' : 'text-error'}`}>{formatCurrency(d.margin)}</span> },
        { header: "Margine %", sortKey: "marginPercentage", cell: d => <span className={`text-xs px-2 py-0.5 rounded font-bold ${d.marginPercentage >= 30 ? 'bg-tertiary-container text-on-tertiary-container' : d.marginPercentage > 0 ? 'bg-yellow-container text-on-yellow-container' : 'bg-error-container text-on-error-container'}`}>{d.marginPercentage.toFixed(1)}%</span> },
        { header: "G/U", sortKey: "personDays", cell: d => <span className="text-sm text-on-surface-variant">{d.personDays.toFixed(1)}</span> },
    ];

    const renderRow = (d: typeof reportData[0]) => (
        <tr key={d.id} className="h-12 hover:bg-surface-container-low group">
            {columns.map((col, i) => <td key={i} className="px-6 py-3 whitespace-nowrap text-sm bg-inherit">{col.cell(d)}</td>)}
            <td className="bg-inherit"></td> 
        </tr>
    );

    const renderMobileCard = (d: typeof reportData[0]) => (
        <div key={d.id} className={`bg-surface rounded-2xl shadow p-4 mb-4 border-l-4 ${d.margin >= 0 ? 'border-tertiary' : 'border-error'} flex flex-col gap-3`}>
             <div className="flex justify-between items-start">
                <div>
                    <h3 className="font-bold text-lg text-on-surface">{d.projectName}</h3>
                    <p className="text-sm text-on-surface-variant">{d.clientName}</p>
                </div>
                 <div className={`px-2 py-1 rounded text-xs font-bold ${d.marginPercentage >= 20 ? 'bg-tertiary-container text-on-tertiary-container' : 'bg-yellow-container text-on-yellow-container'}`}>
                    {d.marginPercentage.toFixed(1)}%
                </div>
            </div>

             <div className="grid grid-cols-2 gap-2 mt-1">
                 <div className="bg-surface-container-low p-2 rounded">
                     <span className="text-xs text-on-surface-variant block">Ricavo T&M</span>
                     <span className="text-sm font-semibold text-primary">{formatCurrency(d.estimatedRevenue)}</span>
                 </div>
                 <div className="bg-surface-container-low p-2 rounded">
                     <span className="text-xs text-on-surface-variant block">Costo Totale</span>
                     <span className="text-sm font-semibold text-on-surface">{formatCurrency(d.totalCost)}</span>
                 </div>
             </div>
             
             <div className="pt-2 border-t border-outline-variant flex justify-between items-center">
                 <span className="text-xs text-on-surface-variant">Budget Residuo: {formatCurrency(d.variance)}</span>
                 <span className={`font-bold ${d.margin >= 0 ? 'text-tertiary' : 'text-error'}`}>Margine: {formatCurrency(d.margin)}</span>
             </div>
        </div>
    );

    const buildPdfConfig = useCallback((): PdfExportConfig => {
      const top10 = [...reportData].sort((a, b) => b.totalCost - a.totalCost).slice(0, 10);
      const positiveMargin = reportData.filter(d => d.margin >= 0).length;
      const negativeMargin = reportData.length - positiveMargin;
      return {
        title: 'Report Marginalità per Progetto',
        subtitle: `${reportData.length} progetti analizzati`,
        charts: [
          {
            title: 'Top 10 Progetti per Costo Totale',
            chartJs: {
              type: 'bar',
              data: {
                labels: top10.map(d => d.projectName.length > 20 ? d.projectName.substring(0, 20) + '...' : d.projectName),
                datasets: [
                  { label: 'Budget', data: top10.map(d => Math.round(d.budget)), backgroundColor: CHART_PALETTE[0] + '99' },
                  { label: 'Costo Totale', data: top10.map(d => Math.round(d.totalCost)), backgroundColor: CHART_PALETTE[3] + '99' },
                ],
              },
              options: { plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true } } },
            },
          },
          {
            title: 'Distribuzione Margine',
            chartJs: {
              type: 'pie',
              data: {
                labels: ['Margine Positivo', 'Margine Negativo'],
                datasets: [{ data: [positiveMargin, negativeMargin], backgroundColor: [CHART_PALETTE[2], CHART_PALETTE[3]] }],
              },
              options: { plugins: { legend: { position: 'bottom' } } },
            },
          },
        ],
        tables: [
          {
            title: 'Dettaglio Costi per Progetto',
            head: [['Progetto', 'Cliente', 'Budget', 'Costo Labor', 'Costo Totale', 'Margine', 'Margine %', 'G/U']],
            body: exportData.map(row => [
              String(row['Progetto'] ?? ''),
              String(row['Cliente'] ?? ''),
              String(row['Budget'] ?? ''),
              String(row['Costo Labor'] ?? ''),
              String(row['Costo Totale'] ?? ''),
              String(row['Margine'] ?? ''),
              String(row['Margine %'] ?? ''),
              String(row['G/U Allocati'] ?? ''),
            ]),
          },
        ],
      };
    }, [reportData, exportData]);

    const filtersNode = (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <SearchableSelect name="clientId" value={filters.clientId} onChange={(_, v) => setFilters(f => ({...f, clientId: v}))} options={clientOptions} placeholder="Tutti i Clienti"/>
            <SearchableSelect name="status" value={filters.status} onChange={(_, v) => setFilters(f => ({...f, status: v}))} options={statusOptions} placeholder="Tutti gli Stati"/>
            <div className="flex flex-wrap items-center gap-2">
                <button onClick={exportToCSV} className="inline-flex items-center justify-center px-4 py-2 bg-secondary-container text-on-secondary-container font-semibold rounded-full shadow-sm hover:opacity-90">
                    <span className="material-symbols-outlined mr-2">download</span> Esporta CSV
                </button>
                <ExportButton data={exportData} title="Marginalità per Progetto" />
                <PdfExportButton buildConfig={buildPdfConfig} />
            </div>
        </div>
    );

    return (
        <DataTable
            title=""
            addNewButtonLabel=""
            onAddNew={() => {}}
            data={reportData}
            columns={columns}
            filtersNode={filtersNode}
            renderRow={renderRow}
            renderMobileCard={renderMobileCard}
            initialSortKey="projectName"
            isLoading={loading}
            tableLayout={{ dense: true, striped: true, headerSticky: true }}
        />
    );
};


const ResourceUtilizationReport: React.FC = () => {
    // Corrected destructuring using functions instead of horizontals
    const { resources, roles, assignments, companyCalendar, functions, getRoleCost, loading } = useEntitiesContext();
    const { allocations } = useAllocationsContext();
    const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
    // Updated filters state horizontal -> function
    const [filters, setFilters] = useState({ roleId: '', function: '' });

    const reportData = useMemo(() => {
        const [year, monthNum] = month.split('-').map(Number);
        const firstDay = new Date(year, monthNum - 1, 1);
        const lastDay = new Date(year, monthNum, 0);

        return resources
            .filter(r => !r.resigned)
            // Corrected usage of resource.function instead of resource.horizontal
            .filter(r => (!filters.roleId || r.roleId === filters.roleId) && (!filters.function || r.function === filters.function))
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
                                
                                // Use historical cost
                                const dailyRate = getRoleCost(resource.roleId, allocDate);
                                allocatedCost += dayFraction * dailyRate;
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
            }).filter(Boolean) as {
                id: string | undefined;
                resourceName: string;
                roleName: string;
                availableDays: number;
                allocatedDays: number;
                utilization: number;
                allocatedCost: number;
            }[];
    }, [resources, roles, assignments, companyCalendar, month, filters, allocations, getRoleCost]);
    
    const exportData = useMemo(() => {
        return reportData.map(d => ({
            'Risorsa': d.resourceName,
            'Ruolo': d.roleName,
            'G/U Disponibili': d.availableDays.toFixed(1),
            'G/U Allocati': d.allocatedDays.toFixed(1),
            'Utilizzo (%)': d.utilization.toFixed(0),
            'Costo Allocato': formatCurrency(d.allocatedCost)
        }));
    }, [reportData]);

    const exportToCSV = () => {
        const headers = ["Risorsa", "Ruolo", "Giorni Disponibili", "Giorni Allocati", "Utilizzo (%)", "Costo Allocato"];
        const rows = reportData.map(d => [
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
    // Corrected functionOptions instead of horizontalOptions
    const functionOptions = useMemo(() => functions.map(h => ({ value: h.value, label: h.value })), [functions]);

    // DataTable Config
    const columns: ColumnDef<typeof reportData[0]>[] = [
        { header: "Risorsa", sortKey: "resourceName", cell: d => <span className="font-medium text-on-surface sticky left-0 bg-inherit pl-6">{d.resourceName}</span> },
        { header: "Ruolo", sortKey: "roleName", cell: d => <span className="text-sm text-on-surface-variant">{d.roleName}</span> },
        { header: "G/U Disponibili", sortKey: "availableDays", cell: d => <span className="text-sm text-on-surface-variant">{d.availableDays.toFixed(1)}</span> },
        { header: "G/U Allocati", sortKey: "allocatedDays", cell: d => <span className="text-sm text-on-surface-variant">{d.allocatedDays.toFixed(2)}</span> },
        { header: "Utilizzo", sortKey: "utilization", cell: d => <span className={`text-sm font-semibold ${d.utilization > 100 ? 'text-error' : d.utilization > 95 ? 'text-tertiary' : 'text-yellow-600 dark:text-yellow-400'}`}>{d.utilization.toFixed(1)}%</span> },
        { header: "Costo Allocato", sortKey: "allocatedCost", cell: d => <span className="text-sm text-on-surface-variant">{formatCurrency(d.allocatedCost)}</span> },
    ];

    const renderRow = (d: typeof reportData[0]) => (
        <tr key={d.id} className="h-12 hover:bg-surface-container-low group">
            {columns.map((col, i) => <td key={i} className="px-6 py-3 whitespace-nowrap text-sm bg-inherit">{col.cell(d)}</td>)}
            <td className="bg-inherit"></td>
        </tr>
    );

    const renderMobileCard = (data: typeof reportData[0]) => {
         const getBarColor = (util: number) => {
            if (util > 100) return 'bg-error';
            if (util > 90) return 'bg-tertiary';
            return 'bg-primary';
        };

        return (
            <div key={data.id} className="bg-surface rounded-2xl shadow p-4 mb-4 border-l-4 border-secondary flex flex-col gap-3">
                <div className="flex justify-between items-center">
                    <div>
                        <h3 className="font-bold text-lg text-on-surface">{data.resourceName}</h3>
                        <p className="text-sm text-on-surface-variant">{data.roleName}</p>
                    </div>
                    <div className="text-right">
                        <span className="block font-bold text-lg text-on-surface">{data.utilization.toFixed(0)}%</span>
                         <span className="text-xs text-on-surface-variant">Utilizzo</span>
                    </div>
                </div>

                 <div className="w-full bg-surface-container-highest rounded-full h-2.5">
                     <div 
                        className={`h-2.5 rounded-full ${getBarColor(data.utilization)}`} 
                        style={{ width: `${Math.min(data.utilization, 100)}%` }}
                    ></div>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-2 text-sm text-center">
                     <div className="bg-surface-container-low p-1 rounded">
                         <span className="block text-xs text-on-surface-variant">Disponibili</span>
                         <span className="font-semibold">{data.availableDays.toFixed(1)}</span>
                     </div>
                     <div className="bg-surface-container-low p-1 rounded">
                         <span className="block text-xs text-on-surface-variant">Allocati</span>
                         <span className="font-semibold">{data.allocatedDays.toFixed(1)}</span>
                     </div>
                      <div className="bg-surface-container-low p-1 rounded">
                         <span className="block text-xs text-on-surface-variant">Costo</span>
                         <span className="font-semibold">{formatCurrency(data.allocatedCost)}</span>
                     </div>
                </div>
            </div>
        )
    };

    const buildPdfConfig = useCallback((): PdfExportConfig => {
      const top10 = [...reportData].sort((a, b) => b.utilization - a.utilization).slice(0, 10);
      const over = reportData.filter(d => d.utilization > 90).length;
      const good = reportData.filter(d => d.utilization >= 60 && d.utilization <= 90).length;
      const under = reportData.filter(d => d.utilization < 60).length;
      return {
        title: 'Report Utilizzo Risorse',
        subtitle: `${reportData.length} risorse analizzate`,
        charts: [
          {
            title: 'Top 10 Risorse per Utilizzo (%)',
            chartJs: {
              type: 'bar',
              data: {
                labels: top10.map(d => d.resourceName.length > 20 ? d.resourceName.substring(0, 20) + '...' : d.resourceName),
                datasets: [{ label: 'Utilizzo %', data: top10.map(d => Math.round(d.utilization)), backgroundColor: CHART_PALETTE[1] }],
              },
              options: { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { max: 120 } } },
            },
          },
          {
            title: 'Distribuzione Utilizzo',
            chartJs: {
              type: 'doughnut',
              data: {
                labels: ['Sovraccarico (>90%)', 'Ottimale (60-90%)', 'Sottoutilizzato (<60%)'],
                datasets: [{ data: [over, good, under], backgroundColor: [CHART_PALETTE[3], CHART_PALETTE[2], CHART_PALETTE[4]] }],
              },
              options: { plugins: { legend: { position: 'bottom' } } },
            },
          },
        ],
        tables: [
          {
            title: 'Dettaglio Utilizzo Risorse',
            head: [['Risorsa', 'Ruolo', 'G/U Disponibili', 'G/U Allocati', 'Utilizzo %', 'Costo Allocato']],
            body: exportData.map(row => [
              String(row['Risorsa'] ?? ''),
              String(row['Ruolo'] ?? ''),
              String(row['G/U Disponibili'] ?? ''),
              String(row['G/U Allocati'] ?? ''),
              String(row['Utilizzo (%)'] ?? ''),
              String(row['Costo Allocato'] ?? ''),
            ]),
          },
        ],
      };
    }, [reportData, exportData]);

    const filtersNode = (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="form-input"/>
            <SearchableSelect name="roleId" value={filters.roleId} onChange={(_, v) => setFilters(f => ({...f, roleId: v}))} options={roleOptions} placeholder="Tutti i Ruoli"/>
            <SearchableSelect name="function" value={filters.function} onChange={(_, v) => setFilters(f => ({...f, function: v}))} options={functionOptions} placeholder="Tutte le Function"/>
            <div className="flex flex-wrap items-center gap-2">
                <button onClick={exportToCSV} className="inline-flex items-center justify-center px-4 py-2 bg-secondary-container text-on-secondary-container font-semibold rounded-full shadow-sm hover:opacity-90">
                    <span className="material-symbols-outlined mr-2">download</span> Esporta CSV
                </button>
                <ExportButton data={exportData} title="Utilizzo Risorse" />
                <PdfExportButton buildConfig={buildPdfConfig} />
            </div>
        </div>
    );

    return (
        <DataTable
            title=""
            addNewButtonLabel=""
            onAddNew={() => {}}
            data={reportData}
            columns={columns}
            filtersNode={filtersNode}
            renderRow={renderRow}
            renderMobileCard={renderMobileCard}
            initialSortKey="resourceName"
            isLoading={loading}
            tableLayout={{ dense: true, striped: true, headerSticky: true }}
        />
    );
};

const ReportsPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<ReportTab>('projectCosts');

    return (
        <div>
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4 p-4 bg-surface rounded-2xl shadow">
                <h1 className="text-3xl font-bold text-on-surface">Report e Analisi</h1>
                
                <div className="flex items-center space-x-1 bg-surface-container p-1 rounded-full">
                    <button 
                        onClick={() => setActiveTab('projectCosts')} 
                        className={`px-4 py-2 text-sm font-medium rounded-full transition-all duration-200 ${activeTab === 'projectCosts' ? 'bg-surface text-primary shadow' : 'text-on-surface-variant hover:text-on-surface'}`}
                    >
                        Costi e Margini
                    </button>
                    <button 
                        onClick={() => setActiveTab('resourceUtilization')} 
                        className={`px-4 py-2 text-sm font-medium rounded-full transition-all duration-200 ${activeTab === 'resourceUtilization' ? 'bg-surface text-primary shadow' : 'text-on-surface-variant hover:text-on-surface'}`}
                    >
                        Utilizzo Risorse
                    </button>
                </div>
            </div>

            <div className="animate-fade-in">
                {activeTab === 'projectCosts' && <ProjectCostsReport />}
                {activeTab === 'resourceUtilization' && <ResourceUtilizationReport />}
            </div>
        </div>
    );
};

export default ReportsPage;