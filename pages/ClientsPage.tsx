/**
 * @file ClientsPage.tsx
 * @description Pagina per la gestione dei clienti (CRUD e visualizzazione).
 */

import React, { useState, useMemo } from 'react';
import { useEntitiesContext } from '../context/AppContext';
import { Client } from '../types';
import Modal from '../components/Modal';
import SearchableSelect from '../components/SearchableSelect';
import { SpinnerIcon } from '../components/icons';
import { DataTable, ColumnDef } from '../components/DataTable';

/**
 * Componente per la pagina di gestione dei Clienti.
 * Permette di visualizzare, filtrare, aggiungere, modificare ed eliminare clienti.
 * @returns {React.ReactElement} La pagina di gestione dei clienti.
 */
const ClientsPage: React.FC = () => {
    const { clients, clientSectors, addClient, updateClient, deleteClient, isActionLoading } = useEntitiesContext();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingClient, setEditingClient] = useState<Client | Omit<Client, 'id'> | null>(null);
    const [filters, setFilters] = useState({ name: '', sector: '' });
    
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
    
    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const handleFilterSelectChange = (name: string, value: string) => setFilters(prev => ({ ...prev, [name]: value }));
    const resetFilters = () => setFilters({ name: '', sector: '' });

    const openModalForNew = () => { setEditingClient(emptyClient); setIsModalOpen(true); };
    const openModalForEdit = (client: Client) => { setEditingClient(client); setIsModalOpen(true); handleCancelInlineEdit(); };
    const handleCloseModal = () => { setIsModalOpen(false); setEditingClient(null); };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (editingClient) {
            try {
                if ('id' in editingClient) await updateClient(editingClient);
                else await addClient(editingClient);
                handleCloseModal();
            } catch (error) {
                // L'errore è già gestito nel contesto, non serve fare altro qui
            }
        }
    };
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (editingClient) setEditingClient({ ...editingClient, [e.target.name]: e.target.value });
    };

    const handleSelectChange = (name: string, value: string) => {
        if (editingClient) {
            setEditingClient({ ...editingClient, [name]: value });
        }
    };

    const handleStartInlineEdit = (client: Client) => { setInlineEditingId(client.id!); setInlineEditingData({ ...client }); };
    const handleCancelInlineEdit = () => { setInlineEditingId(null); setInlineEditingData(null); };
    const handleInlineFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (inlineEditingData) setInlineEditingData({ ...inlineEditingData, [e.target.name]: e.target.value });
    };

    const handleInlineSelectChange = (name: string, value: string) => {
        if (inlineEditingData) {
            setInlineEditingData({ ...inlineEditingData, [name]: value });
        }
    };

    const handleSaveInlineEdit = async () => { if (inlineEditingData) { await updateClient(inlineEditingData); handleCancelInlineEdit(); } };
    
    const sectorOptions = useMemo(() => clientSectors.sort((a,b)=>a.value.localeCompare(b.value)).map(s => ({ value: s.value, label: s.value })), [clientSectors]);

    const columns: ColumnDef<Client>[] = [
        { header: 'Nome Cliente', sortKey: 'name', cell: (client) => <span className="font-medium text-foreground dark:text-dark-foreground">{client.name}</span> },
        { header: 'Settore', sortKey: 'sector', cell: (client) => <span className="text-sm text-muted-foreground dark:text-dark-muted-foreground">{client.sector}</span> },
        { header: 'Email Contatto', sortKey: 'contactEmail', cell: (client) => <span className="text-sm text-muted-foreground dark:text-dark-muted-foreground">{client.contactEmail}</span> },
    ];
    
    const renderRow = (client: Client) => {
        const isEditing = inlineEditingId === client.id;
        if (isEditing) {
            const isSaving = isActionLoading(`updateClient-${client.id}`);
            return (
                <tr key={client.id}>
                    <td className="px-6 py-4"><input type="text" name="name" value={inlineEditingData!.name} onChange={handleInlineFormChange} className="w-full form-input p-1" /></td>
                    <td className="px-6 py-4"><SearchableSelect name="sector" value={inlineEditingData!.sector} onChange={handleInlineSelectChange} options={sectorOptions} placeholder="Seleziona settore" /></td>
                    <td className="px-6 py-4"><input type="email" name="contactEmail" value={inlineEditingData!.contactEmail} onChange={handleInlineFormChange} className="w-full form-input p-1" /></td>
                    <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                            <button onClick={handleSaveInlineEdit} disabled={isSaving} className="p-1 text-success hover:text-success disabled:opacity-50">
                                {isSaving ? <SpinnerIcon className="w-5 h-5"/> : <span className="text-xl">✔️</span>}
                            </button>
                            <button onClick={handleCancelInlineEdit} className="p-1 text-muted-foreground hover:text-muted-foreground"><span className="text-xl">❌</span></button>
                        </div>
                    </td>
                </tr>
            );
        }
        return (
             <tr key={client.id} className="hover:bg-muted dark:hover:bg-dark-muted/50">
                {columns.map((col, i) => <td key={i} className="px-6 py-4 whitespace-nowrap overflow-hidden text-ellipsis" title={col.sortKey ? String((client as any)[col.sortKey]) : undefined}>{col.cell(client)}</td>)}
                 <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-3">
                        <button onClick={() => openModalForEdit(client)} className="text-muted-foreground hover:text-primary" title="Modifica Dettagli"><span className="text-xl">✏️</span></button>
                        <button onClick={() => handleStartInlineEdit(client)} className="text-muted-foreground hover:text-success" title="Modifica Rapida"><span className="text-xl">✏️</span></button>
                        <button onClick={() => deleteClient(client.id!)} className="text-muted-foreground hover:text-destructive" title="Elimina">
                           {isActionLoading(`deleteClient-${client.id}`) ? <SpinnerIcon className="w-5 h-5"/> : <span className="text-xl">🗑️</span>}
                        </button>
                    </div>
                </td>
            </tr>
        );
    };

    const renderMobileCard = (client: Client) => {
        const isEditing = inlineEditingId === client.id;
        const isSaving = isActionLoading(`updateClient-${client.id}`);
        if (isEditing) {
            return (
                <div key={client.id} className="p-4 rounded-lg shadow-md bg-card dark:bg-dark-card border border-primary">
                    <div className="space-y-3">
                        <div><label className="text-xs font-medium text-muted-foreground">Nome Cliente</label><input type="text" name="name" value={inlineEditingData!.name} onChange={handleInlineFormChange} className="w-full form-input p-1" /></div>
                        <div><label className="text-xs font-medium text-muted-foreground">Settore</label><SearchableSelect name="sector" value={inlineEditingData!.sector} onChange={handleInlineSelectChange} options={sectorOptions} placeholder="Seleziona settore" /></div>
                        <div><label className="text-xs font-medium text-muted-foreground">Email</label><input type="email" name="contactEmail" value={inlineEditingData!.contactEmail} onChange={handleInlineFormChange} className="w-full form-input p-1" /></div>
                        <div className="flex justify-end space-x-2 pt-2">
                             <button onClick={handleSaveInlineEdit} disabled={isSaving} className="p-2 bg-success/10 text-success rounded-full disabled:opacity-50">
                                {isSaving ? <SpinnerIcon className="w-5 h-5"/> : <span className="text-xl">✔️</span>}
                            </button>
                            <button onClick={handleCancelInlineEdit} className="p-2 bg-muted text-foreground rounded-full"><span className="text-xl">❌</span></button>
                        </div>
                    </div>
                </div>
            );
        }
        return (
            <div key={client.id} className="p-4 rounded-lg shadow-md bg-card dark:bg-dark-card">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="font-bold text-lg text-foreground dark:text-dark-foreground">{client.name}</p>
                        <p className="text-sm text-muted-foreground dark:text-dark-muted-foreground">{client.contactEmail}</p>
                    </div>
                    <div className="flex items-center space-x-1 flex-shrink-0 ml-4">
                        <button onClick={() => openModalForEdit(client)} className="p-1 text-muted-foreground hover:text-primary"><span className="text-xl">✏️</span></button>
                        <button onClick={() => handleStartInlineEdit(client)} className="p-1 text-muted-foreground hover:text-success"><span className="text-xl">✏️</span></button>
                        <button onClick={() => deleteClient(client.id!)} className="p-1 text-muted-foreground hover:text-destructive">
                             {isActionLoading(`deleteClient-${client.id}`) ? <SpinnerIcon className="w-5 h-5"/> : <span className="text-xl">🗑️</span>}
                        </button>
                    </div>
                </div>
                <div className="mt-4 pt-4 border-t border-border dark:border-dark-border text-sm">
                    <div><p className="text-muted-foreground dark:text-dark-muted-foreground">Settore</p><p className="font-medium text-foreground dark:text-dark-foreground">{client.sector}</p></div>
                </div>
            </div>
        );
    };

    const filtersNode = (
         <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <input type="text" name="name" value={filters.name} onChange={handleFilterChange} className="w-full form-input" placeholder="Cerca per nome..."/>
            <SearchableSelect name="sector" value={filters.sector} onChange={handleFilterSelectChange} options={sectorOptions} placeholder="Tutti i settori" />
            <button onClick={resetFilters} className="px-4 py-2 bg-muted text-foreground dark:bg-dark-muted dark:text-dark-foreground rounded-md hover:bg-muted/80 dark:hover:bg-dark-muted/80 w-full md:w-auto">Reset</button>
        </div>
    );
    
    return (
        <div>
            <DataTable
                title="Gestione Clienti"
                addNewButtonLabel="Aggiungi Cliente"
                data={filteredClients}
                columns={columns}
                filtersNode={filtersNode}
                onAddNew={openModalForNew}
                renderRow={renderRow}
                renderMobileCard={renderMobileCard}
                initialSortKey="name"
            />
            
            {editingClient && (
                <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={'id' in editingClient ? 'Modifica Cliente' : 'Aggiungi Cliente'}>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-foreground dark:text-dark-muted-foreground mb-1">Nome Cliente *</label>
                            <input type="text" name="name" value={editingClient.name} onChange={handleChange} required className="w-full form-input"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-foreground dark:text-dark-muted-foreground mb-1">Settore</label>
                             <SearchableSelect
                                name="sector"
                                value={editingClient.sector}
                                onChange={handleSelectChange}
                                options={sectorOptions}
                                placeholder="Seleziona un settore"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-foreground dark:text-dark-muted-foreground mb-1">Email Contatto *</label>
                            <input type="email" name="contactEmail" value={editingClient.contactEmail} onChange={handleChange} required className="w-full form-input"/>
                        </div>
                        <div className="flex justify-end space-x-3 pt-4">
                            <button type="button" onClick={handleCloseModal} className="px-4 py-2 bg-muted text-foreground dark:bg-dark-muted dark:text-dark-foreground rounded-md hover:bg-muted/80 dark:hover:bg-dark-muted/80">Annulla</button>
                             <button type="submit" disabled={isActionLoading('addClient') || isActionLoading(`updateClient-${'id' in editingClient ? editingClient.id : ''}`)} className="flex justify-center items-center px-4 py-2 bg-primary text-dark-foreground dark:text-dark-sidebar-foreground rounded-md hover:bg-primary-darker disabled:bg-primary/50">
                                {(isActionLoading('addClient') || isActionLoading(`updateClient-${'id' in editingClient ? editingClient.id : ''}`)) ? <SpinnerIcon className="w-5 h-5"/> : 'Salva'}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
             <style>{`.form-input, .form-select { display: block; width: 100%; border-radius: 0.375rem; border: 1px solid var(--color-border); background-color: var(--color-card); padding: 0.5rem 0.75rem; font-size: 0.875rem; line-height: 1.25rem; } .dark .form-input, .dark .form-select { border-color: var(--color-dark-border); background-color: var(--color-dark-card); color: var(--color-dark-foreground); }`}</style>
        </div>
    );
};

export default ClientsPage;