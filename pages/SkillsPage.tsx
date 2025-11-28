

/**
 * @file SkillsPage.tsx
 * @description Pagina per la gestione delle Competenze (Skills) - CRUD, Dashboard e Visualizzazione.
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
type EnrichedSkill = Skill & {
    resourceCount: number;
    projectCount: number;
    totalUsage: number;
    // Aggregation support
    ids: string[];
    isAggregated: boolean;
};

const SkillsPage: React.FC = () => {
    const { 
        skills, 
        resources,
        resourceSkills, 
        projectSkills, 
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
        targetSkill: Skill | null; 
        selectedSkillIds: string[]; 
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
    const [filters, setFilters] = useState({ name: '', category: '', macroCategory: '', isCertification: '', unusedOnly: false });

    const emptySkill: Omit<Skill, 'id'> = {
        name: '',
        category: '',
        macroCategory: '',
        isCertification: false
    };

    // --- Data Processing ---

    // Aggregate skills by Name + Category + Macro
    const aggregatedSkills = useMemo<EnrichedSkill[]>(() => {
        const resCountMap = new Map<string, number>();
        resourceSkills.forEach(rs => {
            resCountMap.set(rs.skillId, (resCountMap.get(rs.skillId) || 0) + 1);
        });

        const projCountMap = new Map<string, number>();
        projectSkills.forEach(ps => {
            projCountMap.set(ps.skillId, (projCountMap.get(ps.skillId) || 0) + 1);
        });

        const groupMap = new Map<string, EnrichedSkill>();

        skills.forEach(skill => {
            const rCount = resCountMap.get(skill.id!) || 0;
            const pCount = projCountMap.get(skill.id!) || 0;
            
            // Create a composite key to group duplicates
            const key = `${skill.name.trim().toLowerCase()}|${(skill.category || '').trim().toLowerCase()}|${(skill.macroCategory || '').trim().toLowerCase()}`;
            
            if (groupMap.has(key)) {
                const existing = groupMap.get(key)!;
                existing.resourceCount += rCount;
                existing.projectCount += pCount;
                existing.totalUsage += (rCount + pCount);
                if (skill.id) existing.ids.push(skill.id);
                existing.isAggregated = true;
            } else {
                groupMap.set(key, {
                    ...skill,
                    resourceCount: rCount,
                    projectCount: pCount,
                    totalUsage: rCount + pCount,
                    ids: skill.id ? [skill.id] : [],
                    isAggregated: false
                });
            }
        });

        return Array.from(groupMap.values());
    }, [skills, resourceSkills, projectSkills]);

    const kpis = useMemo(() => {
        const totalSkills = aggregatedSkills.length;
        
        const categories = new Set(aggregatedSkills.map(s => s.category).filter(Boolean));
        const totalCategories = categories.size;

        const macroCounts: Record<string, number> = {};
        let totalCerts = 0;

        aggregatedSkills.forEach(s => {
            if (s.macroCategory) macroCounts[s.macroCategory] = (macroCounts[s.macroCategory] || 0) + 1;
            if (s.isCertification) totalCerts++;
        });
        const topMacroEntry = Object.entries(macroCounts).sort((a, b) => b[1] - a[1])[0];
        const topMacroCategory = topMacroEntry ? `${topMacroEntry[0]} (${topMacroEntry[1]})` : 'N/A';

        const unusedSkills = aggregatedSkills.filter(s => s.totalUsage === 0).length;

        return { totalSkills, totalCategories, topMacroCategory, unusedSkills, totalCerts };
    }, [aggregatedSkills]);

    const filteredSkills = useMemo(() => {
        return aggregatedSkills.filter(s => {
            const nameMatch = s.name.toLowerCase().includes(filters.name.toLowerCase());
            const catMatch = !filters.category || s.category === filters.category;
            const macroMatch = !filters.macroCategory || s.macroCategory === filters.macroCategory;
            const certMatch = filters.isCertification === '' ? true : 
                              filters.isCertification === 'yes' ? s.isCertification : !s.isCertification;
            
            const unusedMatch = !filters.unusedOnly || s.totalUsage === 0;
            
            return nameMatch && catMatch && macroMatch && certMatch && unusedMatch;
        });
    }, [aggregatedSkills, filters]);

    const categoryOptions = useMemo(() => {
        const cats = Array.from(new Set(skills.map(s => s.category).filter(Boolean)));
        return cats.sort().map(c => ({ value: c as string, label: c as string }));
    }, [skills]);

    const macroCategoryOptions = useMemo(() => {
        const macros = Array.from(new Set(skills.map(s => s.macroCategory).filter(Boolean)));
        return macros.sort().map(c => ({ value: c as string, label: c as string }));
    }, [skills]);

    const resourceOptions = useMemo(() => resources.filter(r => !r.resigned).map(r => ({ value: r.id!, label: r.name })), [resources]);
    
    // Updated skillOptions with disambiguation and deduplication for assignment dropdown
    const skillOptions = useMemo(() => {
        const unique = new Map();
        skills.forEach(s => {
            const label = `${s.name} (${s.category || 'N/A'} | ${s.macroCategory || 'N/A'})`;
            if(!unique.has(label)) unique.set(label, { value: s.id!, label });
        });
        return Array.from(unique.values());
    }, [skills]);

    // --- Handlers ---

    const handleOpenModal = (skill?: Skill) => {
        if (skill) {
            setEditingSkill({
                ...skill,
                category: skill.category || '',
                macroCategory: skill.macroCategory || '',
                isCertification: skill.isCertification || false
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
                category: editingSkill.category || null,
                macroCategory: editingSkill.macroCategory || null,
                isCertification: !!editingSkill.isCertification
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
            console.error("Failed to save skill:", error);
            addToast('Errore durante il salvataggio.', 'error');
        }
    };

    const handleDelete = async () => {
        if (!skillToDelete) return;
        try {
            // Delete ONLY the representative ID (user understands duplicates exist if they see aggregation)
            // Or ideally, iterate and delete all IDs in the group.
            if (skillToDelete.ids && skillToDelete.ids.length > 0) {
                await Promise.all(skillToDelete.ids.map(id => deleteSkill(id)));
            } else {
                await deleteSkill(skillToDelete.id!);
            }
            setSkillToDelete(null);
            addToast('Competenza eliminata.', 'success');
        } catch (error) {
            addToast('Errore durante l\'eliminazione.', 'error');
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!editingSkill) return;
        const { name, value, type, checked } = e.target;
        setEditingSkill({ 
            ...editingSkill, 
            [name]: type === 'checkbox' ? checked : value 
        });
    };

    // --- Assignment Handlers ---

    const openAssignmentModal = (skill: Skill | null = null) => {
        // If skill is aggregated, we pick the first ID as representative target
        // Ideally we should assign to ALL IDs in the group, but assigning to one is sufficient for mapping.
        // Or better: The backend logic creates resource_skill link.
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
                {s.isCertification && <span className="material-symbols-outlined text-yellow-600 text-sm" title="Certificazione">verified</span>}
                <span className="font-medium text-on-surface">{s.name}</span>
                {s.isAggregated && <span className="text-xs text-primary bg-primary/10 px-1 rounded" title="Valori aggregati da duplicati">Aggregato</span>}
            </div>
        ) },
        { header: 'Ambito', sortKey: 'category', cell: s => <span className="text-sm text-on-surface-variant">{s.category || '-'}</span> },
        { header: 'Macro Ambito', sortKey: 'macroCategory', cell: s => <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-surface-variant text-on-surface-variant">{s.macroCategory || '-'}</span> },
        { header: 'Utilizzo Risorse', sortKey: 'resourceCount', cell: s => <span className="text-center block font-semibold">{s.resourceCount}</span> },
        { header: 'Utilizzo Progetti', sortKey: 'projectCount', cell: s => <span className="text-center block font-semibold">{s.projectCount}</span> },
    ];

    const renderRow = (skill: EnrichedSkill) => (
        <tr key={skill.id} className="hover:bg-surface-container group">
            {columns.map((col, i) => <td key={i} className="px-6 py-4 whitespace-nowrap text-sm text-on-surface-variant bg-inherit">{col.cell(skill)}</td>)}
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
        <div key={skill.id} className={`bg-surface-container-low p-4 rounded-2xl shadow flex flex-col gap-3 border-l-4 ${skill.isCertification ? 'border-yellow-500' : 'border-primary'}`}>
            <div className="flex justify-between items-start">
                <div>
                    <div className="flex items-center gap-2">
                        <h3 className="font-bold text-lg text-on-surface">{skill.name}</h3>
                        {skill.isCertification && <span className="material-symbols-outlined text-yellow-600 text-sm">verified</span>}
                    </div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-surface-variant text-on-surface-variant mt-1 mr-2">
                        {skill.category || 'Generica'}
                    </span>
                    {skill.macroCategory && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border border-outline-variant text-on-surface-variant mt-1">
                            {skill.macroCategory}
                        </span>
                    )}
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

    return (
        <div className="space-y-6">
             <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h1 className="text-3xl font-bold text-on-surface">Gestione Competenze</h1>
                <div className="flex items-center gap-4 w-full md:w-auto">
                     <div className="flex items-center space-x-1 bg-surface-container p-1 rounded-full">
                        <button onClick={() => setView('table')} className={`px-3 py-1 text-sm font-medium rounded-full capitalize ${view === 'table' ? 'bg-surface text-primary shadow' : 'text-on-surface-variant'}`}>Tabella</button>
                        <button onClick={() => setView('card')} className={`px-3 py-1 text-sm font-medium rounded-full capitalize ${view === 'card' ? 'bg-surface text-primary shadow' : 'text-on-surface-variant'}`}>Card</button>
                    </div>
                    <button onClick={() => openAssignmentModal(null)} className="px-4 py-2 bg-secondary-container text-on-secondary-container font-semibold rounded-full shadow-sm hover:opacity-90 flex items-center gap-2">
                        <span className="material-symbols-outlined text-lg">group_add</span>
                        Assegna
                    </button>
                    <button onClick={() => handleOpenModal()} className="flex-grow md:flex-grow-0 px-4 py-2 bg-primary text-on-primary font-semibold rounded-full shadow-sm hover:opacity-90">Nuova Skill</button>
                </div>
            </div>

            {/* Dashboard Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-surface-container-low p-5 rounded-2xl shadow border-l-4 border-primary">
                    <p className="text-sm text-on-surface-variant">Totale Skills (Unique)</p>
                    <p className="text-3xl font-bold text-on-surface">{kpis.totalSkills}</p>
                </div>
                <div className="bg-surface-container-low p-5 rounded-2xl shadow border-l-4 border-yellow-500">
                    <p className="text-sm text-on-surface-variant">Totale Certificazioni</p>
                    <p className="text-3xl font-bold text-on-surface">{kpis.totalCerts}</p>
                </div>
                <div className="bg-surface-container-low p-5 rounded-2xl shadow border-l-4 border-tertiary">
                    <p className="text-sm text-on-surface-variant">Top Macro Ambito</p>
                    <p className="text-xl font-bold text-on-surface truncate" title={kpis.topMacroCategory}>{kpis.topMacroCategory}</p>
                </div>
                <div 
                    className={`bg-surface-container-low p-5 rounded-2xl shadow border-l-4 border-error cursor-pointer hover:shadow-lg transition-all ${filters.unusedOnly ? 'ring-2 ring-error' : ''}`}
                    onClick={() => setFilters(prev => ({ ...prev, unusedOnly: !prev.unusedOnly }))}
                >
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm text-on-surface-variant">Inutilizzate</p>
                            <p className="text-3xl font-bold text-on-surface">{kpis.unusedSkills}</p>
                        </div>
                        {filters.unusedOnly && <span className="material-symbols-outlined text-error">filter_alt</span>}
                    </div>
                    {filters.unusedOnly && <p className="text-xs text-error mt-1 font-medium">Filtro attivo</p>}
                </div>
            </div>

            {/* Filters */}
             <div className="bg-surface rounded-2xl shadow p-4">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                    <input 
                        type="text" 
                        placeholder="Cerca per nome..." 
                        className="form-input"
                        value={filters.name}
                        onChange={e => setFilters(prev => ({ ...prev, name: e.target.value }))}
                    />
                    <SearchableSelect 
                        name="macroCategory" 
                        value={filters.macroCategory} 
                        onChange={(_, v) => setFilters(prev => ({ ...prev, macroCategory: v }))} 
                        options={macroCategoryOptions} 
                        placeholder="Macro Ambito"
                    />
                    <SearchableSelect 
                        name="category" 
                        value={filters.category} 
                        onChange={(_, v) => setFilters(prev => ({ ...prev, category: v }))} 
                        options={categoryOptions} 
                        placeholder="Ambito"
                    />
                    <select 
                        className="form-select"
                        value={filters.isCertification}
                        onChange={e => setFilters(prev => ({ ...prev, isCertification: e.target.value }))}
                    >
                        <option value="">Tutti i tipi</option>
                        <option value="yes">Solo Certificazioni</option>
                        <option value="no">Solo Competenze</option>
                    </select>
                    
                    <button onClick={() => setFilters({ name: '', category: '', macroCategory: '', isCertification: '', unusedOnly: false })} className="px-4 py-2 bg-secondary-container text-on-secondary-container rounded-full hover:opacity-90 w-full">
                        Reset
                    </button>
                </div>
            </div>

            {/* Content */}
             {view === 'table' ? (
                 <DataTable<EnrichedSkill>
                    title=""
                    addNewButtonLabel=""
                    data={filteredSkills}
                    columns={columns}
                    filtersNode={<></>}
                    onAddNew={() => {}}
                    renderRow={renderRow}
                    renderMobileCard={renderCard}
                    initialSortKey="name"
                    isLoading={loading}
                    tableLayout={{ dense: true, striped: true, headerSticky: true }}
                    numActions={3} // ASSEGNA, MODIFICA, ELIMINA
                />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredSkills.map(renderCard)}
                    {filteredSkills.length === 0 && <p className="col-span-full text-center py-8 text-on-surface-variant">Nessuna skill trovata.</p>}
                </div>
            )}

            {/* Add/Edit Skill Modal */}
            {isModalOpen && editingSkill && (
                <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={'id' in editingSkill ? 'Modifica Competenza' : 'Nuova Competenza'}>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1 text-on-surface-variant">Nome Competenza *</label>
                            <input 
                                type="text" 
                                name="name" 
                                value={editingSkill.name} 
                                onChange={handleInputChange} 
                                required 
                                className="form-input"
                                placeholder="es. React, Project Management..."
                            />
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1 text-on-surface-variant">Macro Ambito</label>
                                <input 
                                    type="text" 
                                    name="macroCategory" 
                                    value={editingSkill.macroCategory || ''} 
                                    onChange={handleInputChange} 
                                    className="form-input"
                                    placeholder="es. Tech, Lingue..."
                                    list="macro-suggestions"
                                />
                                <datalist id="macro-suggestions">
                                    {macroCategoryOptions.map(opt => <option key={opt.value} value={opt.value} />)}
                                </datalist>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1 text-on-surface-variant">Ambito</label>
                                <input 
                                    type="text" 
                                    name="category" 
                                    value={editingSkill.category || ''} 
                                    onChange={handleInputChange} 
                                    className="form-input"
                                    placeholder="es. Frontend, Soft Skill..."
                                    list="category-suggestions"
                                />
                                <datalist id="category-suggestions">
                                    {categoryOptions.map(opt => <option key={opt.value} value={opt.value} />)}
                                </datalist>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 p-3 bg-surface-container-low rounded border border-outline-variant">
                            <input 
                                type="checkbox" 
                                name="isCertification" 
                                checked={editingSkill.isCertification || false} 
                                onChange={handleInputChange} 
                                className="form-checkbox h-5 w-5 text-primary"
                            />
                            <div>
                                <label className="text-sm font-medium text-on-surface">È una certificazione?</label>
                                <p className="text-xs text-on-surface-variant">Se selezionato, verrà evidenziata come certificazione ufficiale.</p>
                            </div>
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
            {isAssignmentModalOpen && (
                <Modal isOpen={isAssignmentModalOpen} onClose={() => setIsAssignmentModalOpen(false)} title={assignmentData.targetSkill ? `Assegna ${assignmentData.targetSkill.name}` : 'Assegnazione Competenze Massiva'}>
                    <form onSubmit={handleAssignmentSubmit} className="space-y-4 flex flex-col h-[70vh]">
                        <div className="flex-grow space-y-4 overflow-y-auto p-1">
                             {!assignmentData.targetSkill && (
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-on-surface-variant">Competenze da Assegnare</label>
                                    <MultiSelectDropdown 
                                        name="selectedSkillIds" 
                                        selectedValues={assignmentData.selectedSkillIds} 
                                        onChange={(_, v) => setAssignmentData(prev => ({ ...prev, selectedSkillIds: v }))} 
                                        options={skillOptions} 
                                        placeholder="Seleziona una o più skills..."
                                    />
                                </div>
                            )}
                            
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

                            <div>
                                <label className="block text-sm font-medium mb-1 text-on-surface-variant">Livello Competenza</label>
                                <select 
                                    className="form-select"
                                    value={assignmentData.level}
                                    onChange={(e) => setAssignmentData(prev => ({ ...prev, level: parseInt(e.target.value, 10) }))}
                                >
                                    {Object.entries(SKILL_LEVELS).map(([val, label]) => (
                                        <option key={val} value={val}>{label}</option>
                                    ))}
                                </select>
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
                                disabled={assignmentData.selectedResourceIds.length === 0 || assignmentData.selectedSkillIds.length === 0}
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
                            Sei sicuro di voler eliminare la competenza <strong>{skillToDelete.name}</strong>?
                            {skillToDelete.isAggregated && <br/>}
                            {skillToDelete.isAggregated && <span className="text-error font-bold">Attenzione: verranno eliminati tutti i duplicati di questa competenza.</span>}
                            <br/>
                            <span className="text-error text-sm">Verrà rimossa da {skillToDelete.resourceCount} risorse e {skillToDelete.projectCount} progetti.</span>
                        </>
                    }
                    isConfirming={isActionLoading(`deleteSkill-${skillToDelete.id}`)}
                />
            )}
        </div>
    );
};

export default SkillsPage;