
/**
 * @file SkillsMapPage.tsx
 * @description Pagina per la visualizzazione, ricerca e gestione delle competenze delle risorse.
 */

import React, { useState, useMemo } from 'react';
import { useEntitiesContext } from '../context/AppContext';
import { Resource, ComputedSkill, SKILL_LEVELS, SkillLevelValue } from '../types';
import Modal from '../components/Modal';
import SearchableSelect from '../components/SearchableSelect';
import MultiSelectDropdown from '../components/MultiSelectDropdown';
import { SpinnerIcon } from '../components/icons';
import { DataTable, ColumnDef } from '../components/DataTable';

// --- Helper Functions ---
const isExpiringSoon = (dateStr?: string | null): boolean => {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    const today = new Date();
    const diffTime = date.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 90; // Scade entro 90 giorni
};

const isExpired = (dateStr?: string | null): boolean => {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    const today = new Date();
    return date < today;
};

type EnrichedSkillResource = Resource & {
    roleName: string;
    primarySkill: string;
    totalSkills: number;
    certificationCount: number;
    expiringCertifications: number;
    computedSkills: ComputedSkill[];
};

const SkillsMapPage: React.FC = () => {
    const { 
        resources, roles, skills, resourceSkills, addResourceSkill, deleteResourceSkill, 
        getResourceComputedSkills, loading, isActionLoading 
    } = useEntitiesContext();

    // State
    const [view, setView] = useState<'table' | 'card'>('table');
    const [filters, setFilters] = useState({ resourceId: '', roleId: '', skillIds: [] as string[], category: '', macroCategory: '', isCertification: '' });
    
    // Edit Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingResource, setEditingResource] = useState<Resource | null>(null);
    const [editingSkills, setEditingSkills] = useState<{ skillId: string, acquisitionDate: string, expirationDate: string, level: number }[]>([]);
    const [tempSkillId, setTempSkillId] = useState<string>('');

    // --- Derived Data & Dashboard KPIs ---

    const allEnrichedResources = useMemo<EnrichedSkillResource[]>(() => {
        return resources.filter(r => !r.resigned).map(resource => {
            const computed = getResourceComputedSkills(resource.id!);
            const role = roles.find(r => r.id === resource.roleId);
            
            const manualSkills = computed.filter(cs => cs.manualDetails);
            const certifications = manualSkills.filter(cs => cs.skill.isCertification);
            
            return {
                ...resource,
                roleName: role?.name || 'N/A',
                computedSkills: computed,
                primarySkill: computed.length > 0 ? computed[0].skill.name : 'Nessuna',
                totalSkills: computed.length,
                certificationCount: certifications.length,
                expiringCertifications: certifications.filter(c => isExpiringSoon(c.manualDetails?.expirationDate)).length
            };
        });
    }, [resources, roles, getResourceComputedSkills]);

    const kpis = useMemo(() => {
        const skillCounts: {[key: string]: number} = {};
        let totalResources = 0;
        let resourcesWithSkills = 0;
        let expiringCerts = 0;
        let inferredOnlyGap = 0;

        allEnrichedResources.forEach(r => {
            totalResources++;
            if (r.totalSkills > 0) resourcesWithSkills++;
            expiringCerts += r.expiringCertifications;
            
            // Count skill popularity
            r.computedSkills.forEach(cs => {
                const name = cs.skill.name;
                skillCounts[name] = (skillCounts[name] || 0) + 1;
            });

            // Gap Analysis: skills used in projects but not manual
            const inferredOnly = r.computedSkills.filter(cs => !cs.manualDetails && cs.inferredDays > 0).length;
            inferredOnlyGap += inferredOnly;
        });

        const sortedSkills = Object.entries(skillCounts).sort((a,b) => b[1] - a[1]);
        const topSkill = sortedSkills.length > 0 ? sortedSkills[0][0] : 'N/A';
        const coverage = totalResources > 0 ? (resourcesWithSkills / totalResources) * 100 : 0;

        return { topSkill, expiringCerts, coverage, inferredOnlyGap };
    }, [allEnrichedResources]);

    const filteredResources = useMemo(() => {
        return allEnrichedResources.filter(r => {
            const matchesRes = !filters.resourceId || r.id === filters.resourceId;
            const matchesRole = !filters.roleId || r.roleId === filters.roleId;
            
            const matchesSkill = filters.skillIds.length === 0 || r.computedSkills.some(cs => filters.skillIds.includes(cs.skill.id!));
            
            // Advanced Filtering
            const matchesCategory = !filters.category || r.computedSkills.some(cs => cs.skill.category === filters.category);
            const matchesMacro = !filters.macroCategory || r.computedSkills.some(cs => cs.skill.macroCategory === filters.macroCategory);
            
            const matchesCert = filters.isCertification === '' ? true : 
                                filters.isCertification === 'yes' ? r.computedSkills.some(cs => cs.skill.isCertification && cs.manualDetails) : 
                                true;

            return matchesRes && matchesRole && matchesSkill && matchesCategory && matchesMacro && matchesCert;
        });
    }, [allEnrichedResources, filters]);


    // --- Handlers ---

    const openEditModal = (resource: Resource) => {
        setEditingResource(resource);
        // Pre-load ONLY manual skills for editing
        const currentManualSkills = resourceSkills
            .filter(rs => rs.resourceId === resource.id)
            .map(rs => {
                // Ensure we extract pure date strings (YYYY-MM-DD) or empty strings for inputs
                const acq = rs.acquisitionDate && typeof rs.acquisitionDate === 'string' 
                    ? rs.acquisitionDate.split('T')[0] 
                    : '';
                const exp = rs.expirationDate && typeof rs.expirationDate === 'string'
                    ? rs.expirationDate.split('T')[0]
                    : '';

                return {
                    skillId: rs.skillId,
                    acquisitionDate: acq,
                    expirationDate: exp,
                    level: rs.level || 1
                };
            });
        setEditingSkills(currentManualSkills);
        setTempSkillId('');
        setIsModalOpen(true);
    };

    const closeEditModal = () => {
        setIsModalOpen(false);
        setEditingResource(null);
        setEditingSkills([]);
    };

    const handleSaveSkills = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingResource) return;

        const resourceId = editingResource.id!;
        const oldSkills = resourceSkills.filter(rs => rs.resourceId === resourceId).map(rs => rs.skillId);
        const currentSkillIds = editingSkills.map(s => s.skillId);
        
        const toAddOrUpdate = editingSkills;
        const toRemove = oldSkills.filter(id => !currentSkillIds.includes(id));
        
        try {
            // The addResourceSkill function should now handle UPSERT properly on the backend
            await Promise.all([
                ...toAddOrUpdate.map(detail => addResourceSkill({ 
                    resourceId, 
                    skillId: detail.skillId, 
                    acquisitionDate: detail.acquisitionDate || null, 
                    expirationDate: detail.expirationDate || null,
                    level: detail.level
                })),
                ...toRemove.map(skillId => deleteResourceSkill(resourceId, skillId))
            ]);
            closeEditModal();
        } catch (err) {
            // Error handled by context
        }
    };

    const handleAddTempSkill = () => {
        if (tempSkillId && !editingSkills.some(s => s.skillId === tempSkillId)) {
            setEditingSkills([...editingSkills, { skillId: tempSkillId, acquisitionDate: '', expirationDate: '', level: 1 }]);
            setTempSkillId('');
        }
    };

    const handleRemoveSkill = (skillId: string) => {
        setEditingSkills(editingSkills.filter(s => s.skillId !== skillId));
    };

    const handleSkillDateChange = (skillId: string, field: 'acquisitionDate' | 'expirationDate', value: string) => {
        setEditingSkills(prev => prev.map(s => s.skillId === skillId ? { ...s, [field]: value } : s));
    };

    const handleSkillLevelChange = (skillId: string, value: string) => {
        setEditingSkills(prev => prev.map(s => s.skillId === skillId ? { ...s, level: parseInt(value, 10) } : s));
    };

    // --- Render Helpers ---

    const resourceOptions = useMemo(() => resources.filter(r => !r.resigned).map(r => ({ value: r.id!, label: r.name })), [resources]);
    const roleOptions = useMemo(() => roles.map(r => ({ value: r.id!, label: r.name })), [roles]);
    
    // Updated skillOptions with disambiguation
    const skillOptions = useMemo(() => skills.map(s => ({ 
        value: s.id!, 
        label: `${s.name} (${s.category || 'N/A'} | ${s.macroCategory || 'N/A'})` 
    })), [skills]);

    const categoryOptions = useMemo(() => {
        const cats = Array.from(new Set(skills.map(s => s.category).filter(Boolean)));
        return cats.sort().map(c => ({ value: c as string, label: c as string }));
    }, [skills]);
    const macroCategoryOptions = useMemo(() => {
        const macros = Array.from(new Set(skills.map(s => s.macroCategory).filter(Boolean)));
        return macros.sort().map(c => ({ value: c as string, label: c as string }));
    }, [skills]);

    const columns: ColumnDef<EnrichedSkillResource>[] = [
        { header: 'Risorsa', sortKey: 'name', cell: r => <span className="font-medium text-on-surface">{r.name}</span> },
        { header: 'Ruolo', sortKey: 'roleName', cell: r => <span className="text-sm text-on-surface-variant">{r.roleName}</span> },
        { header: 'Competenze Principali', cell: r => (
            <div className="flex flex-wrap gap-1">
                {r.computedSkills.slice(0, 3).map(cs => {
                    const levelName = SKILL_LEVELS[(cs.manualDetails?.level || cs.inferredLevel || 1) as SkillLevelValue];
                    const isManual = !!cs.manualDetails;
                    const isCert = cs.skill.isCertification;
                    return (
                        <span 
                            key={cs.skill.id} 
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
                                isCert && isManual ? 'bg-yellow-50 text-yellow-800 border-yellow-200' : 
                                isManual ? 'bg-primary-container text-on-primary-container border-transparent' : 
                                'bg-surface-variant text-on-surface-variant border-outline-variant'}`}
                            title={`Livello: ${levelName} ${!isManual ? '(Inferito)' : ''}`}
                        >
                            {cs.skill.name} <span className="ml-1 opacity-70 text-[10px]">({levelName.substring(0,3)})</span>
                            {isCert && <span className="material-symbols-outlined text-[10px] ml-1">verified</span>}
                        </span>
                    );
                })}
                {r.computedSkills.length > 3 && <span className="text-xs text-on-surface-variant">+{r.computedSkills.length - 3}</span>}
            </div>
        )},
        { header: 'Certificazioni', sortKey: 'certificationCount', cell: r => (
            <div className="flex items-center gap-2">
                <span className={`font-semibold ${r.certificationCount > 0 ? 'text-primary' : 'text-on-surface-variant'}`}>{r.certificationCount}</span>
                {r.expiringCertifications > 0 && (
                    <span className="flex items-center text-xs text-error font-medium" title={`${r.expiringCertifications} in scadenza`}>
                        <span className="material-symbols-outlined text-sm mr-1">warning</span>
                        {r.expiringCertifications}
                    </span>
                )}
            </div>
        )},
        { header: 'Skill Gap (Inferite)', cell: r => {
            const gap = r.computedSkills.filter(cs => !cs.manualDetails && cs.inferredDays > 0).length;
            return gap > 0 ? <span className="text-xs font-medium text-tertiary">{gap} da validare</span> : <span className="text-xs text-green-600">Ok</span>;
        }}
    ];

    const renderRow = (r: EnrichedSkillResource) => (
        <tr key={r.id} className="hover:bg-surface-container group">
             {columns.map((col, i) => <td key={i} className="px-6 py-4 whitespace-nowrap text-sm text-on-surface-variant bg-inherit">{col.cell(r)}</td>)}
             <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium bg-inherit">
                <div className="flex items-center justify-end space-x-2">
                    <button onClick={() => openEditModal(r)} className="p-2 rounded-full hover:bg-surface-container text-on-surface-variant hover:text-primary" title="Gestisci Competenze">
                        <span className="material-symbols-outlined">edit_note</span>
                    </button>
                </div>
             </td>
        </tr>
    );

    const renderCard = (r: EnrichedSkillResource) => (
        <div key={r.id} className="bg-surface-container-low p-4 rounded-2xl shadow flex flex-col gap-3 relative">
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="font-bold text-lg text-on-surface">{r.name}</h3>
                    <p className="text-sm text-on-surface-variant">{r.roleName}</p>
                </div>
                <button onClick={() => openEditModal(r)} className="p-2 rounded-full hover:bg-surface-container text-primary">
                    <span className="material-symbols-outlined">edit</span>
                </button>
            </div>
            
            <div className="flex gap-2 text-xs">
                <div className="px-2 py-1 bg-surface rounded border border-outline-variant">
                    <span className="font-semibold">{r.totalSkills}</span> Skills
                </div>
                <div className={`px-2 py-1 bg-surface rounded border border-outline-variant ${r.certificationCount > 0 ? 'bg-yellow-50 border-yellow-200 text-yellow-800' : ''} ${r.expiringCertifications > 0 ? 'border-error text-error' : ''}`}>
                    <span className="font-semibold">{r.certificationCount}</span> Certificazioni
                </div>
            </div>

            <div className="mt-2">
                <p className="text-xs font-medium text-on-surface-variant mb-1">Top Skills:</p>
                <div className="flex flex-wrap gap-1">
                    {r.computedSkills.slice(0, 5).map(cs => {
                        const level = cs.manualDetails?.level || cs.inferredLevel || 1;
                        const isCert = cs.skill.isCertification;
                        const isManual = !!cs.manualDetails;
                        return (
                            <span 
                                key={cs.skill.id} 
                                className={`px-2 py-0.5 rounded-full text-[10px] border ${
                                    isCert && isManual ? 'bg-yellow-50 text-yellow-800 border-yellow-100' :
                                    cs.manualDetails ? 'bg-primary/10 text-primary border-transparent' : 
                                    'bg-surface-variant text-on-surface-variant border-transparent'}`}
                                title={SKILL_LEVELS[level as SkillLevelValue]}
                            >
                                {cs.skill.name} {isCert && '★'}
                            </span>
                        );
                    })}
                </div>
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h1 className="text-3xl font-bold text-on-surface">Mappa Competenze</h1>
                 <div className="flex items-center space-x-1 bg-surface-container p-1 rounded-full">
                    <button onClick={() => setView('table')} className={`px-3 py-1 text-sm font-medium rounded-full capitalize ${view === 'table' ? 'bg-surface text-primary shadow' : 'text-on-surface-variant'}`}>Tabella</button>
                    <button onClick={() => setView('card')} className={`px-3 py-1 text-sm font-medium rounded-full capitalize ${view === 'card' ? 'bg-surface text-primary shadow' : 'text-on-surface-variant'}`}>Card</button>
                </div>
            </div>

            {/* Dashboard KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-surface-container-low p-4 rounded-2xl shadow border-l-4 border-primary">
                    <p className="text-sm text-on-surface-variant">Top Competenza</p>
                    <p className="text-2xl font-bold text-on-surface truncate" title={kpis.topSkill}>{kpis.topSkill}</p>
                </div>
                <div className="bg-surface-container-low p-4 rounded-2xl shadow border-l-4 border-error">
                    <p className="text-sm text-on-surface-variant">Certificazioni in Scadenza (90gg)</p>
                    <p className="text-2xl font-bold text-error">{kpis.expiringCerts}</p>
                </div>
                <div className="bg-surface-container-low p-4 rounded-2xl shadow border-l-4 border-tertiary">
                    <p className="text-sm text-on-surface-variant">Copertura Competenze</p>
                    <p className="text-2xl font-bold text-tertiary">{kpis.coverage.toFixed(0)}%</p>
                </div>
                 <div className="bg-surface-container-low p-4 rounded-2xl shadow border-l-4 border-secondary">
                    <p className="text-sm text-on-surface-variant">Skill Gap (Solo Inferite)</p>
                    <p className="text-2xl font-bold text-secondary">{kpis.inferredOnlyGap}</p>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-surface rounded-2xl shadow p-4">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                    <SearchableSelect name="resourceId" value={filters.resourceId} onChange={(_, v) => setFilters(f => ({...f, resourceId: v}))} options={resourceOptions} placeholder="Tutte le Risorse"/>
                    <SearchableSelect name="macroCategory" value={filters.macroCategory} onChange={(_, v) => setFilters(f => ({...f, macroCategory: v}))} options={macroCategoryOptions} placeholder="Macro Ambito"/>
                    <SearchableSelect name="category" value={filters.category} onChange={(_, v) => setFilters(f => ({...f, category: v}))} options={categoryOptions} placeholder="Ambito"/>
                    <select className="form-select" value={filters.isCertification} onChange={(e) => setFilters(prev => ({...prev, isCertification: e.target.value}))}>
                        <option value="">Tutto</option>
                        <option value="yes">Ha Certificazioni</option>
                    </select>
                    <div className="flex gap-2">
                        <div className="flex-grow">
                            <MultiSelectDropdown name="skillIds" selectedValues={filters.skillIds} onChange={(_, v) => setFilters(f => ({...f, skillIds: v}))} options={skillOptions} placeholder="Filtra per Skills..."/>
                        </div>
                        <button onClick={() => setFilters({ resourceId: '', roleId: '', skillIds: [], category: '', macroCategory: '', isCertification: '' })} className="px-4 py-2 bg-secondary-container text-on-secondary-container rounded-full hover:opacity-90">Reset</button>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            {view === 'table' ? (
                 <DataTable<EnrichedSkillResource>
                    title=""
                    addNewButtonLabel=""
                    data={filteredResources}
                    columns={columns}
                    filtersNode={<></>}
                    onAddNew={() => {}} // No add new resource here
                    renderRow={renderRow}
                    renderMobileCard={renderCard}
                    initialSortKey="name"
                    isLoading={loading}
                    tableLayout={{ dense: true, striped: true, headerSticky: true }}
                    numActions={1}
                />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredResources.map(renderCard)}
                    {filteredResources.length === 0 && <p className="col-span-full text-center py-8 text-on-surface-variant">Nessuna risorsa trovata.</p>}
                </div>
            )}

            {/* Edit Modal */}
            {isModalOpen && editingResource && (
                <Modal isOpen={isModalOpen} onClose={closeEditModal} title={`Gestione Competenze: ${editingResource.name}`}>
                    <form onSubmit={handleSaveSkills} className="space-y-4 flex flex-col h-[70vh]">
                         <div className="bg-surface-container-low p-3 rounded-lg border border-outline-variant flex-grow overflow-hidden flex flex-col">
                            <div className="flex gap-2 mb-3 flex-shrink-0">
                                <div className="flex-grow">
                                    <SearchableSelect
                                        name="tempSkillId"
                                        value={tempSkillId}
                                        onChange={(_, val) => setTempSkillId(val)}
                                        options={skillOptions.filter(s => !editingSkills.some(sd => sd.skillId === s.value))}
                                        placeholder="Aggiungi nuova competenza..."
                                    />
                                </div>
                                <button type="button" onClick={handleAddTempSkill} disabled={!tempSkillId} className="px-3 py-1 bg-primary text-on-primary rounded-md disabled:opacity-50">
                                    <span className="material-symbols-outlined">add</span>
                                </button>
                            </div>
                            
                            <div className="space-y-2 overflow-y-auto pr-1 flex-grow">
                                {editingSkills.length === 0 && <p className="text-center text-sm text-on-surface-variant mt-4">Nessuna competenza manuale assegnata.</p>}
                                {editingSkills.map(detail => {
                                    const skillObj = skills.find(s => s.id === detail.skillId);
                                    const skillName = skillObj?.name || 'Unknown';
                                    const skillContext = skillObj ? `(${skillObj.category || '-'} | ${skillObj.macroCategory || '-'})` : '';
                                    const isCert = skillObj?.isCertification;
                                    const expired = isExpired(detail.expirationDate);
                                    const expiring = !expired && isExpiringSoon(detail.expirationDate);
                                    
                                    return (
                                        <div key={detail.skillId} className={`p-3 bg-surface rounded border ${expired ? 'border-error bg-error-container/10' : expiring ? 'border-yellow-500 bg-yellow-container/10' : 'border-outline'} flex flex-col gap-2`}>
                                            <div className="flex justify-between items-center">
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-sm text-on-surface flex items-center gap-2">
                                                        {skillName}
                                                        {isCert && <span className="material-symbols-outlined text-yellow-600 text-sm" title="Certificazione">verified</span>}
                                                        {expired && <span className="text-xs text-error font-bold">(Scaduta)</span>}
                                                        {expiring && <span className="text-xs text-yellow-600 font-bold">(In Scadenza)</span>}
                                                    </span>
                                                    <span className="text-[10px] text-on-surface-variant">{skillContext}</span>
                                                </div>
                                                <button type="button" onClick={() => handleRemoveSkill(detail.skillId)} className="text-error hover:bg-error-container p-1 rounded">
                                                    <span className="material-symbols-outlined text-sm">delete</span>
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-3 gap-2">
                                                <div className="col-span-3 md:col-span-1">
                                                    <label className="text-xs text-on-surface-variant block">Livello</label>
                                                    <select 
                                                        value={detail.level || 1} 
                                                        onChange={(e) => handleSkillLevelChange(detail.skillId, e.target.value)}
                                                        className="w-full text-xs p-1 border rounded bg-transparent focus:border-primary outline-none"
                                                    >
                                                        {Object.entries(SKILL_LEVELS).map(([val, label]) => (
                                                            <option key={val} value={val}>{label}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="text-xs text-on-surface-variant block">Data Conseguimento</label>
                                                    <input 
                                                        type="date" 
                                                        value={detail.acquisitionDate} 
                                                        onChange={(e) => handleSkillDateChange(detail.skillId, 'acquisitionDate', e.target.value)}
                                                        className="w-full text-xs p-1 border rounded bg-transparent focus:border-primary outline-none"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs text-on-surface-variant block">Data Scadenza</label>
                                                    <input 
                                                        type="date" 
                                                        value={detail.expirationDate} 
                                                        onChange={(e) => handleSkillDateChange(detail.skillId, 'expirationDate', e.target.value)}
                                                        className="w-full text-xs p-1 border rounded bg-transparent focus:border-primary outline-none"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        
                        <div className="flex justify-end space-x-2 pt-2 flex-shrink-0">
                            <button type="button" onClick={closeEditModal} className="px-6 py-2 border border-outline rounded-full hover:bg-surface-container-low text-primary font-semibold">Annulla</button>
                            <button type="submit" disabled={isActionLoading(`addResourceSkill-${editingResource.id}`)} className="flex justify-center items-center px-6 py-2 bg-primary text-on-primary rounded-full disabled:opacity-50 font-semibold">
                               {isActionLoading(`addResourceSkill-${editingResource.id}`) ? <SpinnerIcon className="w-5 h-5"/> : 'Salva Modifiche'}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
};

export default SkillsMapPage;
