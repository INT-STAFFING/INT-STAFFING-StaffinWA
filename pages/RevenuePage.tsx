
/**
 * @file RevenuePage.tsx
 * @description Pagina di analisi finanziaria avanzata (Revenue Recognition).
 * Visualizza l'andamento mensile di Ricavi vs Costi e il margine lordo, con filtri per Cliente, Progetto e WBS.
 * Supporta viste aggregate e dettagliate per WBS, Cliente e Progetto.
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useEntitiesContext, useAllocationsContext } from '../context/AppContext';
import { isHoliday } from '../utils/dateUtils';
import { formatCurrency } from '../utils/formatters';
import { SpinnerIcon } from '../components/icons';
import { useTheme } from '../context/ThemeContext';
import { select } from 'd3-selection';
import { scaleBand, scaleLinear } from 'd3-scale';
import { axisBottom, axisLeft, axisRight } from 'd3-axis';
import { line } from 'd3-shape';
import { max } from 'd3-array';
import SearchableSelect from '../components/SearchableSelect';
import { DataTable, ColumnDef } from '../components/DataTable'; // Import DataTable
import ExportButton from '../components/ExportButton'; // Import ExportButton

type MonthlyFinancialData = {
    month: string; // YYYY-MM
    revenue: number;
    cost: number;
    margin: number;
    marginPercent: number;
};

type BreakdownData = {
    id: string; // Composite key
    name: string; // Entity Name (WBS Code, Client Name, or Project Name)
    month: string;
    revenue: number;
    cost: number;
    margin: number;
    marginPercent: number;
};

type ViewTab = 'overview' | 'wbs' | 'client' | 'project';

export const RevenuePage: React.FC = () => {
    const { projects, assignments, resources, contracts, rateCards, billingMilestones, getRoleCost, getSellRate, companyCalendar, clients, loading } = useEntitiesContext();
    const { allocations } = useAllocationsContext();
    const { theme } = useTheme();

    const [year, setYear] = useState(new Date().getFullYear());
    const [filters, setFilters] = useState({ clientId: '', projectId: '', wbs: '' });
    const [activeTab, setActiveTab] = useState<ViewTab>('overview');
    
    const svgRef = useRef<SVGSVGElement>(null);

    // --- Options Generation ---
    const clientOptions = useMemo(() => clients.map(c => ({ value: c.id!, label: c.name })).sort((a,b) => a.label.localeCompare(b.label)), [clients]);
    
    const projectOptions = useMemo(() => {
        let filtered = projects;
        if (filters.clientId) {
            filtered = filtered.filter(p => p.clientId === filters.clientId);
        }
        return filtered.map(p => ({ value: p.id!, label: p.name })).sort((a,b) => a.label.localeCompare(b.label));
    }, [projects, filters.clientId]);

    const wbsOptions = useMemo(() => {
        const uniqueWbs = new Set(contracts.map(c => c.wbs).filter(Boolean) as string[]);
        return Array.from(uniqueWbs).map(w => ({ value: w, label: w })).sort((a,b) => a.label.localeCompare(b.label));
    }, [contracts]);

    const handleResetFilters = () => {
        setFilters({ clientId: '', projectId: '', wbs: '' });
    };

    // --- Helper for Filters ---
    const doesProjectMatchFilters = (projectId: string) => {
        const project = projects.find(p => p.id === projectId);
        if (!project) return false;

        // Filter by Project ID
        if (filters.projectId && project.id !== filters.projectId) return false;

        // Filter by Client ID
        if (filters.clientId && project.clientId !== filters.clientId) return false;

        // Filter by WBS
        if (filters.wbs) {
            const contract = contracts.find(c => c.id === project.contractId);
            if (!contract || contract.wbs !== filters.wbs) return false;
        }

        return true;
    };

    // --- Overview Data Logic (Aggregated by Month) ---
    const financialData = useMemo<MonthlyFinancialData[]>(() => {
        // Only calculate if in overview mode to save perf, OR if we want to keep the chart always updated
        const data: Record<string, MonthlyFinancialData> = {};
        
        // Initialize months for the selected year
        for (let m = 0; m < 12; m++) {
            const monthStr = `${year}-${String(m + 1).padStart(2, '0')}`;
            data[monthStr] = { month: monthStr, revenue: 0, cost: 0, margin: 0, marginPercent: 0 };
        }

        // 1. Process Assignments (Cost & T&M Revenue)
        assignments.forEach(assignment => {
            if (!doesProjectMatchFilters(assignment.projectId)) return;

            const project = projects.find(p => p.id === assignment.projectId);
            const resource = resources.find(r => r.id === assignment.resourceId);
            if (!project || !resource) return;

            const contract = contracts.find(c => c.id === project.contractId);
            const rateCardId = contract?.rateCardId;
            const assignmentAllocations = allocations[assignment.id!];

            if (assignmentAllocations) {
                for (const dateStr in assignmentAllocations) {
                    if (!dateStr.startsWith(`${year}-`)) continue;
                    
                    const date = new Date(dateStr);
                    if (isHoliday(date, resource.location, companyCalendar) || date.getDay() === 0 || date.getDay() === 6) continue;

                    const monthKey = dateStr.substring(0, 7);
                    if (!data[monthKey]) continue;

                    const pct = assignmentAllocations[dateStr] / 100;
                    
                    // Cost Calculation
                    const dailyCost = getRoleCost(resource.roleId, date);
                    const cost = pct * dailyCost * (project.realizationPercentage / 100);
                    data[monthKey].cost += cost;

                    // Revenue Calculation (Only for T&M)
                    if (project.billingType === 'TIME_MATERIAL') {
                        const sellRate = getSellRate(rateCardId, resource.id!);
                        const revenue = pct * sellRate;
                        data[monthKey].revenue += revenue;
                    }
                }
            }
        });

        // 2. Process Billing Milestones (Fixed Price Revenue)
        billingMilestones.forEach(bm => {
             if (!bm.date.startsWith(`${year}-`)) return;
             
             if (!doesProjectMatchFilters(bm.projectId)) return;

             const project = projects.find(p => p.id === bm.projectId);
             if (project?.billingType === 'FIXED_PRICE') {
                 const monthKey = bm.date.substring(0, 7);
                 if (data[monthKey]) {
                     data[monthKey].revenue += Number(bm.amount);
                 }
             }
        });

        // 3. Finalize Margin
        return Object.values(data).map(d => ({
            ...d,
            margin: d.revenue - d.cost,
            marginPercent: d.revenue > 0 ? ((d.revenue - d.cost) / d.revenue) * 100 : 0
        })).sort((a,b) => a.month.localeCompare(b.month));

    }, [year, assignments, projects, resources, contracts, allocations, billingMilestones, companyCalendar, getRoleCost, getSellRate, filters]);

    // --- Detailed Breakdown Logic (WBS/Client/Project per Month) ---
    const breakdownData = useMemo<BreakdownData[]>(() => {
        if (activeTab === 'overview') return [];

        const map = new Map<string, { name: string; month: string; revenue: number; cost: number }>();
        const getGroupKey = (project: any, contract: any, client: any): string | null => {
            if (activeTab === 'wbs') return contract?.wbs || 'No WBS';
            if (activeTab === 'client') return client?.name || 'No Client';
            if (activeTab === 'project') return project.name;
            return null;
        };

        const addToMap = (key: string, name: string, month: string, rev: number, cost: number) => {
             const compositeKey = `${key}|${month}`;
             if (!map.has(compositeKey)) {
                 map.set(compositeKey, { name, month, revenue: 0, cost: 0 });
             }
             const entry = map.get(compositeKey)!;
             entry.revenue += rev;
             entry.cost += cost;
        };

        // 1. Assignments
        assignments.forEach(assignment => {
            if (!doesProjectMatchFilters(assignment.projectId)) return;

            const project = projects.find(p => p.id === assignment.projectId);
            const resource = resources.find(r => r.id === assignment.resourceId);
            if (!project || !resource) return;

            const contract = contracts.find(c => c.id === project.contractId);
            const client = clients.find(c => c.id === project.clientId);
            const rateCardId = contract?.rateCardId;
            const assignmentAllocations = allocations[assignment.id!];
            
            const groupName = getGroupKey(project, contract, client);
            if (!groupName) return;

            if (assignmentAllocations) {
                for (const dateStr in assignmentAllocations) {
                    if (!dateStr.startsWith(`${year}-`)) continue;
                    
                    const date = new Date(dateStr);
                    if (isHoliday(date, resource.location, companyCalendar) || date.getDay() === 0 || date.getDay() === 6) continue;
                    const monthKey = dateStr.substring(0, 7);
                    const pct = assignmentAllocations[dateStr] / 100;
                    
                    const dailyCost = getRoleCost(resource.roleId, date);
                    const cost = pct * dailyCost * (project.realizationPercentage / 100);

                    let revenue = 0;
                    if (project.billingType === 'TIME_MATERIAL') {
                        const sellRate = getSellRate(rateCardId, resource.id!);
                        revenue = pct * sellRate;
                    }
                    
                    addToMap(groupName, groupName, monthKey, revenue, cost);
                }
            }
        });

        // 2. Milestones
        billingMilestones.forEach(bm => {
             if (!bm.date.startsWith(`${year}-`)) return;
             if (!doesProjectMatchFilters(bm.projectId)) return;

             const project = projects.find(p => p.id === bm.projectId);
             const contract = contracts.find(c => c.id === project?.contractId);
             const client = clients.find(c => c.id === project?.clientId);
             
             if (project?.billingType === 'FIXED_PRICE') {
                 const groupName = getGroupKey(project, contract, client);
                 const monthKey = bm.date.substring(0, 7);
                 if (groupName) {
                    addToMap(groupName, groupName, monthKey, Number(bm.amount), 0);
                 }
             }
        });

        // 3. Finalize
        return Array.from(map.entries()).map(([id, val]) => ({
            id,
            name: val.name,
            month: val.month,
            revenue: val.revenue,
            cost: val.cost,
            margin: val.revenue - val.cost,
            marginPercent: val.revenue > 0 ? ((val.revenue - val.cost) / val.revenue) * 100 : 0
        })).sort((a, b) => {
            const monthCmp = a.month.localeCompare(b.month);
            if (monthCmp !== 0) return monthCmp;
            return a.name.localeCompare(b.name);
        });

    }, [year, activeTab, assignments, projects, resources, contracts, allocations, billingMilestones, companyCalendar, getRoleCost, getSellRate, filters, clients]);


    // --- D3 Chart Rendering (Only for Overview) ---
    useEffect(() => {
        if (activeTab !== 'overview' || !svgRef.current || financialData.length === 0) return;

        const svg = select(svgRef.current);
        svg.selectAll("*").remove();

        const margin = { top: 20, right: 60, bottom: 30, left: 60 };
        const { width: containerWidth, height: containerHeight } = svg.node()!.getBoundingClientRect();
        
        const width = containerWidth - margin.left - margin.right;
        const height = containerHeight - margin.top - margin.bottom;

        if (width <= 0 || height <= 0) return;

        const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

        const x = scaleBand()
            .domain(financialData.map(d => d.month))
            .range([0, width])
            .padding(0.3);

        const yMax = max(financialData, d => Math.max(d.revenue, d.cost)) || 0;
        const y = scaleLinear()
            .domain([0, yMax * 1.1])
            .range([height, 0]);

        const yRight = scaleLinear()
            .domain([-50, 100]) // Margin %
            .range([height, 0]);

        // Bars
        const barWidth = x.bandwidth() / 2;

        // Revenue Bar
        g.selectAll(".bar-rev")
            .data(financialData)
            .enter().append("rect")
            .attr("class", "bar-rev")
            .attr("x", d => x(d.month)!)
            .attr("y", d => y(d.revenue))
            .attr("width", barWidth)
            .attr("height", d => height - y(d.revenue))
            .attr("fill", theme.light.primary) // Use theme color
            .attr("opacity", 0.8)
            .append("title").text(d => `Revenue: ${formatCurrency(d.revenue)}`);

        // Cost Bar
        g.selectAll(".bar-cost")
            .data(financialData)
            .enter().append("rect")
            .attr("class", "bar-cost")
            .attr("x", d => x(d.month)! + barWidth)
            .attr("y", d => y(d.cost))
            .attr("width", barWidth)
            .attr("height", d => height - y(d.cost))
            .attr("fill", theme.light.error)
            .attr("opacity", 0.6)
            .append("title").text(d => `Cost: ${formatCurrency(d.cost)}`);

        // Margin Line
        const lineGenerator = line<MonthlyFinancialData>()
            .x(d => x(d.month)! + x.bandwidth() / 2)
            .y(d => yRight(d.marginPercent));

        g.append("path")
            .datum(financialData)
            .attr("fill", "none")
            .attr("stroke", theme.light.tertiary)
            .attr("stroke-width", 2)
            .attr("d", lineGenerator);

        // Points on Line
        g.selectAll(".dot")
            .data(financialData)
            .enter().append("circle")
            .attr("cx", d => x(d.month)! + x.bandwidth() / 2)
            .attr("cy", d => yRight(d.marginPercent))
            .attr("r", 4)
            .attr("fill", theme.light.tertiary)
            .append("title").text(d => `Margin: ${d.marginPercent.toFixed(1)}%`);

        // Axes
        g.append("g")
            .attr("transform", `translate(0,${height})`)
            .call(axisBottom(x).tickFormat(d => d.split('-')[1])); // Show only month number

        g.append("g").call(axisLeft(y).ticks(5).tickFormat(d => `${Number(d) / 1000}k`));
        g.append("g").attr("transform", `translate(${width},0)`).call(axisRight(yRight).tickFormat(d => `${d}%`));
        
        // Zero line for margin
        g.append("line")
            .attr("x1", 0)
            .attr("x2", width)
            .attr("y1", yRight(0))
            .attr("y2", yRight(0))
            .attr("stroke", "#999")
            .attr("stroke-dasharray", "4");

    }, [financialData, theme, activeTab]);

    // --- Detail Table Columns ---
    const detailColumns: ColumnDef<BreakdownData>[] = [
        { header: activeTab === 'wbs' ? 'WBS' : activeTab === 'client' ? 'Cliente' : 'Progetto', sortKey: 'name', cell: d => <span className="font-bold">{d.name}</span> },
        { header: 'Mese', sortKey: 'month', cell: d => d.month },
        { header: 'Revenue', sortKey: 'revenue', cell: d => <span className="text-primary font-mono">{formatCurrency(d.revenue)}</span> },
        { header: 'Costi', sortKey: 'cost', cell: d => <span className="text-error font-mono">{formatCurrency(d.cost)}</span> },
        { header: 'Margine', sortKey: 'margin', cell: d => <span className={`font-mono font-bold ${d.margin >= 0 ? 'text-tertiary' : 'text-error'}`}>{formatCurrency(d.margin)}</span> },
        { header: 'Margine %', sortKey: 'marginPercent', cell: d => <span className={`px-2 py-1 rounded text-xs font-bold ${d.marginPercent >= 30 ? 'bg-tertiary-container text-on-tertiary-container' : d.marginPercent > 0 ? 'bg-yellow-container text-on-yellow-container' : 'bg-error-container text-on-error-container'}`}>{d.marginPercent.toFixed(1)}%</span> },
    ];

    const renderRow = (row: BreakdownData) => (
        <tr key={row.id} className="hover:bg-surface-container-low transition-colors">
            {detailColumns.map((col, i) => <td key={i} className="px-6 py-4 whitespace-nowrap text-sm text-on-surface bg-inherit">{col.cell(row)}</td>)}
        </tr>
    );

    const exportDetailData = useMemo(() => {
        return breakdownData.map(d => ({
            'Entità': d.name,
            'Mese': d.month,
            'Revenue': formatCurrency(d.revenue),
            'Costi': formatCurrency(d.cost),
            'Margine': formatCurrency(d.margin),
            'Margine %': d.marginPercent.toFixed(1) + '%'
        }));
    }, [breakdownData]);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-on-surface">Revenue Recognition</h1>
                <div className="flex items-center gap-2">
                    <button onClick={() => setYear(year - 1)} className="p-2 rounded hover:bg-surface-container"><span className="material-symbols-outlined">chevron_left</span></button>
                    <span className="font-bold text-xl">{year}</span>
                    <button onClick={() => setYear(year + 1)} className="p-2 rounded hover:bg-surface-container"><span className="material-symbols-outlined">chevron_right</span></button>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="bg-surface rounded-2xl shadow p-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <SearchableSelect 
                        name="clientId" 
                        value={filters.clientId} 
                        onChange={(_, v) => setFilters(prev => ({ ...prev, clientId: v, projectId: '' }))} // Reset project on client change
                        options={clientOptions} 
                        placeholder="Filtra per Cliente" 
                    />
                    <SearchableSelect 
                        name="projectId" 
                        value={filters.projectId} 
                        onChange={(_, v) => setFilters(prev => ({ ...prev, projectId: v }))} 
                        options={projectOptions} 
                        placeholder="Filtra per Progetto" 
                    />
                    <SearchableSelect 
                        name="wbs" 
                        value={filters.wbs} 
                        onChange={(_, v) => setFilters(prev => ({ ...prev, wbs: v }))} 
                        options={wbsOptions} 
                        placeholder="Filtra per WBS" 
                    />
                    <button 
                        onClick={handleResetFilters} 
                        className="px-4 py-2 bg-secondary-container text-on-secondary-container rounded-full font-medium hover:opacity-90 w-full"
                    >
                        Reset Filtri
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex space-x-1 bg-surface-container p-1 rounded-full w-fit">
                {(['overview', 'wbs', 'client', 'project'] as ViewTab[]).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 text-sm font-medium rounded-full capitalize transition-all ${
                            activeTab === tab 
                                ? 'bg-surface text-primary shadow font-bold' 
                                : 'text-on-surface-variant hover:text-on-surface'
                        }`}
                    >
                        {tab === 'overview' ? 'Panoramica' : `Per ${tab}`}
                    </button>
                ))}
            </div>

            {/* Content Based on Tab */}
            {activeTab === 'overview' ? (
                <>
                    {/* Chart Section */}
                    <div className="bg-surface rounded-2xl shadow p-6 border border-outline-variant">
                        <h3 className="text-lg font-bold mb-4">Analisi Mensile (Revenue vs Cost)</h3>
                        <div className="h-[400px] w-full">
                            {loading ? <div className="flex items-center justify-center h-full"><SpinnerIcon className="w-8 h-8 text-primary"/></div> : <svg ref={svgRef} className="w-full h-full" />}
                        </div>
                        <div className="flex justify-center gap-6 mt-4 text-xs">
                            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-primary opacity-80"></span> Revenue</div>
                            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-error opacity-60"></span> Costi</div>
                            <div className="flex items-center gap-2"><span className="w-3 h-1 bg-tertiary"></span> Margine %</div>
                        </div>
                    </div>

                    {/* Data Table */}
                    <div className="bg-surface rounded-2xl shadow overflow-hidden border border-outline-variant">
                        <table className="min-w-full divide-y divide-outline-variant">
                            <thead className="bg-surface-container-low">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-on-surface-variant uppercase tracking-wider">Mese</th>
                                    <th className="px-6 py-3 text-right text-xs font-bold text-on-surface-variant uppercase tracking-wider">Revenue</th>
                                    <th className="px-6 py-3 text-right text-xs font-bold text-on-surface-variant uppercase tracking-wider">Costi (COGS)</th>
                                    <th className="px-6 py-3 text-right text-xs font-bold text-on-surface-variant uppercase tracking-wider">Margine</th>
                                    <th className="px-6 py-3 text-right text-xs font-bold text-on-surface-variant uppercase tracking-wider">Margine %</th>
                                </tr>
                            </thead>
                            <tbody className="bg-surface divide-y divide-outline-variant">
                                {financialData.map(row => (
                                    <tr key={row.month} className="hover:bg-surface-container-low transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-on-surface">{row.month}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-primary font-mono">{formatCurrency(row.revenue)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-error font-mono">{formatCurrency(row.cost)}</td>
                                        <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-mono font-bold ${row.margin >= 0 ? 'text-tertiary' : 'text-error'}`}>
                                            {formatCurrency(row.margin)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${row.marginPercent >= 30 ? 'bg-tertiary-container text-on-terti-container' : row.marginPercent > 0 ? 'bg-yellow-container text-on-yellow-container' : 'bg-error-container text-on-error-container'}`}>
                                                {row.marginPercent.toFixed(1)}%
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                <tr className="bg-surface-container font-bold">
                                    <td className="px-6 py-4 text-sm">TOTALE ANNO</td>
                                    <td className="px-6 py-4 text-right font-mono">{formatCurrency(financialData.reduce((s, d) => s + d.revenue, 0))}</td>
                                    <td className="px-6 py-4 text-right font-mono">{formatCurrency(financialData.reduce((s, d) => s + d.cost, 0))}</td>
                                    <td className="px-6 py-4 text-right font-mono">{formatCurrency(financialData.reduce((s, d) => s + d.margin, 0))}</td>
                                    <td className="px-6 py-4 text-right">-</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </>
            ) : (
                <div className="animate-fade-in">
                     <DataTable<BreakdownData>
                        title={`Analisi per ${activeTab.toUpperCase()}`}
                        addNewButtonLabel=""
                        data={breakdownData}
                        columns={detailColumns}
                        filtersNode={<></>} // Already filtered globally
                        onAddNew={() => {}}
                        renderRow={renderRow}
                        renderMobileCard={() => <></>} // Simplified for brevity in this specific detailed view
                        initialSortKey="month"
                        isLoading={loading}
                        headerActions={<ExportButton data={exportDetailData} title={`Report Revenue per ${activeTab}`} />}
                        tableLayout={{ dense: true, striped: true, headerSticky: true }}
                    />
                </div>
            )}
        </div>
    );
};

export default RevenuePage;
