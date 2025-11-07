/**
 * @file DashboardPage.tsx
 * @description Pagina della dashboard che visualizza varie metriche e analisi aggregate sui dati di staffing.
 */

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useEntitiesContext, useAllocationsContext } from '../context/AppContext';
import { getWorkingDaysBetween, isHoliday } from '../utils/dateUtils';
import SearchableSelect from '../components/SearchableSelect';
import { useNavigate, Link } from 'react-router-dom';
import {
  DashboardCardId,
  DASHBOARD_CARDS_CONFIG,
  DEFAULT_DASHBOARD_CARD_ORDER,
  DASHBOARD_CARD_ORDER_STORAGE_KEY,
} from '../config/dashboardLayout';


declare var d3: any;

// --- Colori Centralizzati per la Dashboard ---
const DASHBOARD_COLORS = {
  attention: {
    background: 'bg-amber-100 dark:bg-amber-900/50',
    hoverBackground: 'hover:bg-amber-200 dark:hover:bg-amber-900/80',
    text: 'text-amber-800 dark:text-amber-200',
    strongText: 'text-amber-900 dark:text-amber-100',
    icon: 'text-3xl opacity-50',
  },
  utilization: {
    over: 'text-red-600 dark:text-red-400 font-bold',
    high: 'text-green-600 dark:text-green-400',
    normal: 'text-yellow-600 dark:text-yellow-400 font-semibold',
    zero: 'text-gray-500 dark:text-gray-400',
  },
  variance: {
    positive: 'text-green-600',
    negative: 'text-red-600',
  },
  link: 'text-blue-600 hover:underline',
  header: {
    base: 'text-gray-500 dark:text-gray-300',
    hover: 'hover:text-gray-900 dark:hover:text-white',
    active: 'font-bold text-gray-800 dark:text-white',
    icon: 'text-gray-400',
  },
  chart: {
    primary: '#3b82f6', // blue
    secondary: '#6b7280', // gray
    threshold: 'red',
  },
};


// --- Tipi e Hook per l'Ordinamento ---

type SortDirection = 'ascending' | 'descending';

interface SortConfig<T> {
  key: keyof T | string;
  direction: SortDirection;
}

const useSortableData = <T extends object>(items: T[], initialConfig: SortConfig<T> | null = null) => {
  const [sortConfig, setSortConfig] = useState<SortConfig<T> | null>(initialConfig);

  const sortedItems = useMemo(() => {
    let sortableItems = [...items];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const getNestedValue = (obj: any, path: string) =>
          path.split('.').reduce((o, i) => (o ? o[i] : undefined), obj);

        const aValue = getNestedValue(a, sortConfig.key as string);
        const bValue = getNestedValue(b, sortConfig.key as string);

        if (aValue == null) return 1;
        if (bValue == null) return -1;

        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortConfig.direction === 'ascending' ? aValue - bValue : bValue - aValue;
        }
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortConfig.direction === 'ascending'
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        }
        return 0;
      });
    }
    return sortableItems;
  }, [items, sortConfig]);

  const requestSort = (key: keyof T | string) => {
    let direction: SortDirection = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  return { items: sortedItems, requestSort, sortConfig };
};

const formatCurrency = (value: number | string): string => {
  const numValue = Number(value) || 0;
  return numValue.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
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
    </>
);

const AttentionCards: React.FC<{ overallKPIs: any, navigate: Function }> = ({ overallKPIs, navigate }) => (
    <>
        <div className={`${DASHBOARD_COLORS.attention.background} rounded-lg shadow p-5 flex flex-col justify-start cursor-pointer ${DASHBOARD_COLORS.attention.hoverBackground} min-h-[150px]`} onClick={() => navigate('/resources?filter=unassigned')}>
            <div className="flex justify-between items-start w-full">
                <div>
                    <h3 className={`text-sm font-medium ${DASHBOARD_COLORS.attention.text}`}>Risorse Non Allocate</h3>
                    <p className={`mt-1 text-3xl font-semibold ${DASHBOARD_COLORS.attention.strongText}`}>{overallKPIs.unassignedResources.length}</p>
                </div>
                <span className={DASHBOARD_COLORS.attention.icon}>👥</span>
            </div>
            {overallKPIs.unassignedResources.length > 0 && (
                <div className={`mt-2 text-xs ${DASHBOARD_COLORS.attention.text} overflow-y-auto max-h-20 pr-2 w-full`}>
                    <ul className="list-disc list-inside">{overallKPIs.unassignedResources.slice(0, 5).map((r: any) => <li key={r.id} className="truncate">{r.name}</li>)}</ul>
                </div>
            )}
        </div>
        <div className={`${DASHBOARD_COLORS.attention.background} rounded-lg shadow p-5 flex flex-col justify-start cursor-pointer ${DASHBOARD_COLORS.attention.hoverBackground} min-h-[150px]`} onClick={() => navigate('/projects?filter=unstaffed')}>
            <div className="flex justify-between items-start w-full">
                <div>
                    <h3 className={`text-sm font-medium ${DASHBOARD_COLORS.attention.text}`}>Progetti Senza Staff</h3>
                    <p className={`mt-1 text-3xl font-semibold ${DASHBOARD_COLORS.attention.strongText}`}>{overallKPIs.unstaffedProjects.length}</p>
                </div>
                <span className={DASHBOARD_COLORS.attention.icon}>💼</span>
            </div>
            {overallKPIs.unstaffedProjects.length > 0 && (
                <div className={`mt-2 text-xs ${DASHBOARD_COLORS.attention.text} overflow-y-auto max-h-20 pr-2 w-full`}>
                    <ul className="list-disc list-inside">{overallKPIs.unstaffedProjects.slice(0, 5).map((p: any) => <li key={p.id} className="truncate">{p.name}</li>)}</ul>
                </div>
            )}
        </div>
    </>
);

