
/**
 * @file DashboardCards.tsx
 * @description Sotto-componenti card presentazionali della Dashboard, estratti da DashboardPage.tsx.
 */

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useResourcesContext } from '../../context/ResourcesContext';
import { useHRContext } from '../../context/HRContext';
import { useAuth } from '../../context/AuthContext';
import { formatDateFull } from '../../utils/dateUtils';
import SearchableSelect from '../../components/SearchableSelect';
import { Link } from 'react-router-dom';
import { DashboardDataTable } from '../../components/DashboardDataTable';
import { ColumnDef } from '../../components/DataTable';
import GraphDataView from '../../components/GraphDataView';
import { select } from 'd3-selection';
import { scaleTime, scaleLinear, scaleBand, scaleOrdinal } from 'd3-scale';
import { extent, max } from 'd3-array';
import { axisBottom, axisLeft } from 'd3-axis';
import { timeFormat } from 'd3-time-format';
import { line, stack } from 'd3-shape';
import { format } from 'd3-format';
import { formatCurrency } from '../../utils/formatters';
import ExportButton from '../../components/ExportButton';
import { exportCardToPdf, buildQuickChartUrl } from '../../utils/pdfExport';
import { DASHBOARD_COLORS, getAvgAllocationColor } from './dashboardConstants';
import type {
    KpiHeaderCardsProps,
    AttentionCardsProps,
    UnallocatedFteCardProps,
    NoWbsLeakageCardProps,
    LeavesOverviewCardProps,
    AverageAllocationCardProps,
    AverageAllocationRow,
    FtePerProjectCardProps,
    FtePerProjectRow,
    BudgetAnalysisCardProps,
    BudgetAnalysisRow,
    TemporalBudgetAnalysisCardProps,
    TemporalBudgetAnalysisRow,
    AverageDailyRateCardProps,
    AverageDailyRateRow,
    UnderutilizedResourcesCardProps,
    UnderutilizedResourceRow,
    MonthlyClientCostCardProps,
    ClientCostEntry,
    EffortByFunctionCardProps,
    EffortByIndustryCardProps,
    EffortRow,
    LocationAnalysisCardProps,
    LocationAnalysisRow,
    SaturationTrendCardProps,
    CostForecastCardProps,
    AllocationMatrixCardProps,
    RevenueByIndustryCardProps,
    BenchByFunctionCardProps,
    BenchByIndustryCardProps,
    NamedValueRow,
    WbsSaturationCardProps,
    ContractExpirationsCardProps,
    ContractExpirationRow,
    RevenueMixCardProps,
    BillingPipelineCardProps,
    TopMarginProjectsCardProps,
    TopMarginProjectRow,
} from './dashboardTypes';
import 'd3-transition'; // Import transition to avoid crashes

// --- Child Components for each Card ---

export const KpiHeaderCards: React.FC<KpiHeaderCardsProps> = ({ overallKPIs, currentMonthKPIs }) => (
    <>
        <div className="bg-surface-container-low rounded-2xl shadow p-5 border-l-4 border-primary">
            <h3 className="text-sm font-medium text-on-surface-variant">Budget Complessivo</h3>
            <p className="mt-1 text-3xl font-semibold text-on-surface">{formatCurrency(overallKPIs.totalBudget)}</p>
        </div>
        <div className="bg-surface-container-low rounded-2xl shadow p-5 border-l-4 border-error">
            <h3 className="text-sm font-medium text-on-surface-variant">Costo Stimato (Mese Corrente)</h3>
            <p className="mt-1 text-3xl font-semibold text-on-surface">{formatCurrency(currentMonthKPIs.totalCost)}</p>
        </div>
        <div className="bg-surface-container-low rounded-2xl shadow p-5 border-l-4 border-tertiary">
            <h3 className="text-sm font-medium text-on-surface-variant">Giorni Allocati (Mese Corrente)</h3>
            <p className="mt-1 text-3xl font-semibold text-on-surface">{currentMonthKPIs.totalPersonDays.toLocaleString('it-IT', { maximumFractionDigits: 0 })}</p>
        </div>
    </>
);

export const AttentionCards: React.FC<AttentionCardsProps> = ({ overallKPIs, navigate }) => (
    <>
        <div className={`${DASHBOARD_COLORS.attention.background} rounded-2xl shadow p-5 flex flex-col justify-start cursor-pointer ${DASHBOARD_COLORS.attention.hoverBackground} min-h-[150px] border-l-4 border-error`} onClick={() => navigate('/resources?filter=unassigned')}>
            <div className="flex justify-between items-start w-full">
                <div>
                    <h3 className={`text-sm font-medium ${DASHBOARD_COLORS.attention.text}`}>Risorse Non Allocate</h3>
                    <div className="mt-1 flex items-baseline gap-2">
                        <p className={`text-3xl ${DASHBOARD_COLORS.attention.strongText}`}>{overallKPIs.unassignedResources.length}</p>
                        <p className={`text-sm ${DASHBOARD_COLORS.attention.text}`}>su {overallKPIs.totalActiveResources} totali</p>
                    </div>
                </div>
                <span className={`material-symbols-outlined ${DASHBOARD_COLORS.attention.icon}`}>person_off</span>
            </div>
            {overallKPIs.unassignedResources.length > 0 && (
                <div className={`mt-2 text-xs ${DASHBOARD_COLORS.attention.text} overflow-y-auto max-h-20 pr-2 w-full`}>
                    <ul className="list-disc list-inside">{overallKPIs.unassignedResources.slice(0, 5).map((r) => <li key={r.id} className="truncate">{r.name}</li>)}</ul>
                </div>
            )}
        </div>
        <div className={`${DASHBOARD_COLORS.attention.background} rounded-2xl shadow p-5 flex flex-col justify-start cursor-pointer ${DASHBOARD_COLORS.attention.hoverBackground} min-h-[150px] border-l-4 border-error`} onClick={() => navigate('/projects?filter=unstaffed')}>
            <div className="flex justify-between items-start w-full">
                <div>
                    <h3 className={`text-sm font-medium ${DASHBOARD_COLORS.attention.text}`}>Progetti Senza Staff</h3>
                    <div className="mt-1 flex items-baseline gap-2">
                        <p className={`text-3xl ${DASHBOARD_COLORS.attention.strongText}`}>{overallKPIs.unstaffedProjects.length}</p>
                        <p className={`text-sm ${DASHBOARD_COLORS.attention.text}`}>su {overallKPIs.totalActiveProjects} attivi</p>
                    </div>
                </div>
                 <span className={`material-symbols-outlined ${DASHBOARD_COLORS.attention.icon}`}>work_off</span>
            </div>
            {overallKPIs.unstaffedProjects.length > 0 && (
                <div className={`mt-2 text-xs ${DASHBOARD_COLORS.attention.text} overflow-y-auto max-h-20 pr-2 w-full`}>
                    <ul className="list-disc list-inside">{overallKPIs.unstaffedProjects.slice(0, 5).map((p) => <li key={p.id} className="truncate">{p.name}</li>)}</ul>
                </div>
            )}
        </div>
    </>
);

export const UnallocatedFteCard: React.FC<UnallocatedFteCardProps> = ({ kpis }) => (
    <div className={`${DASHBOARD_COLORS.attention.background} rounded-2xl shadow p-5 flex flex-col justify-start min-h-[150px] border-l-4 border-secondary`}>
        <div className="flex justify-between items-start w-full">
            <div>
                <h3 className={`text-sm font-medium ${DASHBOARD_COLORS.attention.text}`}>FTE Non Allocati (Mese Corrente)</h3>
                <div className="mt-1 flex items-baseline gap-2">
                    <p className={`text-3xl ${DASHBOARD_COLORS.attention.strongText}`}>{kpis.unallocatedFTE > 0 ? kpis.unallocatedFTE.toFixed(1) : '0.0'}</p>
                    <p className={`text-sm ${DASHBOARD_COLORS.attention.text}`}>su {kpis.totalAvailableFTE.toFixed(1)} disponibili</p>
                </div>
            </div>
            <span className={`material-symbols-outlined ${DASHBOARD_COLORS.attention.icon}`}>person_search</span>
        </div>
        <div className="mt-auto pt-2 text-xs text-on-yellow-container/80">
            Calcolato su base FTE e allocazioni del mese corrente.
        </div>
    </div>
);

