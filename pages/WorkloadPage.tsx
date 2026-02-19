/**
 * @file WorkloadPage.tsx
 * @description Pagina di visualizzazione del carico totale per risorsa (sola lettura).
 */

import React, { useState, useMemo, useCallback } from 'react';
import { useEntitiesContext, useAllocationsContext } from '../context/AppContext';
import { Resource, Assignment, LeaveRequest, LeaveType, Role } from '../types';
import { getCalendarDays, formatDate, addDays, isHoliday, getWorkingDaysBetween, formatDateSynthetic } from '../utils/dateUtils';
import SearchableSelect from '../components/SearchableSelect';
import { Link } from 'react-router-dom';
import Pagination from '../components/Pagination';
import ExportButton from '../components/ExportButton';
import PdfExportButton from '../components/PdfExportButton';
import { PdfExportConfig, CHART_PALETTE } from '../utils/pdfExportUtils';

type ViewMode = 'day' | 'week' | 'month';
type WorkloadFilterStatus = 'ALL' | 'UNDER' | 'OVER' | 'ISSUES';

// Utility per generare la chiave di lookup
const getLeaveKey = (resourceId: string, dateStr: string) => `${resourceId}_${dateStr}`;

interface DailyTotalCellProps {
  resource: Resource;
  date: string;
  isNonWorkingDay: boolean;
  resourceAssignments: Assignment[];
  leaveInfo?: { request: LeaveRequest; type: LeaveType };
}

const ReadonlyDailyTotalCell: React.FC<DailyTotalCellProps> = React.memo(({ resource, date, isNonWorkingDay, resourceAssignments, leaveInfo }) => {
  const { allocations } = useAllocationsContext();

  const activeLeave = leaveInfo?.request;
  const leaveType = leaveInfo?.type;

  let effectiveIsNonWorking = isNonWorkingDay;
  if (resource.lastDayOfWork && date > resource.lastDayOfWork) {
    effectiveIsNonWorking = true;
  }

  if (activeLeave && leaveType && !activeLeave.isHalfDay) {
      return (
        <td 
            className="border-t border-outline-variant px-2 py-3 text-center text-sm font-semibold"
            style={{ backgroundColor: `${leaveType.color}40`, color: leaveType.color }}
            title={leaveType.name}
        >
            {leaveType.name.substring(0, 3)}
        </td>
      );
  }

  if (effectiveIsNonWorking) {
    return (
      <td className="border-t border-outline-variant px-2 py-3 text-center text-sm font-semibold bg-surface-container text-on-surface-variant">
        -
      </td>
    );
  }

  const total = resourceAssignments.reduce((sum, a) => {
      return sum + (allocations[a.id!]?.[date] || 0);
  }, 0);

  let capacityUsed = total;
  if (activeLeave && activeLeave.isHalfDay && leaveType?.affectsCapacity) {
      capacityUsed += 50;
  }

  const maxPercentage = resource.maxStaffingPercentage ?? 100;
  let cellColor = 'bg-transparent';

  if (capacityUsed > maxPercentage) cellColor = 'bg-error-container text-on-error-container';
  else if (capacityUsed === maxPercentage) cellColor = 'bg-tertiary-container text-on-tertiary-container';
  else if (total > 0) cellColor = 'bg-yellow-container text-on-yellow-container';
  else if (activeLeave && activeLeave.isHalfDay) cellColor = 'bg-surface-container-high'; 

  return (
    <td className={`border-t border-outline-variant px-2 py-3 text-center text-sm font-semibold ${cellColor}`}>
      {activeLeave && activeLeave.isHalfDay && <span className="text-xs opacity-50 mr-1">1/2</span>}
      {total > 0 ? `${total}%` : (activeLeave && activeLeave.isHalfDay ? '' : '-')}
    </td>
  );
});