const SortableHeader: React.FC<{ label: string; sortKey: string; sortConfig: SortConfig<any> | null; requestSort: (key: string) => void; }> = ({ label, sortKey, sortConfig, requestSort }) => (
    <th className={`px-4 py-2 text-left text-xs font-medium ${DASHBOARD_COLORS.header.base} uppercase tracking-wider`}>
        <button type="button" onClick={() => requestSort(sortKey)} className={`flex items-center space-x-1 ${DASHBOARD_COLORS.header.hover}`}>
            <span className={sortConfig?.key === sortKey ? DASHBOARD_COLORS.header.active : ''}>{label}</span>
            <span className={DASHBOARD_COLORS.header.icon}>↕️</span>
        </button>
    </th>
);

const getAvgAllocationColor = (avg: number): string => {
    if (avg > 100) return DASHBOARD_COLORS.utilization.over;
    if (avg > 95) return DASHBOARD_COLORS.utilization.high;
    if (avg > 0) return DASHBOARD_COLORS.utilization.normal;
    return DASHBOARD_COLORS.utilization.zero;
};

// --- Individual Card Components ---

/**
 * A unified component for all dashboard cards that contain a table.
 * This ensures consistent padding, shadow, header layout, and scrolling behavior.
 */
const DashboardTableCard: React.FC<{
  headerContent: React.ReactNode;
  children: React.ReactNode; // expects the <table> element
}> = ({ headerContent, children }) => (
  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 flex flex-col">
    {/* Header (titolo + filtri) */}
    <div className="flex-shrink-0 mb-4">{headerContent}</div>

    {/* Contenitore scrollabile */}
    <div className="flex-grow overflow-x-auto">
      <div className="max-h-80 overflow-y-auto relative dashboard-table-container">
        {children}
      </div>
    </div>

    <style>{`
      /* Applica sticky header a qualsiasi thead interno */
      .dashboard-table-container thead {
        position: sticky;
        top: 0;
        z-index: 10;
        background-color: #f9fafb; /* bg-gray-50 */
      }
      .dark .dashboard-table-container thead {
        background-color: #374151; /* dark:bg-gray-700 */
      }
      /* Rimuovi eventuali trasparenze per evitare sovrapposizioni */
      .dashboard-table-container th {
        background-color: inherit;
      }
    `}</style>
  </div>
);

const AverageAllocationCard: React.FC<any> = ({ data, filter, setFilter, resourceOptions, requestSort, sortConfig, totals }) => (
    <DashboardTableCard
        headerContent={
            <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold">Allocazione Media</h2>
                <div className="w-48"><SearchableSelect name="resourceId" value={filter.resourceId} onChange={(_, v) => setFilter({ resourceId: v })} options={resourceOptions} placeholder="Tutte le risorse" /></div>
            </div>
        }
    >
        <table className="min-w-full">
            <thead><tr><SortableHeader label="Risorsa" sortKey="resource.name" sortConfig={sortConfig} requestSort={requestSort} /><SortableHeader label="Mese Corrente" sortKey="currentMonth" sortConfig={sortConfig} requestSort={requestSort} /><SortableHeader label="Mese Prossimo" sortKey="nextMonth" sortConfig={sortConfig} requestSort={requestSort} /></tr></thead>
            <tbody>
                {data.map((d: any) => (
                    <tr key={d.resource.id} className="border-t border-gray-200 dark:border-gray-700">
                        <td className="px-4 py-2"><Link to={`/workload?resourceId=${d.resource.id}`} className={DASHBOARD_COLORS.link}>{d.resource.name}</Link></td>
                        <td className={`px-4 py-2 font-semibold ${getAvgAllocationColor(d.currentMonth)}`}>{d.currentMonth.toFixed(0)}%</td>
                        <td className={`px-4 py-2 font-semibold ${getAvgAllocationColor(d.nextMonth)}`}>{d.nextMonth.toFixed(0)}%</td>
                    </tr>
                ))}
            </tbody>
            <tfoot><tr className="border-t-2 border-gray-300 dark:border-gray-600 font-bold"><td className="px-4 py-2">Media</td><td className={`px-4 py-2 ${getAvgAllocationColor(totals.currentMonth)}`}>{totals.currentMonth.toFixed(0)}%</td><td className={`px-4 py-2 ${getAvgAllocationColor(totals.nextMonth)}`}>{totals.nextMonth.toFixed(0)}%</td></tr></tfoot>
        </table>
    </DashboardTableCard>
);

const FtePerProjectCard: React.FC<any> = ({ data, filter, setFilter, clientOptions, requestSort, sortConfig, totals }) => (
  <DashboardTableCard
    headerContent={
        <div className="flex justify-between items-center"><h2 className="text-lg font-semibold">FTE per Progetto</h2><div className="w-48"><SearchableSelect name="clientId" value={filter.clientId} onChange={(_, v) => setFilter({ clientId: v })} options={clientOptions} placeholder="Tutti i clienti"/></div></div>
    }
  >
    <table className="min-w-full">
        <thead><tr><SortableHeader label="Progetto" sortKey="name" sortConfig={sortConfig} requestSort={requestSort} /><SortableHeader label="G/U Allocati" sortKey="totalPersonDays" sortConfig={sortConfig} requestSort={requestSort} /><SortableHeader label="FTE" sortKey="fte" sortConfig={sortConfig} requestSort={requestSort} /></tr></thead>
        <tbody>
            {data.map((d: any) => (
                <tr key={d.id} className="border-t border-gray-200 dark:border-gray-700">
                    <td className="px-4 py-2">{d.name}</td>
                    <td className="px-4 py-2">{d.totalPersonDays.toFixed(1)}</td>
                    <td className="px-4 py-2 font-semibold">{d.fte.toFixed(2)}</td>
                </tr>
            ))}
        </tbody>
        <tfoot><tr className="border-t-2 border-gray-300 dark:border-gray-600 font-bold"><td className="px-4 py-2">Totale</td><td className="px-4 py-2">{totals.totalDays.toFixed(1)}</td><td className="px-4 py-2">{totals.totalFte.toFixed(2)}</td></tr></tfoot>
    </table>
  </DashboardTableCard>
);

