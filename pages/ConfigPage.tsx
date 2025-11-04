/**
 * @file ConfigPage.tsx
 * @description Pagina per la gestione delle opzioni di configurazione (es. Horizontals, Livelli di Seniority, etc.).
 */

import React, { useState } from 'react';
import { useEntitiesContext } from '../context/AppContext';
import { ConfigOption } from '../types';
import Modal from '../components/Modal';
import { SpinnerIcon } from '../components/icons';

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
        <div className="bg-card dark:bg-dark-card rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">{title}</h2>
                <button onClick={() => handleOpenModal()} className="px-3 py-1.5 bg-primary text-dark-foreground dark:text-dark-sidebar-foreground text-sm rounded-md shadow-sm hover:bg-primary-darker">
                    Aggiungi
                </button>
            </div>
            <ul className="divide-y divide-border dark:divide-dark-border max-h-60 overflow-y-auto">
                {options.map(option => {
                    const isDeleting = isActionLoading(`deleteConfig-${configType}-${option.id}`);
                    return (
                    <li key={option.id} className="py-2 flex justify-between items-center">
                        <span className="text-sm text-foreground dark:text-dark-foreground">{option.value}</span>
                        <div>
                            <button onClick={() => handleOpenModal(option)} className="text-primary hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-200 mr-3 p-1" title="Modifica">
                                <span className="text-lg">✏️</span>
                            </button>
                            <button onClick={() => deleteConfigOption(configType, option.id!)} disabled={isDeleting} className="text-destructive hover:text-destructive/80 dark:text-destructive dark:hover:text-destructive/60 p-1 disabled:opacity-50" title="Elimina">
                                {isDeleting ? <SpinnerIcon className="w-4 h-4" /> : <span className="text-lg">🗑️</span>}
                            </button>
                        </div>
                    </li>
                )})}
            </ul>
             {editingOption && (
                <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={'id' in editingOption ? `Modifica ${title}` : `Aggiungi ${title}`}>
                     <form onSubmit={handleSubmit}>
                        <label className="block text-sm font-medium mb-2">Valore *</label>
                        <input
                            type="text"
                            value={editingOption.value}
                            onChange={handleChange}
                            required
                            className="w-full form-input"
                        />
                        <div className="flex justify-end space-x-3 pt-5">
                            <button type="button" onClick={handleCloseModal} className="px-4 py-2 bg-muted text-foreground dark:bg-dark-muted dark:text-dark-foreground rounded-md hover:bg-muted/80 dark:hover:bg-dark-muted/80">Annulla</button>
                             <button type="submit" disabled={isActionLoading(`addConfig-${configType}`) || isActionLoading(`updateConfig-${configType}-${'id' in editingOption ? editingOption.id : ''}`)} className="flex justify-center items-center px-4 py-2 bg-primary text-dark-foreground dark:text-dark-sidebar-foreground rounded-md hover:bg-primary-darker disabled:bg-primary/50">
                                {(isActionLoading(`addConfig-${configType}`) || isActionLoading(`updateConfig-${configType}-${'id' in editingOption ? editingOption.id : ''}`)) ? <SpinnerIcon className="w-5 h-5"/> : 'Salva'}
                            </button>
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
            <h1 className="text-3xl font-bold text-foreground dark:text-dark-foreground mb-8">Configurazioni</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <ConfigSection title="Horizontals (Risorse)" configType="horizontals" options={horizontals} />
                <ConfigSection title="Livelli Seniority (Ruoli)" configType="seniorityLevels" options={seniorityLevels} />
                <ConfigSection title="Stati (Progetti)" configType="projectStatuses" options={projectStatuses} />
                <ConfigSection title="Settori (Clienti)" configType="clientSectors" options={clientSectors} />
                <ConfigSection title="Sedi di Lavoro (Risorse)" configType="locations" options={locations} />
            </div>
             <style>{`
                .form-input { display: block; width: 100%; border-radius: 0.375rem; border: 1px solid var(--color-border); background-color: var(--color-card); padding: 0.5rem 0.75rem; font-size: 0.875rem; line-height: 1.25rem; }
                .dark .form-input { border-color: var(--color-dark-border); background-color: var(--color-dark-card); color: var(--color-dark-foreground); }
            `}</style>
        </div>
    );
};

export default ConfigPage;