export const NoWbsLeakageCard: React.FC<NoWbsLeakageCardProps> = ({ leakageAmount, navigate }) => (
    <div className={`${DASHBOARD_COLORS.attention.background} rounded-2xl shadow p-5 flex flex-col justify-start min-h-[150px] border-l-4 border-error cursor-pointer hover:opacity-90`} onClick={() => navigate('/wbs-analysis')}>
         <div className="flex justify-between items-start w-full">
            <div>
                <h3 className={`text-sm font-medium ${DASHBOARD_COLORS.attention.text}`}>Leakage "No WBS" (Mese Corrente)</h3>
                <div className="mt-1 flex items-baseline gap-2">
                    <p className={`text-3xl ${DASHBOARD_COLORS.attention.strongText}`}>{formatCurrency(leakageAmount)}</p>
                </div>
            </div>
            <span className={`material-symbols-outlined ${DASHBOARD_COLORS.attention.icon}`}>money_off</span>
        </div>
         <div className="mt-auto pt-2 text-xs text-on-yellow-container/80">
            Costo stimato allocazioni su progetti senza contratto/WBS.
        </div>
    </div>
);

export const LeavesOverviewCard: React.FC<LeavesOverviewCardProps> = ({ navigate }) => {
    const { leaveRequests, leaveTypes } = useHRContext();
    const { resources } = useResourcesContext();
    const { isAdmin } = useAuth();
    
    const today = new Date().toISOString().split('T')[0];

    const absentToday = useMemo(() => {
        return leaveRequests.filter(l => 
            l.status === 'APPROVED' && 
            today >= l.startDate && 
            today <= l.endDate
        ).map(l => ({
            resourceName: resources.find(r => r.id === l.resourceId)?.name || 'Sconosciuto',
            typeName: leaveTypes.find(t => t.id === l.typeId)?.name || 'Assenza',
            color: leaveTypes.find(t => t.id === l.typeId)?.color || '#ccc'
        }));
    }, [leaveRequests, resources, leaveTypes, today]);

    const pendingCount = useMemo(() => {
        return leaveRequests.filter(l => l.status === 'PENDING').length;
    }, [leaveRequests]);

    return (
        <div className="bg-surface-container-low rounded-2xl shadow p-5 flex flex-col justify-start min-h-[150px] border-l-4 border-tertiary cursor-pointer hover:bg-surface-container" onClick={() => navigate('/leaves')}>
            <div className="flex justify-between items-start w-full mb-3">
                <h3 className="text-sm font-medium text-on-surface-variant">Panoramica Assenze</h3>
                <span className="material-symbols-outlined text-3xl opacity-50 text-tertiary">event_busy</span>
            </div>
            
            <div className="flex-1 space-y-3">
                <div>
                    <p className="text-xs font-bold text-on-surface mb-1">Assenti Oggi ({absentToday.length})</p>
                    {absentToday.length > 0 ? (
                        <ul className="text-xs text-on-surface space-y-1">
                            {absentToday.slice(0, 3).map((a, i) => (
                                <li key={i} className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full" style={{backgroundColor: a.color}}></span>
                                    <span className="truncate">{a.resourceName}</span>
                                </li>
                            ))}
                            {absentToday.length > 3 && <li className="text-on-surface-variant italic">e altri {absentToday.length - 3}...</li>}
                        </ul>
                    ) : (
                        <p className="text-xs text-on-surface-variant italic">Nessuna assenza oggi.</p>
                    )}
                </div>

                {isAdmin && pendingCount > 0 && (
                    <div className="flex items-center gap-2 bg-yellow-container/50 p-2 rounded text-xs">
                        <span className="material-symbols-outlined text-sm text-yellow-700">notifications_active</span>
                        <span className="font-bold text-yellow-900">{pendingCount} richieste in attesa</span>
                    </div>
                )}
            </div>
        </div>
    );
};


// --- Individual Card Components ---

// --- Pulsante esportazione PDF ---
export interface PdfExportButtonProps {
    title: string;
    tableData: Record<string, any>[];
    chartUrl?: string;
}
export const PdfExportButton: React.FC<PdfExportButtonProps> = ({ title, tableData, chartUrl }) => (
    <button
        type="button"
        onClick={() => exportCardToPdf(title, tableData, chartUrl)}
        disabled={tableData.length === 0}
        className="inline-flex items-center gap-2 rounded-full border border-outline-variant bg-surface px-3 py-2 text-sm font-medium text-on-surface shadow-sm transition hover:bg-surface-container focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
        aria-label="Esporta PDF"
        title="Esporta come PDF"
    >
        <span className="material-symbols-outlined text-base">picture_as_pdf</span>
        <span>PDF</span>
    </button>
);

export const ViewToggleButton: React.FC<{ view: 'table' | 'graph', setView: (v: 'table' | 'graph') => void }> = ({ view, setView }) => (
    <div className="flex items-center space-x-1 bg-surface-container p-1 rounded-full">
        <button
            onClick={() => setView('table')}
            className={`px-3 py-1 text-xs font-medium rounded-full flex items-center transition-all ${
                view === 'table'
                    ? 'bg-surface text-primary shadow'
                    : 'text-on-surface-variant hover:text-on-surface'
            }`}
        >
            <span className="material-symbols-outlined text-sm mr-1">table_rows</span>
            Tabella
        </button>
        <button
            onClick={() => setView('graph')}
            className={`px-3 py-1 text-xs font-medium rounded-full flex items-center transition-all ${
                view === 'graph'
                    ? 'bg-surface text-primary shadow'
                    : 'text-on-surface-variant hover:text-on-surface'
            }`}
        >
            <span className="material-symbols-outlined text-sm mr-1">bar_chart</span>
            Grafico
        </button>
    </div>
);


export const AverageAllocationCard: React.FC<AverageAllocationCardProps> = ({ data, filter, setFilter, resourceOptions, totals, isLoading }) => {
    const [view, setView] = useState<'table' | 'graph'>('table');
    const columns: ColumnDef<AverageAllocationRow>[] = [
        { header: 'Risorsa', sortKey: 'resource.name', cell: d => <Link to={`/workload?resourceId=${d.resource.id}`} className={DASHBOARD_COLORS.link}>{d.resource.name}</Link> },
        { header: 'Mese Corrente', sortKey: 'currentMonth', cell: d => <span className={`font-semibold ${getAvgAllocationColor(d.currentMonth)}`}>{d.currentMonth.toFixed(0)}%</span> },
        { header: 'Mese Prossimo', sortKey: 'nextMonth', cell: d => <span className={`font-semibold ${getAvgAllocationColor(d.nextMonth)}`}>{d.nextMonth.toFixed(0)}%</span> },
    ];

    const footer = (
        <tr>
            <td className="px-4 py-2">Media</td>
            <td className={`px-4 py-2 ${getAvgAllocationColor(totals.currentMonth)}`}>{totals.currentMonth.toFixed(0)}%</td>
            <td className={`px-4 py-2 ${getAvgAllocationColor(totals.nextMonth)}`}>{totals.nextMonth.toFixed(0)}%</td>
        </tr>
    );

    const exportData = useMemo(() => {
        return data.map((d) => ({
            Risorsa: d.resource.name,
            'Mese Corrente (%)': d.currentMonth.toFixed(0),
            'Mese Prossimo (%)': d.nextMonth.toFixed(0)
        }));
    }, [data]);
    
    return (
        <div className="bg-surface-container rounded-2xl shadow p-4 sm:p-6 flex flex-col border-l-4 border-primary">
            <div className="flex-shrink-0 mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <h2 className="text-lg font-semibold">Allocazione Media</h2>
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    <div className="w-full sm:w-48"><SearchableSelect name="resourceId" value={filter.resourceId} onChange={(_, v) => setFilter({ resourceId: v })} options={resourceOptions} placeholder="Tutte le risorse" /></div>
                    <ViewToggleButton view={view} setView={setView} />
                    <ExportButton data={exportData} title="Allocazione Media" />
                    <PdfExportButton title="Allocazione Media" tableData={exportData} chartUrl={buildQuickChartUrl(data, 'bar', 'resource.name', 'currentMonth')} />
                </div>
            </div>
            <div className="flex-grow min-h-0 h-64 sm:h-[30rem] overflow-hidden">
                {view === 'table' ? (
                    <DashboardDataTable
                        columns={columns}
                        data={data}
                        isLoading={isLoading}
                        initialSortKey="resource.name"
                        footerNode={footer}
                        maxVisibleRows={10}
                    />
                ) : (
                    <GraphDataView 
                        data={data}
                        type="bar"
                        config={{ xKey: 'resource.name', yKey: 'currentMonth' }}
                    />
                )}
            </div>
        </div>
    );
};

