/**
 * @file StaffingPage.tsx
 * @description Pagina principale per la visualizzazione e la gestione dello staffing delle risorse sui progetti.
 * Optimized for on-demand data loading and fixed input logic bug.
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useEntitiesContext, useAllocationsContext } from '../context/AppContext';
import { Resource, Assignment, LeaveRequest, LeaveType, Project, Client, Role } from '../types';
import {
  getCalendarDays,
  formatDate,
  addDays,
  isHoliday,
  formatDateFull,
  formatDateSynthetic
} from '../utils/dateUtils';
import SearchableSelect from '../components/SearchableSelect';
import ConfirmationModal from '../components/ConfirmationModal';
import { Link } from 'react-router-dom';
import Pagination from '../components/Pagination';
import ExportButton from '../components/ExportButton';
import { SpinnerIcon } from '../components/icons';
import {
  FormDialog,
  Option,
  assignmentSchema,
  bulkAssignmentSchema,
  bulkFormFields,
  buildAssignmentFormFields,
  AssignmentFormValues,
  BulkAssignmentFormValues,
} from '../components/forms';

// Added local type definition for ViewMode to resolve compilation errors
type ViewMode = 'day' | 'week' | 'month';

// Helper per icona
const getLeaveIcon = (typeName: string) => {
    const lower = typeName.toLowerCase();
    if (lower.includes('ferie')) return 'beach_access';
    if (lower.includes('malattia')) return 'medical_services';
    if (lower.includes('permesso')) return 'schedule';
    if (lower.includes('studio')) return 'school';
    if (lower.includes('smart')) return 'home_work'; 
    return 'block'; 
};

const getLeaveKey = (resourceId: string, dateStr: string) => `${resourceId}_${dateStr}`;

interface AllocationCellProps {
  assignment: Assignment;
  date: string;
  isNonWorkingDay: boolean;
  activeLeave?: LeaveRequest;
  leaveType?: LeaveType;
}

const AllocationCell: React.FC<AllocationCellProps> = React.memo(({ assignment, date, isNonWorkingDay, activeLeave, leaveType }) => {
    const { allocations, updateAllocation } = useAllocationsContext();
    const contextPercentage = allocations[assignment.id!]?.[date] || 0;
    const [localValue, setLocalValue] = useState<number | string>(contextPercentage === 0 ? '' : contextPercentage);

    useEffect(() => { 
        setLocalValue(contextPercentage === 0 ? '' : contextPercentage); 
    }, [contextPercentage]);

    useEffect(() => {
        const numericValue = localValue === '' ? 0 : Number(localValue);
        if (numericValue === contextPercentage) return;
        
        const timer = setTimeout(() => { 
            updateAllocation(assignment.id!, date, numericValue); 
        }, 600);
        return () => clearTimeout(timer);
    }, [localValue, assignment.id, date, updateAllocation, contextPercentage]);

    if (activeLeave && leaveType && !activeLeave.isHalfDay) {
         return (
            <td className="border-t border-outline-variant p-0 text-center relative cursor-not-allowed opacity-70" style={{ backgroundColor: `${leaveType.color}20` }} title={`${leaveType.name}: ${activeLeave.notes || ''}`}>
                <span className="material-symbols-outlined text-base align-middle" style={{ color: leaveType.color }}>{getLeaveIcon(leaveType.name)}</span>
            </td>
        );
    }

    if (isNonWorkingDay) return <td className="border-t border-outline-variant p-0 text-center bg-surface-container"><span className="text-sm text-on-surface-variant">-</span></td>;

    return (
      <td className="border-t border-outline-variant p-0 text-center relative h-10 group">
        {activeLeave && activeLeave.isHalfDay && leaveType && <div className="absolute top-0 right-0 w-3 h-3 rounded-bl bg-opacity-50 pointer-events-none z-10" style={{ backgroundColor: leaveType.color }} />}
        <input 
            type="number" 
            min="0" 
            max="100" 
            step="5" 
            value={localValue} 
            placeholder="-"
            onChange={(e) => {
                const raw = e.target.value;
                if (raw === '') {
                    setLocalValue('');
                    return;
                }
                let val = parseInt(raw, 10);
                if (isNaN(val)) val = 0;
                if (val < 0) val = 0;
                if (val > 100) val = 100;
                setLocalValue(val);
            }} 
            className="w-full h-full bg-transparent border-0 text-center text-sm focus:ring-2 focus:ring-inset focus:ring-primary text-on-surface p-0 m-0 appearance-none hover:bg-surface-container-high transition-colors" 
        />
      </td>
    );
});

const DailyTotalCell: React.FC<any> = ({ resource, date, resourceAssignments, activeLeave, leaveType }) => {
    const { allocations } = useAllocationsContext();
    const total = resourceAssignments.reduce((sum: number, a: any) => sum + (allocations[a.id!]?.[date] || 0), 0);
    
    const max = resource.maxStaffingPercentage || 100;
    let colorClass = "bg-surface-container-low text-on-surface";
    if (total > max) colorClass = "bg-error-container text-on-error-container";
    else if (total === max) colorClass = "bg-tertiary-container text-on-tertiary-container";
    else if (total > 0) colorClass = "bg-yellow-container text-on-yellow-container";

    return (
        <td className={`border-t border-outline-variant px-2 py-3 text-center text-sm font-bold ${colorClass}`}>
            {total > 0 ? `${total}%` : activeLeave ? <span className="material-symbols-outlined text-xs" style={{color: leaveType?.color}}>event_busy</span> : '-'}
        </td>
    );
};

const ReadonlyAggregatedTotalCell: React.FC<any> = () => <td className="border-t border-outline-variant px-2 py-3 text-center text-sm font-semibold bg-surface-container-low">-</td>;
const ReadonlyAggregatedAllocationCell: React.FC<any> = () => <td className="border-t border-outline-variant px-2 py-3 text-center text-sm bg-surface">-</td>;

export const StaffingPage: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  // Using locally defined ViewMode type
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
      const handleResize = () => setIsMobile(window.innerWidth < 768);
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
  }, []);

  const {
    projects,
    assignments,
    resources,
    roles,
    clients,
    addMultipleAssignments,
    deleteAssignment,
    companyCalendar,
    leaveRequests,
    leaveTypes,
    isActionLoading,
    getPaginatedResources, 
    fetchAllocationsForRange 
  } = useEntitiesContext();
  const { bulkUpdateAllocations } = useAllocationsContext();

  const [localResources, setLocalResources] = useState<Resource[]>([]);
  const [totalResources, setTotalResources] = useState(0);
  const [isGridLoading, setIsGridLoading] = useState(false);

  const [isBulkModalOpen, setBulkModalOpen] = useState(false);
  const [isAssignmentModalOpen, setAssignmentModalOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [assignmentToDelete, setAssignmentToDelete] = useState<Assignment | null>(null);
  const [newAssignmentData, setNewAssignmentData] = useState<AssignmentFormValues>({ resourceId: '', projectIds: [] });

  const [filters, setFilters] = useState({ resourceId: '', projectId: '', clientId: '', projectManager: '' });
  const [debouncedFilters, setDebouncedFilters] = useState(filters);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  const projectsById = useMemo(() => new Map<string, Project>(projects.map((p) => [p.id!, p])), [projects]);
  const clientsById = useMemo(() => new Map<string, Client>(clients.map((c) => [c.id!, c])), [clients]);
  const rolesById = useMemo(() => new Map<string, Role>(roles.map((r) => [r.id!, r])), [roles]);
  
  const resourceOptions = useMemo(() => resources.filter(r => !r.resigned).map(r => ({ value: r.id!, label: r.name })), [resources]);
  const projectOptions = useMemo(() => projects.filter(p => p.status !== 'Completato').map(p => ({ value: p.id!, label: p.name })), [projects]);

  useEffect(() => {
      const handler = setTimeout(() => {
          setDebouncedFilters(filters);
          setCurrentPage(1);
      }, 400);
      return () => clearTimeout(handler);
  }, [filters]);

  useEffect(() => {
      const loadGridData = async () => {
          setIsGridLoading(true);
          try {
              const resName = debouncedFilters.resourceId ? resources.find(r => r.id === debouncedFilters.resourceId)?.name || '' : '';
              const resourceData = await getPaginatedResources(currentPage, itemsPerPage, { search: resName });
              
              setLocalResources(resourceData?.data || []);
              setTotalResources(resourceData?.total || 0);

              const startStr = formatDate(timeColumns[0].startDate, 'iso');
              const endStr = formatDate(timeColumns[timeColumns.length - 1].endDate, 'iso');
              await fetchAllocationsForRange(startStr, endStr);
          } catch (e) {
              console.error("Grid load failed", e);
          } finally {
              setIsGridLoading(false);
          }
      };

      loadGridData();
  }, [currentPage, itemsPerPage, debouncedFilters, currentDate, viewMode]); 

  const timeColumns = useMemo(() => {
    const cols = [];
    let d = new Date(currentDate);

    if (viewMode === 'day') {
      return getCalendarDays(d, 14).map((day) => {
        const dayOfWeek = day.getUTCDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const dateIso = formatDate(day, 'iso');
        const holiday = companyCalendar.find((e) => e.date === dateIso && e.type !== 'LOCAL_HOLIDAY');
        return { label: formatDateSynthetic(day), subLabel: formatDate(day, 'day'), startDate: day, endDate: day, isNonWorkingDay: isWeekend || !!holiday, dateIso };
      });
    }
    if (viewMode === 'week') {
      const day = d.getUTCDay();
      const diff = day === 0 ? 6 : day - 1;
      d.setUTCDate(d.getUTCDate() - diff);
      for (let i = 0; i < 12; i++) {
        const startOfWeek = new Date(d);
        const endOfWeek = addDays(new Date(d), 6);
        cols.push({ label: `${formatDateSynthetic(startOfWeek)} - ${formatDateSynthetic(endOfWeek)}`, subLabel: '', startDate: startOfWeek, endDate: endOfWeek, isNonWorkingDay: false, dateIso: '' });
        d.setUTCDate(d.getUTCDate() + 7);
      }
    } else {
      d.setUTCDate(1);
      for (let i = 0; i < 12; i++) {
        const startOfMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
        const endOfMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
        cols.push({ label: d.toLocaleString('it-IT', { month: 'long', year: 'numeric', timeZone: 'UTC' }), subLabel: '', startDate: startOfMonth, endDate: endOfMonth, isNonWorkingDay: false, dateIso: '' });
        d.setUTCMonth(d.getUTCMonth() + 1);
      }
    }
    return cols;
  }, [currentDate, viewMode, companyCalendar]);

  const assignmentsByResource = useMemo(() => {
      const map = new Map<string, Assignment[]>();
      localResources.forEach(r => {
          const resAssignments = assignments.filter(a => a.resourceId === r.id);
          const filtered = resAssignments.filter(a =>
            (!debouncedFilters.projectId || a.projectId === debouncedFilters.projectId) &&
            (!debouncedFilters.clientId || projectsById.get(a.projectId)?.clientId === debouncedFilters.clientId) &&
            (!debouncedFilters.projectManager || projectsById.get(a.projectId)?.projectManager === debouncedFilters.projectManager)
          );
          if (filtered.length > 0 || !debouncedFilters.projectId) {
             map.set(r.id!, filtered);
          }
      });
      return map;
  }, [localResources, assignments, debouncedFilters, projectsById]);
  
  const leavesLookup = useMemo(() => {
      const map = new Map<string, { request: LeaveRequest; type: LeaveType }>();
      if (viewMode !== 'day' || timeColumns.length === 0) return map;
      
      const startStr = formatDate(timeColumns[0].startDate, 'iso');
      const endStr = formatDate(timeColumns[timeColumns.length - 1].endDate, 'iso');

      leaveRequests.filter(l => l.status === 'APPROVED' && l.endDate >= startStr && l.startDate <= endStr).forEach(req => {
          const type = leaveTypes.find(t => t.id === req.typeId);
          if (!type) return;
          let d = new Date(req.startDate);
          const end = new Date(req.endDate);
          while(d <= end) {
             const iso = d.toISOString().split('T')[0];
             if (iso >= startStr && iso <= endStr) {
                map.set(`${req.resourceId}_${iso}`, { request: req, type });
             }
             d.setDate(d.getDate() + 1);
          }
      });
      return map;
  }, [leaveRequests, leaveTypes, viewMode, timeColumns]);

  const handlePrev = useCallback(() => setCurrentDate(prev => { const d = new Date(prev); if (viewMode === 'week') d.setDate(d.getDate() - 7); else if (viewMode === 'month') d.setMonth(d.getMonth() - 1); else d.setDate(d.getDate() - 1); return d; }), [viewMode]);
  const handleNext = useCallback(() => setCurrentDate(prev => { const d = new Date(prev); if (viewMode === 'week') d.setDate(d.getDate() + 7); else if (viewMode === 'month') d.setMonth(d.getMonth() + 1); else d.setDate(d.getDate() + 1); return d; }), [viewMode]);
  const handleToday = useCallback(() => setCurrentDate(new Date()), []);
  
  const handleFilterChange = (name: string, value: string) => setFilters(prev => ({...prev, [name]: value}));
  const clearFilters = () => setFilters({ resourceId: '', projectId: '', clientId: '', projectManager: '' });

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 space-y-4">
         <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
              <div className="flex items-center justify-center md:justify-start space-x-2">
                  <button onClick={handlePrev} className="px-4 py-2 bg-surface border border-outline text-on-surface rounded-full shadow-sm hover:bg-surface-container-low text-sm">← Prec.</button>
                  <button onClick={handleToday} className="px-4 py-2 bg-secondary-container text-on-secondary-container rounded-full shadow-sm font-semibold hover:opacity-90">Oggi</button>
                  <button onClick={handleNext} className="px-4 py-2 bg-surface border border-outline text-on-surface rounded-full shadow-sm hover:bg-surface-container-low text-sm">Succ. →</button>
              </div>
              <div className="flex items-center justify-center md:justify-start space-x-1 bg-surface-container p-1 rounded-full">
                  {/* Using locally defined ViewMode type for casting */}
                  {(['day', 'week', 'month'] as ViewMode[]).map((level) => (
                      <button key={level} onClick={() => setViewMode(level)} className={`px-3 py-1 text-sm font-medium rounded-full capitalize ${viewMode === level ? 'bg-surface text-primary shadow' : 'text-on-surface-variant'}`}>{level === 'day' ? 'Giorno' : level === 'week' ? 'Settimana' : 'Mese'}</button>
                  ))}
              </div>
              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                   <button onClick={() => { setNewAssignmentData({ resourceId: '', projectIds: [] }); setAssignmentModalOpen(true); }} className="flex items-center justify-center w-full md:w-auto px-6 py-2 bg-primary text-on-primary font-semibold rounded-full shadow-sm"><span className="material-symbols-outlined mr-2 text-xl">add</span>Assegna Risorsa</button>
              </div>
         </div>

         <div className="p-4 bg-surface rounded-2xl shadow">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div><label className="block text-sm font-medium text-on-surface-variant">Risorsa</label><SearchableSelect name="resourceId" value={filters.resourceId} onChange={handleFilterChange} options={resourceOptions} placeholder="Filtra vista..."/></div>
                <div><label className="block text-sm font-medium text-on-surface-variant">Progetto</label><SearchableSelect name="projectId" value={filters.projectId} onChange={handleFilterChange} options={projectOptions} placeholder="Tutti i Progetti"/></div>
                <button onClick={clearFilters} className="px-6 py-2 bg-secondary-container text-on-secondary-container font-semibold rounded-full hover:opacity-90 w-full md:w-auto">Reset Filtri</button>
            </div>
         </div>
      </div>

      <div className="flex-grow mt-4">
          <div className="bg-surface rounded-2xl shadow overflow-x-auto relative min-h-[400px]">
              {isGridLoading && <div className="absolute inset-0 bg-surface/50 z-20 flex items-center justify-center"><SpinnerIcon className="w-10 h-10 text-primary" /></div>}
              
              <div className="max-h-[660px] overflow-y-auto">
                <table className="min-w-full divide-y divide-outline-variant">
                    <thead className="bg-surface-container-low sticky top-0 z-10">
                        <tr>
                            <th className="sticky left-0 bg-surface-container-low px-3 py-3.5 text-left text-sm font-semibold text-on-surface z-20" style={{ minWidth: '260px' }}>Risorsa / Progetto</th>
                            <th className="px-2 py-3.5 text-center text-sm font-semibold text-on-surface">Azioni</th>
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
                        {localResources.map(resource => {
                            const role = rolesById.get(resource.roleId);
                            const resourceAssignments = assignmentsByResource.get(resource.id!) || [];
                            return (
                                <React.Fragment key={resource.id}>
                                    <tr className="bg-surface-container font-bold">
                                        <td className="sticky left-0 bg-surface-container px-3 py-3 text-left text-sm z-9">
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-on-surface truncate">{resource.name}</span>
                                                    <span className="text-[10px] font-normal text-on-surface-variant uppercase tracking-tighter">{role?.name} (Max: {resource.maxStaffingPercentage}%)</span>
                                                </div>
                                                <button onClick={() => { setNewAssignmentData({ resourceId: resource.id!, projectIds: [] }); setAssignmentModalOpen(true); }} className="p-1 rounded-full hover:bg-surface-container-high text-primary"><span className="material-symbols-outlined">add_circle</span></button>
                                            </div>
                                        </td>
                                        <td className="bg-surface-container text-center text-xs text-on-surface-variant">-</td>
                                        {timeColumns.map((col, index) => {
                                             if (viewMode === 'day') {
                                                const leaveInfo = leavesLookup.get(`${resource.id}_${col.dateIso}`);
                                                return (
                                                    <DailyTotalCell 
                                                        key={index} 
                                                        resource={resource} 
                                                        date={col.dateIso!} 
                                                        isNonWorkingDay={col.isNonWorkingDay} 
                                                        resourceAssignments={resourceAssignments} 
                                                        activeLeave={leaveInfo?.request}
                                                        leaveType={leaveInfo?.type}
                                                    />
                                                );
                                            }
                                            return <ReadonlyAggregatedTotalCell key={index} />;
                                        })}
                                    </tr>
                                    {resourceAssignments.map(assignment => {
                                        const project = projectsById.get(assignment.projectId);
                                        return (
                                            <tr key={assignment.id} className="group hover:bg-surface-container-low">
                                                 <td className="sticky left-0 bg-surface group-hover:bg-surface-container-low px-3 py-4 text-sm font-medium pl-8 z-9 truncate">
                                                    <span className="text-on-surface">{project?.name || 'N/D'}</span>
                                                 </td>
                                                 <td className="px-2 py-3 text-center">
                                                    <div className="flex items-center justify-center space-x-2">
                                                        <button onClick={() => { setSelectedAssignment(assignment); setBulkModalOpen(true); }} className="p-1 rounded-full hover:bg-surface-container text-primary" title="Allocazione Massiva"><span className="material-symbols-outlined">calendar_add_on</span></button>
                                                        <button onClick={() => setAssignmentToDelete(assignment)} className="p-1 rounded-full hover:bg-surface-container text-error" title="Elimina"><span className="material-symbols-outlined">delete</span></button>
                                                    </div>
                                                 </td>
                                                 {timeColumns.map((col, index) => {
                                                    if (viewMode === 'day') {
                                                        const leaveInfo = leavesLookup.get(`${resource.id}_${col.dateIso}`);
                                                        return (
                                                            <AllocationCell 
                                                                key={index} 
                                                                assignment={assignment} 
                                                                date={col.dateIso!} 
                                                                isNonWorkingDay={col.isNonWorkingDay} 
                                                                activeLeave={leaveInfo?.request}
                                                                leaveType={leaveInfo?.type}
                                                            />
                                                        );
                                                    }
                                                    return <ReadonlyAggregatedAllocationCell key={index} />;
                                                 })}
                                            </tr>
                                        );
                                    })}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
              </div>

              <Pagination currentPage={currentPage} totalItems={totalResources} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} onItemsPerPageChange={setItemsPerPage} />
          </div>
      </div>
      
      <FormDialog 
        isOpen={isBulkModalOpen} 
        onClose={() => setBulkModalOpen(false)} 
        title="Assegnazione Massiva" 
        defaultValues={{ startDate: '', endDate: '', percentage: 50 }} 
        onSubmit={(vals: any) => { if(selectedAssignment) bulkUpdateAllocations(selectedAssignment.id!, vals.startDate, vals.endDate, vals.percentage); }} 
        fields={bulkFormFields} 
        schema={bulkAssignmentSchema} 
      />

      <FormDialog 
        isOpen={isAssignmentModalOpen} 
        onClose={() => setAssignmentModalOpen(false)} 
        title="Nuova Assegnazione" 
        defaultValues={newAssignmentData} 
        onSubmit={(vals: any) => { if(vals.resourceId && vals.projectIds) addMultipleAssignments(vals.projectIds.map((pid: string) => ({resourceId: vals.resourceId, projectId: pid}))); }} 
        fields={buildAssignmentFormFields(resourceOptions, projectOptions)} 
        schema={assignmentSchema} 
      />

      {assignmentToDelete && <ConfirmationModal isOpen={true} onClose={() => setAssignmentToDelete(null)} onConfirm={() => { deleteAssignment(assignmentToDelete.id!); setAssignmentToDelete(null); }} title="Elimina Assegnazione" message="Sei sicuro di voler rimuovere questa risorsa dal progetto? L'operazione rimuoverà anche tutte le allocazioni esistenti." isConfirming={isActionLoading(`deleteAssignment-${assignmentToDelete.id}`)} />}
    </div>
  );
};

export default StaffingPage;