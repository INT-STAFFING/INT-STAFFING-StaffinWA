
/**
 * @file WorkloadPage.tsx
 * @description Pagina di visualizzazione del carico totale per risorsa (sola lettura).
 */

import React, { useState, useMemo, useCallback } from 'react';
import { useEntitiesContext, useAllocationsContext } from '../context/AppContext';
import { Resource, Assignment, LeaveRequest, LeaveType } from '../types';
import { getCalendarDays, formatDate, addDays, isHoliday, getWorkingDaysBetween, formatDateSynthetic } from '../utils/dateUtils';
import SearchableSelect from '../components/SearchableSelect';
import { Link } from 'react-router-dom';
import Pagination from '../components/Pagination';

type ViewMode = 'day' | 'week' | 'month';

// Utility per generare la chiave di lookup
const getLeaveKey = (resourceId: string, dateStr: string) => `${resourceId}_${dateStr}`;

interface DailyTotalCellProps {
  resource: Resource;
  date: string;
  isNonWorkingDay: boolean;
  resourceAssignments: Assignment[]; // Optimized: Passed from parent
  leaveInfo?: { request: LeaveRequest; type: LeaveType }; // Optimized: Passed from parent
}

const ReadonlyDailyTotalCell: React.FC<DailyTotalCellProps> = React.memo(({ resource, date, isNonWorkingDay, resourceAssignments, leaveInfo }) => {
  const { allocations } = useAllocationsContext();

  const activeLeave = leaveInfo?.request;
  const leaveType = leaveInfo?.type;

  // Override working day status if forced by leave or resource end date
  let effectiveIsNonWorking = isNonWorkingDay;
  if (resource.lastDayOfWork && date > resource.lastDayOfWork) {
    effectiveIsNonWorking = true;
  }

  // Render Leave Cell (Full Day)
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

  // Calculate total only using the pre-filtered assignments
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
    if (startDate > effectiveEndDate) return 0;

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
        let currentDate = new Date(startDate);
        while (currentDate <= effectiveEndDate) {
          const dateStr = formatDate(currentDate, 'iso');
          if (assignmentAllocations[dateStr]) {
            if (
              !isHoliday(currentDate, resource.location, companyCalendar) &&
              currentDate.getDay() !== 0 &&
              currentDate.getDay() !== 6
            ) {
              totalPersonDays += assignmentAllocations[dateStr] / 100;
            }
          }
          currentDate = addDays(currentDate, 1);
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
    const { resources, roles, companyCalendar, assignments, leaveRequests, leaveTypes } = useEntitiesContext();
    
    const [filters, setFilters] = useState({ resourceId: '', roleId: '', horizontal: '' });
    
    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);

    const handlePrev = useCallback(() => {
        setCurrentDate(prev => {
            const newDate = new Date(prev);
            if (viewMode === 'week') newDate.setDate(newDate.getDate() - 7);
            else if (viewMode === 'month') newDate.setMonth(newDate.getMonth() - 1);
            else newDate.setDate(newDate.getDate() - 1);
            return newDate;
        });
    }, [viewMode]);

    const handleNext = useCallback(() => {
        setCurrentDate(prev => {
            const newDate = new Date(prev);
            if (viewMode === 'week') newDate.setDate(newDate.getDate() + 7);
            else if (viewMode === 'month') newDate.setMonth(newDate.getMonth() + 1);
            else newDate.setDate(newDate.getDate() + 1);
            return newDate;
        });
    }, [viewMode]);

    const handleToday = useCallback(() => setCurrentDate(new Date()), []);

    const timeColumns = useMemo(() => {
        const cols = [];
        let d = new Date(currentDate);

        if (viewMode === 'day') {
            return getCalendarDays(d, 14).map((day) => {
                const dayOfWeek = day.getDay();
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
            d.setDate(d.getDate() - (d.getDay() === 0 ? 6 : d.getDay() - 1));
            for (let i = 0; i < 12; i++) {
                const startOfWeek = new Date(d);
                const endOfWeek = addDays(new Date(d), 6);
                cols.push({
                    label: `${formatDate(startOfWeek, 'short')} - ${formatDate(endOfWeek, 'short')}`,
                    subLabel: '',
                    startDate: startOfWeek,
                    endDate: endOfWeek,
                    isNonWorkingDay: false,
                    dateIso: ''
                });
                d.setDate(d.getDate() + 7);
            }
        } else {
            d.setDate(1);
            for (let i = 0; i < 12; i++) {
                const startOfMonth = new Date(d);
                const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0);
                cols.push({
                    label: d.toLocaleString('it-IT', { month: 'long', year: 'numeric' }),
                    subLabel: '',
                    startDate: startOfMonth,
                    endDate: endOfMonth,
                    isNonWorkingDay: false,
                    dateIso: ''
                });
                d.setMonth(d.getMonth() + 1);
            }
        }
        return cols;
    }, [currentDate, viewMode, companyCalendar]);

    const displayData = useMemo(() => {
        let visibleResources = resources.filter((r) => !r.resigned);
        if (filters.resourceId) visibleResources = visibleResources.filter(r => r.id === filters.resourceId);
        if (filters.roleId) visibleResources = visibleResources.filter(r => r.roleId === filters.roleId);
        if (filters.horizontal) visibleResources = visibleResources.filter(r => r.horizontal === filters.horizontal);
        
        return visibleResources.sort((a, b) => a.name.localeCompare(b.name));
    }, [resources, filters]);

    // Paginated Data
    const paginatedData = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return displayData.slice(startIndex, startIndex + itemsPerPage);
    }, [displayData, currentPage, itemsPerPage]);

    // OPTIMIZATION: Pre-calculate Assignments map for the visible resources
    // This prevents filtering assignments inside every single cell (O(N^2) -> O(N))
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

    // OPTIMIZATION: Pre-calculate Leaves Lookup Map
    // Key: resourceId_dateIso
    const leavesLookup = useMemo(() => {
        const map = new Map<string, { request: LeaveRequest; type: LeaveType }>();
        // Only process approved leaves
        const approvedLeaves = leaveRequests.filter(l => l.status === 'APPROVED');
        
        // For 'Day' view, we need precise daily lookup. For Aggregated, less critical but useful.
        // To avoid exploding memory, we only map the visible date range if viewMode is 'day'
        if (viewMode === 'day' && timeColumns.length > 0) {
            const rangeStart = timeColumns[0].startDate;
            const rangeEnd = timeColumns[timeColumns.length - 1].endDate;
            const rangeStartStr = formatDate(rangeStart, 'iso');
            const rangeEndStr = formatDate(rangeEnd, 'iso');

            approvedLeaves.forEach(req => {
                // Check overlap with visible range
                if (req.endDate < rangeStartStr || req.startDate > rangeEndStr) return;

                const type = leaveTypes.find(t => t.id === req.typeId);
                if (!type) return;

                // Iterate days of the leave request
                let d = new Date(req.startDate);
                const end = new Date(req.endDate);
                
                // Optimization: Clamp start/end to visible range
                if (d < rangeStart) d = new Date(rangeStart);
                const effectiveEnd = end > rangeEnd ? rangeEnd : end;

                while (d <= effectiveEnd) {
                    const dateStr = d.toISOString().split('T')[0];
                    const key = getLeaveKey(req.resourceId, dateStr);
                    // Last leave wins if duplicates (shouldn't happen in clean data)
                    map.set(key, { request: req, type });
                    d.setDate(d.getDate() + 1);
                }
            });
        }
        
        return map;
    }, [leaveRequests, leaveTypes, viewMode, timeColumns]);

    const resourceOptions = useMemo(() => resources.filter(r => !r.resigned).map(r => ({ value: r.id!, label: r.name })), [resources]);
    const roleOptions = useMemo(() => roles.map(r => ({ value: r.id!, label: r.name })), [roles]);
    
    const handleFilterChange = (name: string, value: string) => {
        setFilters(p => ({...p, [name]: value}));
        setCurrentPage(1);
    };

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
                </div>

                <div className="p-4 bg-surface rounded-2xl shadow">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                        <div><label className="block text-sm font-medium text-on-surface-variant">Risorsa</label><SearchableSelect name="resourceId" value={filters.resourceId} onChange={handleFilterChange} options={resourceOptions} placeholder="Tutte"/></div>
                        <div><label className="block text-sm font-medium text-on-surface-variant">Ruolo</label><SearchableSelect name="roleId" value={filters.roleId} onChange={handleFilterChange} options={roleOptions} placeholder="Tutti"/></div>
                        <button onClick={() => { setFilters({ resourceId: '', roleId: '', horizontal: '' }); setCurrentPage(1); }} className="px-6 py-2 bg-secondary-container text-on-secondary-container rounded-full w-full md:w-auto">Reset</button>
                    </div>
                </div>
            </div>

            <div className="flex-grow mt-4 bg-surface rounded-2xl shadow overflow-x-auto">
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
                            {paginatedData.map(resource => {
                                // Pass pre-filtered assignments
                                const resourceAssignments = assignmentsMap.get(resource.id!) || [];
                                
                                return (
                                    <tr key={resource.id} className="hover:bg-surface-container-low">
                                        <td className="sticky left-0 bg-surface px-3 py-3 text-left text-sm font-medium z-9">
                                            <Link to={`/staffing?resourceId=${resource.id}`} className="text-primary hover:underline">{resource.name}</Link>
                                        </td>
                                        {timeColumns.map((col, index) => {
                                            if (viewMode === 'day') {
                                                // Fast lookup
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
                                )
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
        </div>
    );
};

export default WorkloadPage;
