
/**
 * @file WorkloadPage.tsx
 * @description Pagina di visualizzazione del carico totale per risorsa (sola lettura).
 */

import React, { useState, useMemo, useCallback } from 'react';
import { useEntitiesContext, useAllocationsContext } from '../context/AppContext';
import { Resource, Assignment } from '../types';
import { getCalendarDays, formatDate, addDays, isHoliday, getWorkingDaysBetween, formatDateFull } from '../utils/dateUtils';
import SearchableSelect from '../components/SearchableSelect';
import MultiSelectDropdown from '../components/MultiSelectDropdown';
import { Link } from 'react-router-dom';

type ViewMode = 'day' | 'week' | 'month';

interface DailyTotalCellProps {
  resource: Resource;
  date: string;
  isNonWorkingDay: boolean;
}

const ReadonlyDailyTotalCell: React.FC<DailyTotalCellProps> = ({ resource, date, isNonWorkingDay }) => {
  const { assignments, leaveRequests, leaveTypes } = useEntitiesContext();
  const { allocations } = useAllocationsContext();

  const activeLeave = useMemo(() => {
      return leaveRequests.find(l => 
          l.resourceId === resource.id && 
          l.status === 'APPROVED' && 
          date >= l.startDate && 
          date <= l.endDate
      );
  }, [leaveRequests, resource.id, date]);

  const leaveType = useMemo(() => {
      return activeLeave ? leaveTypes.find(t => t.id === activeLeave.typeId) : undefined;
  }, [activeLeave, leaveTypes]);

  if (resource.lastDayOfWork && date > resource.lastDayOfWork) {
    isNonWorkingDay = true;
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

  if (isNonWorkingDay) {
    return (
      <td className="border-t border-outline-variant px-2 py-3 text-center text-sm font-semibold bg-surface-container text-on-surface-variant">
        -
      </td>
    );
  }

  const total = useMemo(() => {
    const resourceAssignments = assignments.filter((a) => a.resourceId === resource.id);
    return resourceAssignments.reduce((sum, a) => {
      return sum + (allocations[a.id!]?.[date] || 0);
    }, 0);
  }, [assignments, allocations, resource.id, date]);

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
};

const ReadonlyAggregatedTotalCell: React.FC<{ resource: Resource; startDate: Date; endDate: Date }> = React.memo(({ resource, startDate, endDate }) => {
  const { assignments, companyCalendar } = useEntitiesContext();
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

    const resourceAssignments = assignments.filter((a) => a.resourceId === resource.id);
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
  }, [resource, startDate, endDate, assignments, allocations, companyCalendar]);

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
    const { resources, roles, companyCalendar, assignments } = useEntitiesContext();
    
    const [filters, setFilters] = useState({ resourceId: '', roleId: '', horizontal: '' });

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
                    label: formatDateFull(day),
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

    const resourceOptions = useMemo(() => resources.filter(r => !r.resigned).map(r => ({ value: r.id!, label: r.name })), [resources]);
    const roleOptions = useMemo(() => roles.map(r => ({ value: r.id!, label: r.name })), [roles]);
    
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
                        <div><label className="block text-sm font-medium text-on-surface-variant">Risorsa</label><SearchableSelect name="resourceId" value={filters.resourceId} onChange={(n, v) => setFilters(p => ({...p, [n]: v}))} options={resourceOptions} placeholder="Tutte"/></div>
                        <div><label className="block text-sm font-medium text-on-surface-variant">Ruolo</label><SearchableSelect name="roleId" value={filters.roleId} onChange={(n, v) => setFilters(p => ({...p, [n]: v}))} options={roleOptions} placeholder="Tutti"/></div>
                        <button onClick={() => setFilters({ resourceId: '', roleId: '', horizontal: '' })} className="px-6 py-2 bg-secondary-container text-on-secondary-container rounded-full w-full md:w-auto">Reset</button>
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
                            {displayData.map(resource => (
                                <tr key={resource.id} className="hover:bg-surface-container-low">
                                    <td className="sticky left-0 bg-surface px-3 py-3 text-left text-sm font-medium z-9">
                                        <Link to={`/staffing?resourceId=${resource.id}`} className="text-primary hover:underline">{resource.name}</Link>
                                    </td>
                                    {timeColumns.map((col, index) => {
                                        if (viewMode === 'day') {
                                            return <ReadonlyDailyTotalCell key={index} resource={resource} date={col.dateIso} isNonWorkingDay={col.isNonWorkingDay} />;
                                        }
                                        return <ReadonlyAggregatedTotalCell key={index} resource={resource} startDate={col.startDate} endDate={col.endDate} />;
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default WorkloadPage;
