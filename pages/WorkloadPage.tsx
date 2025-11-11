/**
 * @file WorkloadPage.tsx
 * @description Pagina di visualizzazione del carico totale per risorsa (sola lettura).
 */

// Fix: Add module declaration for react-window to resolve type errors.
declare module 'react-window' {
    import * as React from 'react';

    export type ListOnScrollProps = {
        scrollDirection: 'forward' | 'backward';
        scrollOffset: number;
        scrollUpdateWasRequested: boolean;
    };

    export class FixedSizeList extends React.Component<any> {
        scrollTo(scrollOffset: number): void;
        scrollToItem(index: number, align?: 'auto' | 'start' | 'center' | 'end'): void;
    }
}

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { FixedSizeList, ListOnScrollProps } from 'react-window';
import { useEntitiesContext, useAllocationsContext } from '../context/AppContext';
import { Resource } from '../types';
import { getCalendarDays, formatDate, addDays, isHoliday, getWorkingDaysBetween } from '../utils/dateUtils';
import SearchableSelect from '../components/SearchableSelect';
import MultiSelectDropdown from '../components/MultiSelectDropdown';
import { useSearchParams } from 'react-router-dom';

type ViewMode = 'day' | 'week' | 'month';
const ROW_HEIGHT = 68;

// --- Cell Components (render divs) ---

const ReadonlyDailyTotalCell: React.FC<{ resource: Resource; date: string; isNonWorkingDay: boolean; }> = React.memo(({ resource, date, isNonWorkingDay }) => {
  const { assignments } = useEntitiesContext();
  const { allocations } = useAllocationsContext();
  
  if (resource.lastDayOfWork && date > resource.lastDayOfWork) isNonWorkingDay = true;
  
  const baseClasses = "flex items-center justify-center h-full w-[112px] text-center text-sm font-semibold";

  if (isNonWorkingDay) {
    return <div className={`${baseClasses} bg-gray-100 dark:bg-gray-900/50 text-gray-400`}>-</div>;
  }

  const total = assignments.filter(a => a.resourceId === resource.id).reduce((sum, a) => sum + (allocations[a.id!]?.[date] || 0), 0);
  
  const cellColor = useMemo(() => {
    const max = resource.maxStaffingPercentage ?? 100;
    if (total > max) return 'bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200';
    if (total === max) return 'bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200';
    if (total > 0) return 'bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200';
    return 'bg-transparent';
  }, [total, resource.maxStaffingPercentage]);

  return <div className={`${baseClasses} ${cellColor}`}>{total > 0 ? `${total}%` : '-'}</div>;
});

const ReadonlyAggregatedWorkloadCell: React.FC<{ resource: Resource; startDate: Date; endDate: Date; }> = React.memo(({ resource, startDate, endDate }) => {
  const { assignments, companyCalendar } = useEntitiesContext();
  const { allocations } = useAllocationsContext();

  const averageAllocation = useMemo(() => {
    const workingDays = getWorkingDaysBetween(startDate, endDate, companyCalendar, resource.location);
    if (workingDays === 0) return 0;
    
    const resourceAssignments = assignments.filter(a => a.resourceId === resource.id);
    let totalPersonDays = 0;
    resourceAssignments.forEach(assignment => {
      const assignmentAllocations = allocations[assignment.id!];
      if (assignmentAllocations) {
        let currentDate = new Date(startDate);
        while (currentDate <= endDate) {
          const dateStr = formatDate(currentDate, 'iso');
          if (assignmentAllocations[dateStr] && !isHoliday(currentDate, resource.location, companyCalendar)) {
            totalPersonDays += assignmentAllocations[dateStr] / 100;
          }
          currentDate = addDays(currentDate, 1);
        }
      }
    });
    return (totalPersonDays / workingDays) * 100;
  }, [resource, startDate, endDate, assignments, allocations, companyCalendar]);

  const cellColor = useMemo(() => {
    const max = resource.maxStaffingPercentage ?? 100;
    const roundedAvg = Math.round(averageAllocation);
    if (roundedAvg > max) return 'bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200';
    if (roundedAvg === max) return 'bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200';
    if (roundedAvg > 0) return 'bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200';
    return 'bg-transparent';
  }, [averageAllocation, resource.maxStaffingPercentage]);

  return (
    <div className={`flex items-center justify-center h-full w-[112px] text-center text-sm font-semibold ${cellColor}`}>
      {averageAllocation > 0 ? `${averageAllocation.toFixed(0)}%` : '-'}
    </div>
  );
});


// --- Virtualization Components ---

interface TimeColumn {
  label: string;
  subLabel: string;
  startDate: Date;
  endDate: Date;
  isNonWorkingHeader?: boolean;
}