const ReadonlyAggregatedTotalCell: React.FC<{ resource: Resource; startDate: Date; endDate: Date; resourceAssignments: Assignment[] }> = React.memo(({ resource, startDate, endDate, resourceAssignments }) => {
  const { companyCalendar } = useEntitiesContext();
  const { allocations } = useAllocationsContext();

  const averageAllocation = useMemo(() => {
    const effectiveEndDate =
      resource.lastDayOfWork && new Date(resource.lastDayOfWork) < endDate
        ? new Date(resource.lastDayOfWork)
        : endDate;
    if (startDate.getTime() > effectiveEndDate.getTime()) return 0;

    const workingDays = getWorkingDaysBetween(
      startDate,
      effectiveEndDate,
      companyCalendar,
      resource.location
    );
    if (workingDays === 0) return 0;

    let totalPersonDays = 0;

    resourceAssignments.forEach((assignment) => {
      const assignmentAllocations = allocations[assignment.id!];
      if (assignmentAllocations) {
        let currentDate = new Date(startDate.getTime());
        while (currentDate.getTime() <= effectiveEndDate.getTime()) {
          const dateStr = formatDate(currentDate, 'iso');
          if (assignmentAllocations[dateStr]) {
            const day = currentDate.getUTCDay();
            if (
              !isHoliday(currentDate, resource.location, companyCalendar) &&
              day !== 0 &&
              day !== 6
            ) {
              totalPersonDays += assignmentAllocations[dateStr] / 100;
            }
          }
          currentDate.setUTCDate(currentDate.getUTCDate() + 1);
        }
      }
    });

    return (totalPersonDays / workingDays) * 100;
  }, [resource, startDate, endDate, resourceAssignments, allocations, companyCalendar]);

  const cellColor = useMemo(() => {
    const maxPercentage = resource.maxStaffingPercentage ?? 100;
    const roundedAverage = Math.round(averageAllocation);
    if (roundedAverage > maxPercentage)
      return 'bg-error-container text-on-error-container';
    if (roundedAverage === maxPercentage)
      return 'bg-tertiary-container text-on-tertiary-container';
    if (roundedAverage > 0 && roundedAverage < maxPercentage)
      return 'bg-yellow-container text-on-yellow-container';
    return 'bg-surface-container-low';
  }, [averageAllocation, resource.maxStaffingPercentage]);

  return (
    <td className={`border-t border-outline-variant px-2 py-3 text-center text-sm font-semibold ${cellColor}`}>
      {averageAllocation > 0 ? `${averageAllocation.toFixed(0)}%` : '-'}
    </td>
  );
});