const BudgetAnalysisCard: React.FC<any> = ({ data, filter, setFilter, clientOptions, requestSort, sortConfig, totals }) => (
  <DashboardTableCard
    headerContent={
        <div className="flex justify-between items-center"><h2 className="text-lg font-semibold">Analisi Budget</h2><div className="w-48"><SearchableSelect name="clientId" value={filter.clientId} onChange={(_, v) => setFilter({ clientId: v })} options={clientOptions} placeholder="Tutti i clienti"/></div></div>
    }
  >
    <table className="min-w-full">
        <thead><tr><SortableHeader label="Progetto" sortKey="name" sortConfig={sortConfig} requestSort={requestSort} /><SortableHeader label="Budget" sortKey="budget" sortConfig={sortConfig} requestSort={requestSort} /><SortableHeader label="Costo Stimato" sortKey="estimatedCost" sortConfig={sortConfig} requestSort={requestSort} /><SortableHeader label="Varianza" sortKey="variance" sortConfig={sortConfig} requestSort={requestSort} /></tr></thead>
        <tbody>
            {data.map((d: any) => (
                <tr key={d.id} className="border-t border-gray-200 dark:border-gray-700">
                    <td className="px-4 py-2">{d.name}</td>
                    <td className="px-4 py-2">{formatCurrency(d.budget)}</td>
                    <td className="px-4 py-2">{formatCurrency(d.estimatedCost)}</td>
                    <td className={`px-4 py-2 font-semibold ${d.variance < 0 ? DASHBOARD_COLORS.variance.negative : DASHBOARD_COLORS.variance.positive}`}>{formatCurrency(d.variance)}</td>
                </tr>
            ))}
        </tbody>
        <tfoot><tr className="border-t-2 border-gray-300 dark:border-gray-600 font-bold"><td className="px-4 py-2">Totale</td><td className="px-4 py-2">{formatCurrency(totals.budget)}</td><td className="px-4 py-2">{formatCurrency(totals.cost)}</td><td className={`px-4 py-2 ${totals.variance < 0 ? DASHBOARD_COLORS.variance.negative : DASHBOARD_COLORS.variance.positive}`}>{formatCurrency(totals.variance)}</td></tr></tfoot>
    </table>
  </DashboardTableCard>
);