export const FtePerProjectCard: React.FC<FtePerProjectCardProps> = ({ data, filter, setFilter, clientOptions, totals, isLoading }) => {
    const [view, setView] = useState<'table' | 'graph'>('table');
    const columns: ColumnDef<FtePerProjectRow>[] = [
        { header: "Progetto", sortKey: "name", cell: (d) => d.name },
        { header: "G/U Allocati", sortKey: "totalPersonDays", cell: (d) => d.totalPersonDays.toFixed(1) },
        { header: "FTE", sortKey: "fte", cell: (d) => <span className="font-semibold">{d.fte.toFixed(2)}</span> },
    ];
    
    const footer = (
        <tr>
            <td className="px-4 py-2">Totale</td>
            <td className="px-4 py-2">{totals.totalDays.toFixed(1)}</td>
            <td className="px-4 py-2">{totals.totalFte.toFixed(2)}</td>
        </tr>
    );

    const exportData = useMemo(() => {
        return data.map((d) => ({
            Progetto: d.name,
            'G/U Allocati': d.totalPersonDays.toFixed(1),
            FTE: d.fte.toFixed(2)
        }));
    }, [data]);

    return (
        <div className="bg-surface-container rounded-2xl shadow p-4 sm:p-6 flex flex-col border-l-4 border-primary">
            <div className="flex-shrink-0 mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <h2 className="text-lg font-semibold">FTE per Progetto</h2>
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    <div className="w-full sm:w-40"><SearchableSelect name="clientId" value={filter.clientId} onChange={(_, v) => setFilter({ clientId: v })} options={clientOptions} placeholder="Tutti i clienti"/></div>
                    <ViewToggleButton view={view} setView={setView} />
                    <ExportButton data={exportData} title="FTE per Progetto" />
                    <PdfExportButton title="FTE per Progetto" tableData={exportData} chartUrl={buildQuickChartUrl(data, 'bar', 'name', 'fte')} />
                </div>
            </div>
            <div className="flex-grow min-h-0 h-64 sm:h-[30rem] overflow-hidden">
                {view === 'table' ? (
                     <DashboardDataTable
                        columns={columns}
                        data={data}
                        isLoading={isLoading}
                        initialSortKey="name"
                        footerNode={footer}
                        maxVisibleRows={10}
                    />
                ) : (
                     <GraphDataView 
                        data={data}
                        type="bar"
                        config={{ xKey: "name", yKey: "fte" }}
                    />
                )}
            </div>
        </div>
    );
};

export const BudgetAnalysisCard: React.FC<BudgetAnalysisCardProps> = ({ data, filter, setFilter, clientOptions, totals, isLoading }) => {
    const [view, setView] = useState<'table' | 'graph'>('table');
    const columns: ColumnDef<BudgetAnalysisRow>[] = [
        { header: "Progetto", sortKey: "name", cell: (d) => d.name },
        { header: "Budget", sortKey: "budget", cell: (d) => formatCurrency(d.budget) },
        { header: "Costo Stimato", sortKey: "estimatedCost", cell: (d) => formatCurrency(d.estimatedCost) },
        { header: "Varianza", sortKey: "variance", cell: (d) => <span className={`font-semibold ${d.variance < 0 ? DASHBOARD_COLORS.variance.negative : DASHBOARD_COLORS.variance.positive}`}>{formatCurrency(d.variance)}</span> },
    ];

    const footer = (
        <tr>
            <td className="px-4 py-2">Totale</td>
            <td className="px-4 py-2">{formatCurrency(totals.budget)}</td>
            <td className="px-4 py-2">{formatCurrency(totals.cost)}</td>
            <td className={`px-4 py-2 ${totals.variance < 0 ? DASHBOARD_COLORS.variance.negative : DASHBOARD_COLORS.variance.positive}`}>{formatCurrency(totals.variance)}</td>
        </tr>
    );

    const exportData = useMemo(() => {
        return data.map((d) => ({
            Progetto: d.name,
            Budget: formatCurrency(d.budget),
            'Costo Stimato': formatCurrency(d.estimatedCost),
            Varianza: formatCurrency(d.variance)
        }));
    }, [data]);

    return (
        <div className="bg-surface-container rounded-2xl shadow p-4 sm:p-6 flex flex-col border-l-4 border-primary">
            <div className="flex-shrink-0 mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <h2 className="text-lg font-semibold">Analisi Budget</h2>
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    <div className="w-full sm:w-40"><SearchableSelect name="clientId" value={filter.clientId} onChange={(_, v) => setFilter({ clientId: v })} options={clientOptions} placeholder="Tutti i clienti"/></div>
                    <ViewToggleButton view={view} setView={setView} />
                    <ExportButton data={exportData} title="Analisi Budget" />
                    <PdfExportButton title="Analisi Budget" tableData={exportData} chartUrl={buildQuickChartUrl(data, 'bar', 'name', 'variance')} />
                </div>
            </div>
            <div className="flex-grow min-h-0 h-64 sm:h-[30rem] overflow-hidden">
                {view === 'table' ? (
                    <DashboardDataTable
                        columns={columns}
                        data={data}
                        isLoading={isLoading}
                        initialSortKey="name"
                        footerNode={footer}
                        maxVisibleRows={10}
                    />
                ) : (
                     <GraphDataView 
                        data={data}
                        type="bar"
                        config={{ xKey: 'name', yKey: 'variance' }}
                    />
                )}
            </div>
        </div>
    );
};

