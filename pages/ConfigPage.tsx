
/**
 * @file ConfigPage.tsx
 * @description Pagina per la gestione delle opzioni di configurazione (es. Horizontals, Livelli di Seniority, etc.).
 */

import React, { useState, useMemo } from 'react';
import { useEntitiesContext } from '../context/AppContext';
import { ConfigOption, LeaveType, SkillCategory, SkillMacroCategory } from '../types';
import Modal from '../components/Modal';
import { SpinnerIcon } from '../components/icons';
import MultiSelectDropdown from '../components/MultiSelectDropdown';

/** @type ConfigType - Definisce i tipi di configurazione gestibili. */
type ConfigType = 'horizontals' | 'seniorityLevels' | 'projectStatuses' | 'clientSectors' | 'locations';

/**
 * @interface ConfigSectionProps
 * @description Prop per il componente ConfigSection.
 */
interface ConfigSectionProps {
    /** @property {string} title - Il titolo della sezione di configurazione. */
    title: string;
    /** @property {ConfigType} configType - Il tipo di configurazione gestito da questa sezione. */
    configType: ConfigType;
    /** @property {ConfigOption[]} options - L'array di opzioni da visualizzare. */
    options: ConfigOption[];
}

/**
 * Componente per una singola sezione della pagina di configurazione.
 * Gestisce la visualizzazione, aggiunta, modifica ed eliminazione delle opzioni per un tipo specifico.
 * @param {ConfigSectionProps} props - Le prop del componente.
 * @returns {React.ReactElement} Una card con la lista di opzioni e i controlli.
 */
