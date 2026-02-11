/**
 * @file DashboardPage.tsx
 * @description Pagina della dashboard che visualizza varie metriche e analisi aggregate sui dati di staffing.
 */

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useEntitiesContext, useAllocationsContext } from '../context/AppContext';
import { getWorkingDaysBetween, isHoliday, formatDate } from '../utils/dateUtils';
import SearchableSelect from '../components/SearchableSelect';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { DashboardDataTable } from '../components/DashboardDataTable';
import { ColumnDef } from '../components/DataTable';
import {
  DashboardCardId,
  DASHBOARD_CARDS_CONFIG,
} from '../config/dashboardLayout';
import GraphDataView from '../components/GraphDataView';
import { select } from 'd3-selection';
import { scaleTime, scaleLinear } from 'd3-scale';
import { extent, max } from 'd3-array';
import { axisBottom, axisLeft } from 'd3-axis';
import { timeFormat } from 'd3-time-format';
import { line } from 'd3-shape';
import { format } from 'd3-format';
import { formatCurrency } from '../utils/formatters';
import { useAuth } from '../context/AuthContext';
import ExportButton from '../components/ExportButton';
import 'd3-transition'; // Import transition to avoid crashes

// --- Colori Centralizzati per la Dashboard ---
const DASHBOARD_COLORS = {
  attention: {
    background: 'bg-yellow-container',
    hoverBackground: 'hover:bg-yellow-container/80',
    text: 'text-on-yellow-container',
    strongText: 'text-on-yellow-container font-semibold',
    icon: 'text-3xl opacity-50 text-on-yellow-container',
  },
  utilization: {
    over: 'text-error font-bold',
    high: 'text-tertiary font-semibold',
    normal: 'text-secondary',
    zero: 'text-on-surface-variant',
  },
  variance: {
    positive: 'text-tertiary',
    negative: 'text-error',
  },
  link: 'text-primary hover:underline',
  chart: {
    primary: '#006493',
    secondary: '#50606e',
    threshold: '#ba1a1a',
  },
};

const dateCache = new Map<string, Date>();
const parseISODate = (s: string): Date => {
  const cached = dateCache.get(s);
  if (cached) return cached;
  const d = new Date(s);
  dateCache.set(s, d);
  return d;
};

// --- Child Components for each Card ---

const KpiHeaderCards: React.FC<{ overallKPIs: any, currentMonthKPIs: any }> = ({ overallKPIs, currentMonthKPIs }) => (
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

const AttentionCards: React.FC<{ overallKPIs: any, navigate: (path: string) => void }> = ({ overallKPIs, navigate }) => (
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
                    <ul className="list-disc list-inside">{overallKPIs.unassignedResources.slice(0, 5).map((r: any) => <li key={r.id} className="truncate">{r.name}</li>)}</ul>
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
                    <ul className="list-disc list-inside">{overallKPIs.unstaffedProjects.slice(0, 5).map((p: any) => <li key={p.id} className="truncate">{p.name}</li>)}</ul>
                </div>
            )}
        </div>
    </>
);