const WorkloadPage: React.FC = () => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewMode, setViewMode] = useState<ViewMode>('week');
    // Destructured loading from useEntitiesContext to fix line 510 error
    const { resources, roles, companyCalendar, assignments, leaveRequests, leaveTypes, loading } = useEntitiesContext();
    const { allocations } = useAllocationsContext();
    
    const [filters, setFilters] = useState({ resourceId: '', roleId: '', function: '' });
    const [statusFilter, setStatusFilter] = useState<WorkloadFilterStatus>('ALL');
    
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);

    const rolesById = useMemo(() => new Map<string, Role>(roles.map((r) => [r.id!, r])), [roles]);

    const handlePrev = useCallback(() => {
        setCurrentDate(prev => {
            const newDate = new Date(prev);
            if (viewMode === 'week') newDate.setUTCDate(newDate.getUTCDate() - 7);
            else if (viewMode === 'month') newDate.setUTCMonth(newDate.getUTCMonth() - 1);
            else newDate.setUTCDate(newDate.getUTCDate() - 1);
            return newDate;
        });
    }, [viewMode]);

    const handleNext = useCallback(() => {
        setCurrentDate(prev => {
            const newDate = new Date(prev);
            if (viewMode === 'week') newDate.setUTCDate(newDate.getUTCDate() + 7);
            else if (viewMode === 'month') newDate.setUTCMonth(newDate.getUTCMonth() + 1);
            else newDate.setUTCDate(newDate.getUTCDate() + 1);
            return newDate;
        });
    }, [viewMode]);

    const handleToday = useCallback(() => setCurrentDate(new Date()), []);

    const timeColumns = useMemo(() => {
        const cols = [];
        let d = new Date(currentDate);

        if (viewMode === 'day') {
            return getCalendarDays(d, 14).map((day) => {
                const dayOfWeek = day.getUTCDay();
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                const dateIso = formatDate(day, 'iso');
                const holiday = companyCalendar.find((e) => e.date === dateIso && e.type !== 'LOCAL_HOLIDAY');
                return {
                    label: formatDateSynthetic(day),
                    subLabel: formatDate(day, 'day'),
                    startDate: day,
                    endDate: day,
                    isNonWorkingDay: isWeekend || !!holiday,
                    dateIso,
                };
            });
        }

        if (viewMode === 'week') {
            const day = d.getUTCDay();
            const diff = day === 0 ? 6 : day - 1;
            d.setUTCDate(d.getUTCDate() - diff);
            
            for (let i = 0; i < 12; i++) {
                const startOfWeek = new Date(d);
                const endOfWeek = addDays(new Date(d), 6);
                cols.push({
                    label: `${formatDateSynthetic(startOfWeek)} - ${formatDateSynthetic(endOfWeek)}`,
                    subLabel: '',
                    startDate: startOfWeek,
                    endDate: endOfWeek,
                    isNonWorkingDay: false,
                    dateIso: ''
                });
                d.setUTCDate(d.getUTCDate() + 7);
            }
        } else {
            d.setUTCDate(1);
            for (let i = 0; i < 12; i++) {
                const startOfMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
                const endOfMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
                cols.push({
                    label: d.toLocaleString('it-IT', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
                    subLabel: '',
                    startDate: startOfMonth,
                    endDate: endOfMonth,
                    isNonWorkingDay: false,
                    dateIso: ''
                });
                d.setUTCMonth(d.getUTCMonth() + 1);
            }
        }
        return cols;
    }, [currentDate, viewMode, companyCalendar]);

    const calculateAvgLoadForPeriod = useCallback((resource: Resource, startDate: Date, endDate: Date) => {
        const effectiveEndDate = resource.lastDayOfWork && new Date(resource.lastDayOfWork) < endDate 
            ? new Date(resource.lastDayOfWork) 
            : endDate;
        
        if (startDate > effectiveEndDate) return { avg: 0, allocated: 0, available: 0 };

        const workingDays = getWorkingDaysBetween(startDate, effectiveEndDate, companyCalendar, resource.location);
        if (workingDays === 0) return { avg: 0, allocated: 0, available: 0 };

        const resourceAssignments = assignments.filter(a => a.resourceId === resource.id);
        let totalPersonDays = 0;

        resourceAssignments.forEach(assignment => {
            const assignmentAllocations = allocations[assignment.id!];
            if (assignmentAllocations) {
                for (const dateStr in assignmentAllocations) {
                    const allocDate = new Date(dateStr);
                    if (allocDate >= startDate && allocDate <= effectiveEndDate) {
                        const day = allocDate.getUTCDay();
                        if (!isHoliday(allocDate, resource.location, companyCalendar) && day !== 0 && day !== 6) {
                            totalPersonDays += (assignmentAllocations[dateStr] / 100);
                        }
                    }
                }
            }
        });

        const availableDays = workingDays * (resource.maxStaffingPercentage / 100);
        return { 
            avg: (totalPersonDays / workingDays) * 100,
            allocated: totalPersonDays,
            available: availableDays
        };
    }, [assignments, allocations, companyCalendar]);

    const displayData = useMemo(() => {
        let visibleResources = resources.filter((r) => r.resigned !== true);
        
        if (filters.resourceId) visibleResources = visibleResources.filter(r => r.id === filters.resourceId);
        if (filters.roleId) visibleResources = visibleResources.filter(r => r.roleId === filters.roleId);
        if (filters.function) visibleResources = visibleResources.filter(r => r.function === filters.function);
        
        if (statusFilter !== 'ALL') {
            const firstCol = timeColumns[0];
            const lastCol = timeColumns[timeColumns.length - 1];
            
            visibleResources = visibleResources.filter(r => {
                const { avg } = calculateAvgLoadForPeriod(r, firstCol.startDate, lastCol.endDate);
                const roundedAvg = Math.round(avg);
                const max = r.maxStaffingPercentage;
                
                if (statusFilter === 'UNDER') return roundedAvg < max;
                if (statusFilter === 'OVER') return roundedAvg > max;
                if (statusFilter === 'ISSUES') return roundedAvg !== max;
                return true;
            });
        }

        return visibleResources.sort((a, b) => a.name.localeCompare(b.name));
    }, [resources, filters, statusFilter, timeColumns, calculateAvgLoadForPeriod]);

    const paginatedData = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return displayData.slice(startIndex, startIndex + itemsPerPage);
    }, [displayData, currentPage, itemsPerPage]);
    
    const exportData = useMemo(() => {
        const firstCol = timeColumns[0];
        const lastCol = timeColumns[timeColumns.length - 1];
        return paginatedData.map(r => ({
            Risorsa: r.name,
            Ruolo: rolesById.get(r.roleId)?.name || 'N/A',
            Sede: r.location,
            Function: r.function,
            'Carico Medio (%)': calculateAvgLoadForPeriod(r, firstCol.startDate, lastCol.endDate).avg.toFixed(0),
            'Max Staffing %': r.maxStaffingPercentage
        }));
    }, [paginatedData, rolesById, timeColumns, calculateAvgLoadForPeriod]);

    const assignmentsMap = useMemo(() => {
        const map = new Map<string, Assignment[]>();
        const visibleIds = new Set(paginatedData.map(r => r.id));
        
        assignments.forEach(a => {
            if (visibleIds.has(a.resourceId)) {
                if (!map.has(a.resourceId)) {
                    map.set(a.resourceId, []);
                }
                map.get(a.resourceId)!.push(a);
            }
        });
        return map;
    }, [paginatedData, assignments]);

    const leavesLookup = useMemo(() => {
        const map = new Map<string, { request: LeaveRequest; type: LeaveType }>();
        const approvedLeaves = leaveRequests.filter(l => l.status === 'APPROVED');
        
        if (viewMode === 'day' && timeColumns.length > 0) {
            const rangeStart = timeColumns[0].startDate;
            const rangeEnd = timeColumns[timeColumns.length - 1].endDate;
            const rangeStartStr = formatDate(rangeStart, 'iso');
            const rangeEndStr = formatDate(rangeEnd, 'iso');

            approvedLeaves.forEach(req => {
                if (req.endDate < rangeStartStr || req.startDate > rangeEndStr) return;
                const type = leaveTypes.find(t => t.id === req.typeId);
                if (!type) return;

                let d = new Date(req.startDate);
                const end = new Date(req.endDate);
                
                if (d.getTime() < rangeStart.getTime()) d = new Date(rangeStart.getTime());
                const effectiveEnd = end.getTime() > rangeEnd.getTime() ? rangeEnd : end;

                while (d.getTime() <= effectiveEnd.getTime()) {
                    const dateStr = d.toISOString().split('T')[0];
                    const key = getLeaveKey(req.resourceId, dateStr);
                    map.set(key, { request: req, type });
                    d.setUTCDate(d.getUTCDate() + 1);
                }
            });
        }
        return map;
    }, [leaveRequests, leaveTypes, viewMode, timeColumns]);

    const resourceOptions = useMemo(() => resources.filter(r => r.resigned !== true).map(r => ({ value: r.id!, label: r.name })), [resources]);
    const roleOptions = useMemo(() => roles.map(r => ({ value: r.id!, label: r.name })), [roles]);
    
    const handleFilterChange = (name: string, value: string) => {
        setFilters(p => ({...p, [name]: value}));
        setCurrentPage(1);
    };

    const handleStatusFilter = (status: WorkloadFilterStatus) => {
        setStatusFilter(status);
        setCurrentPage(1);
    };

    const renderMobileCard = (resource: Resource) => {
        const firstCol = timeColumns[0];
        const lastCol = timeColumns[timeColumns.length - 1];
        const { avg, allocated, available } = calculateAvgLoadForPeriod(resource, firstCol.startDate, lastCol.endDate);
        const max = resource.maxStaffingPercentage;

        let colorClass = 'border-primary';
        let barColor = 'bg-primary';
        if (Math.round(avg) > max) { colorClass = 'border-error'; barColor = 'bg-error'; }
        else if (Math.round(avg) === max) { colorClass = 'border-tertiary'; barColor = 'bg-tertiary'; }
        else if (avg > 0) { colorClass = 'border-yellow-500'; barColor = 'bg-yellow-500'; }

        return (
            <div key={resource.id} className={`bg-surface-container-low p-4 rounded-2xl shadow border-l-4 ${colorClass} flex flex-col gap-3 mb-4`}>
                <div className="flex justify-between items-start">
                    <div className="flex flex-col min-w-0">
                        <h3 className="font-bold text-lg text-on-surface truncate">{resource.name}</h3>
                        <p className="text-xs text-on-surface-variant font-medium uppercase tracking-wider">{rolesById.get(resource.roleId)?.name || 'N/A'}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                        <span className="text-lg font-black text-on-surface">{avg.toFixed(0)}%</span>
                        <p className="text-[10px] text-on-surface-variant font-bold uppercase">Utilizzo Medio</p>
                    </div>
                </div>

                <div className="w-full bg-surface-container-highest rounded-full h-2.5 overflow-hidden">
                    <div
                        className={`h-full ${barColor} transition-all duration-500`}
                        style={{ width: `${Math.min(avg, 100)}%` }}
                    />
                </div>

                <div className="grid grid-cols-2 gap-4 mt-1 pt-3 border-t border-outline-variant/30 text-sm">
                    <div>
                        <p className="text-[10px] uppercase font-bold text-on-surface-variant opacity-70">G/U Allocati</p>
                        <p className="font-semibold text-on-surface">{allocated.toFixed(1)}</p>
                    </div>
                    <div>
                        <p className="text-[10px] uppercase font-bold text-on-surface-variant opacity-70">G/U Disponibili</p>
                        <p className="font-semibold text-on-surface">{available.toFixed(1)} <span className="text-[10px] opacity-50">({max}%)</span></p>
                    </div>
                </div>
            </div>
        );
    };

    const buildPdfConfig = useCallback((): PdfExportConfig => {
      const topResources = [...paginatedData]
        .map(r => {
          const firstCol = timeColumns[0];
          const lastCol = timeColumns[timeColumns.length - 1];
          const avg = firstCol && lastCol ? calculateAvgLoadForPeriod(r, firstCol.startDate, lastCol.endDate).avg : 0;
          return { name: r.name, avg };
        })
        .sort((a, b) => b.avg - a.avg)
        .slice(0, 10);

      const overCount = paginatedData.filter(r => {
        const firstCol = timeColumns[0];
        const lastCol = timeColumns[timeColumns.length - 1];
        if (!firstCol || !lastCol) return false;
        const avg = calculateAvgLoadForPeriod(r, firstCol.startDate, lastCol.endDate).avg;
        return avg > (r.maxStaffingPercentage ?? 100);
      }).length;
      const atCount = paginatedData.filter(r => {
        const firstCol = timeColumns[0];
        const lastCol = timeColumns[timeColumns.length - 1];
        if (!firstCol || !lastCol) return false;
        const avg = calculateAvgLoadForPeriod(r, firstCol.startDate, lastCol.endDate).avg;
        const max = r.maxStaffingPercentage ?? 100;
        return avg >= max * 0.8 && avg <= max;
      }).length;
      const underCount = paginatedData.length - overCount - atCount;

      return {
        title: 'Carico Risorse',
        subtitle: `Periodo visualizzato - ${paginatedData.length} risorse`,
        charts: [
          {
            title: 'Top 10 Risorse per Carico Medio (%)',
            chartJs: {
              type: 'bar',
              data: {
                labels: topResources.map(r => r.name),
                datasets: [{
                  label: 'Carico Medio %',
                  data: topResources.map(r => Math.round(r.avg)),
                  backgroundColor: CHART_PALETTE[0],
                }],
              },
              options: { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { max: 120 } } },
            },
          },
          {
            title: 'Distribuzione Carico',
            chartJs: {
              type: 'doughnut',
              data: {
                labels: ['Sotto capacità', 'In target', 'Sovraccarico'],
                datasets: [{
                  data: [underCount, atCount, overCount],
                  backgroundColor: [CHART_PALETTE[2], CHART_PALETTE[0], CHART_PALETTE[3]],
                }],
              },
              options: { plugins: { legend: { position: 'bottom' } } },
            },
          },
        ],
        tables: [
          {
            title: 'Dettaglio Carico Risorse',
            head: [['Risorsa', 'Ruolo', 'Sede', 'Function', 'Carico Medio %', 'Max Staffing %']],
            body: exportData.map(row => [
              String(row['Risorsa'] ?? ''),
              String(row['Ruolo'] ?? ''),
              String(row['Sede'] ?? ''),
              String(row['Function'] ?? ''),
              String(row['Carico Medio (%)'] ?? ''),
              String(row['Max Staffing %'] ?? ''),
            ]),
          },
        ],
      };
    }, [paginatedData, timeColumns, calculateAvgLoadForPeriod, exportData]);

    return (
        <div className="flex flex-col h-full">
            <div className="flex-shrink-0 space-y-4">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center space-x-2">
                        <button onClick={handlePrev} className="px-4 py-2 bg-surface border border-outline text-on-surface rounded-full text-sm">← Prec.</button>
                        <button onClick={handleToday} className="px-4 py-2 bg-secondary-container text-on-secondary-container rounded-full font-semibold">Oggi</button>
                        <button onClick={handleNext} className="px-4 py-2 bg-surface border border-outline text-on-surface rounded-full text-sm">Succ. →</button>
                    </div>
                    <div className="flex items-center bg-surface-container p-1 rounded-full">
                        {(['day', 'week', 'month'] as ViewMode[]).map((level) => (
                            <button key={level} onClick={() => setViewMode(level)} className={`px-3 py-1 text-sm font-medium rounded-full capitalize ${viewMode === level ? 'bg-surface text-primary shadow' : 'text-on-surface-variant'}`}>{level === 'day' ? 'Giorno' : level === 'week' ? 'Settimana' : 'Mese'}</button>
                        ))}
                    </div>
                    <ExportButton data={exportData} title="Carico Risorse" />
                    <PdfExportButton buildConfig={buildPdfConfig} />
                </div>

                <div className="p-4 bg-surface rounded-2xl shadow flex flex-col gap-4">
                    <div className="flex flex-wrap gap-2 pb-2 border-b border-outline-variant">
                        <span className="text-sm font-medium text-on-surface-variant self-center mr-2">Filtri Rapidi:</span>
                        <button onClick={() => handleStatusFilter('ALL')} className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${statusFilter === 'ALL' ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'}`}>Tutte</button>
                        <button onClick={() => handleStatusFilter('UNDER')} className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${statusFilter === 'UNDER' ? 'bg-yellow-container text-on-yellow-container border border-yellow-500' : 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'}`}>Sottostaffate</button>
                        <button onClick={() => handleStatusFilter('OVER')} className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${statusFilter === 'OVER' ? 'bg-error-container text-on-error-container border border-error' : 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'}`}>Sovrastaffate</button>
                        <button onClick={() => handleStatusFilter('ISSUES')} className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${statusFilter === 'ISSUES' ? 'bg-tertiary-container text-on-tertiary-container border border-tertiary' : 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'}`}>Anomalie</button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                        <div><label className="block text-sm font-medium text-on-surface-variant">Risorsa</label><SearchableSelect name="resourceId" value={filters.resourceId} onChange={handleFilterChange} options={resourceOptions} placeholder="Tutte"/></div>
                        <div><label className="block text-sm font-medium text-on-surface-variant">Ruolo</label><SearchableSelect name="roleId" value={filters.roleId} onChange={handleFilterChange} options={roleOptions} placeholder="Tutti"/></div>
                        <button onClick={() => { setFilters({ resourceId: '', roleId: '', function: '' }); setStatusFilter('ALL'); setCurrentPage(1); }} className="px-6 py-2 bg-secondary-container text-on-secondary-container rounded-full w-full md:w-auto">Reset</button>
                    </div>
                </div>
            </div>

            {/* Desktop view */}
            <div className="hidden md:block flex-grow mt-4 bg-surface rounded-2xl shadow overflow-x-auto">
                <div className="max-h-[660px] overflow-y-auto">
                    <table className="min-w-full divide-y divide-outline-variant">
                        <thead className="bg-surface-container-low sticky top-0 z-10">
                            <tr>
                                <th className="sticky left-0 bg-surface-container-low px-3 py-3.5 text-left text-sm font-semibold text-on-surface z-20" style={{ minWidth: '200px' }}>Risorsa</th>
                                {timeColumns.map((col, index) => (
                                    <th key={index} className={`px-2 py-3.5 text-center text-sm font-semibold w-24 ${col.isNonWorkingDay ? 'bg-surface-container' : ''}`}>
                                        <div className="flex flex-col items-center">
                                            <span className={col.isNonWorkingDay ? 'text-on-surface-variant' : 'text-on-surface'}>{col.label}</span>
                                            {col.subLabel && <span className="text-xs text-on-surface-variant">{col.subLabel}</span>}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-outline-variant">
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={`skeleton-${i}`} className="animate-pulse">
                                        <td className="sticky left-0 bg-surface px-3 py-3"><div className="h-4 w-24 rounded bg-surface-variant" /></td>
                                        {timeColumns.map((_, j) => (
                                            <td key={j} className="px-2 py-3"><div className="h-4 w-8 rounded bg-surface-variant mx-auto" /></td>
                                        ))}
                                    </tr>
                                ))
                            ) : paginatedData.map(resource => {
                                const resourceAssignments = assignmentsMap.get(resource.id!) || [];
                                return (
                                    <tr key={resource.id} className="hover:bg-surface-container-low">
                                        <td className="sticky left-0 bg-surface px-3 py-3 text-left text-sm font-medium z-9">
                                            <Link to={`/staffing?resourceId=${resource.id}`} className="text-primary hover:underline">{resource.name}</Link>
                                        </td>
                                        {timeColumns.map((col, index) => {
                                            if (viewMode === 'day') {
                                                const leaveInfo = leavesLookup.get(getLeaveKey(resource.id!, col.dateIso));
                                                return (
                                                    <ReadonlyDailyTotalCell
                                                        key={index}
                                                        resource={resource}
                                                        date={col.dateIso}
                                                        isNonWorkingDay={col.isNonWorkingDay}
                                                        resourceAssignments={resourceAssignments}
                                                        leaveInfo={leaveInfo}
                                                    />
                                                );
                                            }
                                            return (
                                                <ReadonlyAggregatedTotalCell
                                                    key={index}
                                                    resource={resource}
                                                    startDate={col.startDate}
                                                    endDate={col.endDate}
                                                    resourceAssignments={resourceAssignments}
                                                />
                                            );
                                        })}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <Pagination
                    currentPage={currentPage}
                    totalItems={displayData.length}
                    itemsPerPage={itemsPerPage}
                    onPageChange={setCurrentPage}
                    onItemsPerPageChange={setItemsPerPage}
                />
            </div>

            {/* Mobile view */}
            <div className="md:hidden flex-grow mt-4">
                <h1 className="text-2xl font-bold text-on-surface mb-4">Analisi Carico di Lavoro</h1>
                {loading ? (
                    <div className="space-y-4">
                        {Array.from({ length: 3 }).map((_, idx) => (
                            <div key={`mobile-skeleton-${idx}`} className="p-4 rounded-2xl bg-surface-variant animate-pulse space-y-2">
                                <div className="h-4 rounded bg-surface" />
                                <div className="h-4 rounded bg-surface" />
                                <div className="h-4 rounded bg-surface w-1/2" />
                            </div>
                        ))}
                    </div>
                ) : paginatedData.length > 0 ? (
                    paginatedData.map(resource => renderMobileCard(resource))
                ) : (
                    <p className="text-center py-8 text-on-surface-variant">Nessun dato trovato.</p>
                )}
                <Pagination
                    currentPage={currentPage}
                    totalItems={displayData.length}
                    itemsPerPage={itemsPerPage}
                    onPageChange={setCurrentPage}
                    onItemsPerPageChange={setItemsPerPage}
                />
            </div>
        </div>
    );
};

export default WorkloadPage;
