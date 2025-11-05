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
        // MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza.
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-[var(--space-6)]">
            {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
            <div className="flex justify-between items-center mb-[var(--space-4)]">
                {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
                <h2 className="text-[var(--font-size-xl)] font-semibold">{title}</h2>
                {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
                <button onClick={() => handleOpenModal()} className="px-[var(--space-3)] py-[var(--space-1-5)] bg-primary text-white text-[var(--font-size-sm)] rounded-md shadow-sm hover:bg-primary-darker">
                    Aggiungi
                </button>
            </div>
            <ul className="divide-y divide-gray-200 dark:divide-gray-700 max-h-60 overflow-y-auto">
                {options.map(option => {
                    const isDeleting = isActionLoading(`deleteConfig-${configType}-${option.id}`);
                    return (
                    // MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza.
                    <li key={option.id} className="py-[var(--space-2)] flex justify-between items-center">
                        {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
                        <span className="text-[var(--font-size-sm)] text-gray-800 dark:text-gray-200">{option.value}</span>
                        <div>
                            {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
                            <button onClick={() => handleOpenModal(option)} className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-200 mr-[var(--space-3)] p-[var(--space-1)]" title="Modifica">
                                {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
                                <span className="text-[var(--font-size-lg)]">✏️</span>
                            </button>
                            {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
                            <button onClick={() => deleteConfigOption(configType, option.id!)} disabled={isDeleting} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-200 p-[var(--space-1)] disabled:opacity-50" title="Elimina">
                                {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
                                {isDeleting ? <SpinnerIcon className="w-[var(--space-4)] h-[var(--space-4)]" /> : <span className="text-[var(--font-size-lg)]">🗑️</span>}
                            </button>
                        </div>
                    </li>
                )})}
            </ul>
             {editingOption && (
                <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={'id' in editingOption ? `Modifica ${title}` : `Aggiungi ${title}`}>
                     <form onSubmit={handleSubmit}>
                        {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
                        <label className="block text-[var(--font-size-sm)] font-medium mb-[var(--space-2)]">Valore *</label>
                        <input
                            type="text"
                            value={editingOption.value}
                            onChange={handleChange}
                            required
                            className="w-full form-input"
                        />
                        {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
                        <div className="flex justify-end space-x-[var(--space-3)] pt-[var(--space-5)]">
                            {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
                            <button type="button" onClick={handleCloseModal} className="px-[var(--space-4)] py-[var(--space-2)] bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500">Annulla</button>
                             {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
                             <button type="submit" disabled={isActionLoading(`addConfig-${configType}`) || isActionLoading(`updateConfig-${configType}-${'id' in editingOption ? editingOption.id : ''}`)} className="flex justify-center items-center px-[var(--space-4)] py-[var(--space-2)] bg-primary text-white rounded-md hover:bg-primary-darker disabled:bg-blue-400">
                                {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
                                {(isActionLoading(`addConfig-${configType}`) || isActionLoading(`updateConfig-${configType}-${'id' in editingOption ? editingOption.id : ''}`)) ? <SpinnerIcon className="w-[var(--space-5)] h-[var(--space-5)]"/> : 'Salva'}
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
            {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
            <h1 className="text-[var(--font-size-3xl)] font-bold text-gray-800 dark:text-white mb-[var(--space-8)]">Configurazioni</h1>

            {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--space-8)]">
                <ConfigSection title="Horizontals (Risorse)" configType="horizontals" options={horizontals} />
                <ConfigSection title="Livelli Seniority (Ruoli)" configType="seniorityLevels" options={seniorityLevels} />
                <ConfigSection title="Stati (Progetti)" configType="projectStatuses" options={projectStatuses} />
                <ConfigSection title="Settori (Clienti)" configType="clientSectors" options={clientSectors} />
                <ConfigSection title="Sedi di Lavoro (Risorse)" configType="locations" options={locations} />
            </div>
             <style>{`
                .form-input { display: block; width: 100%; border-radius: 0.375rem; border: 1px solid #D1D5DB; background-color: #FFFFFF; padding: 0.5rem 0.75rem; font-size: 0.875rem; line-height: 1.25rem; }
                .dark .form-input { border-color: #4B5563; background-color: #374151; color: #F9FAFB; }
            `}</style>
        </div>
    );
};

export default ConfigPage;