export const TemporalBudgetAnalysisCard: React.FC<TemporalBudgetAnalysisCardProps> = ({ data, filter, setFilter, clientOptions, totals, isLoading }) => {
    const [view, setView] = useState<'table' | 'graph'>('table');
    const columns: ColumnDef<TemporalBudgetAnalysisRow>[] = [
        { header: "Progetto", sortKey: "name", cell: (d) => d.name },
        { header: "Budget Periodo", sortKey: "periodBudget", cell: (d) => formatCurrency(d.periodBudget) },
        { header: "Costo Stimato", sortKey: "estimatedCost", cell: (d) => formatCurrency(d.estimatedCost) },
        { header: "Varianza", sortKey: "variance", cell: (d) => <span className={`font-semibold ${d.variance < 0 ? DASHBOARD_COLORS.variance.negative : DASHBOARD_COLORS.variance.positive}`}>{formatCurrency(d.variance)}</span> },
    ];

    const footer = (
        <tr>
            <td className="px-4 py-2">Totale</td>
            <td className="px-4 py-2">{formatCurrency(totals.budget)}</td>
            <td className="px-4 py-2">{formatCurrency(totals.cost)}</td>
            <td className={`px-4 py-2 ${totals.variance < 0 ? DASHBOARD_COLORS.variance.negative : DASHBOARD_COLORS.variance.positive}`}>{formatCurrency(totals.variance)}</td>
        </tr>
    );

    const exportData = useMemo(() => {
        return data.map((d) => ({
            Progetto: d.name,
            'Budget Periodo': formatCurrency(d.periodBudget),
            'Costo Stimato': formatCurrency(d.estimatedCost),
            Varianza: formatCurrency(d.variance)
        }));
    }, [data]);

    return (
        <div className="bg-surface-container rounded-2xl shadow p-4 sm:p-6 flex flex-col border-l-4 border-primary">
            <div className="flex-shrink-0 mb-4">
                 <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <h2 className="text-lg font-semibold">Analisi Budget Temporale</h2>
                    <div className="flex flex-wrap gap-2 w-full md:w-auto justify-start md:justify-end items-center">
                        <input type="date" value={filter.startDate} onChange={(e) => setFilter({ ...filter, startDate: e.target.value })} className="form-input text-sm p-1.5 w-full sm:w-32"/>
                        <input type="date" value={filter.endDate} onChange={(e) => setFilter({ ...filter, endDate: e.target.value })} className="form-input text-sm p-1.5 w-full sm:w-32"/>
                        <div className="w-full sm:w-40"><SearchableSelect name="clientId" value={filter.clientId} onChange={(_, v) => setFilter({ ...filter, clientId: v })} options={clientOptions} placeholder="Tutti i clienti"/></div>
                        <ViewToggleButton view={view} setView={setView} />
                        <ExportButton data={exportData} title="Analisi Budget Temporale" />
                        <PdfExportButton title="Analisi Budget Temporale" tableData={exportData} chartUrl={buildQuickChartUrl(data, 'bar', 'name', 'variance')} />
                    </div>
                </div>
            </div>
            <div className="flex-grow min-h-0 h-64 sm:h-[30rem] overflow-hidden">
                {view === 'table' ? (
                    <DashboardDataTable
                        columns={columns}
                        data={data}
                        isLoading={isLoading}
                        initialSortKey="name"
                        footerNode={footer}
                        maxVisibleRows={10}
                    />
                ) : (
                     <GraphDataView 
                        data={data}
                        type="bar"
                        config={{ xKey: 'name', yKey: 'variance' }}
                    />
                )}
            </div>
        </div>
    );
};

export const AverageDailyRateCard: React.FC<AverageDailyRateCardProps> = ({ data, filter, setFilter, clientOptions, totals, isLoading }) => {
    const [view, setView] = useState<'table' | 'graph'>('table');
    const columns: ColumnDef<AverageDailyRateRow>[] = [
        { header: "Progetto", sortKey: "name", cell: (d) => d.name },
        { header: "Cliente", sortKey: "clientName", cell: (d) => d.clientName },
        { header: "G/U Lavorati", sortKey: "totalPersonDays", cell: (d) => d.totalPersonDays.toFixed(1) },
        { header: "Costo Totale", sortKey: "totalCost", cell: (d) => formatCurrency(d.totalCost) },
        { header: "Tariffa Media G.", sortKey: "avgDailyRate", cell: (d) => <span className="font-semibold text-primary">{formatCurrency(d.avgDailyRate)}</span> },
    ];

    const footer = (
        <tr>
            <td className="px-4 py-2" colSpan={2}>Media Ponderata</td>
            <td className="px-4 py-2">{totals.totalDays.toFixed(1)}</td>
            <td className="px-4 py-2">{formatCurrency(totals.totalCost)}</td>
            <td className="px-4 py-2 text-primary">{formatCurrency(totals.weightedAverage)}</td>
        </tr>
    );

    const exportData = useMemo(() => {
        return data.map((d) => ({
            Progetto: d.name,
            Cliente: d.clientName,
            'G/U Lavorati': d.totalPersonDays.toFixed(1),
            'Costo Totale': formatCurrency(d.totalCost),
            'Tariffa Media G.': formatCurrency(d.avgDailyRate)
        }));
    }, [data]);

    return (
        <div className="bg-surface-container rounded-2xl shadow p-4 sm:p-6 flex flex-col border-l-4 border-primary">
            <div className="flex-shrink-0 mb-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <h2 className="text-lg font-semibold">Tariffa Media Giornaliera</h2>
                    <div className="flex flex-wrap gap-2 w-full md:w-auto justify-start md:justify-end items-center">
                        <input type="date" value={filter.startDate} onChange={(e) => setFilter({ ...filter, startDate: e.target.value })} className="form-input text-sm p-1.5 w-full sm:w-32"/>
                        <input type="date" value={filter.endDate} onChange={(e) => setFilter({ ...filter, endDate: e.target.value })} className="form-input text-sm p-1.5 w-full sm:w-32"/>
                        <div className="w-full sm:w-40"><SearchableSelect name="clientId" value={filter.clientId} onChange={(_, v) => setFilter({ ...filter, clientId: v })} options={clientOptions} placeholder="Tutti i clienti"/></div>
                        <ViewToggleButton view={view} setView={setView} />
                        <ExportButton data={exportData} title="Tariffa Media Giornaliera" />
                        <PdfExportButton title="Tariffa Media Giornaliera" tableData={exportData} chartUrl={buildQuickChartUrl(data, 'bar', 'name', 'avgDailyRate')} />
                    </div>
                </div>
            </div>
            <div className="flex-grow min-h-0 h-64 sm:h-[30rem] overflow-hidden">
                 {view === 'table' ? (
                    <DashboardDataTable
                        columns={columns}
                        data={data}
                        isLoading={isLoading}
                        initialSortKey="name"
                        footerNode={footer}
                        maxVisibleRows={10}
                    />
                ) : (
                     <GraphDataView 
                        data={data}
                        type="bar"
                        config={{ xKey: 'name', yKey: 'avgDailyRate' }}
                    />
                )}
            </div>
        </div>
    );
};


export const UnderutilizedResourcesCard: React.FC<UnderutilizedResourcesCardProps> = ({ data, month, setMonth, isLoading }) => {
    const [view, setView] = useState<'table' | 'graph'>('table');
    const columns: ColumnDef<UnderutilizedResourceRow>[] = [
        { header: "Risorsa", sortKey: "resource.name", cell: (d) => d.resource.name },
        { header: "Alloc. Media", sortKey: "avgAllocation", cell: (d) => <span className={DASHBOARD_COLORS.utilization.high}>{d.avgAllocation.toFixed(0)}%</span> },
    ];

    const exportData = useMemo(() => {
        return data.map((d) => ({
            Risorsa: d.resource.name,
            'Allocazione Media (%)': d.avgAllocation.toFixed(0)
        }));
    }, [data]);

    return (
        <div className="bg-surface-container rounded-2xl shadow p-4 sm:p-6 flex flex-col border-l-4 border-primary">
            <div className="flex-shrink-0 mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <h2 className="text-lg font-semibold">Risorse Sottoutilizzate</h2>
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="form-input w-full sm:w-48"/>
                    <ViewToggleButton view={view} setView={setView} />
                    <ExportButton data={exportData} title="Risorse Sottoutilizzate" />
                    <PdfExportButton title="Risorse Sottoutilizzate" tableData={exportData} chartUrl={buildQuickChartUrl(data, 'bar', 'resource.name', 'avgAllocation')} />
                </div>
            </div>
            <div className="flex-grow min-h-0 h-64 sm:h-[30rem] overflow-hidden">
                {view === 'table' ? (
                    <DashboardDataTable
                        columns={columns}
                        data={data}
                        isLoading={isLoading}
                        initialSortKey="avgAllocation"
                        maxVisibleRows={10}
                    />
                ) : (
                     <GraphDataView 
                        data={data}
                        type="bar"
                        config={{ xKey: 'resource.name', yKey: 'avgAllocation' }}
                    />
                )}
            </div>
        </div>
    );
};

