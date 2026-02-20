
/**
 * @file ConfigPage.tsx
 * @description Pagina per la gestione delle opzioni di configurazione (es. Functions, Industries, Livelli di Seniority, etc.).
 */

import React, { useState, useMemo } from 'react';
import { useAppState } from '../context/AppContext';
import { useLookupContext } from '../context/LookupContext';
import { useSkillsContext } from '../context/SkillsContext';
import { ConfigOption, LeaveType, SkillCategory, SkillMacroCategory } from '../types';
import Modal from '../components/Modal';
import { SpinnerIcon } from '../components/icons';
import MultiSelectDropdown from '../components/MultiSelectDropdown';

/** @type ConfigType - Definisce i tipi di configurazione gestibili. */
type ConfigType = 'functions' | 'industries' | 'seniorityLevels' | 'projectStatuses' | 'clientSectors' | 'locations';

interface ConfigSectionProps {
    title: string;
    configType: ConfigType;
    options: ConfigOption[];
}

const ConfigSection: React.FC<ConfigSectionProps> = ({ title, configType, options }) => {
    const { addConfigOption, updateConfigOption, deleteConfigOption } = useLookupContext();
    const { isActionLoading } = useAppState();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingOption, setEditingOption] = useState<ConfigOption | { value: string } | null>(null);

    const handleOpenModal = (option: ConfigOption | null = null) => {
        setEditingOption(option || { value: '' });
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingOption(null);
    };

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

const SkillConfigSection: React.FC = () => {
    const {
        skillCategories, addSkillCategory, updateSkillCategory, deleteSkillCategory,
        skillMacroCategories, addSkillMacro, updateSkillMacro, deleteSkillMacro
    } = useSkillsContext();
    const [modalMode, setModalMode] = useState<'cat' | 'macro' | null>(null);
    const [editingItem, setEditingItem] = useState<any>(null);

    const openMacroModal = (macro?: any) => { setEditingItem(macro || { name: '' }); setModalMode('macro'); };
    const openCatModal = (cat?: any) => { setEditingItem(cat || { name: '', macroCategoryIds: [] }); setModalMode('cat'); };
    const closeModal = () => { setModalMode(null); setEditingItem(null); };

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
        </div>
    );
};

const ConfigPage: React.FC = () => {
    const { functions, industries, seniorityLevels, projectStatuses, clientSectors, locations } = useLookupContext();

    return (
        <div>
            <h1 className="text-3xl font-bold text-on-background mb-8">Configurazioni</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <ConfigSection title="Functions (Risorse)" configType="functions" options={functions} />
                <ConfigSection title="Industries (Risorse)" configType="industries" options={industries} />
                <ConfigSection title="Livelli Seniority (Ruoli)" configType="seniorityLevels" options={seniorityLevels} />
                <ConfigSection title="Stati (Progetti)" configType="projectStatuses" options={projectStatuses} />
                <ConfigSection title="Settori (Clienti)" configType="clientSectors" options={clientSectors} />
                <ConfigSection title="Sedi di Lavoro (Risorse)" configType="locations" options={locations} />
                <SkillConfigSection />
            </div>
        </div>
    );
};

export default ConfigPage;