const WorkloadHeader: React.FC<{ timeColumns: TimeColumn[], scrollRef: React.RefObject<HTMLDivElement> }> = ({ timeColumns, scrollRef }) => (
  <div className="flex-shrink-0 bg-gray-50 dark:bg-gray-700 font-semibold text-sm border-b border-gray-200 dark:border-gray-700">
    <div className="flex">
      <div className="sticky left-0 z-20 flex items-center px-3 py-3.5 w-[260px] bg-gray-50 dark:bg-gray-700 border-r border-gray-200 dark:border-gray-700">
        Carico Totale Risorsa
      </div>
      <div className="flex-grow overflow-x-hidden" ref={scrollRef}>
        <div className="flex">
          {timeColumns.map((col, index) => (
            <div key={index} className={`flex flex-col items-center justify-center p-2 w-[112px] border-r border-gray-200 dark:border-gray-700 ${col.isNonWorkingHeader ? 'bg-gray-100 dark:bg-gray-700/50' : ''}`}>
              <span className={col.isNonWorkingHeader ? 'text-gray-500' : ''}>{col.label}</span>
              {col.subLabel && <span className="text-xs text-gray-500">{col.subLabel}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

const ResourceRow = React.memo(({ index, style, data }: { index: number; style: React.CSSProperties; data: any }) => {
  const { displayResources, timeColumns, viewMode, companyCalendar } = data;
  const resource = displayResources[index];

  return (
    <div style={style} className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-100/50 dark:bg-gray-900/50 font-bold">
      <div className="sticky left-0 z-10 flex items-center px-3 py-3 w-[260px] text-left text-sm text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700">
        {resource.name} (Max: {resource.maxStaffingPercentage}%)
      </div>
      {timeColumns.map((col: TimeColumn, i: number) => (
        <div key={i} className="border-r border-gray-200 dark:border-gray-700">
          {viewMode === 'day' ? (
            <ReadonlyDailyTotalCell resource={resource} date={formatDate(col.startDate, 'iso')} isNonWorkingDay={!!col.isNonWorkingHeader || isHoliday(col.startDate, resource.location, companyCalendar)} />
          ) : (
            <ReadonlyAggregatedWorkloadCell resource={resource} startDate={col.startDate} endDate={col.endDate} />
          )}
        </div>
      ))}
    </div>
  );
});

const WorkloadPage: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const { resources, projects, assignments, clients, companyCalendar, roles } = useEntitiesContext();

  const [filters, setFilters] = useState({ resourceId: '', projectId: '', clientId: '', roleIds: [] as string[] });
  const [searchParams, setSearchParams] = useSearchParams();

  const headerScrollRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<FixedSizeList>(null);

  useEffect(() => {
    const resourceId = searchParams.get('resourceId');
    if (resourceId) {
      setFilters(prev => ({ ...prev, resourceId }));
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const timeColumns: TimeColumn[] = useMemo(() => {
    let d = new Date(currentDate);
    if (viewMode === 'day') {
      return getCalendarDays(d, 21).map(day => ({
        label: formatDate(day, 'short'), subLabel: formatDate(day, 'day'), startDate: day, endDate: day,
        isNonWorkingHeader: day.getDay() === 0 || day.getDay() === 6 || !!companyCalendar.find(e => e.date === formatDate(day, 'iso') && e.type !== 'LOCAL_HOLIDAY'),
      }));
    }
    const cols: TimeColumn[] = [];
    if (viewMode === 'week') {
      d.setDate(d.getDate() - (d.getDay() === 0 ? 6 : d.getDay() - 1));
      for (let i = 0; i < 8; i++) {
        const start = new Date(d); const end = addDays(new Date(d), 6);
        cols.push({ label: `${formatDate(start, 'short')} - ${formatDate(end, 'short')}`, subLabel: ``, startDate: start, endDate: end });
        d.setDate(d.getDate() + 7);
      }
    } else {
      d.setDate(1);
      for (let i = 0; i < 6; i++) {
        const start = new Date(d); const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        cols.push({ label: d.toLocaleString('it-IT', { month: 'long', year: 'numeric' }), subLabel: '', startDate: start, endDate: end });
        d.setMonth(d.getMonth() + 1);
      }
    }
    return cols;
  }, [currentDate, viewMode, companyCalendar]);

  const handlePrev = useCallback(() => setCurrentDate(prev => addDays(prev, viewMode === 'day' ? -14 : viewMode === 'week' ? -7 * 4 : -180)), [viewMode]);
  const handleNext = useCallback(() => setCurrentDate(prev => addDays(prev, viewMode === 'day' ? 14 : viewMode === 'week' ? 7 * 4 : 180)), [viewMode]);
  const handleToday = () => setCurrentDate(new Date());

  const handleFilterChange = (name: string, value: string) => setFilters(prev => ({ ...prev, [name]: value }));
  const handleMultiSelectFilterChange = (name: string, values: string[]) => setFilters(prev => ({ ...prev, [name]: values }));
  const clearFilters = () => setFilters({ resourceId: '', projectId: '', clientId: '', roleIds: [] });

  const displayResources = useMemo(() => {
    let finalResources = resources.filter(r => !r.resigned);
    if (filters.roleIds.length > 0) finalResources = finalResources.filter(r => filters.roleIds.includes(r.roleId));
    if (filters.resourceId) finalResources = finalResources.filter(r => r.id === filters.resourceId);

    if (filters.projectId || filters.clientId) {
      let relevantResourceIds: Set<string>;
      if (filters.projectId) {
        relevantResourceIds = new Set(assignments.filter(a => a.projectId === filters.projectId).map(a => a.resourceId));
      } else {
        const clientProjectIds = new Set(projects.filter(p => p.clientId === filters.clientId).map(p => p.id));
        relevantResourceIds = new Set(assignments.filter(a => clientProjectIds.has(a.projectId)).map(a => a.resourceId));
      }
      finalResources = finalResources.filter(r => relevantResourceIds.has(r.id!));
    }
    return finalResources.sort((a, b) => a.name.localeCompare(b.name));
  }, [resources, assignments, projects, filters]);

  const handleScroll = useCallback(({ scrollLeft }: ListOnScrollProps) => {
    if (headerScrollRef.current) {
      headerScrollRef.current.scrollLeft = scrollLeft;
    }
  }, []);

  const itemData = useMemo(() => ({
    displayResources, timeColumns, viewMode, companyCalendar
  }), [displayResources, timeColumns, viewMode, companyCalendar]);

  const resourceOptions = useMemo(() => resources.filter(r => !r.resigned).map(r => ({ value: r.id!, label: r.name })), [resources]);
  const roleOptions = useMemo(() => roles.map(r => ({ value: r.id!, label: r.name })), [roles]);
  const projectOptions = useMemo(() => projects.map(p => ({ value: p.id!, label: p.name })), [projects]);
  const clientOptions = useMemo(() => clients.map(c => ({ value: c.id!, label: c.name })), [clients]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 space-y-4">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
              <div className="flex items-center justify-start space-x-2">
                <button onClick={handlePrev} className="px-3 py-2 bg-white dark:bg-gray-700 border dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 text-sm">← Prec.</button>
                <button onClick={handleToday} className="px-4 py-2 bg-white dark:bg-gray-700 border dark:border-gray-600 rounded-md shadow-sm font-semibold text-blue-600 dark:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-600">Oggi</button>
                <button onClick={handleNext} className="px-3 py-2 bg-white dark:bg-gray-700 border dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 text-sm">Succ. →</button>
              </div>
              <div className="flex items-center space-x-1 bg-gray-200 dark:bg-gray-700 p-1 rounded-md">
                {(['day', 'week', 'month'] as ViewMode[]).map(level => <button key={level} onClick={() => setViewMode(level)} className={`px-3 py-1 text-sm font-medium rounded-md capitalize ${viewMode === level ? 'bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 shadow' : 'text-gray-600 dark:text-gray-300'}`}>{level === 'day' ? 'Giorno' : level === 'week' ? 'Settimana' : 'Mese'}</button>)}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 text-right">Vista di sola lettura. <a href="/staffing" className="text-blue-500 hover:underline">Vai a Staffing per modifiche</a>.</div>
          </div>
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow relative z-30">
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 items-end">
                  <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Risorsa</label><SearchableSelect name="resourceId" value={filters.resourceId} onChange={handleFilterChange} options={resourceOptions} placeholder="Tutte le Risorse"/></div>
                  <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Ruolo</label><MultiSelectDropdown name="roleIds" selectedValues={filters.roleIds} onChange={handleMultiSelectFilterChange} options={roleOptions} placeholder="Tutti i Ruoli"/></div>
                  <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Progetto</label><SearchableSelect name="projectId" value={filters.projectId} onChange={handleFilterChange} options={projectOptions} placeholder="Tutti i Progetti"/></div>
                  <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Cliente</label><SearchableSelect name="clientId" value={filters.clientId} onChange={handleFilterChange} options={clientOptions} placeholder="Tutti i Clienti"/></div>
                  <button onClick={clearFilters} className="px-4 py-2 bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 w-full md:w-auto">Reset Filtri</button>
              </div>
          </div>
      </div>
      
      <div className="flex-grow mt-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden h-[720px] flex flex-col">
          <WorkloadHeader timeColumns={timeColumns} scrollRef={headerScrollRef} />
          <div className="flex-1 w-full">
            {displayResources.length > 0 ? (
                <FixedSizeList
                  ref={listRef}
                  height={660}
                  width="100%"
                  itemCount={displayResources.length}
                  itemSize={ROW_HEIGHT}
                  itemData={itemData}
                  onScroll={handleScroll}
                >
                  {ResourceRow}
                </FixedSizeList>
            ) : (
                <div className="text-center py-8 text-gray-500">Nessuna risorsa trovata con i filtri correnti.</div>
            )}
          </div>
        </div>
      </div>

      <style>{`.form-input,.form-select{display:block;width:100%;border-radius:0.375rem;border:1px solid #D1D5DB;background-color:#FFFFFF;padding:0.5rem 0.75rem;font-size:0.875rem;line-height:1.25rem}.dark .form-input,.dark .form-select{border-color:#4B5563;background-color:#374151;color:#F9FAFB}`}</style>
    </div>
  );
};

export default WorkloadPage;