const UnallocatedFteCard: React.FC<{ kpis: any }> = ({ kpis }) => (
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

const LeavesOverviewCard: React.FC<{ navigate: (path: string) => void }> = ({ navigate }) => {
    const { leaveRequests, resources, leaveTypes } = useEntitiesContext();
    const { isAdmin } = useAuth();
    
    const today = new Date().toISOString().split('T')[0];
    const nextWeek = new Date();
    nextWeek.setUTCDate(nextWeek.getUTCDate() + 7);
    const nextWeekStr = nextWeek.toISOString().split('T')[0];

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


const getAvgAllocationColor = (avg: number): string => {
    if (avg > 100) return DASHBOARD_COLORS.utilization.over;
    if (avg > 95) return DASHBOARD_COLORS.utilization.high;
    if (avg > 0) return DASHBOARD_COLORS.utilization.normal;
    return DASHBOARD_COLORS.utilization.zero;
};

// --- Individual Card Components ---

const ViewToggleButton: React.FC<{ view: 'table' | 'graph', setView: (v: 'table' | 'graph') => void }> = ({ view, setView }) => (
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


const AverageAllocationCard: React.FC<any> = ({ data, filter, setFilter, resourceOptions, totals, isLoading }) => {
    const [view, setView] = useState<'table' | 'graph'>('table');
    const columns: ColumnDef<any>[] = [
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
        return data.map((d: any) => ({
            Risorsa: d.resource.name,
            'Mese Corrente (%)': d.currentMonth.toFixed(0),
            'Mese Prossimo (%)': d.nextMonth.toFixed(0)
        }));
    }, [data]);
    
    return (
        <div className="bg-surface-container rounded-2xl shadow p-6 flex flex-col border-l-4 border-primary">
            <div className="flex-shrink-0 mb-4 flex justify-between items-center">
                <h2 className="text-lg font-semibold">Allocazione Media</h2>
                <div className="flex items-center gap-4">
                    <div className="w-48"><SearchableSelect name="resourceId" value={filter.resourceId} onChange={(_, v) => setFilter({ resourceId: v })} options={resourceOptions} placeholder="Tutte le risorse" /></div>
                    <ViewToggleButton view={view} setView={setView} />
                    <ExportButton data={exportData} title="Allocazione Media" />
                </div>
            </div>
            <div className="flex-grow h-[30rem]">
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

const FtePerProjectCard: React.FC<any> = ({ data, filter, setFilter, clientOptions, totals, isLoading }) => {
    const [view, setView] = useState<'table' | 'graph'>('table');
    const columns: ColumnDef<any>[] = [
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
        return data.map((d: any) => ({
            Progetto: d.name,
            'G/U Allocati': d.totalPersonDays.toFixed(1),
            FTE: d.fte.toFixed(2)
        }));
    }, [data]);

    return (
        <div className="bg-surface-container rounded-2xl shadow p-6 flex flex-col border-l-4 border-primary">
            <div className="flex-shrink-0 mb-4 flex justify-between items-center">
                <h2 className="text-lg font-semibold">FTE per Progetto</h2>
                <div className="flex items-center gap-4">
                    <div className="w-48"><SearchableSelect name="clientId" value={filter.clientId} onChange={(_, v) => setFilter({ clientId: v })} options={clientOptions} placeholder="Tutti i clienti"/></div>
                    <ViewToggleButton view={view} setView={setView} />
                    <ExportButton data={exportData} title="FTE per Progetto" />
                </div>
            </div>
            <div className="flex-grow h-[30rem]">
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

const BudgetAnalysisCard: React.FC<any> = ({ data, filter, setFilter, clientOptions, totals, isLoading }) => {
    const [view, setView] = useState<'table' | 'graph'>('table');
    const columns: ColumnDef<any>[] = [
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
        return data.map((d: any) => ({
            Progetto: d.name,
            Budget: formatCurrency(d.budget),
            'Costo Stimato': formatCurrency(d.estimatedCost),
            Varianza: formatCurrency(d.variance)
        }));
    }, [data]);

    return (
        <div className="bg-surface-container rounded-2xl shadow p-6 flex flex-col border-l-4 border-primary">
            <div className="flex-shrink-0 mb-4 flex justify-between items-center">
                <h2 className="text-lg font-semibold">Analisi Budget</h2>
                <div className="flex items-center gap-4">
                    <div className="w-48"><SearchableSelect name="clientId" value={filter.clientId} onChange={(_, v) => setFilter({ clientId: v })} options={clientOptions} placeholder="Tutti i clienti"/></div>
                    <ViewToggleButton view={view} setView={setView} />
                    <ExportButton data={exportData} title="Analisi Budget" />
                </div>
            </div>
            <div className="flex-grow h-[30rem]">
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

const TemporalBudgetAnalysisCard: React.FC<any> = ({ data, filter, setFilter, clientOptions, totals, isLoading }) => {
    const [view, setView] = useState<'table' | 'graph'>('table');
    const columns: ColumnDef<any>[] = [
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
        return data.map((d: any) => ({
            Progetto: d.name,
            'Budget Periodo': formatCurrency(d.periodBudget),
            'Costo Stimato': formatCurrency(d.estimatedCost),
            Varianza: formatCurrency(d.variance)
        }));
    }, [data]);

    return (
        <div className="bg-surface-container rounded-2xl shadow p-6 flex flex-col border-l-4 border-primary">
            <div className="flex-shrink-0 mb-4">
                 <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                    <h2 className="text-lg font-semibold">Analisi Budget Temporale</h2>
                    <div className="flex flex-wrap gap-2 w-full xl:w-auto justify-start xl:justify-end items-center">
                        <input type="date" value={filter.startDate} onChange={(e) => setFilter({ ...filter, startDate: e.target.value })} className="form-input text-sm p-1.5 w-32"/>
                        <input type="date" value={filter.endDate} onChange={(e) => setFilter({ ...filter, endDate: e.target.value })} className="form-input text-sm p-1.5 w-32"/>
                        <div className="w-full sm:w-48"><SearchableSelect name="clientId" value={filter.clientId} onChange={(_, v) => setFilter({ ...filter, clientId: v })} options={clientOptions} placeholder="Tutti i clienti"/></div>
                        <ViewToggleButton view={view} setView={setView} />
                        <ExportButton data={exportData} title="Analisi Budget Temporale" />
                    </div>
                </div>
            </div>
            <div className="flex-grow h-[30rem]">
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

const AverageDailyRateCard: React.FC<any> = ({ data, filter, setFilter, clientOptions, totals, isLoading }) => {
    const [view, setView] = useState<'table' | 'graph'>('table');
    const columns: ColumnDef<any>[] = [
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
        return data.map((d: any) => ({
            Progetto: d.name,
            Cliente: d.clientName,
            'G/U Lavorati': d.totalPersonDays.toFixed(1),
            'Costo Totale': formatCurrency(d.totalCost),
            'Tariffa Media G.': formatCurrency(d.avgDailyRate)
        }));
    }, [data]);

    return (
        <div className="bg-surface-container rounded-2xl shadow p-6 flex flex-col border-l-4 border-primary">
            <div className="flex-shrink-0 mb-4">
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                    <h2 className="text-lg font-semibold">Tariffa Media Giornaliera</h2>
                    <div className="flex flex-wrap gap-2 w-full xl:w-auto justify-start xl:justify-end items-center">
                        <input type="date" value={filter.startDate} onChange={(e) => setFilter({ ...filter, startDate: e.target.value })} className="form-input text-sm p-1.5 w-32"/>
                        <input type="date" value={filter.endDate} onChange={(e) => setFilter({ ...filter, endDate: e.target.value })} className="form-input text-sm p-1.5 w-32"/>
                        <div className="w-full sm:w-48"><SearchableSelect name="clientId" value={filter.clientId} onChange={(_, v) => setFilter({ ...filter, clientId: v })} options={clientOptions} placeholder="Tutti i clienti"/></div>
                        <ViewToggleButton view={view} setView={setView} />
                        <ExportButton data={exportData} title="Tariffa Media Giornaliera" />
                    </div>
                </div>
            </div>
            <div className="flex-grow h-[30rem]">
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


const UnderutilizedResourcesCard: React.FC<any> = ({ data, month, setMonth, isLoading }) => {
    const [view, setView] = useState<'table' | 'graph'>('table');
    const columns: ColumnDef<any>[] = [
        { header: "Risorsa", sortKey: "resource.name", cell: (d) => d.resource.name },
        { header: "Alloc. Media", sortKey: "avgAllocation", cell: (d) => <span className={DASHBOARD_COLORS.utilization.high}>{d.avgAllocation.toFixed(0)}%</span> },
    ];

    const exportData = useMemo(() => {
        return data.map((d: any) => ({
            Risorsa: d.resource.name,
            'Allocazione Media (%)': d.avgAllocation.toFixed(0)
        }));
    }, [data]);

    return (
        <div className="bg-surface-container rounded-2xl shadow p-6 flex flex-col border-l-4 border-primary">
            <div className="flex-shrink-0 mb-4 flex justify-between items-center">
                <h2 className="text-lg font-semibold">Risorse Sottoutilizzate</h2>
                <div className="flex items-center gap-4">
                    <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="form-input w-48"/>
                    <ViewToggleButton view={view} setView={setView} />
                    <ExportButton data={exportData} title="Risorse Sottoutilizzate" />
                </div>
            </div>
            <div className="flex-grow h-[30rem]">
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

const MonthlyClientCostCard: React.FC<any> = ({ data, navigate, isLoading }) => {
    const [view, setView] = useState<'table' | 'graph'>('table');
    const columns: ColumnDef<any>[] = [
        { header: "Cliente", sortKey: "name", cell: (d) => <button onClick={() => navigate(`/projects?clientId=${d.id}`)} className={DASHBOARD_COLORS.link}>{d.name}</button> },
        { header: "Costo Stimato", sortKey: "cost", cell: (d) => formatCurrency(d.cost) },
    ];

    const exportData = useMemo(() => {
        return data.map((d: any) => ({
            Cliente: d.name,
            'Costo Stimato': formatCurrency(d.cost)
        }));
    }, [data]);

    return (
        <div className="bg-surface-container rounded-2xl shadow p-6 flex flex-col border-l-4 border-primary">
            <div className="flex-shrink-0 mb-4 flex justify-between items-center">
                 <h2 className="text-lg font-semibold">Costo Mensile per Cliente</h2>
                 <div className="flex items-center gap-2">
                    <ViewToggleButton view={view} setView={setView} />
                    <ExportButton data={exportData} title="Costo Mensile per Cliente" />
                 </div>
            </div>
            <div className="flex-grow h-[30rem]">
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

const EffortByFunctionCard: React.FC<any> = ({ data, total, isLoading }) => {
    const [view, setView] = useState<'table' | 'graph'>('table');
    const columns: ColumnDef<any>[] = [
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
        return data.map((d: any) => ({
            Function: d.name,
            'G/U Totali': d.totalPersonDays.toFixed(1)
        }));
    }, [data]);

    return (
        <div className="bg-surface-container rounded-2xl shadow p-6 flex flex-col border-l-4 border-primary">
            <div className="flex-shrink-0 mb-4 flex justify-between items-center">
                 <h2 className="text-lg font-semibold">Analisi Sforzo per Function</h2>
                 <div className="flex items-center gap-2">
                    <ViewToggleButton view={view} setView={setView} />
                    <ExportButton data={exportData} title="Analisi Sforzo per Function" />
                 </div>
            </div>
            <div className="flex-grow h-[30rem]">
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

const EffortByIndustryCard: React.FC<any> = ({ data, total, isLoading }) => {
    const [view, setView] = useState<'table' | 'graph'>('table');
    const columns: ColumnDef<any>[] = [
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
        return data.map((d: any) => ({
            Industry: d.name,
            'G/U Totali': d.totalPersonDays.toFixed(1)
        }));
    }, [data]);

    return (
        <div className="bg-surface-container rounded-2xl shadow p-6 flex flex-col border-l-4 border-secondary">
            <div className="flex-shrink-0 mb-4 flex justify-between items-center">
                 <h2 className="text-lg font-semibold">Analisi Sforzo per Industry</h2>
                 <div className="flex items-center gap-2">
                    <ViewToggleButton view={view} setView={setView} />
                    <ExportButton data={exportData} title="Analisi Sforzo per Industry" />
                 </div>
            </div>
            <div className="flex-grow h-[30rem]">
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

const LocationAnalysisCard: React.FC<any> = ({ data, isLoading }) => {
    const [view, setView] = useState<'table' | 'graph'>('table');
    const columns: ColumnDef<any>[] = [
        { header: "Sede", sortKey: "name", cell: (d) => d.name },
        { header: "N. Risorse", sortKey: "resourceCount", cell: (d) => d.resourceCount },
        { header: "G/U Allocati", sortKey: "allocatedDays", cell: (d) => d.allocatedDays.toFixed(1) },
        { header: "Utilizzo Medio", sortKey: "avgUtilization", cell: (d) => <span className={`font-semibold ${getAvgAllocationColor(d.avgUtilization)}`}>{d.avgUtilization.toFixed(0)}%</span> },
    ];

    const exportData = useMemo(() => {
        return data.map((d: any) => ({
            Sede: d.name,
            'N. Risorse': d.resourceCount,
            'G/U Allocati': d.allocatedDays.toFixed(1),
            'Utilizzo Medio (%)': d.avgUtilization.toFixed(0)
        }));
    }, [data]);

    return (
        <div className="bg-surface-container rounded-2xl shadow p-6 flex flex-col border-l-4 border-primary">
            <div className="flex-shrink-0 mb-4 flex justify-between items-center">
                <h2 className="text-lg font-semibold">Analisi per Sede (Mese Corrente)</h2>
                <div className="flex items-center gap-2">
                    <ViewToggleButton view={view} setView={setView} />
                    <ExportButton data={exportData} title="Analisi per Sede (Mese Corrente)" />
                </div>
            </div>
            <div className="flex-grow h-[30rem]">
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

const SaturationTrendCard: React.FC<{ 
    trendResource: string, 
    setTrendResource: (v: string) => void, 
    resourceOptions: any[], 
    data: any[] 
}> = ({ trendResource, setTrendResource, resourceOptions, data }) => {
    const chartRef = useRef<SVGSVGElement>(null);

    const exportData = useMemo(() => {
        return data.map((d: any) => ({
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
        <div className="h-full bg-surface-container rounded-2xl shadow p-6 border-l-4 border-primary flex flex-col">
            <div className="flex justify-between items-center mb-4 flex-shrink-0">
                <h2 className="text-lg font-semibold">Trend Saturazione Risorsa</h2>
                <div className="flex items-center gap-2">
                    <div className="w-64"><SearchableSelect name="trendResource" value={trendResource} onChange={(_, v) => setTrendResource(v)} options={resourceOptions} placeholder="Seleziona una risorsa"/></div>
                    <ExportButton data={exportData} title="Trend Saturazione Risorsa" />
                </div>
            </div>
            <div className="flex-grow h-72">{ trendResource ? <svg ref={chartRef} className="w-full h-full"></svg> : <div className="flex items-center justify-center h-full text-on-surface-variant">Seleziona una risorsa per visualizzare il trend.</div> }</div>
        </div>
    );
};

const CostForecastCard: React.FC<{ data: any[] }> = ({ data }) => {
    const chartRef = useRef<SVGSVGElement>(null);

    const exportData = useMemo(() => {
        return data.map((d: any) => ({
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
        <div className="h-full bg-surface-container rounded-2xl shadow p-6 border-l-4 border-primary flex flex-col">
            <div className="flex justify-between items-center mb-4 flex-shrink-0">
                <h2 className="text-lg font-semibold">Forecast Costo Mensile (Rolling 3 Mesi)</h2>
                <ExportButton data={exportData} title="Forecast Costo Mensile (Rolling 3 Mesi)" />
            </div>
            <div className="flex-grow h-72"><svg ref={chartRef} className="w-full h-full"></svg></div>
        </div>
    );
};


/**
 * Componente principale della pagina Dashboard.
 * Mostra una serie di "card" con analisi dei dati, ora renderizzate dinamicamente in base a una configurazione.
 */
const DashboardPage: React.FC = () => {
    const { resources, roles, projects, clients, assignments, functions, industries, locations, companyCalendar, loading, getRoleCost, dashboardLayout } = useEntitiesContext();
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
                    let currentDate = new Date(filterStartDate);
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
            default: return null;
        }
    };

    // If no layout defined (should not happen due to default), fallback
    const activeCategory = dashboardLayout.find(c => c.id === activeTab) || dashboardLayout[0];

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-on-surface">Dashboard</h1>
            
            {/* Tabs */}
            <div className="flex border-b border-outline-variant overflow-x-auto">
                {dashboardLayout.map(cat => (
                    <button
                        key={cat.id}
                        onClick={() => setActiveTab(cat.id)}
                        className={`flex items-center px-6 py-3 font-medium text-sm whitespace-nowrap transition-colors ${
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
                    return (
                        <React.Fragment key={cardId}>
                            {renderCard(cardId)}
                        </React.Fragment>
                    );
                })}
            </div>
        </div>
    );
};

export default DashboardPage;