const ConfigSection: React.FC<ConfigSectionProps> = ({ title, configType, options }) => {
    const { addConfigOption, updateConfigOption, deleteConfigOption, isActionLoading } = useEntitiesContext();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingOption, setEditingOption] = useState<ConfigOption | { value: string } | null>(null);

    /**
     * Apre la modale per aggiungere o modificare un'opzione.
     * @param {ConfigOption | null} [option=null] - L'opzione da modificare, o null per crearne una nuova.
     */
    const handleOpenModal = (option: ConfigOption | null = null) => {
        setEditingOption(option || { value: '' });
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingOption(null);
    };

    /**
     * Gestisce l'invio del form nella modale.
     * @param {React.FormEvent} e - L'evento di submit.
     */
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (editingOption) {
            try {
                if ('id' in editingOption) {
                    await updateConfigOption(configType, editingOption);
                } else {
                    await addConfigOption(configType, editingOption.value);
                }
                handleCloseModal();
            } catch (e) {}
        }
    };

    /**
     * Gestisce le modifiche al campo di input nella modale.
     * @param {React.ChangeEvent<HTMLInputElement>} e - L'evento di input.
     */
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (editingOption) {
            setEditingOption({ ...editingOption, value: e.target.value });
        }
    };
    
    return (
        <div className="bg-surface rounded-2xl shadow p-6">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-on-surface">{title}</h2>
                <button onClick={() => handleOpenModal()} className="px-4 py-2 bg-primary text-on-primary text-sm font-semibold rounded-full shadow-sm">
                    Aggiungi
                </button>
            </div>
            <ul className="divide-y divide-outline-variant max-h-60 overflow-y-auto">
                {options.map(option => {
                    const isDeleting = isActionLoading(`deleteConfig-${configType}-${option.id}`);
                    return (
                    <li key={option.id} className="py-2 flex justify-between items-center">
                        <span className="text-sm text-on-surface">{option.value}</span>
                        <div>
                            <button onClick={() => handleOpenModal(option)} className="text-on-surface-variant hover:text-primary p-2 rounded-full" title="Modifica">
                                <span className="material-symbols-outlined">edit</span>
                            </button>
                            <button onClick={() => deleteConfigOption(configType, option.id!)} disabled={isDeleting} className="text-on-surface-variant hover:text-error p-2 rounded-full disabled:opacity-50" title="Elimina">
                                {isDeleting ? <SpinnerIcon className="w-5 h-5" /> : <span className="material-symbols-outlined">delete</span>}
                            </button>
                        </div>
                    </li>
                )})}
            </ul>
             {editingOption && (
                <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={'id' in editingOption ? `Modifica ${title}` : `Aggiungi ${title}`}>
                     <form onSubmit={handleSubmit}>
                        <label className="block text-sm font-medium mb-2 text-on-surface-variant">Valore *</label>
                        <input
                            type="text"
                            value={editingOption.value}
                            onChange={handleChange}
                            required
                            className="w-full form-input"
                        />
                        <div className="flex justify-end space-x-2 pt-5">
                            <button type="button" onClick={handleCloseModal} className="px-6 py-2 border border-outline rounded-full hover:bg-surface-container-low text-primary font-semibold">Annulla</button>
                             <button type="submit" disabled={isActionLoading(`addConfig-${configType}`) || isActionLoading(`updateConfig-${configType}-${'id' in editingOption ? editingOption.id : ''}`)} className="flex justify-center items-center px-6 py-2 bg-primary text-on-primary rounded-full disabled:opacity-50 font-semibold">
                                {(isActionLoading(`addConfig-${configType}`) || isActionLoading(`updateConfig-${configType}-${'id' in editingOption ? editingOption.id : ''}`)) ? <SpinnerIcon className="w-5 h-5"/> : 'Salva'}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
};

const LeaveTypeSection: React.FC = () => {
    const { leaveTypes, addLeaveType, updateLeaveType, deleteLeaveType, isActionLoading } = useEntitiesContext();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingType, setEditingType] = useState<LeaveType | Omit<LeaveType, 'id'> | null>(null);

    const emptyType: Omit<LeaveType, 'id'> = {
        name: '',
        color: '#FFCC00',
        requiresApproval: true,
        affectsCapacity: true
    };

    const handleOpenModal = (type?: LeaveType) => {
        setEditingType(type || emptyType);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingType(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingType) return;
        try {
            if ('id' in editingType) {
                await updateLeaveType(editingType as LeaveType);
            } else {
                await addLeaveType(editingType as Omit<LeaveType, 'id'>);
            }
            handleCloseModal();
        } catch (error) {}
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!editingType) return;
        const { name, value, type, checked } = e.target;
        setEditingType(prev => {
            if (!prev) return null;
            return {
                ...prev,
                [name]: type === 'checkbox' ? checked : value
            };
        });
    };

    return (
        <div className="bg-surface rounded-2xl shadow p-6">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-on-surface">Tipologie Assenza</h2>
                <button onClick={() => handleOpenModal()} className="px-4 py-2 bg-primary text-on-primary text-sm font-semibold rounded-full shadow-sm">
                    Aggiungi
                </button>
            </div>
            <ul className="divide-y divide-outline-variant max-h-60 overflow-y-auto">
                {leaveTypes.map(type => {
                    const isDeleting = isActionLoading(`deleteLeaveType-${type.id}`);
                    return (
                        <li key={type.id} className="py-2 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: type.color }}></div>
                                <div>
                                    <p className="text-sm font-medium text-on-surface">{type.name}</p>
                                    <p className="text-xs text-on-surface-variant">
                                        {type.requiresApproval ? 'Richiede Approvazione' : 'Automatico'} • {type.affectsCapacity ? 'Riduce Capacità' : 'Non Riduce Capacità'}
                                    </p>
                                </div>
                            </div>
                            <div>
                                <button onClick={() => handleOpenModal(type)} className="text-on-surface-variant hover:text-primary p-2 rounded-full" title="Modifica">
                                    <span className="material-symbols-outlined">edit</span>
                                </button>
                                <button onClick={() => deleteLeaveType(type.id!)} disabled={isDeleting} className="text-on-surface-variant hover:text-error p-2 rounded-full disabled:opacity-50" title="Elimina">
                                    {isDeleting ? <SpinnerIcon className="w-5 h-5" /> : <span className="material-symbols-outlined">delete</span>}
                                </button>
                            </div>
                        </li>
                    );
                })}
            </ul>

            {editingType && (
                <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={'id' in editingType ? 'Modifica Tipologia' : 'Aggiungi Tipologia'}>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-on-surface-variant mb-1">Nome Tipologia *</label>
                            <input type="text" name="name" value={editingType.name} onChange={handleChange} required className="form-input" placeholder="es. Ferie, Malattia"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-on-surface-variant mb-1">Colore *</label>
                            <div className="flex items-center gap-2">
                                <input type="color" name="color" value={editingType.color} onChange={handleChange} className="h-10 w-10 p-0 border-0 rounded cursor-pointer"/>
                                <input type="text" name="color" value={editingType.color} onChange={handleChange} className="form-input flex-grow" pattern="^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$"/>
                            </div>
                        </div>
                        <div className="flex items-center space-x-3">
                            <input type="checkbox" id="requiresApproval" name="requiresApproval" checked={editingType.requiresApproval} onChange={handleChange} className="form-checkbox"/>
                            <label htmlFor="requiresApproval" className="text-sm text-on-surface">Richiede Approvazione (Workflow)</label>
                        </div>
                        <div className="flex items-center space-x-3">
                            <input type="checkbox" id="affectsCapacity" name="affectsCapacity" checked={editingType.affectsCapacity} onChange={handleChange} className="form-checkbox"/>
                            <label htmlFor="affectsCapacity" className="text-sm text-on-surface">Impatta sulla Capacità (Riduce i giorni disponibili)</label>
                        </div>
                        <div className="flex justify-end space-x-2 pt-4">
                            <button type="button" onClick={handleCloseModal} className="px-6 py-2 border border-outline rounded-full hover:bg-surface-container-low text-primary font-semibold">Annulla</button>
                            <button type="submit" disabled={isActionLoading('addLeaveType') || isActionLoading(`updateLeaveType-${'id' in editingType ? editingType.id : ''}`)} className="flex justify-center items-center px-6 py-2 bg-primary text-on-primary rounded-full disabled:opacity-50 font-semibold">
                                {(isActionLoading('addLeaveType') || isActionLoading(`updateLeaveType-${'id' in editingType ? editingType.id : ''}`)) ? <SpinnerIcon className="w-5 h-5"/> : 'Salva'}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
};

const SkillConfigSection: React.FC = () => {
    const { 
        skillCategories, addSkillCategory, updateSkillCategory, deleteSkillCategory,
        skillMacroCategories, addSkillMacro, updateSkillMacro, deleteSkillMacro 
    } = useEntitiesContext();
    const [modalMode, setModalMode] = useState<'cat' | 'macro' | null>(null);
    const [editingItem, setEditingItem] = useState<any>(null);

    const openMacroModal = (macro?: any) => {
        setEditingItem(macro || { name: '' });
        setModalMode('macro');
    };

    const openCatModal = (cat?: any) => {
        setEditingItem(cat || { name: '', macroCategoryIds: [] });
        setModalMode('cat');
    };

    const closeModal = () => {
        setModalMode(null);
        setEditingItem(null);
    };

    const handleMacroSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (editingItem.id) await updateSkillMacro(editingItem.id, editingItem.name);
        else await addSkillMacro({ name: editingItem.name });
        closeModal();
    };

    const handleCatSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (editingItem.id) await updateSkillCategory(editingItem);
        else await addSkillCategory(editingItem);
        closeModal();
    };

    const macroOptions = useMemo(() => skillMacroCategories.map(m => ({ value: m.id, label: m.name })), [skillMacroCategories]);

    return (
        <div className="bg-surface rounded-2xl shadow p-6">
            <h2 className="text-xl font-semibold text-on-surface mb-6">Configurazione Competenze</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* MACRO CATEGORIES */}
                <div>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-medium text-on-surface">Macro Ambiti</h3>
                        <button onClick={() => openMacroModal()} className="px-3 py-1 bg-primary text-on-primary text-xs font-semibold rounded-full">Aggiungi</button>
                    </div>
                    <ul className="divide-y divide-outline-variant max-h-60 overflow-y-auto">
                        {skillMacroCategories.map(m => (
                            <li key={m.id} className="py-2 flex justify-between items-center">
                                <span className="text-sm text-on-surface">{m.name}</span>
                                <div>
                                    <button onClick={() => openMacroModal(m)} className="text-on-surface-variant hover:text-primary p-1"><span className="material-symbols-outlined text-lg">edit</span></button>
                                    <button onClick={() => deleteSkillMacro(m.id)} className="text-on-surface-variant hover:text-error p-1"><span className="material-symbols-outlined text-lg">delete</span></button>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* CATEGORIES */}
                <div>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-medium text-on-surface">Ambiti (Categorie)</h3>
                        <button onClick={() => openCatModal()} className="px-3 py-1 bg-primary text-on-primary text-xs font-semibold rounded-full">Aggiungi</button>
                    </div>
                    <ul className="divide-y divide-outline-variant max-h-60 overflow-y-auto">
                        {skillCategories.map(c => (
                            <li key={c.id} className="py-2 flex justify-between items-center">
                                <div>
                                    <span className="text-sm text-on-surface block">{c.name}</span>
                                    <span className="text-xs text-on-surface-variant">
                                        {c.macroCategoryIds?.map(mid => skillMacroCategories.find(m => m.id === mid)?.name).join(', ') || '-'}
                                    </span>
                                </div>
                                <div>
                                    <button onClick={() => openCatModal(c)} className="text-on-surface-variant hover:text-primary p-1"><span className="material-symbols-outlined text-lg">edit</span></button>
                                    <button onClick={() => deleteSkillCategory(c.id)} className="text-on-surface-variant hover:text-error p-1"><span className="material-symbols-outlined text-lg">delete</span></button>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            {/* Modals */}
            {modalMode === 'macro' && (
                <Modal isOpen={true} onClose={closeModal} title={editingItem.id ? 'Modifica Macro Ambito' : 'Nuovo Macro Ambito'}>
                    <form onSubmit={handleMacroSubmit}>
                        <label className="block text-sm font-medium mb-2 text-on-surface-variant">Nome</label>
                        <input type="text" value={editingItem.name} onChange={e => setEditingItem({...editingItem, name: e.target.value})} className="form-input w-full" required />
                        <div className="flex justify-end gap-2 mt-4">
                            <button type="button" onClick={closeModal} className="px-4 py-2 border border-outline rounded-full text-primary font-semibold text-sm hover:bg-surface-container-low">Annulla</button>
                            <button type="submit" className="px-4 py-2 bg-primary text-on-primary rounded-full font-semibold text-sm hover:opacity-90">Salva</button>
                        </div>
                    </form>
                </Modal>
            )}

            {modalMode === 'cat' && (
                <Modal isOpen={true} onClose={closeModal} title={editingItem.id ? 'Modifica Ambito' : 'Nuovo Ambito'}>
                    <form onSubmit={handleCatSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-2 text-on-surface-variant">Nome</label>
                            <input type="text" value={editingItem.name} onChange={e => setEditingItem({...editingItem, name: e.target.value})} className="form-input w-full" required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2 text-on-surface-variant">Macro Ambiti Collegati</label>
                            <MultiSelectDropdown 
                                name="macroCategoryIds" 
                                selectedValues={editingItem.macroCategoryIds || []}
                                onChange={(_, vals) => setEditingItem({...editingItem, macroCategoryIds: vals})}
                                options={macroOptions}
                                placeholder="Seleziona Macro Ambiti..."
                            />
                        </div>
                        <div className="flex justify-end gap-2 mt-4">
                            <button type="button" onClick={closeModal} className="px-4 py-2 border border-outline rounded-full text-primary font-semibold text-sm hover:bg-surface-container-low">Annulla</button>
                            <button type="submit" className="px-4 py-2 bg-primary text-on-primary rounded-full font-semibold text-sm hover:opacity-90">Salva</button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
};

/**
 * Componente principale della pagina di Configurazione.
 * Raggruppa diverse sezioni di configurazione in un layout a griglia.
 * @returns {React.ReactElement} La pagina delle configurazioni.
 */
const ConfigPage: React.FC = () => {
    const { horizontals, seniorityLevels, projectStatuses, clientSectors, locations } = useEntitiesContext();

    return (
        <div>
            <h1 className="text-3xl font-bold text-on-background mb-8">Configurazioni</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <ConfigSection title="Horizontals (Risorse)" configType="horizontals" options={horizontals} />
                <ConfigSection title="Livelli Seniority (Ruoli)" configType="seniorityLevels" options={seniorityLevels} />
                <ConfigSection title="Stati (Progetti)" configType="projectStatuses" options={projectStatuses} />
                <ConfigSection title="Settori (Clienti)" configType="clientSectors" options={clientSectors} />
                <ConfigSection title="Sedi di Lavoro (Risorse)" configType="locations" options={locations} />
                <SkillConfigSection />
                <LeaveTypeSection />
            </div>
        </div>
    );
};

export default ConfigPage;
