
/**
 * @file TestStaffingPage.tsx
 * @description Pagina di test per la visualizzazione dello staffing con Responsive Layout Switching.
 * Desktop: Virtualized Grid (Performance Optimized).
 * Mobile: Resource Cards View (Agenda).
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useEntitiesContext, useAllocationsContext } from '../context/AppContext';
import { Resource, Assignment } from '../types';
import { getCalendarDays, formatDate, addDays } from '../utils/dateUtils';
import Modal from '../components/Modal';
import SearchableSelect from '../components/SearchableSelect';
import MultiSelectDropdown from '../components/MultiSelectDropdown';
import ConfirmationModal from '../components/ConfirmationModal';
import VirtualStaffingGrid from '../components/VirtualStaffingGrid';

type ViewMode = 'day' | 'week' | 'month';

type MobileRowData = {
  resource: Resource;
  roleName: string;
  totalLoad: number;
  assignments: {
      assignment: Assignment;
      projectName: string;
      clientName: string;
      avgLoad: number;
  }[];
};

// --- MOBILE COMPONENTS ---

// Modale per la modifica giornaliera su mobile
const MobileAssignmentEditor: React.FC<{
    assignment: Assignment;
    projectName: string;
    dates: { dateIso: string; label: string; isNonWorkingDay: boolean }[];
    onClose: () => void;
}> = ({ assignment, projectName, dates, onClose }) => {
    const { allocations, updateAllocation } = useAllocationsContext();

    return (
        <div className="fixed inset-0 z-50 bg-background flex flex-col animate-slide-up">
            <div className="flex items-center justify-between p-4 border-b border-outline-variant bg-surface">
                <h3 className="text-lg font-bold truncate pr-4">{projectName}</h3>
                <button onClick={onClose} className="p-2 rounded-full bg-surface-container text-on-surface">
                    <span className="material-symbols-outlined">close</span>
                </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {dates.map(d => {
                    const currentVal = allocations[assignment.id!]?.[d.dateIso] || 0;
                    return (
                        <div key={d.dateIso} className={`flex items-center justify-between p-3 rounded-lg border ${d.isNonWorkingDay ? 'bg-surface-container/50 border-transparent' : 'bg-surface border-outline-variant'}`}>
                            <div className="flex flex-col">
                                <span className={`font-medium ${d.isNonWorkingDay ? 'text-on-surface-variant' : 'text-on-surface'}`}>{d.label}</span>
                                {d.isNonWorkingDay && <span className="text-xs text-on-surface-variant">Non lavorativo</span>}
                            </div>
                            {!d.isNonWorkingDay ? (
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="range" 
                                        min="0" max="100" step="5" 
                                        value={currentVal}
                                        onChange={(e) => updateAllocation(assignment.id!, d.dateIso, parseInt(e.target.value, 10))}
                                        className="w-32 accent-primary"
                                    />
                                    <span className="w-10 text-right font-bold text-primary">{currentVal}%</span>
                                </div>
                            ) : (
                                <span className="text-on-surface-variant">-</span>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const MobileResourceCard: React.FC<{
    data: MobileRowData;
    dates: { dateIso: string; label: string; isNonWorkingDay: boolean }[];
}> = React.memo(({ data, dates }) => {
    const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
    const [editingProjectName, setEditingProjectName] = useState('');

    const getLoadColor = (load: number) => {
        const max = data.resource.maxStaffingPercentage;
        if (load > max) return 'bg-error text-on-error';
        if (load === max) return 'bg-tertiary text-on-tertiary';
        if (load > 0) return 'bg-yellow-container text-on-yellow-container'; 
        return 'bg-surface-variant text-on-surface-variant';
    };
    
    const getBarColor = (load: number) => {
        const max = data.resource.maxStaffingPercentage;
        if (load > max) return 'bg-error';
        if (load >= max * 0.9) return 'bg-tertiary'; 
        return 'bg-primary';
    };

    return (
        <>
            <div className="bg-surface rounded-2xl shadow p-4 mb-4 border-l-4 border-primary flex flex-col gap-3">
                {/* Header Card */}
                <div className="flex justify-between items-start">
                    <div>
                        <h3 className="font-bold text-lg text-on-surface">{data.resource.name}</h3>
                        <p className="text-sm text-on-surface-variant">{data.roleName}</p>
                    </div>
                    <div className={`px-2 py-1 rounded text-xs font-bold ${getLoadColor(data.totalLoad)}`}>
                        {data.totalLoad.toFixed(0)}% Avg
                    </div>
                </div>

                {/* Visual Load Indicator */}
                <div className="w-full bg-surface-container-highest rounded-full h-2.5">
                    <div 
                        className={`h-2.5 rounded-full ${getBarColor(data.totalLoad)}`} 
                        style={{ width: `${Math.min(data.totalLoad, 100)}%` }}
                    ></div>
                </div>

                {/* Assignments List */}
                <div className="space-y-2 mt-1">
                    {data.assignments.length > 0 ? (
                        data.assignments.map(a => (
                            <div 
                                key={a.assignment.id} 
                                onClick={() => {
                                    setEditingAssignment(a.assignment);
                                    setEditingProjectName(a.projectName);
                                }}
                                className="flex justify-between items-center p-3 bg-surface-container-low rounded-lg border border-transparent active:bg-surface-container-high active:border-outline-variant transition-colors cursor-pointer"
                            >
                                <div className="flex flex-col truncate pr-2">
                                    <span className="font-medium text-sm text-on-surface truncate">{a.projectName}</span>
                                    <span className="text-xs text-on-surface-variant truncate">{a.clientName}</span>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <span className="text-sm font-semibold text-primary">{a.avgLoad.toFixed(0)}%</span>
                                    <span className="material-symbols-outlined text-on-surface-variant text-sm">chevron_right</span>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-sm text-on-surface-variant italic text-center py-2">Nessuna assegnazione nel periodo.</p>
                    )}
                </div>
            </div>

            {editingAssignment && (
                <MobileAssignmentEditor 
                    assignment={editingAssignment} 
                    projectName={editingProjectName} 
                    dates={dates} 
                    onClose={() => setEditingAssignment(null)} 
                />
            )}
        </>
    );
});


