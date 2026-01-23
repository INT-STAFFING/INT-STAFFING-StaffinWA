
/**
 * @file WbsAllocationPage.tsx
 * @description Pagina di analisi gerarchica delle allocazioni raggruppate per WBS > Progetto > Risorsa.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useEntitiesContext, useAllocationsContext } from '../context/AppContext';
import { getWorkingDaysBetween, isHoliday, formatDate, formatDateFull } from '../utils/dateUtils';
import { formatCurrency } from '../utils/formatters';
import SearchableSelect from '../components/SearchableSelect';
import ExportButton from '../components/ExportButton';
import { SpinnerIcon } from '../components/icons';

// --- Types & Interfaces ---

type UnitType = 'days' | 'fte' | 'cost';

interface AggregatedResource {
    type: 'resource';
    id: string;
    name: string;
    roleName: string;
    totalValue: number;
    monthlyValues: Record<string, number>; // key: "YYYY-MM"
}

interface AggregatedProject {
    type: 'project';
    id: string;
    name: string;
    pm: string;
    clientName: string;
    status: string;
    totalValue: number;
    monthlyValues: Record<string, number>;
    children: AggregatedResource[];
}

interface AggregatedWbs {
    type: 'wbs';
    id: string; // wbs code or contract id
    code: string;
    contractName: string;
    totalValue: number;
    monthlyValues: Record<string, number>;
    children: AggregatedProject[];
    isExpanded?: boolean;
}

// --- Helper Components ---

const WbsRow: React.FC<{ 
    item: AggregatedWbs; 
    unit: UnitType; 
    months: string[]; 
    level: number;
    toggleExpand: (id: string) => void;
    expandedIds: Set<string>;
}> = ({ item, unit, months, level, toggleExpand, expandedIds }) => {
    const isExpanded = expandedIds.has(item.id);
    
    return (
        <>
            <tr className="hover:bg-surface-container-low transition-colors bg-surface-container/50 border-b border-outline-variant">
                <td className="px-4 py-3 text-sm whitespace-nowrap sticky left-0 z-10 bg-surface-container/50 border-r border-outline-variant">
                    <div className="flex items-center gap-2" style={{ paddingLeft: `${level * 16}px` }}>
                        <button onClick={() => toggleExpand(item.id)} className="p-1 rounded hover:bg-surface-variant text-on-surface-variant">
                            <span className={`material-symbols-outlined text-base transform transition-transform ${isExpanded ? 'rotate-90' : ''}`}>chevron_right</span>
                        </button>
                        <div className="flex flex-col">
                            <span className="font-bold text-primary">{item.code}</span>
                            <span className="text-[10px] text-on-surface-variant truncate max-w-[200px]" title={item.contractName}>{item.contractName}</span>
                        </div>
                    </div>
                </td>
                <td className="px-4 py-3 text-sm text-center text-on-surface-variant">-</td>
                <td className="px-4 py-3 text-sm font-bold text-right text-on-surface">
                    {unit === 'cost' ? formatCurrency(item.totalValue) : item.totalValue.toFixed(unit === 'days' ? 1 : 2)}
                </td>
                {months.map(m => (
                    <td key={m} className="px-4 py-3 text-sm text-right text-on-surface-variant font-mono bg-inherit">
                        {unit === 'cost' ? formatCurrency(item.monthlyValues[m] || 0) : (item.monthlyValues[m] || 0).toFixed(unit === 'days' ? 1 : 2)}
                    </td>
                ))}
            </tr>
            {isExpanded && item.children.map(child => (
                <ProjectRow 
                    key={child.id} 
                    item={child} 
                    unit={unit} 
                    months={months} 
                    level={level + 1} 
                    toggleExpand={toggleExpand}
                    expandedIds={expandedIds}
                />
            ))}
        </>
    );
};

const ProjectRow: React.FC<{ 
    item: AggregatedProject; 
    unit: UnitType; 
    months: string[]; 
    level: number;
    toggleExpand: (id: string) => void;
    expandedIds: Set<string>;
}> = ({ item, unit, months, level, toggleExpand, expandedIds }) => {
    const isExpanded = expandedIds.has(item.id);

    return (
        <>
            <tr className="hover:bg-surface-container-low transition-colors border-b border-outline-variant/50">
                <td className="px-4 py-2 text-sm whitespace-nowrap sticky left-0 z-10 bg-surface border-r border-outline-variant">
                    <div className="flex items-center gap-2" style={{ paddingLeft: `${level * 16}px` }}>
                        <button onClick={() => toggleExpand(item.id)} className="p-1 rounded hover:bg-surface-container text-on-surface-variant">
                            <span className={`material-symbols-outlined text-base transform transition-transform ${isExpanded ? 'rotate-90' : ''}`}>chevron_right</span>
                        </button>
                        <span className="font-semibold text-on-surface flex items-center gap-2">
                             <span className="material-symbols-outlined text-base text-secondary">folder</span>
                             {item.name}
                        </span>
                    </div>
                </td>
                <td className="px-4 py-2 text-xs text-center text-on-surface-variant truncate max-w-[150px]" title={item.clientName}>{item.clientName}</td>
                <td className="px-4 py-2 text-sm font-semibold text-right text-on-surface">
                    {unit === 'cost' ? formatCurrency(item.totalValue) : item.totalValue.toFixed(unit === 'days' ? 1 : 2)}
                </td>
                {months.map(m => (
                    <td key={m} className="px-4 py-2 text-xs text-right text-on-surface-variant font-mono">
                        {unit === 'cost' ? formatCurrency(item.monthlyValues[m] || 0) : (item.monthlyValues[m] || 0).toFixed(unit === 'days' ? 1 : 2)}
                    </td>
                ))}
            </tr>
            {isExpanded && item.children.map(child => (
                <ResourceRow key={child.id} item={child} unit={unit} months={months} level={level + 1} />
            ))}
        </>
    );
};

const ResourceRow: React.FC<{ 
    item: AggregatedResource; 
    unit: UnitType; 
    months: string[]; 
    level: number;
}> = ({ item, unit, months, level }) => {
    return (
        <tr className="hover:bg-surface-container-low transition-colors border-b border-outline-variant/30 bg-surface-container-lowest/50">
            <td className="px-4 py-2 text-sm whitespace-nowrap sticky left-0 z-10 bg-surface-container-lowest/50 border-r border-outline-variant">
                <div className="flex items-center gap-2" style={{ paddingLeft: `${level * 16}px` }}>
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] text-primary font-bold">
                        {item.name.charAt(0)}
                    </div>
                    <div className="flex flex-col">
                        <span className="text-sm text-on-surface">{item.name}</span>
                        <span className="text-[10px] text-on-surface-variant">{item.roleName}</span>
                    </div>
                </div>
            </td>
            <td className="px-4 py-2 text-sm text-center text-on-surface-variant">-</td>
            <td className="px-4 py-2 text-sm text-right text-on-surface">
                {unit === 'cost' ? formatCurrency(item.totalValue) : item.totalValue.toFixed(unit === 'days' ? 1 : 2)}
            </td>
            {months.map(m => (
                <td key={m} className="px-4 py-2 text-xs text-right text-on-surface-variant font-mono opacity-80">
                    {unit === 'cost' ? formatCurrency(item.monthlyValues[m] || 0) : (item.monthlyValues[m] || 0).toFixed(unit === 'days' ? 1 : 2)}
                </td>
            ))}
        </tr>
    );
};

// --- Main Component ---

export const WbsAllocationPage: React.FC = () => {
    const { 
        assignments, projects, contracts, resources, clients, roles, 
        companyCalendar, getRoleCost, loading 
    } = useEntitiesContext();
    const { allocations } = useAllocationsContext();

    // Filters
    const today = new Date();
    const [startDate, setStartDate] = useState(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 3, 0)).toISOString().split('T')[0]);
    const [clientId, setClientId] = useState('');
    const [searchText, setSearchText] = useState('');
    const [unit, setUnit] = useState<UnitType>('days');
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    // --- Aggregation Logic ---
    const { data, months, kpis } = useMemo(() => {
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        // Generate Month Keys for Columns (e.g. "2024-01", "2024-02")
        const monthKeys: string[] = [];
        let curr = new Date(start.getUTCFullYear(), start.getUTCMonth(), 1);
        const endMonth = new Date(end.getUTCFullYear(), end.getUTCMonth(), 1);
        
        while (curr <= endMonth) {
            monthKeys.push(curr.toISOString().slice(0, 7));
            curr.setMonth(curr.getMonth() + 1);
        }

        // Helper Grouping Structures
        const wbsMap = new Map<string, AggregatedWbs>();
        
        // Helper: Get or Create WBS Node
        const getWbsNode = (contractId: string | null, contract?: any): AggregatedWbs => {
            const id = contractId || 'NO_CONTRACT';
            if (!wbsMap.has(id)) {
                wbsMap.set(id, {
                    type: 'wbs',
                    id,
                    code: contract?.wbs || (contractId ? 'WBS Mancante' : 'No Contratto'),
                    contractName: contract?.name || 'Attività Extra-Contrattuali',
                    totalValue: 0,
                    monthlyValues: {},
                    children: []
                });
            }
            return wbsMap.get(id)!;
        };

        let totalEffortDays = 0;
        let totalActiveWbs = 0;
        let effortNoWbs = 0;

        // --- Core Loop ---
        assignments.forEach(assignment => {
            const project = projects.find(p => p.id === assignment.projectId);
            if (!project) return;
            
            // Client Filter
            if (clientId && project.clientId !== clientId) return;

            const resource = resources.find(r => r.id === assignment.resourceId);
            if (!resource || resource.resigned) return;

            // Search Text Filter (Naive)
            const contract = contracts.find(c => c.id === project.contractId);
            const wbsCode = contract?.wbs || '';
            const searchContent = `${wbsCode} ${contract?.name || ''} ${project.name} ${resource.name}`.toLowerCase();
            if (searchText && !searchContent.includes(searchText.toLowerCase())) return;

            const assignmentAllocations = allocations[assignment.id!];
            if (!assignmentAllocations) return;

            // Calc Values
            let resTotalValue = 0;
            const resMonthlyValues: Record<string, number> = {};

            // Iterate Dates
            for (const dateStr in assignmentAllocations) {
                if (dateStr < startDate || dateStr > endDate) continue;
                
                const allocDate = new Date(dateStr);
                // Check working days
                if (isHoliday(allocDate, resource.location, companyCalendar) || allocDate.getUTCDay() === 0 || allocDate.getUTCDay() === 6) continue;

                const percentage = assignmentAllocations[dateStr];
                if (percentage <= 0) continue;

                const dayValue = percentage / 100;
                let value = dayValue; // Default 'days'

                if (unit === 'cost') {
                    value = dayValue * getRoleCost(resource.roleId, allocDate) * (project.realizationPercentage / 100);
                } else if (unit === 'fte') {
                    // Approximate FTE: 1 day = 1/20 FTE (simplified for aggregation speed)
                    // For more precision, we would need working days per specific month.
                    value = dayValue / 20; 
                }

                resTotalValue += value;
                
                const mKey = dateStr.slice(0, 7);
                resMonthlyValues[mKey] = (resMonthlyValues[mKey] || 0) + value;
            }

            if (resTotalValue === 0) return;

            // --- Tree Building ---
            const wbsNode = getWbsNode(project.contractId || null, contract);
            
            let projNode = wbsNode.children.find(p => p.id === project.id);
            if (!projNode) {
                projNode = {
                    type: 'project',
                    id: project.id!,
                    name: project.name,
                    pm: project.projectManager || '-',
                    clientName: clients.find(c => c.id === project.clientId)?.name || '',
                    status: project.status || '',
                    totalValue: 0,
                    monthlyValues: {},
                    children: []
                };
                wbsNode.children.push(projNode);
            }

            const resNode: AggregatedResource = {
                type: 'resource',
                id: resource.id!,
                name: resource.name,
                roleName: roles.find(r => r.id === resource.roleId)?.name || '',
                totalValue: resTotalValue,
                monthlyValues: resMonthlyValues
            };

            // Aggregate up
            projNode.children.push(resNode);
            projNode.totalValue += resTotalValue;
            wbsNode.totalValue += resTotalValue;

            monthKeys.forEach(m => {
                const val = resMonthlyValues[m] || 0;
                projNode!.monthlyValues[m] = (projNode!.monthlyValues[m] || 0) + val;
                wbsNode.monthlyValues[m] = (wbsNode.monthlyValues[m] || 0) + val;
            });

            // KPI Tracking
            if (unit === 'days') {
                totalEffortDays += resTotalValue;
                if (!contract?.wbs) effortNoWbs += resTotalValue;
            }
        });

        // Sorting
        const finalData = Array.from(wbsMap.values()).sort((a, b) => b.totalValue - a.totalValue);
        finalData.forEach(wbs => {
            wbs.children.sort((a, b) => b.totalValue - a.totalValue);
            // Auto-expand if searching or few items
            if (searchText || finalData.length < 5) expandedIds.add(wbs.id);
        });

        totalActiveWbs = finalData.filter(w => w.id !== 'NO_CONTRACT' && w.code !== 'WBS Mancante').length;

        return { 
            data: finalData, 
            months: monthKeys,
            kpis: { totalEffortDays, totalActiveWbs, effortNoWbs }
        };

    }, [assignments, allocations, projects, contracts, resources, clients, roles, startDate, endDate, clientId, searchText, unit, companyCalendar, getRoleCost]);

    const toggleExpand = (id: string) => {
        setExpandedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // --- Export ---
    const exportData = useMemo(() => {
        // Flatten for CSV
        const rows: any[] = [];
        data.forEach(wbs => {
            wbs.children.forEach(proj => {
                proj.children.forEach(res => {
                    const row: any = {
                        'WBS': wbs.code,
                        'Contratto': wbs.contractName,
                        'Progetto': proj.name,
                        'Cliente': proj.clientName,
                        'Risorsa': res.name,
                        'Ruolo': res.roleName,
                        'Totale Periodo': res.totalValue.toFixed(2)
                    };
                    months.forEach(m => {
                        row[m] = (res.monthlyValues[m] || 0).toFixed(2);
                    });
                    rows.push(row);
                });
            });
        });
        return rows;
    }, [data, months]);

    const clientOptions = useMemo(() => clients.map(c => ({ value: c.id!, label: c.name })), [clients]);

    return (
        <div className="flex flex-col h-full space-y-6">
            
            {/* Header & Controls */}
            <div className="flex flex-col space-y-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <h1 className="text-3xl font-bold text-on-surface">Analisi Allocazioni WBS</h1>
                    <ExportButton data={exportData} title={`Report WBS ${startDate} - ${endDate}`} />
                </div>
                
                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-surface-container-low p-4 rounded-2xl shadow border-l-4 border-primary">
                        <p className="text-sm text-on-surface-variant">Totale Sforzo (Periodo)</p>
                        <p className="text-2xl font-bold text-on-surface">{kpis.totalEffortDays.toFixed(1)} <span className="text-sm font-normal text-on-surface-variant">Giorni</span></p>
                    </div>
                    <div className="bg-surface-container-low p-4 rounded-2xl shadow border-l-4 border-tertiary">
                        <p className="text-sm text-on-surface-variant">WBS Attivi</p>
                        <p className="text-2xl font-bold text-on-surface">{kpis.totalActiveWbs}</p>
                    </div>
                    <div className="bg-surface-container-low p-4 rounded-2xl shadow border-l-4 border-error">
                        <p className="text-sm text-on-surface-variant">Sforzo "No WBS"</p>
                        <p className="text-2xl font-bold text-on-surface">{kpis.effortNoWbs.toFixed(1)} <span className="text-sm font-normal text-on-surface-variant">Giorni</span></p>
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-surface rounded-2xl shadow p-4 grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                    <div>
                        <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">Da</label>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="form-input text-sm" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">A</label>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="form-input text-sm" />
                    </div>
                    <div className="md:col-span-1">
                        <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">Cliente</label>
                        <SearchableSelect name="clientId" value={clientId} onChange={(_, v) => setClientId(v)} options={clientOptions} placeholder="Tutti i Clienti" />
                    </div>
                    <div className="md:col-span-1">
                        <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">Cerca</label>
                        <input type="text" value={searchText} onChange={e => setSearchText(e.target.value)} placeholder="WBS, Progetto, Risorsa..." className="form-input text-sm" />
                    </div>
                     <div>
                        <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">Unità</label>
                        <select value={unit} onChange={(e) => setUnit(e.target.value as UnitType)} className="form-select text-sm w-full">
                            <option value="days">Giorni Uomo</option>
                            <option value="fte">FTE (Approx)</option>
                            <option value="cost">Costo (€)</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Tree Table */}
            <div className="flex-grow bg-surface rounded-2xl shadow border border-outline-variant overflow-hidden flex flex-col">
                {loading ? (
                    <div className="flex-grow flex items-center justify-center">
                        <SpinnerIcon className="w-10 h-10 text-primary" />
                    </div>
                ) : data.length === 0 ? (
                    <div className="flex-grow flex items-center justify-center text-on-surface-variant">
                        Nessun dato trovato per i criteri selezionati.
                    </div>
                ) : (
                    <div className="flex-grow overflow-auto">
                        <table className="min-w-full text-left border-collapse">
                            <thead className="bg-surface-container-low sticky top-0 z-20 shadow-sm">
                                <tr>
                                    <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-on-surface-variant border-b border-r border-outline-variant sticky left-0 z-30 bg-surface-container-low w-[350px]">
                                        Gerarchia WBS
                                    </th>
                                    <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-on-surface-variant text-center border-b border-outline-variant w-[150px]">
                                        Cliente
                                    </th>
                                    <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-on-surface-variant text-right border-b border-outline-variant w-[100px]">
                                        Totale
                                    </th>
                                    {months.map(m => (
                                        <th key={m} className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-on-surface-variant text-right border-b border-outline-variant min-w-[80px]">
                                            {m}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-outline-variant">
                                {data.map(wbs => (
                                    <WbsRow 
                                        key={wbs.id} 
                                        item={wbs} 
                                        unit={unit} 
                                        months={months} 
                                        level={0} 
                                        toggleExpand={toggleExpand}
                                        expandedIds={expandedIds}
                                    />
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};
