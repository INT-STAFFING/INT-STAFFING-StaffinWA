
/**
 * @file CertificationsPage.tsx
 * @description Pagina dedicata alla gestione delle Certificazioni (Skills con isCertification=true).
 */

import React, { useState, useMemo } from 'react';
import { useEntitiesContext } from '../context/AppContext';
import { Skill, SKILL_LEVELS } from '../types';
import Modal from '../components/Modal';
import SearchableSelect from '../components/SearchableSelect';
import MultiSelectDropdown from '../components/MultiSelectDropdown';
import { SpinnerIcon } from '../components/icons';
import { DataTable, ColumnDef } from '../components/DataTable';
import ConfirmationModal from '../components/ConfirmationModal';
import { useToast } from '../context/ToastContext';

// --- Types ---
type EnrichedCertification = Skill & {
    resourceCount: number;
    projectCount: number;
    expiringCount: number; // Numero di risorse con questa cert in scadenza
};

const isExpiringSoon = (dateStr?: string | null): boolean => {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    const today = new Date();
    const diffTime = date.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 90;
};

const CertificationsPage: React.FC = () => {
    const { 
        skills, 
        resources,
        resourceSkills, 
        projectSkills, 
        skillCategories,
        skillMacroCategories,
        addSkill, 
        updateSkill, 
        deleteSkill, 
        addResourceSkill,
        isActionLoading, 
        loading 
    } = useEntitiesContext();

    const { addToast } = useToast();

    // UI State
    const [view, setView] = useState<'table' | 'card'>('table');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSkill, setEditingSkill] = useState<Skill | Omit<Skill, 'id'> | null>(null);
    const [skillToDelete, setSkillToDelete] = useState<EnrichedCertification | null>(null);
    
    // Assignment Modal State
    const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
    const [assignmentData, setAssignmentData] = useState<{
        targetSkill: Skill | null;
        selectedResourceIds: string[];
        acquisitionDate: string;
        expirationDate: string;
        level: number;
    }>({
        targetSkill: null,
        selectedResourceIds: [],
        acquisitionDate: '',
        expirationDate: '',
        level: 1
    });

    // Filter State
    const [filters, setFilters] = useState({ name: '', categoryId: '', macroCategoryId: '' });

    const emptySkill: Omit<Skill, 'id'> = {
        name: '',
        categoryIds: [],
        isCertification: true // Always true for this page
    };

    // --- Data Processing ---

    const enrichedCertifications = useMemo<EnrichedCertification[]>(() => {
        // Filter only certifications
        const certsOnly = skills.filter(s => s.isCertification);

        const resCountMap = new Map<string, number>();
        const expiringMap = new Map<string, number>();

        resourceSkills.forEach(rs => {
            resCountMap.set(rs.skillId, (resCountMap.get(rs.skillId) || 0) + 1);
            if (isExpiringSoon(rs.expirationDate)) {
                expiringMap.set(rs.skillId, (expiringMap.get(rs.skillId) || 0) + 1);
            }
        });

        const projCountMap = new Map<string, number>();
        projectSkills.forEach(ps => {
            projCountMap.set(ps.skillId, (projCountMap.get(ps.skillId) || 0) + 1);
        });

        return certsOnly.map(skill => {
            const rCount = resCountMap.get(skill.id!) || 0;
            const pCount = projCountMap.get(skill.id!) || 0;
            const eCount = expiringMap.get(skill.id!) || 0;
            return {
                ...skill,
                resourceCount: rCount,
                projectCount: pCount,
                expiringCount: eCount
            };
        });
    }, [skills, resourceSkills, projectSkills]);

    const kpis = useMemo(() => {
        const totalTypes = enrichedCertifications.length;
        const totalAssigned = enrichedCertifications.reduce((acc, curr) => acc + curr.resourceCount, 0);
        const totalExpiring = enrichedCertifications.reduce((acc, curr) => acc + curr.expiringCount, 0);
        
        // Most popular Macro Category for Certs
        const macroCounts: Record<string, number> = {};
        enrichedCertifications.forEach(s => {
            if (s.macroCategory) {
                s.macroCategory.split(', ').forEach(m => {
                    macroCounts[m] = (macroCounts[m] || 0) + 1;
                });
            }
        });
        const topMacroEntry = Object.entries(macroCounts).sort((a, b) => b[1] - a[1])[0];
        const topMacroCategory = topMacroEntry ? `${topMacroEntry[0]}` : 'N/A';

        return { totalTypes, totalAssigned, totalExpiring, topMacroCategory };
    }, [enrichedCertifications]);

    const filteredData = useMemo(() => {
        return enrichedCertifications.filter(s => {
            const nameMatch = s.name.toLowerCase().includes(filters.name.toLowerCase());
            
            // Advanced Filtering using IDs
            const matchesCategory = !filters.categoryId || s.categoryIds?.includes(filters.categoryId);
            
            const matchesMacro = !filters.macroCategoryId || (s.categoryIds && s.categoryIds.some(catId => {
                const cat = skillCategories.find(c => c.id === catId);
                return cat?.macroCategoryIds?.includes(filters.macroCategoryId);
            }));

            return nameMatch && matchesCategory && matchesMacro;
        });
    }, [enrichedCertifications, filters, skillCategories]);

    const categoryOptions = useMemo(() => skillCategories.map(c => ({ value: c.id, label: c.name })).sort((a,b)=>a.label.localeCompare(b.label)), [skillCategories]);
    const macroCategoryOptions = useMemo(() => skillMacroCategories.map(m => ({ value: m.id, label: m.name })).sort((a,b)=>a.label.localeCompare(b.label)), [skillMacroCategories]);
    const resourceOptions = useMemo(() => resources.filter(r => !r.resigned).map(r => ({ value: r.id!, label: r.name })), [resources]);

    // --- Handlers ---

    const handleOpenModal = (skill?: Skill) => {
        if (skill) {
            setEditingSkill({
                ...skill,
                categoryIds: skill.categoryIds || [],
                isCertification: true
            });
        } else {
            setEditingSkill(emptySkill);
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setEditingSkill(null);
        setIsModalOpen(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingSkill) return;

        try {
            const payload: any = {
                name: editingSkill.name,
                categoryIds: editingSkill.categoryIds,
                isCertification: true // Force true
            };

            if ('id' in editingSkill && editingSkill.id) {
                payload.id = editingSkill.id;
                await updateSkill(payload as Skill);
                addToast('Certificazione aggiornata.', 'success');
            } else {
                await addSkill(payload as Omit<Skill, 'id'>);
                addToast('Certificazione creata.', 'success');
            }
            handleCloseModal();
        } catch (error) {
            addToast('Errore durante il salvataggio.', 'error');
        }
    };

    const handleDelete = async () => {
        if (!skillToDelete) return;
        try {
            await deleteSkill(skillToDelete.id!);
            setSkillToDelete(null);
        } catch (error) {
            // Error handled by context toast
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!editingSkill) return;
        const { name, value } = e.target;
        setEditingSkill({ ...editingSkill, [name]: value });
    };

    const handleCategoryChange = (name: string, selectedIds: string[]) => {
        if (!editingSkill) return;
        setEditingSkill({ ...editingSkill, categoryIds: selectedIds });
    };

    // --- Assignment Handlers ---

    const openAssignmentModal = (skill: Skill) => {
        setAssignmentData({
            targetSkill: skill,
            selectedResourceIds: [],
            acquisitionDate: '',
            expirationDate: '',
            level: 1
        });
        setIsAssignmentModalOpen(true);
    };

    const handleAssignmentSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const { selectedResourceIds, targetSkill, acquisitionDate, expirationDate, level } = assignmentData;

        if (!targetSkill || selectedResourceIds.length === 0) {
            addToast('Seleziona almeno una risorsa.', 'error');
            return;
        }

        try {
            const promises = selectedResourceIds.map(resourceId => 
                addResourceSkill({
                    resourceId,
                    skillId: targetSkill.id!,
                    acquisitionDate: acquisitionDate || null,
                    expirationDate: expirationDate || null,
                    level
                })
            );
            
            await Promise.all(promises);
            addToast(`${promises.length} certificazioni assegnate con successo.`, 'success');
            setIsAssignmentModalOpen(false);
        } catch (error) {
            addToast('Errore durante l\'assegnazione.', 'error');
        }
    };

    // --- Render Helpers ---

    const columns: ColumnDef<EnrichedCertification>[] = [
        { header: 'Nome Certificazione', sortKey: 'name', cell: s => (
            <div className="flex items-center gap-2 sticky left-0 bg-inherit pl-6">
                <span className="material-symbols-outlined text-yellow-600 text-sm">verified</span>
                <span className="font-medium text-on-surface">{s.name}</span>
            </div>
        ) },
        { header: 'Macro Area', sortKey: 'macroCategory', cell: s => <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-surface-variant text-on-surface-variant">{s.macroCategory || '-'}</span> },
        { header: 'Ambito Specifico', sortKey: 'category', cell: s => <span className="text-sm text-on-surface-variant">{s.category || '-'}</span> },
        { header: 'Risorse Certificate', sortKey: 'resourceCount', cell: s => (
            <div className="flex items-center gap-2">
                <span className="font-semibold">{s.resourceCount}</span>
                {s.expiringCount > 0 && (
                    <span className="text-xs bg-error-container text-on-error-container px-2 py-0.5 rounded flex items-center gap-1" title="In scadenza">
                        <span className="material-symbols-outlined text-[10px]">warning</span> {s.expiringCount}
                    </span>
                )}
            </div>
        ) },
    ];

    const renderRow = (skill: EnrichedCertification) => (
        <tr key={skill.id} className="hover:bg-surface-container group">
            {columns.map((col, i) => <td key={i} className="px-6 py-4 whitespace-nowrap text-sm text-on-surface-variant bg-inherit overflow-hidden text-ellipsis max-w-[200px]">{col.cell(skill)}</td>)}
            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium bg-inherit">
                <div className="flex items-center justify-end space-x-2">
                    <button onClick={() => openAssignmentModal(skill)} className="p-2 rounded-full hover:bg-surface-container text-on-surface-variant hover:text-tertiary" title="Assegna a Risorse">
                        <span className="material-symbols-outlined">person_add</span>
                    </button>
                    <button onClick={() => handleOpenModal(skill)} className="p-2 rounded-full hover:bg-surface-container text-on-surface-variant hover:text-primary" title="Modifica">
                        <span className="material-symbols-outlined">edit</span>
                    </button>
                    <button onClick={() => setSkillToDelete(skill)} className="p-2 rounded-full hover:bg-surface-container text-on-surface-variant hover:text-error" title="Elimina">
                        {isActionLoading(`deleteSkill-${skill.id}`) ? <SpinnerIcon className="w-5 h-5"/> : <span className="material-symbols-outlined">delete</span>}
                    </button>
                </div>
            </td>
        </tr>
    );

    const renderCard = (skill: EnrichedCertification) => (
        <div key={skill.id} className="bg-surface-container-low p-4 rounded-2xl shadow flex flex-col gap-3 border-l-4 border-yellow-500">
            <div className="flex justify-between items-start">
                <div>
                    <div className="flex items-center gap-2">
                        <h3 className="font-bold text-lg text-on-surface">{skill.name}</h3>
                        <span className="material-symbols-outlined text-yellow-600 text-sm">verified</span>
                    </div>
                    <p className="text-xs text-on-surface-variant mt-1">{skill.macroCategory || 'Generica'}</p>
                </div>
                <div className="flex gap-1">
                     <button onClick={() => openAssignmentModal(skill)} className="p-2 rounded-full hover:bg-surface-container text-tertiary">
                        <span className="material-symbols-outlined">person_add</span>
                    </button>
                    <button onClick={() => handleOpenModal(skill)} className="p-2 rounded-full hover:bg-surface-container text-primary">
                        <span className="material-symbols-outlined">edit</span>
                    </button>
                    <button onClick={() => setSkillToDelete(skill)} className="p-2 rounded-full hover:bg-surface-container text-error">
                        <span className="material-symbols-outlined">delete</span>
                    </button>
                </div>
            </div>
            <div className="flex justify-between items-center mt-2 border-t border-outline-variant pt-2 text-sm">
                <span className="text-on-surface-variant">{skill.category}</span>
                <div className="flex items-center gap-2">
                    <span className="font-bold">{skill.resourceCount}</span> Risorse
                    {skill.expiringCount > 0 && <span className="text-error text-xs">({skill.expiringCount} scad.)</span>}
                </div>
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
             <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h1 className="text-3xl font-bold text-on-surface">Gestione Certificazioni</h1>
                <div className="flex items-center gap-4 w-full md:w-auto">
                     <div className="flex items-center space-x-1 bg-surface-container p-1 rounded-full">
                        <button onClick={() => setView('table')} className={`px-3 py-1 text-sm font-medium rounded-full capitalize ${view === 'table' ? 'bg-surface text-primary shadow' : 'text-on-surface-variant'}`}>Tabella</button>
                        <button onClick={() => setView('card')} className={`px-3 py-1 text-sm font-medium rounded-full capitalize ${view === 'card' ? 'bg-surface text-primary shadow' : 'text-on-surface-variant'}`}>Card</button>
                    </div>
                    <button onClick={() => handleOpenModal()} className="flex-grow md:flex-grow-0 px-4 py-2 bg-primary text-on-primary font-semibold rounded-full shadow-sm hover:opacity-90 flex items-center gap-2">
                        <span className="material-symbols-outlined">add_verified</span> Nuova Certificazione
                    </button>
                </div>
            </div>

            {/* Dashboard Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-surface-container-low p-5 rounded-2xl shadow border-l-4 border-primary">
                    <p className="text-sm text-on-surface-variant">Tipi di Certificazione</p>
                    <p className="text-3xl font-bold text-on-surface">{kpis.totalTypes}</p>
                </div>
                <div className="bg-surface-container-low p-5 rounded-2xl shadow border-l-4 border-yellow-500">
                    <p className="text-sm text-on-surface-variant">Assegnazioni Totali</p>
                    <p className="text-3xl font-bold text-on-surface">{kpis.totalAssigned}</p>
                </div>
                <div className="bg-surface-container-low p-5 rounded-2xl shadow border-l-4 border-error">
                    <p className="text-sm text-on-surface-variant">In Scadenza (90gg)</p>
                    <p className="text-3xl font-bold text-on-surface">{kpis.totalExpiring}</p>
                </div>
                <div className="bg-surface-container-low p-5 rounded-2xl shadow border-l-4 border-tertiary">
                    <p className="text-sm text-on-surface-variant">Macro Area Top</p>
                    <p className="text-xl font-bold text-on-surface truncate" title={kpis.topMacroCategory}>{kpis.topMacroCategory}</p>
                </div>
            </div>

            {/* Filters */}
             <div className="bg-surface rounded-2xl shadow p-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <input 
                        type="text" 
                        placeholder="Cerca per nome..." 
                        className="form-input"
                        value={filters.name}
                        onChange={e => setFilters(prev => ({ ...prev, name: e.target.value }))}
                    />
                    <SearchableSelect 
                        name="macroCategory" 
                        value={filters.macroCategoryId} 
                        onChange={(_, v) => setFilters(prev => ({ ...prev, macroCategoryId: v }))} 
                        options={macroCategoryOptions} 
                        placeholder="Macro Area"
                    />
                    <SearchableSelect 
                        name="category" 
                        value={filters.categoryId} 
                        onChange={(_, v) => setFilters(prev => ({ ...prev, categoryId: v }))} 
                        options={categoryOptions} 
                        placeholder="Ambito Specifico"
                    />
                    <button onClick={() => setFilters({ name: '', categoryId: '', macroCategoryId: '' })} className="px-4 py-2 bg-secondary-container text-on-secondary-container rounded-full hover:opacity-90 w-full">
                        Reset
                    </button>
                </div>
            </div>

            {/* Content */}
             {view === 'table' ? (
                 <DataTable<EnrichedCertification>
                    title=""
                    addNewButtonLabel=""
                    data={filteredData}
                    columns={columns}
                    filtersNode={<></>}
                    onAddNew={() => {}}
                    renderRow={renderRow}
                    renderMobileCard={renderCard}
                    initialSortKey="name"
                    isLoading={loading}
                    tableLayout={{ dense: true, striped: true, headerSticky: true }}
                    numActions={3}
                />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredData.map(renderCard)}
                    {filteredData.length === 0 && <p className="col-span-full text-center py-8 text-on-surface-variant">Nessuna certificazione trovata.</p>}
                </div>
            )}

            {/* Add/Edit Modal */}
            {isModalOpen && editingSkill && (
                <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={'id' in editingSkill ? 'Modifica Certificazione' : 'Nuova Certificazione'}>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1 text-on-surface-variant">Nome Certificazione *</label>
                            <input 
                                type="text" 
                                name="name" 
                                value={editingSkill.name} 
                                onChange={handleInputChange} 
                                required 
                                className="form-input"
                                placeholder="es. AWS Solutions Architect..."
                            />
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium mb-1 text-on-surface-variant">Ambiti / Categorie</label>
                            <MultiSelectDropdown 
                                name="categoryIds" 
                                selectedValues={editingSkill.categoryIds || []} 
                                onChange={handleCategoryChange} 
                                options={categoryOptions} 
                                placeholder="Seleziona Ambiti..."
                            />
                        </div>

                        {/* Hidden field note: isCertification is implicitly true */}
                        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800 flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm">info</span>
                            Questo elemento verrà salvato automaticamente come Certificazione.
                        </div>

                         <div className="flex justify-end space-x-3 pt-4">
                            <button type="button" onClick={handleCloseModal} className="px-6 py-2 border border-outline rounded-full hover:bg-surface-container-low text-primary font-semibold">
                                Annulla
                            </button>
                            <button
                                type="submit"
                                disabled={isActionLoading('addSkill') || isActionLoading(`updateSkill-${'id' in editingSkill ? editingSkill.id : ''}`)}
                                className="flex justify-center items-center px-6 py-2 bg-primary text-on-primary font-semibold rounded-full hover:opacity-90 disabled:opacity-50"
                            >
                                {isActionLoading('addSkill') || isActionLoading(`updateSkill-${'id' in editingSkill ? editingSkill.id : ''}`) ? (
                                <SpinnerIcon className="w-5 h-5" />
                                ) : (
                                'Salva'
                                )}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
            
            {/* Assignment Modal */}
            {isAssignmentModalOpen && assignmentData.targetSkill && (
                <Modal isOpen={isAssignmentModalOpen} onClose={() => setIsAssignmentModalOpen(false)} title={`Assegna ${assignmentData.targetSkill.name}`}>
                    <form onSubmit={handleAssignmentSubmit} className="space-y-4 flex flex-col h-[60vh]">
                        <div className="flex-grow space-y-4 overflow-y-auto p-1">
                            <div>
                                <label className="block text-sm font-medium mb-1 text-on-surface-variant">Risorse Destinatarie</label>
                                <MultiSelectDropdown 
                                    name="selectedResourceIds" 
                                    selectedValues={assignmentData.selectedResourceIds} 
                                    onChange={(_, v) => setAssignmentData(prev => ({ ...prev, selectedResourceIds: v }))} 
                                    options={resourceOptions} 
                                    placeholder="Seleziona una o più risorse..."
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-on-surface-variant">Data Conseguimento</label>
                                    <input 
                                        type="date" 
                                        className="form-input"
                                        value={assignmentData.acquisitionDate}
                                        onChange={e => setAssignmentData(prev => ({ ...prev, acquisitionDate: e.target.value }))}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-on-surface-variant">Data Scadenza</label>
                                    <input 
                                        type="date" 
                                        className="form-input"
                                        value={assignmentData.expirationDate}
                                        onChange={e => setAssignmentData(prev => ({ ...prev, expirationDate: e.target.value }))}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end space-x-3 pt-4 flex-shrink-0">
                             <button type="button" onClick={() => setIsAssignmentModalOpen(false)} className="px-6 py-2 border border-outline rounded-full hover:bg-surface-container-low text-primary font-semibold">
                                Annulla
                            </button>
                            <button
                                type="submit"
                                disabled={assignmentData.selectedResourceIds.length === 0}
                                className="flex justify-center items-center px-6 py-2 bg-primary text-on-primary font-semibold rounded-full hover:opacity-90 disabled:opacity-50"
                            >
                                Assegna
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            {skillToDelete && (
                <ConfirmationModal
                    isOpen={!!skillToDelete}
                    onClose={() => setSkillToDelete(null)}
                    onConfirm={handleDelete}
                    title="Conferma Eliminazione"
                    message={
                        <>
                            Sei sicuro di voler eliminare la certificazione <strong>{skillToDelete.name}</strong>?
                            <br/>
                            <span className="text-error text-sm">Verrà rimossa da {skillToDelete.resourceCount} risorse.</span>
                        </>
                    }
                    isConfirming={isActionLoading(`deleteSkill-${skillToDelete.id}`)}
                />
            )}
        </div>
    );
};

export default CertificationsPage;