// --- Pagina Principale ---
const TestStaffingPage: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('day'); // Desktop default is 'day' for grid
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
      const handleResize = () => setIsMobile(window.innerWidth < 768);
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
  }, []);

  const {
    resources,
    projects,
    assignments,
    roles,
    clients,
    addMultipleAssignments,
    deleteAssignment,
    companyCalendar,
    isActionLoading,
  } = useEntitiesContext();
  const { allocations, bulkUpdateAllocations } = useAllocationsContext();

  // Modali Desktop
  const [isBulkModalOpen, setBulkModalOpen] = useState(false);
  const [isAssignmentModalOpen, setAssignmentModalOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [assignmentToDelete, setAssignmentToDelete] = useState<Assignment | null>(null);
  const [bulkFormData, setBulkFormData] = useState({ startDate: '', endDate: '', percentage: 50 });
  const [newAssignmentData, setNewAssignmentData] = useState<{ resourceId: string; projectIds: string[] }>({ resourceId: '', projectIds: [] });

  const [filters, setFilters] = useState({ resourceId: '', projectId: '', clientId: '', projectManager: '' });

  const projectsById = useMemo(() => new Map(projects.map((p) => [p.id!, p])), [projects]);
  const clientsById = useMemo(() => new Map(clients.map((c) => [c.id!, c])), [clients]);
  const rolesById = useMemo(() => new Map(roles.map((r) => [r.id!, r])), [roles]);

  // --- Time Calculation ---
  const timeColumns = useMemo(() => {
    const cols: { label: string; subLabel: string; startDate: Date; endDate: Date; isNonWorkingDay: boolean; dateIso: string; }[] = [];
    let d = new Date(currentDate);

    if (isMobile) {
        let daysToGenerate = 1;
        if (viewMode === 'week') {
             d.setDate(d.getDate() - (d.getDay() === 0 ? 6 : d.getDay() - 1));
             daysToGenerate = 7;
        } else if (viewMode === 'month') {
             d.setDate(1);
             daysToGenerate = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        }

        for (let i = 0; i < daysToGenerate; i++) {
            const day = new Date(d);
            day.setDate(d.getDate() + i);
            const dayOfWeek = day.getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            const dateIso = formatDate(day, 'iso');
            const holiday = companyCalendar.find((e) => e.date === dateIso && e.type !== 'LOCAL_HOLIDAY');
            cols.push({ 
                label: formatDate(day, 'day') + ' ' + formatDate(day, 'short'), 
                subLabel: '', 
                startDate: day, 
                endDate: day, 
                isNonWorkingDay: isWeekend || !!holiday, 
                dateIso 
            });
        }
        return cols;
    }

    // Desktop Logic - Generate 30 days window for virtualization
    // In grid mode 'day' we render each day. 'week' and 'month' aggregations are not implemented in the virtual grid yet for simplicity, 
    // sticking to 'day' view as per common request for grids.
    const daysToRender = 30; 
    
    return getCalendarDays(d, daysToRender).map((day) => {
        const dayOfWeek = day.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const dateIso = formatDate(day, 'iso');
        const holiday = companyCalendar.find((e) => e.date === dateIso && e.type !== 'LOCAL_HOLIDAY');
        return { 
            label: formatDate(day, 'short'), 
            subLabel: formatDate(day, 'day'), 
            startDate: day, 
            endDate: day, 
            isNonWorkingDay: isWeekend || !!holiday, 
            dateIso 
        };
    });
  }, [currentDate, viewMode, companyCalendar, isMobile]);

  const handlePrev = useCallback(() => setCurrentDate(prev => {
    const newDate = new Date(prev);
    if (viewMode === 'week') newDate.setDate(newDate.getDate() - 7);
    else if (viewMode === 'month') newDate.setMonth(newDate.getMonth() - 1);
    else newDate.setDate(newDate.getDate() - 1);
    return newDate;
  }), [viewMode]);

  const handleNext = useCallback(() => setCurrentDate(prev => {
    const newDate = new Date(prev);
    if (viewMode === 'week') newDate.setDate(newDate.getDate() + 7);
    else if (viewMode === 'month') newDate.setMonth(newDate.getMonth() + 1);
    else newDate.setDate(newDate.getDate() + 1);
    return newDate;
  }), [viewMode]);

  const handleToday = useCallback(() => setCurrentDate(new Date()), []);

  const openBulkModal = useCallback((assignment: Assignment) => { setSelectedAssignment(assignment); setBulkFormData({ startDate: '', endDate: '', percentage: 50 }); setBulkModalOpen(true); }, []);
  const openNewAssignmentModal = useCallback((resourceId: string = '') => { setNewAssignmentData({ resourceId, projectIds: [] }); setAssignmentModalOpen(true); }, []);

  const handleBulkSubmit = (e: React.FormEvent) => { e.preventDefault(); if (selectedAssignment) { bulkUpdateAllocations(selectedAssignment.id!, bulkFormData.startDate, bulkFormData.endDate, bulkFormData.percentage); setBulkModalOpen(false); } };
  const handleNewAssignmentSubmit = (e: React.FormEvent) => { e.preventDefault(); if (newAssignmentData.resourceId && newAssignmentData.projectIds.length > 0) { const assignmentsToCreate = newAssignmentData.projectIds.map(projectId => ({ resourceId: newAssignmentData.resourceId, projectId })); addMultipleAssignments(assignmentsToCreate); setAssignmentModalOpen(false); } };
  
  const handleFilterChange = useCallback((name: string, value: string) => setFilters(prev => ({ ...prev, [name]: value })), []);
  const clearFilters = useCallback(() => setFilters({ resourceId: '', projectId: '', clientId: '', projectManager: '' }), []);

  const getResourceById = useCallback((id: string) => resources.find((r) => r.id === id), [resources]);
  const getProjectById = useCallback((id: string) => projectsById.get(id), [projectsById]);

  // --- Data Processing for Views ---
  const commonDataProcessing = useMemo(() => {
    const filteredAssignments = assignments.filter(a =>
      (!filters.projectId || a.projectId === filters.projectId) &&
      (!filters.clientId || projectsById.get(a.projectId)?.clientId === filters.clientId) &&
      (!filters.projectManager || projectsById.get(a.projectId)?.projectManager === filters.projectManager)
    );

    const assignmentsByResource = new Map<string, Assignment[]>();
    filteredAssignments.forEach(a => {
      if (!assignmentsByResource.has(a.resourceId)) assignmentsByResource.set(a.resourceId, []);
      assignmentsByResource.get(a.resourceId)!.push(a);
    });

    let visibleResources = resources.filter(r => !r.resigned);
    if (filters.resourceId) visibleResources = visibleResources.filter(r => r.id === filters.resourceId);
    if (filters.projectId || filters.clientId || filters.projectManager) {
        const resourceIdsFromAssignments = new Set(filteredAssignments.map(a => a.resourceId));
        visibleResources = visibleResources.filter(r => resourceIdsFromAssignments.has(r.id!));
    }
    // Filter resources with no assignments if a filter is active (except resource filter)
    if (filters.projectId || filters.clientId || filters.projectManager) {
         visibleResources = visibleResources.filter(r => assignmentsByResource.has(r.id!) && assignmentsByResource.get(r.id!)!.length > 0);
    }
    // Sort
    visibleResources.sort((a, b) => a.name.localeCompare(b.name));

    return { visibleResources, filteredAssignments, assignmentsByResource };
  }, [assignments, projectsById, resources, filters]);


  // --- Mobile Data Preparation ---
  const mobileDisplayData = useMemo<MobileRowData[]>(() => {
      if (!isMobile) return [];
      
      return commonDataProcessing.visibleResources.map(resource => {
          const resAssignments = commonDataProcessing.assignmentsByResource.get(resource.id!) || [];
          let totalLoadSum = 0;
          let workingDaysCount = 0;

          const assignmentsDetails = resAssignments.map(assignment => {
              let assignmentLoadSum = 0;
              timeColumns.forEach(col => {
                   if (!col.isNonWorkingDay && col.dateIso) {
                       assignmentLoadSum += allocations[assignment.id!]?.[col.dateIso] || 0;
                   }
              });
              const avgLoad = timeColumns.filter(c => !c.isNonWorkingDay).length > 0 
                ? assignmentLoadSum / timeColumns.filter(c => !c.isNonWorkingDay).length 
                : 0;
              
              const project = projectsById.get(assignment.projectId);
              const client = project && project.clientId ? clientsById.get(project.clientId) : undefined;

              return {
                  assignment,
                  projectName: project?.name || 'Unknown',
                  clientName: client?.name || 'Unknown',
                  avgLoad
              };
          });

          timeColumns.forEach(col => {
              if (!col.isNonWorkingDay && col.dateIso) {
                  workingDaysCount++;
                  resAssignments.forEach(a => {
                      totalLoadSum += allocations[a.id!]?.[col.dateIso] || 0;
                  });
              }
          });

          const totalAvgLoad = workingDaysCount > 0 ? totalLoadSum / workingDaysCount : 0;

          return {
              resource,
              roleName: rolesById.get(resource.roleId)?.name || '',
              totalLoad: totalAvgLoad,
              assignments: assignmentsDetails
          };
      });
  }, [isMobile, commonDataProcessing, timeColumns, allocations, projectsById, clientsById, rolesById]);


  // --- JSX ---

  const resourceOptions = useMemo(() => resources.filter((r) => !r.resigned).map((r) => ({ value: r.id!, label: r.name })), [resources]);
  const projectOptions = useMemo(() => projects.map((p) => ({ value: p.id!, label: p.name })), [projects]);
  const clientOptions = useMemo(() => clients.map((c) => ({ value: c.id!, label: c.name })), [clients]);
  const projectManagerOptions = useMemo(() => { const managers = [...new Set(projects.map((p) => p.projectManager).filter(Boolean) as string[])]; return managers.sort().map((pm) => ({ value: pm, label: pm })); }, [projects]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Controlli + Filtri */}
      <div className="flex-shrink-0 space-y-4 mb-4">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div className="flex items-center justify-center md:justify-start space-x-2">
              <button onClick={handlePrev} className="px-4 py-2 bg-surface border border-outline text-on-surface rounded-full shadow-sm hover:bg-surface-container-low text-sm">← Prec.</button>
              <button onClick={handleToday} className="px-4 py-2 bg-secondary-container text-on-secondary-container rounded-full shadow-sm font-semibold hover:opacity-90">Oggi</button>
              <button onClick={handleNext} className="px-4 py-2 bg-surface border border-outline text-on-surface rounded-full shadow-sm hover:bg-surface-container-low text-sm">Succ. →</button>
              {isMobile && <span className="ml-2 text-sm font-semibold text-on-surface">{viewMode === 'week' ? 'Settimana Corrente' : viewMode === 'day' ? 'Giorno' : 'Mese'}</span>}
          </div>
          
          {/* View Mode (Only mobile relevant for now as desktop is grid) */}
          {isMobile && (
             <div className="flex items-center justify-center md:justify-start space-x-1 bg-surface-container p-1 rounded-full">
                {(['day', 'week', 'month'] as ViewMode[]).map((level) => (
                    <button key={level} onClick={() => setViewMode(level)} className={`px-3 py-1 text-sm font-medium rounded-full capitalize ${viewMode === level ? 'bg-surface text-primary shadow' : 'text-on-surface-variant'}`}>
                        {level === 'day' ? 'Giorno' : level === 'week' ? 'Settimana' : 'Mese'}
                    </button>
                ))}
             </div>
          )}

          <button onClick={() => openNewAssignmentModal()} className="flex items-center justify-center w-full md:w-auto px-6 py-2 bg-primary text-on-primary font-semibold rounded-full shadow-sm"><span className="material-symbols-outlined mr-2 text-xl">add</span>Assegna Risorsa</button>
        </div>
        
        {/* Filters */}
        <div className="p-4 bg-surface rounded-2xl shadow">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                <div><label className="block text-sm font-medium text-on-surface-variant">Risorsa</label><SearchableSelect name="resourceId" value={filters.resourceId} onChange={handleFilterChange} options={resourceOptions} placeholder="Tutte le Risorse"/></div>
                {!isMobile && (
                    <>
                        <div><label className="block text-sm font-medium text-on-surface-variant">Cliente</label><SearchableSelect name="clientId" value={filters.clientId} onChange={handleFilterChange} options={clientOptions} placeholder="Tutti i Clienti"/></div>
                        <div><label className="block text-sm font-medium text-on-surface-variant">Project Manager</label><SearchableSelect name="projectManager" value={filters.projectManager} onChange={handleFilterChange} options={projectManagerOptions} placeholder="Tutti i PM"/></div>
                        <div><label className="block text-sm font-medium text-on-surface-variant">Progetto</label><SearchableSelect name="projectId" value={filters.projectId} onChange={handleFilterChange} options={projectOptions} placeholder="Tutti i Progetti"/></div>
                    </>
                )}
                <button onClick={clearFilters} className="px-6 py-2 bg-secondary-container text-on-secondary-container font-semibold rounded-full hover:opacity-90 w-full md:w-auto">Reset Filtri</button>
            </div>
        </div>
      </div>

      {/* MAIN CONTENT: RESPONSIVE SWITCH */}
      <div className="flex-grow overflow-hidden bg-surface rounded-2xl shadow border border-outline-variant relative">
          {isMobile ? (
              <div className="space-y-4 pb-20 p-4 h-full overflow-y-auto">
                  {mobileDisplayData.map(data => (
                      <MobileResourceCard key={data.resource.id} data={data} dates={timeColumns.map(c => ({ dateIso: c.dateIso || '', label: c.label, isNonWorkingDay: !!c.isNonWorkingDay }))} />
                  ))}
                  {mobileDisplayData.length === 0 && (
                      <div className="text-center p-10 text-on-surface-variant bg-surface rounded-2xl border border-dashed border-outline">
                          Nessuna risorsa da visualizzare.
                      </div>
                  )}
              </div>
          ) : (
             <VirtualStaffingGrid 
                 resources={commonDataProcessing.visibleResources}
                 timeColumns={timeColumns}
                 assignments={commonDataProcessing.filteredAssignments}
                 viewMode={viewMode}
                 projectsById={projectsById}
                 clientsById={clientsById}
                 rolesById={rolesById}
                 onAddAssignment={openNewAssignmentModal}
                 onBulkEdit={openBulkModal}
                 onDeleteAssignment={setAssignmentToDelete}
             />
          )}
      </div>

      {/* Modali Comuni */}
      {assignmentToDelete && <ConfirmationModal isOpen={!!assignmentToDelete} onClose={() => setAssignmentToDelete(null)} onConfirm={() => { if (assignmentToDelete) { deleteAssignment(assignmentToDelete.id!); setAssignmentToDelete(null); } }} title="Conferma Rimozione" message={<>Sei sicuro di voler rimuovere l'assegnazione di <strong>{getResourceById(assignmentToDelete.resourceId)?.name}</strong> dal progetto <strong>{getProjectById(assignmentToDelete.projectId)?.name}</strong>?</>} isConfirming={isActionLoading(`deleteAssignment-${assignmentToDelete.id}`)} />}
      
      <Modal isOpen={isBulkModalOpen} onClose={() => setBulkModalOpen(false)} title="Assegnazione Massiva">
          <form onSubmit={handleBulkSubmit}>
              <div className="space-y-4">
                  <div><label className="block text-sm font-medium text-on-surface-variant">Data Inizio</label><input type="date" required value={bulkFormData.startDate} onChange={(e) => setBulkFormData(f => ({ ...f, startDate: e.target.value }))} className="mt-1 block w-full form-input"/></div>
                  <div><label className="block text-sm font-medium text-on-surface-variant">Data Fine</label><input type="date" required value={bulkFormData.endDate} onChange={(e) => setBulkFormData(f => ({ ...f, endDate: e.target.value }))} className="mt-1 block w-full form-input"/></div>
                  <div><label className="block text-sm font-medium text-on-surface-variant">Percentuale ({bulkFormData.percentage}%)</label><input type="range" min="0" max="100" step="5" value={bulkFormData.percentage} onChange={(e) => setBulkFormData(f => ({ ...f, percentage: parseInt(e.target.value, 10) }))} className="mt-1 block w-full accent-primary"/></div>
              </div>
              <div className="mt-6 flex justify-end space-x-3 pt-4 border-t border-outline-variant">
                  <button type="button" onClick={() => setBulkModalOpen(false)} className="px-6 py-2 border border-outline rounded-full hover:bg-surface-container-low text-primary font-semibold">Annulla</button>
                  <button type="submit" className="px-6 py-2 bg-primary text-on-primary rounded-full font-semibold hover:opacity-90">Salva</button>
              </div>
          </form>
      </Modal>
      
      <Modal isOpen={isAssignmentModalOpen} onClose={() => setAssignmentModalOpen(false)} title="Assegna Risorsa a Progetto">
          <form onSubmit={handleNewAssignmentSubmit} className="flex flex-col h-96">
              <div className="space-y-4 flex-grow">
                  <div><label className="block text-sm font-medium text-on-surface-variant">Risorsa</label><SearchableSelect name="resourceId" value={newAssignmentData.resourceId} onChange={(name, value) => setNewAssignmentData(d => ({ ...d, [name]: value }))} options={resourceOptions} placeholder="Seleziona una risorsa" required/></div>
                  <div><label className="block text-sm font-medium text-on-surface-variant">Progetto/i</label><MultiSelectDropdown name="projectIds" selectedValues={newAssignmentData.projectIds} onChange={(name, values) => setNewAssignmentData(d => ({ ...d, [name]: values }))} options={projects.filter((p) => p.status !== 'Completato').map((p) => ({ value: p.id!, label: p.name }))} placeholder="Seleziona uno o più progetti"/></div>
              </div>
              <div className="mt-6 flex justify-end space-x-3 pt-4 border-t border-outline-variant">
                  <button type="button" onClick={() => setAssignmentModalOpen(false)} className="px-6 py-2 border border-outline rounded-full hover:bg-surface-container-low text-primary font-semibold">Annulla</button>
                  <button type="submit" className="px-6 py-2 bg-primary text-on-primary rounded-full font-semibold hover:opacity-90">Aggiungi</button>
              </div>
          </form>
      </Modal>
    </div>
  );
};

export default TestStaffingPage;