export const MonthlyClientCostCard: React.FC<MonthlyClientCostCardProps> = ({ data, navigate, isLoading }) => {
    const [view, setView] = useState<'table' | 'graph'>('table');
    const columns: ColumnDef<ClientCostEntry>[] = [
        { header: "Cliente", sortKey: "name", cell: (d) => <button onClick={() => navigate(`/projects?clientId=${d.id}`)} className={DASHBOARD_COLORS.link}>{d.name}</button> },
        { header: "Costo Stimato", sortKey: "cost", cell: (d) => formatCurrency(d.cost) },
    ];

    const exportData = useMemo(() => {
        return data.map((d) => ({
            Cliente: d.name,
            'Costo Stimato': formatCurrency(d.cost)
        }));
    }, [data]);

    return (
        <div className="bg-surface-container rounded-2xl shadow p-4 sm:p-6 flex flex-col border-l-4 border-primary">
            <div className="flex-shrink-0 mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                 <h2 className="text-lg font-semibold">Costo Mensile per Cliente</h2>
                 <div className="flex flex-wrap items-center gap-2">
                    <ViewToggleButton view={view} setView={setView} />
                    <ExportButton data={exportData} title="Costo Mensile per Cliente" />
                    <PdfExportButton title="Costo Mensile per Cliente" tableData={exportData} chartUrl={buildQuickChartUrl(data, 'bar', 'name', 'cost')} />
                 </div>
            </div>
            <div className="flex-grow min-h-0 h-64 sm:h-[30rem] overflow-hidden">
                {view === 'table' ? (
                    <DashboardDataTable
                        columns={columns}
                        data={data}
                        isLoading={isLoading}
                        initialSortKey="cost"
                        maxVisibleRows={10}
                    />
                ) : (
                     <GraphDataView 
                        data={data}
                        type="bar"
                        config={{ xKey: 'name', yKey: 'cost' }}
                    />
                )}
            </div>
        </div>
    );
};

export const EffortByFunctionCard: React.FC<EffortByFunctionCardProps> = ({ data, total, isLoading }) => {
    const [view, setView] = useState<'table' | 'graph'>('table');
    const columns: ColumnDef<EffortRow>[] = [
        { header: "Function", sortKey: "name", cell: (d) => d.name },
        { header: "G/U Totali", sortKey: "totalPersonDays", cell: (d) => d.totalPersonDays.toFixed(1) },
    ];
    
    const footer = (
        <tr>
            <td className="px-4 py-2">Totale</td>
            <td className="px-4 py-2">{total.toFixed(1)}</td>
        </tr>
    );

    const exportData = useMemo(() => {
        return data.map((d) => ({
            Function: d.name,
            'G/U Totali': d.totalPersonDays.toFixed(1)
        }));
    }, [data]);

    return (
        <div className="bg-surface-container rounded-2xl shadow p-4 sm:p-6 flex flex-col border-l-4 border-primary">
            <div className="flex-shrink-0 mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                 <h2 className="text-lg font-semibold">Analisi Sforzo per Function</h2>
                 <div className="flex flex-wrap items-center gap-2">
                    <ViewToggleButton view={view} setView={setView} />
                    <ExportButton data={exportData} title="Analisi Sforzo per Function" />
                    <PdfExportButton title="Analisi Sforzo per Function" tableData={exportData} chartUrl={buildQuickChartUrl(data, 'bar', 'name', 'totalPersonDays')} />
                 </div>
            </div>
            <div className="flex-grow min-h-0 h-64 sm:h-[30rem] overflow-hidden">
                {view === 'table' ? (
                    <DashboardDataTable
                        columns={columns}
                        data={data}
                        isLoading={isLoading}
                        initialSortKey="totalPersonDays"
                        footerNode={footer}
                        maxVisibleRows={10}
                    />
                ) : (
                     <GraphDataView 
                        data={data}
                        type="bar"
                        config={{ xKey: 'name', yKey: 'totalPersonDays' }}
                    />
                )}
            </div>
        </div>
    );
};

export const EffortByIndustryCard: React.FC<EffortByIndustryCardProps> = ({ data, total, isLoading }) => {
    const [view, setView] = useState<'table' | 'graph'>('table');
    const columns: ColumnDef<EffortRow>[] = [
        { header: "Industry", sortKey: "name", cell: (d) => d.name },
        { header: "G/U Totali", sortKey: "totalPersonDays", cell: (d) => d.totalPersonDays.toFixed(1) },
    ];
    
    const footer = (
        <tr>
            <td className="px-4 py-2">Totale</td>
            <td className="px-4 py-2">{total.toFixed(1)}</td>
        </tr>
    );

    const exportData = useMemo(() => {
        return data.map((d) => ({
            Industry: d.name,
            'G/U Totali': d.totalPersonDays.toFixed(1)
        }));
    }, [data]);

    return (
        <div className="bg-surface-container rounded-2xl shadow p-4 sm:p-6 flex flex-col border-l-4 border-secondary">
            <div className="flex-shrink-0 mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                 <h2 className="text-lg font-semibold">Analisi Sforzo per Industry</h2>
                 <div className="flex flex-wrap items-center gap-2">
                    <ViewToggleButton view={view} setView={setView} />
                    <ExportButton data={exportData} title="Analisi Sforzo per Industry" />
                    <PdfExportButton title="Analisi Sforzo per Industry" tableData={exportData} chartUrl={buildQuickChartUrl(data, 'bar', 'name', 'totalPersonDays')} />
                 </div>
            </div>
            <div className="flex-grow min-h-0 h-64 sm:h-[30rem] overflow-hidden">
                {view === 'table' ? (
                    <DashboardDataTable
                        columns={columns}
                        data={data}
                        isLoading={isLoading}
                        initialSortKey="totalPersonDays"
                        footerNode={footer}
                        maxVisibleRows={10}
                    />
                ) : (
                     <GraphDataView 
                        data={data}
                        type="bar"
                        config={{ xKey: 'name', yKey: 'totalPersonDays' }}
                    />
                )}
            </div>
        </div>
    );
};

export const LocationAnalysisCard: React.FC<LocationAnalysisCardProps> = ({ data, isLoading }) => {
    const [view, setView] = useState<'table' | 'graph'>('table');
    const columns: ColumnDef<LocationAnalysisRow>[] = [
        { header: "Sede", sortKey: "name", cell: (d) => d.name },
        { header: "N. Risorse", sortKey: "resourceCount", cell: (d) => d.resourceCount },
        { header: "G/U Allocati", sortKey: "allocatedDays", cell: (d) => d.allocatedDays.toFixed(1) },
        { header: "Utilizzo Medio", sortKey: "avgUtilization", cell: (d) => <span className={`font-semibold ${getAvgAllocationColor(d.avgUtilization)}`}>{d.avgUtilization.toFixed(0)}%</span> },
    ];

    const exportData = useMemo(() => {
        return data.map((d) => ({
            Sede: d.name,
            'N. Risorse': d.resourceCount,
            'G/U Allocati': d.allocatedDays.toFixed(1),
            'Utilizzo Medio (%)': d.avgUtilization.toFixed(0)
        }));
    }, [data]);

    return (
        <div className="bg-surface-container rounded-2xl shadow p-4 sm:p-6 flex flex-col border-l-4 border-primary">
            <div className="flex-shrink-0 mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <h2 className="text-lg font-semibold">Analisi per Sede (Mese Corrente)</h2>
                <div className="flex flex-wrap items-center gap-2">
                    <ViewToggleButton view={view} setView={setView} />
                    <ExportButton data={exportData} title="Analisi per Sede (Mese Corrente)" />
                    <PdfExportButton title="Analisi per Sede (Mese Corrente)" tableData={exportData} chartUrl={buildQuickChartUrl(data, 'bar', 'name', 'avgUtilization')} />
                </div>
            </div>
            <div className="flex-grow min-h-0 h-64 sm:h-[30rem] overflow-hidden">
                {view === 'table' ? (
                    <DashboardDataTable
                        columns={columns}
                        data={data}
                        isLoading={isLoading}
                        initialSortKey="resourceCount"
                        maxVisibleRows={10}
                    />
                ) : (
                     <GraphDataView 
                        data={data}
                        type="bar"
                        config={{ xKey: 'name', yKey: 'avgUtilization' }}
                    />
                )}
            </div>
        </div>
    );
};

