/**
 * @file ClientsPage.tsx
 * @description Pagina per la gestione dei clienti (CRUD e visualizzazione).
 */

import React, { useState, useMemo } from 'react';
import { useStaffingContext } from '../context/StaffingContext';
import { Client } from '../types';
import Modal from '../components/Modal';
import { PencilIcon, TrashIcon, PencilSquareIcon, CheckIcon, XMarkIcon, ArrowsUpDownIcon } from '../components/icons';

/**
 * @type SortConfig
 * @description Configurazione per l'ordinamento della tabella.
 */
type SortConfig = { key: keyof Client; direction: 'ascending' | 'descending' } | null;


/**
 * Componente per la pagina di gestione dei Clienti.
 * Permette di visualizzare, filtrare, ordinare, aggiungere, modificare ed eliminare clienti.
 * @returns {React.ReactElement} La pagina di gestione dei clienti.
 */
const ClientsPage: React.FC = () => {
    const { clients, clientSectors, addClient, updateClient, deleteClient } = useStaffingContext();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingClient, setEditingClient] = useState<Client | Omit<Client, 'id'> | null>(null);
    const [filters, setFilters] = useState({ name: '', sector: '' });
    const [sortConfig, setSortConfig] = useState<SortConfig>(null);
    
    // Stati per la gestione della modifica inline.
    const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
    const [inlineEditingData, setInlineEditingData] = useState<Client | null>(null);

    const emptyClient: Omit<Client, 'id'> = { name: '', sector: clientSectors[0]?.value || '', contactEmail: '' };

    const filteredClients = useMemo(() => {
        return clients.filter(client => {
            const nameMatch = client.name.toLowerCase().includes(filters.name.toLowerCase());
            const sectorMatch = filters.sector ? client.sector === filters.sector : true;
            return nameMatch && sectorMatch;
        });
    }, [clients, filters]);

    // Applica l'ordinamento ai dati filtrati
    const sortedClients = useMemo(() => {
        let sortableItems = [...filteredClients];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                const aValue = a[sortConfig.key];
                const bValue = b[sortConfig.key];
                if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }
        return sortableItems;
    }, [filteredClients, sortConfig]);

    const requestSort = (key: keyof Client) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const resetFilters = () => setFilters({ name: '', sector: '' });

    const openModalForNew = () => { setEditingClient(emptyClient); setIsModalOpen(true); };
    const openModalForEdit = (client: Client) => { setEditingClient(client); setIsModalOpen(true); };
    const handleCloseModal = () => { setIsModalOpen(false); setEditingClient(null); };

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (editingClient) {
            if ('id' in editingClient) updateClient(editingClient);
            else addClient(editingClient);
            handleCloseModal();
        }
    };
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        if (editingClient) setEditingClient({ ...editingClient, [e.target.name]: e.target.value });
    };

    const handleStartInlineEdit = (client: Client) => { setInlineEditingId(client.id!); setInlineEditingData({ ...client }); };
    const handleCancelInlineEdit = () => { setInlineEditingId(null); setInlineEditingData(null); };
    const handleInlineFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        if (inlineEditingData) setInlineEditingData({ ...inlineEditingData, [e.target.name]: e.target.value });
    };
    const handleSaveInlineEdit = () => { if (inlineEditingData) { updateClient(inlineEditingData); handleCancelInlineEdit(); } };

    const getSortableHeader = (label: string, key: keyof Client) => (
        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
            <button type="button" onClick={() => requestSort(key)} className="flex items-center space-x-1">
                <span className={sortConfig?.key === key ? 'font-bold text-gray-700 dark:text-white' : ''}>{label}</span>
                <ArrowsUpDownIcon className="w-4 h-4" />
            </button>
        </th>
    );

    return (
        <div>
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white self-start">Gestione Clienti</h1>
                <button onClick={openModalForNew} className="w-full md:w-auto px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700">Aggiungi Cliente</button>
            </div>
            
            <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <input type="text" name="name" value={filters.name} onChange={handleFilterChange} className="w-full form-input" placeholder="Cerca per nome..."/>
                    <select name="sector" value={filters.sector} onChange={handleFilterChange} className="w-full form-select"><option value="">Tutti i settori</option>{clientSectors.map(s => <option key={s.id} value={s.value}>{s.value}</option>)}</select>
                    <button onClick={resetFilters} className="px-4 py-2 bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 w-full md:w-auto">Reset</button>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
                <table className="min-w-full divide-y md:divide-y-0 divide-gray-200 dark:divide-gray-700">
                    <thead className="hidden md:table-header-group bg-gray-50 dark:bg-gray-700">
                        <tr>
                            {getSortableHeader('Nome Cliente', 'name')}
                            {getSortableHeader('Settore', 'sector')}
                            {getSortableHeader('Email Contatto', 'contactEmail')}
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Azioni</th>
                        </tr>
                    </thead>
                    <tbody className="block md:table-row-group divide-y divide-gray-200 dark:divide-gray-700">
                        {sortedClients.map(client => {
                            const isEditing = inlineEditingId === client.id;
                            if (isEditing) {
                                return (
                                <tr key={client.id} className="block md:table-row p-4 md:p-0 border-b dark:border-gray-600">
                                    <td data-label="Cliente"><input type="text" name="name" value={inlineEditingData!.name} onChange={handleInlineFormChange} className="w-full form-input p-1" /></td>
                                    <td data-label="Settore"><select name="sector" value={inlineEditingData!.sector} onChange={handleInlineFormChange} className="w-full form-select p-1">{clientSectors.sort((a,b)=> a.value.localeCompare(b.value)).map(s=><option key={s.id} value={s.value}>{s.value}</option>)}</select></td>
                                    <td data-label="Email"><input type="email" name="contactEmail" value={inlineEditingData!.contactEmail} onChange={handleInlineFormChange} className="w-full form-input p-1" /></td>
                                    <td className="text-right"><button onClick={handleSaveInlineEdit}><CheckIcon className="w-5 h-5"/></button><button onClick={handleCancelInlineEdit}><XMarkIcon className="w-5 h-5"/></button></td>
                                </tr>
                                )
                            }
                            return (
                            <tr key={client.id} className="block md:table-row p-4 md:p-0 border-b dark:border-gray-600">
                                <td data-label="Cliente">{client.name}</td>
                                <td data-label="Settore">{client.sector}</td>
                                <td data-label="Email">{client.contactEmail}</td>
                                <td className="text-right">
                                    <div className="flex items-center justify-end space-x-2">
                                        <button onClick={() => openModalForEdit(client)}><PencilIcon className="w-5 h-5"/></button>
                                        <button onClick={() => handleStartInlineEdit(client)}><PencilSquareIcon className="w-5 h-5"/></button>
                                        <button onClick={() => deleteClient(client.id!)}><TrashIcon className="w-5 h-5"/></button>
                                    </div>
                                </td>
                            </tr>
                        )})}
                    </tbody>
                </table>
            </div>

            {editingClient && (
                <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={'id' in editingClient ? 'Modifica Cliente' : 'Aggiungi Cliente'}>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <input type="text" name="name" value={editingClient.name} onChange={handleChange} required className="w-full form-input" placeholder="Nome Cliente *"/>
                        <select name="sector" value={editingClient.sector} onChange={handleChange} className="w-full form-select">{clientSectors.sort((a, b) => a.value.localeCompare(b.value)).map(s => <option key={s.id} value={s.value}>{s.value}</option>)}</select>
                        <input type="email" name="contactEmail" value={editingClient.contactEmail} onChange={handleChange} required className="w-full form-input" placeholder="Email Contatto *"/>
                        <div className="flex justify-end space-x-3 pt-4">
                            <button type="button" onClick={handleCloseModal} className="px-4 py-2 bg-gray-200 rounded-md">Annulla</button>
                            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md">Salva</button>
                        </div>
                    </form>
                </Modal>
            )}
             <style>{`.form-input, .form-select { display: block; width: 100%; border-radius: 0.375rem; border: 1px solid #D1D5DB; background-color: #FFFFFF; padding: 0.5rem 0.75rem; font-size: 0.875rem; line-height: 1.25rem; } .dark .form-input, .dark .form-select { border-color: #4B5563; background-color: #374151; color: #F9FAFB; }`}</style>
        </div>
    );
};

export default ClientsPage;