const TemporalBudgetAnalysisCard: React.FC<any> = ({ data, filter, setFilter, clientOptions, requestSort, sortConfig, totals }) => (
    <DashboardTableCard
        headerContent={
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h2 className="text-lg font-semibold">Analisi Budget Temporale</h2>
                <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
                <input type="date" value={filter.startDate} onChange={(e) => setFilter({ ...filter, startDate: e.target.value })} className="form-input text-sm p-1.5"/>
                <input type="date" value={filter.endDate} onChange={(e) => setFilter({ ...filter, endDate: e.target.value })} className="form-input text-sm p-1.5"/>
                <div className="w-full md:w-48"><SearchableSelect name="clientId" value={filter.clientId} onChange={(_, v) => setFilter({ ...filter, clientId: v })} options={clientOptions} placeholder="Tutti i clienti"/></div>
                </div>
            </div>
        }
    >
        <table className="min-w-full">
            <thead><tr>
                <SortableHeader label="Progetto" sortKey="name" sortConfig={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Budget Periodo" sortKey="periodBudget" sortConfig={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Costo Stimato" sortKey="estimatedCost" sortConfig={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Varianza" sortKey="variance" sortConfig={sortConfig} requestSort={requestSort} />
            </tr></thead>
            <tbody>
                {data.map((d: any) => (
                    <tr key={d.id} className="border-t border-gray-200 dark:border-gray-700">
                        <td className="px-4 py-2">{d.name}</td>
                        <td className="px-4 py-2">{formatCurrency(d.periodBudget)}</td>
                        <td className="px-4 py-2">{formatCurrency(d.estimatedCost)}</td>
                        <td className={`px-4 py-2 font-semibold ${d.variance < 0 ? DASHBOARD_COLORS.variance.negative : DASHBOARD_COLORS.variance.positive}`}>{formatCurrency(d.variance)}</td>
                    </tr>
                ))}
            </tbody>
            <tfoot><tr className="border-t-2 border-gray-300 dark:border-gray-600 font-bold">
                <td className="px-4 py-2">Totale</td>
                <td className="px-4 py-2">{formatCurrency(totals.budget)}</td>
                <td className="px-4 py-2">{formatCurrency(totals.cost)}</td>
                <td className={`px-4 py-2 ${totals.variance < 0 ? DASHBOARD_COLORS.variance.negative : DASHBOARD_COLORS.variance.positive}`}>{formatCurrency(totals.variance)}</td>
            </tr></tfoot>
        </table>
    </DashboardTableCard>
  );

const UnderutilizedResourcesCard: React.FC<any> = ({ data, month, setMonth, requestSort, sortConfig }) => (
  <DashboardTableCard
    headerContent={
        <div className="flex justify-between items-center"><h2 className="text-lg font-semibold">Risorse Sottoutilizzate</h2><input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="form-input w-48"/></div>
    }
  >
      <table className="min-w-full">
          <thead><tr><SortableHeader label="Risorsa" sortKey="resource.name" sortConfig={sortConfig} requestSort={requestSort} /><SortableHeader label="Alloc. Media" sortKey="avgAllocation" sortConfig={sortConfig} requestSort={requestSort} /></tr></thead>
          <tbody>
              {data.map((d: any) => (
                  <tr key={d.resource.id} className="border-t border-gray-200 dark:border-gray-700">
                      <td className="px-4 py-2">{d.resource.name}</td>
                      <td className={`px-4 py-2 ${DASHBOARD_COLORS.utilization.high}`}>{d.avgAllocation.toFixed(0)}%</td>
                  </tr>
              ))}
          </tbody>
      </table>
  </DashboardTableCard>
);

const MonthlyClientCostCard: React.FC<any> = ({ data, requestSort, sortConfig, navigate }) => (
  <DashboardTableCard
    headerContent={
        <h2 className="text-lg font-semibold">Costo Mensile per Cliente</h2>
    }
  >
    <table className="min-w-full">
        <thead><tr><SortableHeader label="Cliente" sortKey="name" sortConfig={sortConfig} requestSort={requestSort} /><SortableHeader label="Costo Stimato" sortKey="cost" sortConfig={sortConfig} requestSort={requestSort} /></tr></thead>
        <tbody>
            {data.map((d: any) => (
                <tr key={d.id} className="border-t border-gray-200 dark:border-gray-700">
                    <td className="px-4 py-2"><button onClick={() => navigate(`/projects?clientId=${d.id}`)} className={DASHBOARD_COLORS.link}>{d.name}</button></td>
                    <td className="px-4 py-2">{formatCurrency(d.cost)}</td>
                </tr>
            ))}
        </tbody>
    </table>
  </DashboardTableCard>
);

const EffortByHorizontalCard: React.FC<any> = ({ data, requestSort, sortConfig, total }) => (
  <DashboardTableCard
    headerContent={
        <h2 className="text-lg font-semibold">Analisi Sforzo per Horizontal</h2>
    }
  >
      <table className="min-w-full">
          <thead><tr><SortableHeader label="Horizontal" sortKey="name" sortConfig={sortConfig} requestSort={requestSort} /><SortableHeader label="G/U Totali" sortKey="totalPersonDays" sortConfig={sortConfig} requestSort={requestSort} /></tr></thead>
          <tbody>
              {data.map((d: any) => (
                  <tr key={d.name} className="border-t border-gray-200 dark:border-gray-700">
                      <td className="px-4 py-2">{d.name}</td>
                      <td className="px-4 py-2">{d.totalPersonDays.toFixed(1)}</td>
                  </tr>
              ))}
          </tbody>
          <tfoot><tr className="border-t-2 border-gray-300 dark:border-gray-600 font-bold"><td className="px-4 py-2">Totale</td><td className="px-4 py-2">{total.toFixed(1)}</td></tr></tfoot>
      </table>
  </DashboardTableCard>
);

const LocationAnalysisCard: React.FC<any> = ({ data, requestSort, sortConfig }) => (
  <DashboardTableCard
    headerContent={
        <h2 className="text-lg font-semibold">Analisi per Sede (Mese Corrente)</h2>
    }
  >
    <table className="min-w-full">
        <thead><tr><SortableHeader label="Sede" sortKey="name" sortConfig={sortConfig} requestSort={requestSort} /><SortableHeader label="N. Risorse" sortKey="resourceCount" sortConfig={sortConfig} requestSort={requestSort} /><SortableHeader label="G/U Allocati" sortKey="allocatedDays" sortConfig={sortConfig} requestSort={requestSort} /><SortableHeader label="Utilizzo Medio" sortKey="avgUtilization" sortConfig={sortConfig} requestSort={requestSort} /></tr></thead>
        <tbody>
            {data.map((d: any) => (
                <tr key={d.name} className="border-t border-gray-200 dark:border-gray-700">
                    <td className="px-4 py-2">{d.name}</td>
                    <td className="px-4 py-2">{d.resourceCount}</td>
                    <td className="px-4 py-2">{d.allocatedDays.toFixed(1)}</td>
                    <td className={`px-4 py-2 font-semibold ${getAvgAllocationColor(d.avgUtilization)}`}>{d.avgUtilization.toFixed(0)}%</td>
                </tr>
            ))}
        </tbody>
    </table>
  </DashboardTableCard>
);

const SaturationTrendCard: React.FC<any> = ({ trendResource, setTrendResource, resourceOptions, chartRef }) => (
  <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-lg shadow p-6 mt-8">
    <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Trend Saturazione Risorsa</h2>
        <div className="w-64"><SearchableSelect name="trendResource" value={trendResource} onChange={(_, v) => setTrendResource(v)} options={resourceOptions} placeholder="Seleziona una risorsa"/></div>
    </div>
    <div className="h-72">{ trendResource ? <svg ref={chartRef} className="w-full h-full"></svg> : <div className="flex items-center justify-center h-full text-gray-500">Seleziona una risorsa per visualizzare il trend.</div> }</div>
  </div>
);

const CostForecastCard: React.FC<any> = ({ chartRef }) => (
  <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-lg shadow p-6 mt-8">
      <h2 className="text-lg font-semibold mb-4">Forecast Costo Mensile (Rolling 3 Mesi)</h2>
      <div className="h-72"><svg ref={chartRef} className="w-full h-full"></svg></div>
  </div>
);


/**
 * Componente principale della pagina Dashboard.
 * Mostra una serie di "card" con analisi dei dati, ora renderizzate dinamicamente in base a una configurazione.
 */
const DashboardPage: React.FC = () => {
    const { resources, roles, projects, clients, assignments, horizontals, locations, companyCalendar } = useEntitiesContext();
    const { allocations } = useAllocationsContext();
    const navigate = useNavigate();

    // Stati dei filtri per ogni card
    const [avgAllocFilter, setAvgAllocFilter] = useState({ resourceId: '' });
    const [fteFilter, setFteFilter] = useState({ clientId: '' });
    const [budgetFilter, setBudgetFilter] = useState({ clientId: '' });
    const [temporalBudgetFilter, setTemporalBudgetFilter] = useState({
        clientId: '',
        startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
        endDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0, 10),
    });
    const [underutilizedFilter, setUnderutilizedFilter] = useState(new Date().toISOString().slice(0, 7));
    const [trendResource, setTrendResource] = useState<string>('');
    const trendChartRef = useRef<SVGSVGElement>(null);
    const costForecastChartRef = useRef<SVGSVGElement>(null);

    const activeResources = useMemo(() => resources.filter(r => !r.resigned), [resources]);

    const overallKPIs = useMemo(() => {
        const totalBudget = projects.reduce((sum, p) => sum + Number(p.budget || 0), 0);
        const assignedResourceIds = new Set(assignments.map(a => a.resourceId));
        const unassignedResources = activeResources.filter(r => r.id && !assignedResourceIds.has(r.id));
        const staffedProjectIds = new Set(assignments.map(a => a.projectId));
        const unstaffedProjects = projects.filter(p => p.status === 'In corso' && p.id && !staffedProjectIds.has(p.id));
        return { totalBudget, unassignedResources, unstaffedProjects };
    }, [projects, assignments, activeResources]);

    const currentMonthKPIs = useMemo(() => {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        let totalCost = 0;
        let totalPersonDays = 0;
        const costByClient: { [clientId: string]: { id: string; name: string; cost: number } } = {};
        clients.forEach(c => { if(c.id) costByClient[c.id] = { id: c.id, name: c.name, cost: 0 }; });

        for (const assignment of assignments) {
            const resource = resources.find(r => r.id === assignment.resourceId);
            if (!resource || resource.resigned) continue;
            
            const role = roles.find(r => r.id === resource.roleId);
            const dailyRate = role?.dailyCost || 0;
            const project = projects.find(p => p.id === assignment.projectId);
            const realization = (project?.realizationPercentage ?? 100) / 100;

            const assignmentAllocations = allocations[assignment.id!];
            if (assignmentAllocations) {
                for (const dateStr in assignmentAllocations) {
                    const allocDate = parseISODate(dateStr);
                    if (allocDate >= firstDay && allocDate <= lastDay) {
                        if (!isHoliday(allocDate, resource.location, companyCalendar) && allocDate.getDay() !== 0 && allocDate.getDay() !== 6) {
                            const personDayFraction = (assignmentAllocations[dateStr] / 100);
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
        return { totalCost, totalPersonDays, clientCostArray: Object.values(costByClient).filter(c => c.cost > 0) };
    }, [assignments, resources, roles, projects, allocations, companyCalendar, clients]);

    const averageAllocationData = useMemo(() => {
        const filteredResources = avgAllocFilter.resourceId
            ? activeResources.filter(r => r.id === avgAllocFilter.resourceId)
            : activeResources;

        return filteredResources.map(resource => {
            const calculateAvgForMonth = (monthOffset: number) => {
                const now = new Date();
                const firstDay = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
                const lastDay = new Date(now.getFullYear(), now.getMonth() + monthOffset + 1, 0);
                const workingDays = getWorkingDaysBetween(firstDay, lastDay, companyCalendar, resource.location);
                if (workingDays === 0) return 0;
                
                const resourceAssignments = assignments.filter(a => a.resourceId === resource.id);
                let totalPersonDays = 0;
                resourceAssignments.forEach(assignment => {
                    const assignmentAllocations = allocations[assignment.id!];
                    if(assignmentAllocations){
                        for(const dateStr in assignmentAllocations){
                            const allocDate = parseISODate(dateStr);
                            if(allocDate >= firstDay && allocDate <= lastDay && !isHoliday(allocDate, resource.location, companyCalendar) && allocDate.getDay() !== 0 && allocDate.getDay() !== 6){
                                totalPersonDays += (assignmentAllocations[dateStr] / 100);
                            }
                        }
                    }
                });
                return (totalPersonDays / workingDays) * 100;
            };

            return {
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
                        if (allocDate >= firstDay && allocDate <= lastDay && !isHoliday(allocDate, resource.location, companyCalendar) && allocDate.getDay() !== 0 && allocDate.getDay() !== 6) {
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
                const role = roles.find(ro => ro.id === resource.roleId);
                const dailyRate = role?.dailyCost || 0;
                
                const assignmentAllocations = allocations[assignment.id!];
                if (assignmentAllocations) {
                    for (const dateStr in assignmentAllocations) {
                         if (!isHoliday(parseISODate(dateStr), resource.location, companyCalendar) && parseISODate(dateStr).getDay() !== 0 && parseISODate(dateStr).getDay() !== 6) {
                            estimatedCost += ((assignmentAllocations[dateStr] / 100) * dailyRate);
                        }
                    }
                }
            });
            const budget = Number(project.budget || 0);
            estimatedCost = estimatedCost * (project.realizationPercentage / 100);
            return { ...project, budget, estimatedCost, variance: budget - estimatedCost };
        });
    }, [projects, assignments, allocations, resources, roles, companyCalendar, budgetFilter]);

    const temporalBudgetAnalysisData = useMemo(() => {
        const filteredProjects = temporalBudgetFilter.clientId
            ? projects.filter(p => p.clientId === temporalBudgetFilter.clientId)
            : projects;
    
        const filterStartDate = parseISODate(temporalBudgetFilter.startDate);
        const filterEndDate = parseISODate(temporalBudgetFilter.endDate);
        if (isNaN(filterStartDate.getTime()) || isNaN(filterEndDate.getTime())) {
            return []; // Invalid date range
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
                const role = roles.find(ro => ro.id === resource.roleId);
                const dailyRate = role?.dailyCost || 0;
                
                const assignmentAllocations = allocations[assignment.id!];
                if (assignmentAllocations) {
                    for (const dateStr in assignmentAllocations) {
                        const allocDate = parseISODate(dateStr);
                        if (allocDate >= filterStartDate && allocDate <= filterEndDate) {
                             if (!isHoliday(allocDate, resource.location, companyCalendar) && allocDate.getDay() !== 0 && allocDate.getDay() !== 6) {
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
    }, [projects, assignments, allocations, resources, roles, companyCalendar, temporalBudgetFilter]);
    
    const underutilizedResourcesData = useMemo(() => {
        const [year, monthNum] = underutilizedFilter.split('-').map(Number);
        const firstDay = new Date(year, monthNum - 1, 1);
        const lastDay = new Date(year, monthNum, 0);

        return activeResources.map(resource => {
            const workingDays = getWorkingDaysBetween(firstDay, lastDay, companyCalendar, resource.location);
            if (workingDays === 0) return { resource, avgAllocation: 0 };
            
            const resourceAssignments = assignments.filter(a => a.resourceId === resource.id);
            let totalPersonDays = 0;
            resourceAssignments.forEach(assignment => {
                const assignmentAllocations = allocations[assignment.id!];
                if (assignmentAllocations) {
                    for (const dateStr in assignmentAllocations) {
                        const allocDate = parseISODate(dateStr);
                        if(allocDate >= firstDay && allocDate <= lastDay && !isHoliday(allocDate, resource.location, companyCalendar) && allocDate.getDay() !== 0 && allocDate.getDay() !== 6){
                           totalPersonDays += (assignmentAllocations[dateStr] / 100);
                        }
                    }
                }
            });
            return { resource, avgAllocation: (totalPersonDays / workingDays) * 100 };
        }).filter(d => d.avgAllocation < 100);
    }, [activeResources, assignments, allocations, companyCalendar, underutilizedFilter]);

    const effortByHorizontalData = useMemo(() => {
        const data: {[key: string]: number} = {};
        horizontals.forEach(h => data[h.value] = 0);

        assignments.forEach(assignment => {
            const resource = resources.find(r => r.id === assignment.resourceId);
            if(!resource || !resource.horizontal || !data.hasOwnProperty(resource.horizontal)) return;

            const assignmentAllocations = allocations[assignment.id!];
            if(assignmentAllocations) {
                for(const dateStr in assignmentAllocations) {
                    const allocDate = parseISODate(dateStr);
                     if (!isHoliday(allocDate, resource.location, companyCalendar) && allocDate.getDay() !== 0 && allocDate.getDay() !== 6) {
                        data[resource.horizontal] += (assignmentAllocations[dateStr] / 100);
                    }
                }
            }
        });
        return Object.entries(data).map(([name, totalPersonDays]) => ({ name, totalPersonDays }));
    }, [horizontals, resources, assignments, allocations, companyCalendar]);

    const analysisByLocationData = useMemo(() => {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        return locations.map(location => {
            const resourcesInLocation = activeResources.filter(r => r.location === location.value);
            const resourceCount = resourcesInLocation.length;
            
            let allocatedDays = 0;
            let availableDays = 0;

            resourcesInLocation.forEach(resource => {
                availableDays += getWorkingDaysBetween(firstDay, lastDay, companyCalendar, resource.location);
                const resourceAssignments = assignments.filter(a => a.resourceId === resource.id);
                resourceAssignments.forEach(assignment => {
                    const assignmentAllocations = allocations[assignment.id!];
                    if (assignmentAllocations) {
                        for (const dateStr in assignmentAllocations) {
                            const allocDate = parseISODate(dateStr);
                             if (allocDate >= firstDay && allocDate <= lastDay && !isHoliday(allocDate, resource.location, companyCalendar) && allocDate.getDay() !== 0 && allocDate.getDay() !== 6) {
                                allocatedDays += (assignmentAllocations[dateStr] / 100);
                            }
                        }
                    }
                });
            });

            return {
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
            const date = new Date(today.getFullYear(), today.getMonth() + i, 1);
            const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
            const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);

            const workingDays = getWorkingDaysBetween(firstDay, lastDay, companyCalendar, resource.location);
            let totalPersonDays = 0;
            
            if (workingDays > 0) {
                const resourceAssignments = assignments.filter(a => a.resourceId === resource.id);
                resourceAssignments.forEach(assignment => {
                    const assignmentAllocations = allocations[assignment.id!];
                    if (assignmentAllocations) {
                        for (const dateStr in assignmentAllocations) {
                            const allocDate = parseISODate(dateStr);
                             if (allocDate >= firstDay && allocDate <= lastDay && !isHoliday(allocDate, resource.location, companyCalendar) && allocDate.getDay() !== 0 && allocDate.getDay() !== 6) {
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
            const firstDay = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
            const lastDay = new Date(now.getFullYear(), now.getMonth() + monthOffset + 1, 0);
            let totalCost = 0;
            
            for (const assignment of assignments) {
                const resource = activeResources.find(r => r.id === assignment.resourceId);
                if (!resource) continue;
                const role = roles.find(ro => ro.id === resource.roleId);
                const dailyRate = role?.dailyCost || 0;
                const project = projects.find(p => p.id === assignment.projectId);
                const realization = (project?.realizationPercentage ?? 100) / 100;
                
                const assignmentAllocations = allocations[assignment.id!];
                if (assignmentAllocations) {
                    for (const dateStr in assignmentAllocations) {
                        const allocDate = parseISODate(dateStr);
                        if (allocDate >= firstDay && allocDate <= lastDay && !isHoliday(allocDate, resource.location, companyCalendar) && allocDate.getDay() !== 0 && allocDate.getDay() !== 6) {
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
            const date = new Date(new Date().getFullYear(), new Date().getMonth() + i, 1);
            forecastData.push({
                month: date,
                historic: avgHistoricCost,
                forecast: calculateCostForMonth(i),
            });
        }
        return forecastData;

    }, [activeResources, assignments, allocations, roles, projects, companyCalendar]);

    // Sorting hooks and totals
    const { items: sortedAvgAllocation, requestSort: requestAvgAllocSort, sortConfig: avgAllocSortConfig } = useSortableData(averageAllocationData, { key: 'resource.name', direction: 'ascending' });
    const { items: sortedFte, requestSort: requestFteSort, sortConfig: fteSortConfig } = useSortableData(fteData as any[], { key: 'name', direction: 'ascending' });
    const { items: sortedBudget, requestSort: requestBudgetSort, sortConfig: budgetSortConfig } = useSortableData(budgetAnalysisData, { key: 'name', direction: 'ascending' });
    const { items: sortedTemporalBudget, requestSort: requestTemporalBudgetSort, sortConfig: temporalBudgetSortConfig } = useSortableData(temporalBudgetAnalysisData, { key: 'name', direction: 'ascending' });
    const { items: sortedUnderutilized, requestSort: requestUnderutilizedSort, sortConfig: underutilizedSortConfig } = useSortableData(underutilizedResourcesData, { key: 'avgAllocation', direction: 'ascending' });
    const { items: sortedClientCost, requestSort: requestClientCostSort, sortConfig: clientCostSortConfig } = useSortableData(currentMonthKPIs.clientCostArray, { key: 'cost', direction: 'descending' });
    const { items: sortedEffortByHorizontal, requestSort: requestEffortHorizontalSort, sortConfig: effortHorizontalSortConfig } = useSortableData(effortByHorizontalData, { key: 'totalPersonDays', direction: 'descending' });
    const { items: sortedLocation, requestSort: requestLocationSort, sortConfig: locationSortConfig } = useSortableData(analysisByLocationData, { key: 'resourceCount', direction: 'descending' });
    
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
        return { budget, cost, variance: budget - cost };
    }, [budgetAnalysisData]);

    const temporalBudgetTotals = useMemo(() => {
        const budget = temporalBudgetAnalysisData.reduce((sum, d) => sum + d.periodBudget, 0);
        const cost = temporalBudgetAnalysisData.reduce((sum, d) => sum + d.estimatedCost, 0);
        return { budget, cost, variance: budget - cost };
    }, [temporalBudgetAnalysisData]);

    const effortByHorizontalTotal = useMemo(() => effortByHorizontalData.reduce((sum, d) => sum + d.totalPersonDays, 0), [effortByHorizontalData]);
    
    const resourceOptions = useMemo(() => activeResources.map((r) => ({ value: r.id!, label: r.name })), [activeResources]);
    const clientOptions = useMemo(() => clients.map((c) => ({ value: c.id!, label: c.name })), [clients]);

    // Chart useEffects
    useEffect(() => {
        if (!trendResource || !trendChartRef.current || saturationTrendData.length === 0) {
            if (trendChartRef.current) d3.select(trendChartRef.current).selectAll("*").remove();
            return;
        }

        const svg = d3.select(trendChartRef.current);
        svg.selectAll("*").remove();
        
        const { width: containerWidth, height: containerHeight } = svg.node().getBoundingClientRect();
        const margin = { top: 20, right: 30, bottom: 30, left: 40 };
        const width = containerWidth - margin.left - margin.right;
        const height = containerHeight - margin.top - margin.bottom;

        if (width <= 0 || height <= 0) return;

        const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

        const x = d3.scaleTime().domain(d3.extent(saturationTrendData, (d: any) => d.month)).range([0, width]);
        const y = d3.scaleLinear().domain([0, d3.max(saturationTrendData, (d: any) => Math.max(110, d.value))]).range([height, 0]);

        g.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x).ticks(Math.min(saturationTrendData.length, Math.floor(width / 80))).tickFormat(d3.timeFormat("%b %y")));
        g.append("g").call(d3.axisLeft(y).ticks(5).tickFormat((d: number) => `${d}%`));

        g.append("path").datum(saturationTrendData).attr("fill", "none").attr("stroke", DASHBOARD_COLORS.chart.primary).attr("stroke-width", 2)
          .attr("d", d3.line().x((d: any) => x(d.month)).y((d: any) => y(d.value)));
        
        g.append("line").attr("x1", 0).attr("x2", width).attr("y1", y(100)).attr("y2", y(100)).attr("stroke", DASHBOARD_COLORS.chart.threshold).attr("stroke-width", 1.5).attr("stroke-dasharray", "4");

    }, [saturationTrendData, trendResource]);

    useEffect(() => {
        if (!costForecastChartRef.current || monthlyCostForecastData.length === 0) return;
        
        const svg = d3.select(costForecastChartRef.current);
        svg.selectAll("*").remove();

        const { width: containerWidth, height: containerHeight } = svg.node().getBoundingClientRect();
        const margin = { top: 20, right: 50, bottom: 30, left: 60 };
        const width = containerWidth - margin.left - margin.right;
        const height = containerHeight - margin.top - margin.bottom;

        if (width <= 0 || height <= 0) return;

        const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

        const x = d3.scaleTime().domain(d3.extent(monthlyCostForecastData, (d: any) => d.month)).range([0, width]);
        const yMax = d3.max(monthlyCostForecastData, (d: any) => Math.max(d.historic, d.forecast));
        const y = d3.scaleLinear().domain([0, yMax * 1.1]).range([height, 0]);

        g.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x).ticks(Math.min(monthlyCostForecastData.length, Math.floor(width / 80))).tickFormat(d3.timeFormat("%b %y")));
        g.append("g").call(d3.axisLeft(y).ticks(5).tickFormat(d3.format("~s")));

        g.append("path").datum(monthlyCostForecastData).attr("fill", "none").attr("stroke", DASHBOARD_COLORS.chart.secondary).attr("stroke-width", 2).attr("stroke-dasharray", "4,4")
            .attr("d", d3.line().x((d: any) => x(d.month)).y((d: any) => y(d.historic)));
        
        g.append("path").datum(monthlyCostForecastData).attr("fill", "none").attr("stroke", DASHBOARD_COLORS.chart.primary).attr("stroke-width", 2.5)
            .attr("d", d3.line().x((d: any) => x(d.month)).y((d: any) => y(d.forecast)));

    }, [monthlyCostForecastData]);

    // --- Dynamic Card Rendering Logic ---

    const cardOrder = useMemo(() => {
        try {
            const savedOrderJSON = localStorage.getItem(DASHBOARD_CARD_ORDER_STORAGE_KEY);
            const savedOrder: DashboardCardId[] = savedOrderJSON ? JSON.parse(savedOrderJSON) : DEFAULT_DASHBOARD_CARD_ORDER;
            
            const allKnownIds = new Set(DASHBOARD_CARDS_CONFIG.map(c => c.id));
            const savedIds = new Set(savedOrder);

            const validOrder = savedOrder.filter(id => allKnownIds.has(id));
            
            allKnownIds.forEach(id => {
                if (!savedIds.has(id)) {
                    validOrder.push(id);
                }
            });

            return validOrder;
        } catch (error) {
            console.error("Failed to load or parse dashboard card order from localStorage:", error);
            return DEFAULT_DASHBOARD_CARD_ORDER;
        }
    }, []);

    const renderCardById = (id: DashboardCardId) => {
        switch (id) {
            case 'kpiHeader':
                return <KpiHeaderCards key={id} overallKPIs={overallKPIs} currentMonthKPIs={currentMonthKPIs} />;
            case 'attentionCards':
                return <AttentionCards key={id} overallKPIs={overallKPIs} navigate={navigate} />;
            case 'averageAllocation': 
                return <AverageAllocationCard key={id} data={sortedAvgAllocation} filter={avgAllocFilter} setFilter={setAvgAllocFilter} resourceOptions={resourceOptions} requestSort={requestAvgAllocSort} sortConfig={avgAllocSortConfig} totals={avgAllocationTotals} />;
            case 'ftePerProject':
                return <FtePerProjectCard key={id} data={sortedFte} filter={fteFilter} setFilter={setFteFilter} clientOptions={clientOptions} requestSort={requestFteSort} sortConfig={fteSortConfig} totals={fteTotals} />;
            case 'budgetAnalysis':
                return <BudgetAnalysisCard key={id} data={sortedBudget} filter={budgetFilter} setFilter={setBudgetFilter} clientOptions={clientOptions} requestSort={requestBudgetSort} sortConfig={budgetSortConfig} totals={budgetTotals} />;
            case 'temporalBudgetAnalysis':
                return <TemporalBudgetAnalysisCard key={id} data={sortedTemporalBudget} filter={temporalBudgetFilter} setFilter={setTemporalBudgetFilter} clientOptions={clientOptions} requestSort={requestTemporalBudgetSort} sortConfig={temporalBudgetSortConfig} totals={temporalBudgetTotals} />;
            case 'underutilizedResources':
                return <UnderutilizedResourcesCard key={id} data={sortedUnderutilized} month={underutilizedFilter} setMonth={setUnderutilizedFilter} requestSort={requestUnderutilizedSort} sortConfig={underutilizedSortConfig} />;
            case 'monthlyClientCost':
                return <MonthlyClientCostCard key={id} data={sortedClientCost} requestSort={requestClientCostSort} sortConfig={clientCostSortConfig} navigate={navigate} />;
            case 'effortByHorizontal':
                return <EffortByHorizontalCard key={id} data={sortedEffortByHorizontal} requestSort={requestEffortHorizontalSort} sortConfig={effortHorizontalSortConfig} total={effortByHorizontalTotal} />;
            case 'locationAnalysis':
                return <LocationAnalysisCard key={id} data={sortedLocation} requestSort={requestLocationSort} sortConfig={locationSortConfig} />;
            case 'saturationTrend':
                return <SaturationTrendCard key={id} trendResource={trendResource} setTrendResource={setTrendResource} resourceOptions={resourceOptions} chartRef={trendChartRef} />;
            case 'costForecast':
                return <CostForecastCard key={id} chartRef={costForecastChartRef} />;
            default: return null;
        }
    };
    
    // Group cards by their layout type based on the loaded order
    const kpiGroupCards = cardOrder.filter(id => DASHBOARD_CARDS_CONFIG.find(c => c.id === id)?.group === 'kpi');
    const mainGroupCards = cardOrder.filter(id => DASHBOARD_CARDS_CONFIG.find(c => c.id === id)?.group === 'main');
    const fullWidthGroupCards = cardOrder.filter(id => DASHBOARD_CARDS_CONFIG.find(c => c.id === id)?.group === 'full-width');

    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-8">Dashboard</h1>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 mb-8">
                {kpiGroupCards.map(id => renderCardById(id))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {mainGroupCards.map(id => renderCardById(id))}
            </div>

            {fullWidthGroupCards.map(id => renderCardById(id))}
            
            <style>{`.form-input, .form-select { display: block; width: 100%; border-radius: 0.375rem; border: 1px solid #D1D5DB; background-color: #FFFFFF; padding: 0.5rem 0.75rem; font-size: 0.875rem; line-height: 1.25rem; } .dark .form-input, .dark .form-select { border-color: #4B5563; background-color: #374151; color: #F9FAFB; }`}</style>
        </div>
    );
};

export default DashboardPage;