export const SaturationTrendCard: React.FC<SaturationTrendCardProps> = ({ trendResource, setTrendResource, resourceOptions, data }) => {
    const chartRef = useRef<SVGSVGElement>(null);

    const exportData = useMemo(() => {
        return data.map((d) => ({
            Mese: d.month.toLocaleString('it-IT', { month: 'short', year: '2-digit' }),
            'Saturazione (%)': d.value.toFixed(1)
        }));
    }, [data]);

    useEffect(() => {
        if (!trendResource || !chartRef.current || data.length === 0) {
            if (chartRef.current) select(chartRef.current).selectAll("*").remove();
            return;
        }

        const svg = select(chartRef.current);
        svg.selectAll("*").remove();
        
        const { width: containerWidth, height: containerHeight } = svg.node()!.getBoundingClientRect();
        const margin = { top: 20, right: 30, bottom: 30, left: 40 };
        const width = containerWidth - margin.left - margin.right;
        const height = containerHeight - margin.top - margin.bottom;

        if (width <= 0 || height <= 0) return;

        const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

        const x = scaleTime().domain(extent(data, (d: any) => d.month) as [Date, Date]).range([0, width]);
        const y = scaleLinear().domain([0, max(data, (d: any) => Math.max(110, d.value)) || 110]).range([height, 0]);

        g.append("g").attr("transform", `translate(0,${height})`).call(axisBottom(x).ticks(Math.min(data.length, Math.floor(width / 80))).tickFormat(timeFormat("%b %y") as any));
        g.append("g").call(axisLeft(y).ticks(5).tickFormat((d: any) => `${d}%`));

        g.append("path").datum(data).attr("fill", "none").attr("stroke", DASHBOARD_COLORS.chart.primary).attr("stroke-width", 2)
          .attr("d", line().x((d: any) => x(d.month)).y((d: any) => y(d.value)) as any);
        
        g.append("line").attr("x1", 0).attr("x2", width).attr("y1", y(100)).attr("y2", y(100)).attr("stroke", DASHBOARD_COLORS.chart.threshold).attr("stroke-width", 1.5).attr("stroke-dasharray", "4");

    }, [data, trendResource]);

    return (
        <div className="h-full bg-surface-container rounded-2xl shadow p-4 sm:p-6 border-l-4 border-primary flex flex-col">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3 flex-shrink-0">
                <h2 className="text-lg font-semibold">Trend Saturazione Risorsa</h2>
                <div className="flex items-center gap-2">
                    <div className="w-full sm:w-56"><SearchableSelect name="trendResource" value={trendResource} onChange={(_, v) => setTrendResource(v)} options={resourceOptions} placeholder="Seleziona una risorsa"/></div>
                    <ExportButton data={exportData} title="Trend Saturazione Risorsa" />
                    <PdfExportButton
                        title="Trend Saturazione Risorsa"
                        tableData={exportData}
                        chartUrl={buildQuickChartUrl(
                            data.map(d => ({ label: d.month.toLocaleString('it-IT', { month: 'short', year: '2-digit' }), value: d.value })),
                            'line', 'label', 'value'
                        )}
                    />
                </div>
            </div>
            <div className="flex-grow h-72">{ trendResource ? <svg ref={chartRef} className="w-full h-full"></svg> : <div className="flex items-center justify-center h-full text-on-surface-variant">Seleziona una risorsa per visualizzare il trend.</div> }</div>
        </div>
    );
};

export const CostForecastCard: React.FC<CostForecastCardProps> = ({ data }) => {
    const chartRef = useRef<SVGSVGElement>(null);

    const exportData = useMemo(() => {
        return data.map((d) => ({
            Mese: d.month.toLocaleString('it-IT', { month: 'short', year: '2-digit' }),
            'Media Storica': formatCurrency(d.historic),
            'Forecast': formatCurrency(d.forecast)
        }));
    }, [data]);

    useEffect(() => {
        if (!chartRef.current || data.length === 0) return;
        
        const svg = select(chartRef.current);
        svg.selectAll("*").remove();

        const { width: containerWidth, height: containerHeight } = svg.node()!.getBoundingClientRect();
        const margin = { top: 20, right: 50, bottom: 30, left: 60 };
        const width = containerWidth - margin.left - margin.right;
        const height = containerHeight - margin.top - margin.bottom;

        if (width <= 0 || height <= 0) return;

        const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

        const x = scaleTime().domain(extent(data, (d: any) => d.month) as [Date, Date]).range([0, width]);
        const yMax = max(data, (d: any) => Math.max(d.historic, d.forecast));
        const y = scaleLinear().domain([0, (yMax || 0) * 1.1]).range([height, 0]);

        g.append("g").attr("transform", `translate(0,${height})`).call(axisBottom(x).ticks(Math.min(data.length, Math.floor(width / 80))).tickFormat(timeFormat("%b %y") as any));
        g.append("g").call(axisLeft(y).ticks(5).tickFormat(format("~s") as any));

        g.append("path").datum(data).attr("fill", "none").attr("stroke", DASHBOARD_COLORS.chart.secondary).attr("stroke-width", 2).attr("stroke-dasharray", "4,4")
            .attr("d", line().x((d: any) => x(d.month)).y((d: any) => y(d.historic)) as any);
        
        g.append("path").datum(data).attr("fill", "none").attr("stroke", DASHBOARD_COLORS.chart.primary).attr("stroke-width", 2.5)
            .attr("d", line().x((d: any) => x(d.month)).y((d: any) => y(d.forecast)) as any);

    }, [data]);

    return (
        <div className="h-full bg-surface-container rounded-2xl shadow p-4 sm:p-6 border-l-4 border-primary flex flex-col">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3 flex-shrink-0">
                <h2 className="text-lg font-semibold">Forecast Costo Mensile (Rolling 3 Mesi)</h2>
                <div className="flex flex-wrap items-center gap-2">
                    <ExportButton data={exportData} title="Forecast Costo Mensile (Rolling 3 Mesi)" />
                    <PdfExportButton
                        title="Forecast Costo Mensile (Rolling 3 Mesi)"
                        tableData={exportData}
                        chartUrl={data.length > 0 ? (() => {
                            const labels = data.map(d => d.month.toLocaleString('it-IT', { month: 'short', year: '2-digit' }));
                            const cfg = { type: 'line', data: { labels, datasets: [
                                { label: 'Media Storica', data: data.map(d => Math.round(d.historic)), borderColor: '#50606e', borderDash: [4,4], fill: false, pointRadius: 3 },
                                { label: 'Forecast', data: data.map(d => Math.round(d.forecast)), borderColor: '#006493', fill: false, pointRadius: 3 }
                            ] }, options: { scales: { y: { beginAtZero: true } } } };
                            return `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(cfg))}&w=800&h=400&bkg=white`;
                        })() : undefined}
                    />
                </div>
            </div>
            <div className="flex-grow h-72"><svg ref={chartRef} className="w-full h-full"></svg></div>
        </div>
    );
};

