
/**
 * @file SkillsPage.tsx
 * @description Pagina per la gestione delle Competenze (Skills) - CRUD, Dashboard e Visualizzazione.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useEntitiesContext } from '../context/AppContext';
import { Skill, SKILL_LEVELS } from '../types';
import Modal from '../components/Modal';
import SearchableSelect from '../components/SearchableSelect';
import MultiSelectDropdown from '../components/MultiSelectDropdown';
import { SpinnerIcon } from '../components/icons';
import { DataTable, ColumnDef } from '../components/DataTable';
import ConfirmationModal from '../components/ConfirmationModal';
import { useToast } from '../context/ToastContext';
import { ExportButton } from '@/components/shared/ExportButton';
import { useSearchParams } from 'react-router-dom';

// --- Types ---
type EnrichedSkill = Skill & {
    resourceCount: number;
    projectCount: number;
    totalUsage: number;
};

const SkillsPage: React.FC = () => {
    const { 
        skills, 
        resources,
        resourceSkills, 
        projectSkills, 
        skillCategories,
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
    const [skillToDelete, setSkillToDelete] = useState<EnrichedSkill | null>(null);
    
    // Assignment Modal State
    const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
    const [assignmentData, setAssignmentData] = useState<{
        targetSkill: Skill | null; // Se presente, stiamo assegnando QUESTA skill specifica (da riga)
        selectedSkillIds: string[]; // Usato se targetSkill è null (assegnazione massiva)
        selectedResourceIds: string[];
        acquisitionDate: string;
        expirationDate: string;
        level: number;
    }>({
        targetSkill: null,
        selectedSkillIds: [],
        selectedResourceIds: [],
        acquisitionDate: '',
        expirationDate: '',
        level: 1
    });

    // Filter State
    const [filters, setFilters] = useState({ name: '', category: '', macroCategory: '', unusedOnly: false });
    const [searchParams, setSearchParams] = useSearchParams();

    const emptySkill: Omit<Skill, 'id'> = {
        name: '',
        categoryIds: [],
        isCertification: false
    };

    // Deep Linking
    useEffect(() => {
        const editId = searchParams.get('editId');
        if (editId && !isModalOpen && skills.length > 0) {
            const target = skills.find(s => s.id === editId);
            if (target) {
                handleOpenModal(target);
                setSearchParams({});
            }
        }
    }, [searchParams, setSearchParams, skills, isModalOpen]);

    // --- Data Processing ---

    const enrichedSkills = useMemo<EnrichedSkill[]>(() => {
        const skillsOnly = skills.filter(s => !s.isCertification);

        const resCountMap = new Map<string, number>();
        resourceSkills.forEach(rs => {
            resCountMap.set(rs.skillId, (resCountMap.get(rs.skillId) || 0) + 1);
        });

        const projCountMap = new Map<string, number>();
        projectSkills.forEach(ps => {
            projCountMap.set(ps.skillId, (projCountMap.get(ps.skillId) || 0) + 1);
        });

        return skillsOnly.map(skill => {
            const rCount = resCountMap.get(skill.id!) || 0;
            const pCount = projCountMap.get(skill.id!) || 0;
            return {
                ...skill,
                resourceCount: rCount,
                projectCount: pCount,
                totalUsage: rCount + pCount
            };
        });
    }, [skills, resourceSkills, projectSkills]);

    const kpis = useMemo(() => {
        const totalSkills = enrichedSkills.length;
        const usedCats = new Set();
        enrichedSkills.forEach(s => s.categoryIds?.forEach(id => usedCats.add(id)));
        const totalCategories = usedCats.size;

        const macroCounts: Record<string, number> = {};
        enrichedSkills.forEach(s => {
            if (s.macroCategory) {
                s.macroCategory.split(', ').forEach(m => {
                    macroCounts[m] = (macroCounts[m] || 0) + 1;
                });
            }
        });
        const topMacroEntry = Object.entries(macroCounts).sort((a, b) => b[1] - a[1])[0];
        const topMacroCategory = topMacroEntry ? `${topMacroEntry[0]} (${topMacroEntry[1]})` : 'N/A';
        const unusedSkills = enrichedSkills.filter(s => s.totalUsage === 0).length;

        return { totalSkills, totalCategories, topMacroCategory, unusedSkills };
    }, [enrichedSkills]);

    const filteredSkills = useMemo(() => {
        return enrichedSkills.filter(s => {
            const nameMatch = s.name.toLowerCase().includes(filters.name.toLowerCase());
            const catMatch = !filters.category || (s.category && s.category.includes(filters.category));
            const macroMatch = !filters.macroCategory || (s.macroCategory && s.macroCategory.includes(filters.macroCategory));
            const unusedMatch = !filters.unusedOnly || s.totalUsage === 0;
            return nameMatch && catMatch && macroMatch && unusedMatch;
        });
    }, [enrichedSkills, filters]);

    const exportData = useMemo(() => {
        return filteredSkills.map(s => ({
            'Competenza': s.name,
            'Ambito': s.category || '-',
            'Macro Ambito': s.macroCategory || '-',
            'Utilizzo Risorse': s.resourceCount,
            'Utilizzo Progetti': s.projectCount
        }));
    }, [filteredSkills]);

    const categoryOptions = useMemo(() => skillCategories.map(c => ({ value: c.id, label: c.name })).sort((a,b)=>a.label.localeCompare(b.label)), [skillCategories]);
    
    const categoryFilterOptions = useMemo(() => {
        const cats = Array.from(new Set(skills.filter(s => !s.isCertification).flatMap(s => s.category?.split(', ') || []).filter(Boolean)));
        return cats.sort().map(c => ({ value: c as string, label: c as string }));
    }, [skills]);

    const macroCategoryFilterOptions = useMemo(() => {
        const macros = Array.from(new Set(skills.filter(s => !s.isCertification).flatMap(s => s.macroCategory?.split(', ') || []).filter(Boolean)));
        return macros.sort().map(c => ({ value: c as string, label: c as string }));
    }, [skills]);

    const resourceOptions = useMemo(() => resources.filter(r => !r.resigned).map(r => ({ value: r.id!, label: r.name })), [resources]);
    
    const skillOptions = useMemo(() => skills.filter(s => !s.isCertification).map(s => ({ 
        value: s.id!, 
        label: `${s.name} (${s.category || 'N/A'})` 
    })), [skills]);

    // --- Handlers ---

    const handleOpenModal = (skill?: Skill) => {
        if (skill) {
            setEditingSkill({
                ...skill,
                categoryIds: skill.categoryIds || [],
                isCertification: false
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
                isCertification: false
            };

            if ('id' in editingSkill && editingSkill.id) {
                payload.id = editingSkill.id;
                await updateSkill(payload as Skill);
                addToast('Competenza aggiornata.', 'success');
            } else {
                await addSkill(payload as Omit<Skill, 'id'>);
                addToast('Competenza creata.', 'success');
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
        } catch (error) {}
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

    const openAssignmentModal = (skill: Skill | null = null) => {
        setAssignmentData({
            targetSkill: skill,
            selectedSkillIds: skill ? [skill.id!] : [],
            selectedResourceIds: [],
            acquisitionDate: '',
            expirationDate: '',
            level: 1
        });
        setIsAssignmentModalOpen(true);
    };

    const handleAssignmentSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const { selectedResourceIds, selectedSkillIds, acquisitionDate, expirationDate, level } = assignmentData;
        if (selectedResourceIds.length === 0 || selectedSkillIds.length === 0) {
            addToast('Seleziona almeno una risorsa e una competenza.', 'error');
            return;
        }
        try {
            const promises = [];
            for (const resourceId of selectedResourceIds) {
                for (const skillId of selectedSkillIds) {
                    promises.push(addResourceSkill({
                        resourceId,
                        skillId,
                        acquisitionDate: acquisitionDate || null,
                        expirationDate: expirationDate || null,
                        level
                    }));
                }
            }
            await Promise.all(promises);
            addToast(`${promises.length} associazioni salvate con successo.`, 'success');
            setIsAssignmentModalOpen(false);
        } catch (error) {
            addToast('Errore durante l\'assegnazione delle competenze.', 'error');
        }
    };

    // --- Render Helpers ---

    const columns: ColumnDef<EnrichedSkill>[] = [
        { header: 'Nome Competenza', sortKey: 'name', cell: s => (
            <div className="flex items-center gap-2 sticky left-0 bg-inherit pl-6">
                <span className="font-medium text-on-surface">{s.name}</span>
            </div>
        ) },
        { header: 'Ambiti', sortKey: 'category', cell: s => <span className="text-sm text-on-surface-variant">{s.category || '-'}</span> },
        { header: 'Macro Ambiti', sortKey: 'macroCategory', cell: s => <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-surface-variant text-on-surface-variant">{s.macroCategory || '-'}</span> },
        { header: 'Utilizzo Risorse', sortKey: 'resourceCount', cell: s => <span className="text-center block font-semibold">{s.resourceCount}</span> },
        { header: 'Utilizzo Progetti', sortKey: 'projectCount', cell: s => <span className="text-center block font-semibold">{s.projectCount}</span> },
    ];

    const renderRow = (skill: EnrichedSkill) => (
        <tr key={skill.id} className="hover:bg-surface-container group">
            {columns.map((col, i) => <td key={i} className="px-6 py-4 whitespace-nowrap text-sm text-on-surface-variant bg-inherit overflow-hidden text-ellipsis max-w-[200px]" title={String(col.sortKey ? (skill as any)[col.sortKey] : '')}>{col.cell(skill)}</td>)}
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

    const renderCard = (skill: EnrichedSkill) => (
        <div key={skill.id} className="bg-surface-container-low p-4 rounded-2xl shadow flex flex-col gap-3 border-l-4 border-primary">
            <div className="flex justify-between items-start">
                <div>
                    <div className="flex items-center gap-2">
                        <h3 className="font-bold text-lg text-on-surface">{skill.name}</h3>
                    </div>
                    <p className="text-xs text-on-surface-variant mt-1">{skill.category || 'Generica'}</p>
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
            <div className="grid grid-cols-2 gap-2 mt-2 border-t border-outline-variant pt-2 text-sm">
                <div className="text-center p-2 bg-surface rounded">
                    <div className="font-bold text-lg">{skill.resourceCount}</div>
                    <div className="text-xs text-on-surface-variant">Risorse</div>
                </div>
                <div className="text-center p-2 bg-surface rounded">
                    <div className="font-bold text-lg">{skill.projectCount}</div>
                    <div className="text-xs text-on-surface-variant">Progetti</div>
                </div>
            </div>
        </div>
    );

    const filtersNode = (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            <div className="md:col-span-3">
                <input type="text" placeholder="Cerca per nome..." className="form-input w-full" value={filters.name} onChange={e => setFilters(prev => ({ ...prev, name: e.target.value }))}/>
            </div>
            <div className="md:col-span-2">
                <SearchableSelect name="macroCategory" value={filters.macroCategory} onChange={(_, v) => setFilters(prev => ({ ...prev, macroCategory: v }))} options={macroCategoryFilterOptions} placeholder="Macro Ambito"/>
            </div>
            <div className="md:col-span-2">
                <SearchableSelect name="category" value={filters.category} onChange={(_, v) => setFilters(prev => ({ ...prev, category: v }))} options={categoryFilterOptions} placeholder="Ambito"/>
            </div>
            <div className="md:col-span-2">
                 <div className="flex items-center space-x-1 bg-surface-container p-1 rounded-full w-fit">
                    <button onClick={() => setView('table')} className={`px-3 py-1 text-sm font-medium rounded-full capitalize ${view === 'table' ? 'bg-surface text-primary shadow' : 'text-on-surface-variant'}`}>Tabella</button>
                    <button onClick={() => setView('card')} className={`px-3 py-1 text-sm font-medium rounded-full capitalize ${view === 'card' ? 'bg-surface text-primary shadow' : 'text-on-surface-variant'}`}>Card</button>
                </div>
            </div>
            <div className="md:col-span-3 flex gap-2 justify-end">
                 <button onClick={() => openAssignmentModal(null)} className="px-3 py-2 bg-secondary-container text-on-secondary-container font-semibold rounded-full shadow-sm hover:opacity-90 flex items-center gap-2" title="Assegnazione Massiva">
                    <span className="material-symbols-outlined text-lg">group_add</span>
                    <span className="hidden xl:inline text-sm">Assegna</span>
                </button>
                <button onClick={() => setFilters({ name: '', category: '', macroCategory: '', unusedOnly: false })} className="px-4 py-2 bg-secondary-container text-on-secondary-container rounded-full hover:opacity-90 w-full">Reset</button>
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-surface-container-low p-5 rounded-2xl shadow border-l-4 border-primary">
                    <p className="text-sm text-on-surface-variant">Totale Skills</p>
                    <p className="text-3xl font-bold text-on-surface">{kpis.totalSkills}</p>
                </div>
                <div className="bg-surface-container-low p-5 rounded-2xl shadow border-l-4 border-tertiary">
                    <p className="text-sm text-on-surface-variant">Top Macro Ambito</p>
                    <p className="text-xl font-bold text-on-surface truncate" title={kpis.topMacroCategory}>{kpis.topMacroCategory}</p>
                </div>
                <div className={`bg-surface-container-low p-5 rounded-2xl shadow border-l-4 border-error cursor-pointer hover:shadow-lg transition-all ${filters.unusedOnly ? 'ring-2 ring-error' : ''}`} onClick={() => setFilters(prev => ({ ...prev, unusedOnly: !prev.unusedOnly }))}>
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm text-on-surface-variant">Inutilizzate</p>
                            <p className="text-3xl font-bold text-on-surface">{kpis.unusedSkills}</p>
                        </div>
                        {filters.unusedOnly && <span className="material-symbols-outlined text-error">filter_alt</span>}
                    </div>
                </div>
            </div>

             {view === 'table' ? (
                 <DataTable<EnrichedSkill>
                    title="Gestione Competenze"
                    addNewButtonLabel="Nuova Competenza"
                    data={filteredSkills}
                    columns={columns}
                    filtersNode={filtersNode}
                    onAddNew={() => handleOpenModal()}
                    renderRow={renderRow}
                    renderMobileCard={renderCard}
                    headerActions={<ExportButton data={exportData} title="Gestione Competenze" />}
                    initialSortKey="name"
                    isLoading={loading}
                    tableLayout={{ dense: true, striped: true, headerSticky: true }}
                    numActions={3}
                />
            ) : (
                <>
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                        <h1 className="text-3xl font-bold text-on-surface">Gestione Competenze</h1>
                        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                            <button onClick={() => handleOpenModal()} className="flex-grow md:flex-grow-0 px-4 py-2 bg-primary text-on-primary font-semibold rounded-full shadow-sm hover:opacity-90">Nuova Competenza</button>
                            <ExportButton data={exportData} title="Gestione Competenze" />
                        </div>
                    </div>
                    <div className="bg-surface rounded-2xl shadow p-4">{filtersNode}</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filteredSkills.map(renderCard)}
                        {filteredSkills.length === 0 && <p className="col-span-full text-center py-8 text-on-surface-variant">Nessuna skill trovata.</p>}
                    </div>
                </>
            )}

            {isModalOpen && editingSkill && (
                <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={'id' in editingSkill ? 'Modifica Competenza' : 'Nuova Competenza'}>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant">
                            <h4 className="text-sm font-bold text-primary mb-4 uppercase tracking-wider flex items-center gap-2">
                                <span className="material-symbols-outlined text-lg">school</span> Info Base
                            </h4>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-on-surface-variant">Nome Competenza *</label>
                                    <input type="text" name="name" value={editingSkill.name} onChange={handleInputChange} required className="form-input" placeholder="es. React, Node.js..."/>
                                </div>
                            </div>
                        </div>
                        
                        <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant">
                            <h4 className="text-sm font-bold text-primary mb-4 uppercase tracking-wider flex items-center gap-2">
                                <span className="material-symbols-outlined text-lg">category</span> Classificazione
                            </h4>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-on-surface-variant">Ambiti (Categorie)</label>
                                    <MultiSelectDropdown name="categoryIds" selectedValues={editingSkill.categoryIds || []} onChange={handleCategoryChange} options={categoryOptions} placeholder="Seleziona Ambiti..."/>
                                </div>
                            </div>
                        </div>

                         <div className="flex justify-end space-x-3 pt-4 border-t border-outline-variant mt-4">
                            <button type="button" onClick={handleCloseModal} className="px-6 py-2 border border-outline rounded-full hover:bg-surface-container-low text-primary font-semibold transition-colors">Annulla</button>
                            <button type="submit" disabled={isActionLoading('addSkill') || isActionLoading(`updateSkill-${'id' in editingSkill ? editingSkill.id : ''}`)} className="flex justify-center items-center px-6 py-2 bg-primary text-on-primary rounded-full disabled:opacity-50 font-semibold hover:opacity-90 shadow-sm transition-all">
                                {(isActionLoading('addSkill') || isActionLoading(`updateSkill-${'id' in editingSkill ? editingSkill.id : ''}`)) ? <SpinnerIcon className="w-5 h-5"/> : 'Salva'}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
            
            {isAssignmentModalOpen && (
                <Modal isOpen={isAssignmentModalOpen} onClose={() => setIsAssignmentModalOpen(false)} title={assignmentData.targetSkill ? `Assegna ${assignmentData.targetSkill.name}` : 'Assegnazione Competenze Massiva'}>
                    <form onSubmit={handleAssignmentSubmit} className="space-y-6 flex flex-col h-[70vh]">
                        <div className="flex-grow space-y-6 overflow-y-auto px-1">
                             {!assignmentData.targetSkill && (
                                <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant">
                                    <h4 className="text-sm font-bold text-primary mb-4 uppercase tracking-wider flex items-center gap-2">
                                        <span className="material-symbols-outlined text-lg">list_alt</span> Competenze
                                    </h4>
                                    <MultiSelectDropdown name="selectedSkillIds" selectedValues={assignmentData.selectedSkillIds} onChange={(_, v) => setAssignmentData(prev => ({ ...prev, selectedSkillIds: v }))} options={skillOptions} placeholder="Seleziona skills..."/>
                                </div>
                            )}
                            
                            <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant">
                                <h4 className="text-sm font-bold text-primary mb-4 uppercase tracking-wider flex items-center gap-2">
                                    <span className="material-symbols-outlined text-lg">group_add</span> Risorse
                                </h4>
                                <MultiSelectDropdown name="selectedResourceIds" selectedValues={assignmentData.selectedResourceIds} onChange={(_, v) => setAssignmentData(prev => ({ ...prev, selectedResourceIds: v }))} options={resourceOptions} placeholder="Seleziona risorse..."/>
                            </div>

                            <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant">
                                <h4 className="text-sm font-bold text-primary mb-4 uppercase tracking-wider flex items-center gap-2">
                                    <span className="material-symbols-outlined text-lg">tune</span> Dettagli Assegnazione
                                </h4>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1 text-on-surface-variant">Livello Competenza</label>
                                        <select className="form-select" value={assignmentData.level} onChange={(e) => setAssignmentData(prev => ({ ...prev, level: parseInt(e.target.value, 10) }))}>
                                            {Object.entries(SKILL_LEVELS).map(([val, label]) => (<option key={val} value={val}>{label}</option>))}
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium mb-1 text-on-surface-variant">Data Conseguimento</label>
                                            <input type="date" className="form-input" value={assignmentData.acquisitionDate} onChange={e => setAssignmentData(prev => ({ ...prev, acquisitionDate: e.target.value }))}/>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1 text-on-surface-variant">Data Scadenza</label>
                                            <input type="date" className="form-input" value={assignmentData.expirationDate} onChange={e => setAssignmentData(prev => ({ ...prev, expirationDate: e.target.value }))}/>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end space-x-3 pt-4 border-t border-outline-variant mt-auto">
                             <button type="button" onClick={() => setIsAssignmentModalOpen(false)} className="px-6 py-2 border border-outline rounded-full hover:bg-surface-container-low text-primary font-semibold transition-colors">Annulla</button>
                            <button type="submit" disabled={assignmentData.selectedResourceIds.length === 0 || assignmentData.selectedSkillIds.length === 0} className="flex justify-center items-center px-6 py-2 bg-primary text-on-primary rounded-full font-semibold hover:opacity-90 shadow-sm transition-all">Assegna</button>
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
                    message={<>Sei sicuro di voler eliminare <strong>{skillToDelete.name}</strong>?<br/><span className="text-error text-sm">Verrà rimossa da {skillToDelete.resourceCount} risorse e {skillToDelete.projectCount} progetti.</span></>}
                    isConfirming={isActionLoading(`deleteSkill-${skillToDelete.id}`)}
                />
            )}
        </div>
    );
};

export default SkillsPage;