export const AllocationMatrixCard: React.FC<AllocationMatrixCardProps> = ({ data, isLoading }) => {
    const { matrix, functions, industries } = data;

    // Sort logic handled in parent or here
    const sortedFunctions = useMemo(() => [...functions].sort((a, b) => a.localeCompare(b)), [functions]);
    const sortedIndustries = useMemo(() => [...industries].sort((a, b) => a.localeCompare(b)), [industries]);

    // Color scale helper for heatmap
    const getHeatmapColor = (value: number, maxVal: number) => {
        if (value === 0) return 'bg-transparent';
        const intensity = Math.ceil((value / maxVal) * 100);
        // Using opacity based approach for simpler Tailwind
        return `bg-primary/${Math.max(10, Math.min(100, intensity))} text-on-primary-container`;
    };

    const maxVal = useMemo(() => {
        let m = 0;
        Object.values(matrix).forEach((row) => {
             Object.values(row).forEach((val) => {
                 if(typeof val === 'number' && val > m) m = val;
             });
        });
        return m > 0 ? m : 1;
    }, [matrix]);

    const exportData = useMemo(() => {
        const rows: Record<string, string>[] = [];
        sortedFunctions.forEach((func) => {
            const row: Record<string, string> = { Function: func };
            sortedIndustries.forEach((ind) => {
                row[ind] = (matrix[func]?.[ind] || 0).toFixed(1);
            });
            rows.push(row);
        });
        return rows;
    }, [matrix, sortedFunctions, sortedIndustries]);

    return (
        <div className="bg-surface-container rounded-2xl shadow p-4 sm:p-6 flex flex-col border-l-4 border-primary h-full">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
                <h2 className="text-lg font-semibold">Matrice Allocazione (FTE)</h2>
                <div className="flex flex-wrap items-center gap-2">
                    <ExportButton data={exportData} title="Matrice Allocazione" />
                    <PdfExportButton title="Matrice Allocazione (FTE)" tableData={exportData} />
                </div>
            </div>
            <div className="flex-grow overflow-auto relative max-h-[500px]">
                <table className="w-full text-sm border-collapse">
                    <thead className="bg-surface-container-low sticky top-0 z-10">
                        <tr>
                            <th className="p-2 border-b border-r border-outline-variant bg-surface-container-low sticky left-0 z-20">Function \ Industry</th>
                            {sortedIndustries.map((ind: string) => (
                                <th key={ind} className="p-2 border-b border-outline-variant text-center font-semibold text-xs min-w-[100px]">{ind}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {sortedFunctions.map((func: string) => (
                            <tr key={func} className="hover:bg-surface-container-low">
                                <td className="p-2 border-r border-outline-variant font-medium sticky left-0 bg-surface z-10">{func}</td>
                                {sortedIndustries.map((ind: string) => {
                                    const val = matrix[func]?.[ind] || 0;
                                    return (
                                        <td key={`${func}-${ind}`} className={`p-2 text-center border-b border-outline-variant ${getHeatmapColor(val, maxVal)}`}>
                                            {val > 0 ? val.toFixed(1) : '-'}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
                {sortedFunctions.length === 0 && <div className="text-center p-4 text-on-surface-variant">Nessun dato disponibile.</div>}
            </div>
        </div>
    );
};

export const RevenueByIndustryCard: React.FC<RevenueByIndustryCardProps> = ({ data, isLoading }) => {
    // Top 5 filtering
    const top5 = useMemo(() => [...data].sort((a,b) => b.value - a.value).slice(0, 5), [data]);

    const exportData = useMemo(() => data.map(d => ({ Industry: d.name, Revenue: formatCurrency(d.value) })), [data]);

    return (
        <div className="bg-surface-container rounded-2xl shadow p-4 sm:p-6 flex flex-col border-l-4 border-secondary h-full">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
                <h2 className="text-lg font-semibold">Top 5 Revenue per Industry</h2>
                <div className="flex flex-wrap items-center gap-2">
                    <ExportButton data={exportData} title="Revenue per Industry" />
                    <PdfExportButton title="Top 5 Revenue per Industry" tableData={exportData} chartUrl={buildQuickChartUrl(top5, 'bar', 'name', 'value')} />
                </div>
            </div>
            <div className="flex-grow min-h-0 h-[300px] overflow-hidden">
                <GraphDataView 
                    data={top5} 
                    type="bar" 
                    config={{ xKey: 'name', yKey: 'value' }} 
                />
            </div>
        </div>
    );
};

export const BenchByFunctionCard: React.FC<BenchByFunctionCardProps> = ({ data, isLoading }) => {
     const exportData = useMemo(() => data.map(d => ({ Function: d.name, 'Bench %': d.value.toFixed(1) + '%' })), [data]);

    return (
        <div className="bg-surface-container rounded-2xl shadow p-4 sm:p-6 flex flex-col border-l-4 border-error h-full">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
                <h2 className="text-lg font-semibold">Bench % per Function</h2>
                <div className="flex flex-wrap items-center gap-2">
                    <ExportButton data={exportData} title="Bench per Function" />
                    <PdfExportButton title="Bench % per Function" tableData={exportData} chartUrl={buildQuickChartUrl(data, 'bar', 'name', 'value')} />
                </div>
            </div>
            <div className="flex-grow min-h-0 h-[300px] overflow-hidden">
                <GraphDataView 
                    data={data} 
                    type="bar" 
                    config={{ xKey: 'name', yKey: 'value' }} 
                />
            </div>
        </div>
    );
};

export const BenchByIndustryCard: React.FC<BenchByIndustryCardProps> = ({ data, isLoading }) => {
    const exportData = useMemo(() => data.map(d => ({ Industry: d.name, 'Bench %': d.value.toFixed(1) + '%' })), [data]);

    return (
        <div className="bg-surface-container rounded-2xl shadow p-4 sm:p-6 flex flex-col border-l-4 border-error h-full">
             <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
                <h2 className="text-lg font-semibold">Bench % per Industry</h2>
                <div className="flex flex-wrap items-center gap-2">
                    <ExportButton data={exportData} title="Bench per Industry" />
                    <PdfExportButton title="Bench % per Industry" tableData={exportData} chartUrl={buildQuickChartUrl(data, 'bar', 'name', 'value')} />
                </div>
            </div>
            <div className="flex-grow min-h-0 h-[300px] overflow-hidden">
                <GraphDataView 
                    data={data} 
                    type="bar" 
                    config={{ xKey: 'name', yKey: 'value' }} 
                />
            </div>
        </div>
    );
};

export const WbsSaturationCard: React.FC<WbsSaturationCardProps> = ({ data, isLoading }) => {
    const exportData = useMemo(() => data.map(d => ({ 
        Contratto: d.name, 
        Capienza: formatCurrency(d.capienza), 
        Consumato: formatCurrency(d.consumed), 
        'Saturazione %': d.saturation.toFixed(1) + '%' 
    })), [data]);

    return (
        <div className="bg-surface-container rounded-2xl shadow p-4 sm:p-6 flex flex-col border-l-4 border-error h-full">
             <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
                <h2 className="text-lg font-semibold">Saturazione WBS (Top Rischi)</h2>
                <div className="flex flex-wrap items-center gap-2">
                    <ExportButton data={exportData} title="Saturazione WBS" />
                    <PdfExportButton title="Saturazione WBS (Top Rischi)" tableData={exportData} chartUrl={buildQuickChartUrl(data, 'bar', 'name', 'consumed')} />
                </div>
            </div>
            <div className="flex-grow min-h-0 h-[300px] overflow-hidden">
                 {data.length === 0 ? (
                     <div className="flex items-center justify-center h-full text-on-surface-variant">Nessun contratto a rischio.</div>
                 ) : (
                    <GraphDataView 
                        data={data} 
                        type="bar" 
                        config={{ xKey: 'name', yKey: 'consumed' }} 
                    />
                 )}
            </div>
            <div className="text-xs text-on-surface-variant mt-2 text-center">
                Visualizza i contratti con saturazione &gt; 80%
            </div>
        </div>
    );
};

export const ContractExpirationsCard: React.FC<ContractExpirationsCardProps> = ({ data, isLoading }) => {
     const columns: ColumnDef<ContractExpirationRow>[] = [
        { header: "Scadenza", sortKey: "endDate", cell: (d) => formatDateFull(d.endDate) },
        { header: "Contratto", sortKey: "name", cell: (d) => <span title={d.name} className="truncate block max-w-[150px]">{d.name}</span> },
        { header: "Backlog", sortKey: "backlog", cell: (d) => formatCurrency(d.backlog) },
    ];
    
    const exportData = useMemo(() => data.map(d => ({ 
        Scadenza: formatDateFull(d.endDate), 
        Contratto: d.name, 
        Backlog: formatCurrency(d.backlog) 
    })), [data]);

    return (
        <div className="bg-surface-container rounded-2xl shadow p-4 sm:p-6 flex flex-col border-l-4 border-tertiary h-full">
             <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
                <h2 className="text-lg font-semibold">Scadenzario Contratti (90gg)</h2>
                <div className="flex flex-wrap items-center gap-2">
                    <ExportButton data={exportData} title="Scadenzario Contratti" />
                    <PdfExportButton title="Scadenzario Contratti (90gg)" tableData={exportData} />
                </div>
            </div>
            <div className="flex-grow min-h-0 h-[300px] overflow-auto">
                 <DashboardDataTable
                    columns={columns}
                    data={data}
                    isLoading={isLoading}
                    initialSortKey="endDate"
                />
            </div>
        </div>
    );
};

// --- NEW CARDS IMPLEMENTATION ---

export const RevenueMixCard: React.FC<RevenueMixCardProps> = ({ data, isLoading }) => {
    const svgRef = useRef<SVGSVGElement>(null);

    const exportData = useMemo(() => data.map(d => ({ 
        Mese: d.month, 
        'Time & Material': formatCurrency(d.tm), 
        'Fixed Price': formatCurrency(d.fixed) 
    })), [data]);

    useEffect(() => {
        if (!svgRef.current || data.length === 0) return;
        const svg = select(svgRef.current);
        svg.selectAll("*").remove();

        const margin = { top: 20, right: 20, bottom: 40, left: 60 };
        const width = svgRef.current.clientWidth - margin.left - margin.right;
        const height = svgRef.current.clientHeight - margin.top - margin.bottom;

        const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
        
        // Define stack
        const stackGen = stack().keys(['tm', 'fixed']);
        const stackedData = stackGen(data as any);

        const x = scaleBand()
            .domain(data.map(d => d.month))
            .range([0, width])
            .padding(0.3);

        const yMax = max(stackedData, (layer) => max(layer, (d) => d[1])) || 0;
        const y = scaleLinear().domain([0, yMax * 1.1]).range([height, 0]);

        const color = scaleOrdinal().domain(['tm', 'fixed']).range([DASHBOARD_COLORS.chart.tm, DASHBOARD_COLORS.chart.fixed]);

        g.selectAll("g")
            .data(stackedData)
            .join("g")
            .attr("fill", (d: any) => color(d.key) as string)
            .selectAll("rect")
            .data(d => d)
            .join("rect")
            .attr("x", (d: any) => x(d.data.month)!)
            .attr("y", d => y(d[1]))
            .attr("height", d => y(d[0]) - y(d[1]))
            .attr("width", x.bandwidth())
            .append("title")
            .text((d: any) => formatCurrency(d[1] - d[0]));

        g.append("g").attr("transform", `translate(0,${height})`).call(axisBottom(x).tickFormat((d: string) => d.split('-')[1]));
        g.append("g").call(axisLeft(y).ticks(5).tickFormat(d => `${Number(d)/1000}k`));

        // Legend
        const legend = svg.append("g").attr("transform", `translate(${width - 100}, 0)`);
        legend.append("rect").attr("width", 10).attr("height", 10).attr("fill", DASHBOARD_COLORS.chart.tm);
        legend.append("text").attr("x", 15).attr("y", 10).text("T&M").style("font-size", "10px").attr("fill", "currentColor");
        legend.append("rect").attr("width", 10).attr("height", 10).attr("y", 15).attr("fill", DASHBOARD_COLORS.chart.fixed);
        legend.append("text").attr("x", 15).attr("y", 25).text("Fixed").style("font-size", "10px").attr("fill", "currentColor");

    }, [data, isLoading]);

    return (
        <div className="bg-surface-container rounded-2xl shadow p-4 sm:p-6 flex flex-col border-l-4 border-primary h-full">
             <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
                <h2 className="text-lg font-semibold">Revenue Mix (T&M vs Fixed)</h2>
                <div className="flex flex-wrap items-center gap-2">
                    <ExportButton data={exportData} title="Revenue Mix" />
                    <PdfExportButton
                        title="Revenue Mix (T&M vs Fixed)"
                        tableData={exportData}
                        chartUrl={data.length > 0 ? (() => {
                            const cfg = { type: 'bar', data: { labels: data.map(d => d.month.split('-')[1]),
                                datasets: [
                                    { label: 'T&M', data: data.map(d => Math.round(d.tm)), backgroundColor: '#5b9bd5', stack: 'r' },
                                    { label: 'Fixed Price', data: data.map(d => Math.round(d.fixed)), backgroundColor: '#e67c73', stack: 'r' }
                                ]
                            }, options: { scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } } } };
                            return `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(cfg))}&w=800&h=400&bkg=white`;
                        })() : undefined}
                    />
                </div>
            </div>
            <div className="flex-grow min-h-0 h-[300px] overflow-hidden">
                 {data.length === 0 ? <div className="text-center p-4 text-on-surface-variant">Nessun dato.</div> : <svg ref={svgRef} className="w-full h-full" />}
            </div>
        </div>
    );
};

export const BillingPipelineCard: React.FC<BillingPipelineCardProps> = ({ data, isLoading }) => {
    const exportData = useMemo(() => data.map(d => ({ 
        Mese: d.month, 
        'Fatturato Previsto': formatCurrency(d.amount) 
    })), [data]);

    return (
        <div className="bg-surface-container rounded-2xl shadow p-4 sm:p-6 flex flex-col border-l-4 border-secondary h-full">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
                <h2 className="text-lg font-semibold">Pipeline Fatturazione (PLANNED)</h2>
                <div className="flex flex-wrap items-center gap-2">
                    <ExportButton data={exportData} title="Pipeline Fatturazione" />
                    <PdfExportButton title="Pipeline Fatturazione (PLANNED)" tableData={exportData} chartUrl={buildQuickChartUrl(data, 'bar', 'month', 'amount')} />
                </div>
            </div>
            <div className="flex-grow min-h-0 h-[300px] overflow-hidden">
                <GraphDataView 
                    data={data} 
                    type="bar" 
                    config={{ xKey: 'month', yKey: 'amount' }} 
                />
            </div>
        </div>
    );
};

export const TopMarginProjectsCard: React.FC<TopMarginProjectsCardProps> = ({ data, isLoading }) => {
     const columns: ColumnDef<TopMarginProjectRow>[] = [
        { header: "Progetto", sortKey: "name", cell: (d) => <span className="font-semibold">{d.name}</span> },
        { header: "Ricavi", sortKey: "revenue", cell: (d) => formatCurrency(d.revenue) },
        { header: "Margine", sortKey: "margin", cell: (d) => <span className={d.margin < 0 ? 'text-error' : 'text-tertiary'}>{formatCurrency(d.margin)}</span> },
        { header: "Margine %", sortKey: "marginPct", cell: (d) => <span className={`px-2 py-0.5 rounded text-xs font-bold ${d.marginPct < 0 ? 'bg-error-container text-on-error-container' : 'bg-tertiary-container text-on-tertiary-container'}`}>{d.marginPct.toFixed(1)}%</span> },
    ];
    
    const exportData = useMemo(() => data.map(d => ({ 
        Progetto: d.name, 
        Ricavi: formatCurrency(d.revenue), 
        Margine: formatCurrency(d.margin),
        'Margine %': d.marginPct.toFixed(1) + '%'
    })), [data]);

    return (
        <div className="bg-surface-container rounded-2xl shadow p-4 sm:p-6 flex flex-col border-l-4 border-tertiary h-full">
             <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
                <h2 className="text-lg font-semibold">Top Progetti per Margine (Mese Corrente)</h2>
                <div className="flex flex-wrap items-center gap-2">
                    <ExportButton data={exportData} title="Top Margine Progetti" />
                    <PdfExportButton title="Top Progetti per Margine (Mese Corrente)" tableData={exportData} chartUrl={buildQuickChartUrl(data, 'bar', 'name', 'margin')} />
                </div>
            </div>
            <div className="flex-grow min-h-0 h-[300px] overflow-auto">
                 <DashboardDataTable
                    columns={columns}
                    data={data}
                    isLoading={isLoading}
                    initialSortKey="margin"
                />
            </div>
        </div>
    );
};
