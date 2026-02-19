
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useEntitiesContext } from '../context/AppContext';
import { Client } from '../types';
import Modal from '../components/Modal';
import SearchableSelect from '../components/SearchableSelect';
import { SpinnerIcon } from '../components/icons';
import { DataTable, ColumnDef } from '../components/DataTable';
import ExportButton from '../components/ExportButton';
import PdfExportButton from '../components/PdfExportButton';
import { PdfExportConfig, CHART_PALETTE } from '../utils/pdfExportUtils';
import { useSearchParams } from 'react-router-dom';

/**
 * Componente per la pagina di gestione dei Clienti.
 * Permette di visualizzare, filtrare, aggiungere, modificare ed eliminare clienti.
 * @returns {React.ReactElement} La pagina di gestione dei clienti.
 */
const ClientsPage: React.FC = () => {
    const { clients, clientSectors, addClient, updateClient, deleteClient, isActionLoading, loading, projects } = useEntitiesContext();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingClient, setEditingClient] = useState<Client | Omit<Client, 'id'> | null>(null);
    const [filters, setFilters] = useState({ name: '', sector: '' });
    
    // Stati per la gestione della modifica inline.
    const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
    const [inlineEditingData, setInlineEditingData] = useState<Client | null>(null);

    const [searchParams, setSearchParams] = useSearchParams();

    const emptyClient: Omit<Client, 'id'> = { name: '', sector: clientSectors[0]?.value || '', contactEmail: '' };

    // Deep Linking
    useEffect(() => {
        const editId = searchParams.get('editId');
        if (editId && !isModalOpen && clients.length > 0) {
            const target = clients.find(c => c.id === editId);
            if (target) {
                openModalForEdit(target);
                setSearchParams({});
            }
        }
    }, [searchParams, setSearchParams, clients, isModalOpen]);

    // KPI Calculations
    const kpis = useMemo(() => {
        const totalClients = clients.length;
        
        const activeProjectClientIds = new Set(
            projects.filter(p => p.status === 'In corso' && p.clientId).map(p => p.clientId)
        );
        const activeClients = clients.filter(c => activeProjectClientIds.has(c.id)).length;
    
        const sectors = new Set(clients.map(c => c.sector).filter(Boolean));
        
        return { totalClients, activeClients, totalSectors: sectors.size };
    }, [clients, projects]);

    const filteredClients = useMemo(() => {
        return clients.filter(client => {
            const nameMatch = client.name.toLowerCase().includes(filters.name.toLowerCase());
            const sectorMatch = filters.sector ? client.sector === filters.sector : true;
            return nameMatch && sectorMatch;
        });
    }, [clients, filters]);
    
    const exportData = useMemo(() => {
        return filteredClients.map(client => ({
            'Nome Cliente': client.name,
            'Settore': client.sector,
            'Email Contatto': client.contactEmail
        }));
    }, [filteredClients]);

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

    const buildPdfConfig = useCallback((): PdfExportConfig => {
      const sectorCounts: Record<string, number> = {};
      filteredClients.forEach(c => {
        const sector = c.sector || 'Non definito';
        sectorCounts[sector] = (sectorCounts[sector] || 0) + 1;
      });

      const projectsPerClient = filteredClients.map(c => ({
        name: c.name.length > 20 ? c.name.substring(0, 20) + '...' : c.name,
        count: projects.filter(p => p.clientId === c.id).length,
      })).sort((a, b) => b.count - a.count).slice(0, 10);

      return {
        title: 'Gestione Clienti',
        subtitle: `${filteredClients.length} clienti`,
        charts: [
          {
            title: 'Clienti per Settore',
            chartJs: {
              type: 'doughnut',
              data: {
                labels: Object.keys(sectorCounts),
                datasets: [{ data: Object.values(sectorCounts), backgroundColor: CHART_PALETTE }],
              },
              options: { plugins: { legend: { position: 'bottom' } } },
            },
          },
          {
            title: 'Top 10 Clienti per Numero Progetti',
            chartJs: {
              type: 'bar',
              data: {
                labels: projectsPerClient.map(c => c.name),
                datasets: [{ label: 'Progetti', data: projectsPerClient.map(c => c.count), backgroundColor: CHART_PALETTE[1] }],
              },
              options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } },
            },
          },
        ],
        tables: [
          {
            title: 'Elenco Clienti',
            head: [['Nome Cliente', 'Settore', 'Email Contatto']],
            body: exportData.map(row => [
              String(row['Nome Cliente'] ?? ''),
              String(row['Settore'] ?? ''),
              String(row['Email Contatto'] ?? ''),
            ]),
          },
        ],
      };
    }, [filteredClients, exportData, projects]);

    const columns: ColumnDef<Client>[] = [
        { header: 'Nome Cliente', sortKey: 'name', cell: (client) => <span className="font-medium text-on-surface sticky left-0 bg-inherit pl-6">{client.name}</span> },
        { header: 'Settore', sortKey: 'sector', cell: (client) => <span className="text-sm text-on-surface-variant">{client.sector}</span> },
        { header: 'Email Contatto', sortKey: 'contactEmail', cell: (client) => <span className="text-sm text-on-surface-variant">{client.contactEmail}</span> },
    ];
    
    const renderRow = (client: Client) => {
        const isEditing = inlineEditingId === client.id;
        const isSaving = isActionLoading(`updateClient-${client.id}`);
        if (isEditing) {
            return (
                <tr key={client.id} className="h-16">
                    <td className="px-6 py-4 sticky left-0 bg-inherit"><input type="text" name="name" value={inlineEditingData!.name} onChange={handleInlineFormChange} className="w-full form-input p-1" /></td>
                    <td className="px-6 py-4"><SearchableSelect name="sector" value={inlineEditingData!.sector} onChange={handleInlineSelectChange} options={sectorOptions} placeholder="Seleziona settore" /></td>
                    <td className="px-6 py-4"><input type="email" name="contactEmail" value={inlineEditingData!.contactEmail} onChange={handleInlineFormChange} className="w-full form-input p-1" /></td>
                    <td className="px-6 py-4 text-right sticky right-0 bg-inherit">
                        <div className="flex items-center justify-end space-x-2">
                            <button onClick={handleSaveInlineEdit} disabled={isSaving} className="p-2 rounded-full text-tertiary hover:bg-surface-container disabled:opacity-50">
                                {isSaving ? <SpinnerIcon className="w-5 h-5"/> : <span className="material-symbols-outlined">check</span>}
                            </button>
                            <button onClick={handleCancelInlineEdit} className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container"><span className="material-symbols-outlined">close</span></button>
                        </div>
                    </td>
                </tr>
            );
        }
        return (
             <tr key={client.id} className="group h-16 hover:bg-surface-container">
                {columns.map((col, i) => <td key={i} className={`px-6 py-4 whitespace-nowrap overflow-hidden text-ellipsis bg-inherit`} title={col.sortKey ? String((client as any)[col.sortKey]) : undefined}>{col.cell(client)}</td>)}
                 <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium sticky right-0 bg-inherit">
                    <div className="flex items-center justify-end space-x-2">
                        <button onClick={() => openModalForEdit(client)} className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container hover:text-primary" title="Modifica Dettagli"><span className="material-symbols-outlined">edit_note</span></button>
                        <button onClick={() => handleStartInlineEdit(client)} className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container hover:text-primary" title="Modifica Rapida"><span className="material-symbols-outlined">edit</span></button>
                        <button onClick={() => deleteClient(client.id!)} className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container hover:text-error" title="Elimina">
                           {isActionLoading(`deleteClient-${client.id}`) ? <SpinnerIcon className="w-5 h-5"/> : <span className="material-symbols-outlined">delete</span>}
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
                <div key={client.id} className="p-4 rounded-lg shadow-md bg-surface-container border border-primary">
                    <div className="space-y-3">
                        <div><label className="text-xs font-medium text-on-surface-variant">Nome Cliente</label><input type="text" name="name" value={inlineEditingData!.name} onChange={handleInlineFormChange} className="w-full form-input p-1" /></div>
                        <div><label className="text-xs font-medium text-on-surface-variant">Settore</label><SearchableSelect name="sector" value={inlineEditingData!.sector} onChange={handleInlineSelectChange} options={sectorOptions} placeholder="Seleziona settore" /></div>
                        <div><label className="text-xs font-medium text-on-surface-variant">Email</label><input type="email" name="contactEmail" value={inlineEditingData!.contactEmail} onChange={handleInlineFormChange} className="w-full form-input p-1" /></div>
                        <div className="flex justify-end space-x-2 pt-2">
                             <button onClick={handleSaveInlineEdit} disabled={isSaving} className="p-2 bg-primary-container text-on-primary-container rounded-full disabled:opacity-50">
                                {isSaving ? <SpinnerIcon className="w-5 h-5"/> : <span className="material-symbols-outlined">check</span>}
                            </button>
                            <button onClick={handleCancelInlineEdit} className="p-2 bg-surface-container-high text-on-surface-variant rounded-full"><span className="material-symbols-outlined">close</span></button>
                        </div>
                    </div>
                </div>
            );
        }
        return (
            <div key={client.id} className="p-4 rounded-lg shadow-md bg-surface-container border-l-4 border-primary">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="font-bold text-lg text-on-surface">{client.name}</p>
                        <p className="text-sm text-on-surface-variant">{client.contactEmail}</p>
                    </div>
                    <div className="flex items-center space-x-1 flex-shrink-0 ml-4">
                        <button onClick={() => openModalForEdit(client)} className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container-high"><span className="material-symbols-outlined">edit_note</span></button>
                        <button onClick={() => handleStartInlineEdit(client)} className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container-high"><span className="material-symbols-outlined">edit</span></button>
                        <button onClick={() => deleteClient(client.id!)} className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container-high">
                             {isActionLoading(`deleteClient-${client.id}`) ? <SpinnerIcon className="w-5 h-5"/> : <span className="material-symbols-outlined">delete</span>}
                        </button>
                    </div>
                </div>
                <div className="mt-4 pt-4 border-t border-outline-variant text-sm">
                    <div><p className="text-on-surface-variant">Settore</p><p className="font-medium text-on-surface">{client.sector}</p></div>
                </div>
            </div>
        );
    };

    const filtersNode = (
         <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <input type="text" name="name" value={filters.name} onChange={handleFilterChange} className="w-full form-input" placeholder="Cerca per nome..."/>
            <SearchableSelect name="sector" value={filters.sector} onChange={handleFilterSelectChange} options={sectorOptions} placeholder="Tutti i settori" />
            <button onClick={resetFilters} className="px-4 py-2 bg-surface-container-high text-on-surface-variant rounded-full hover:bg-surface-container-highest w-full md:w-auto">Reset</button>
        </div>
    );
    
    return (
        <div>
             {/* KPI Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-surface-container-low p-4 rounded-2xl shadow border-l-4 border-primary">
                    <p className="text-sm text-on-surface-variant">Totale Clienti</p>
                    <p className="text-2xl font-bold text-on-surface">{kpis.totalClients}</p>
                </div>
                <div className="bg-surface-container-low p-4 rounded-2xl shadow border-l-4 border-tertiary">
                     <p className="text-sm text-on-surface-variant">Clienti Attivi</p>
                     <p className="text-2xl font-bold text-on-surface">{kpis.activeClients}</p>
                </div>
                <div className="bg-surface-container-low p-4 rounded-2xl shadow border-l-4 border-secondary">
                     <p className="text-sm text-on-surface-variant">Settori Coperti</p>
                     <p className="text-2xl font-bold text-on-surface">{kpis.totalSectors}</p>
                </div>
            </div>

            <DataTable
                title="Gestione Clienti"
                addNewButtonLabel="Aggiungi Cliente"
                data={filteredClients}
                columns={columns}
                filtersNode={filtersNode}
                onAddNew={openModalForNew}
                renderRow={renderRow}
                renderMobileCard={renderMobileCard}
                headerActions={<><ExportButton data={exportData} title="Gestione Clienti" /><PdfExportButton buildConfig={buildPdfConfig} /></>}
                initialSortKey="name"
                isLoading={loading}
                tableLayout={{
                    dense: true,
                    striped: true,
                    headerSticky: true,
                    headerBackground: true,
                    headerBorder: true,
                }}
                tableClassNames={{
                    base: 'w-full text-sm',
                }}
                numActions={3} // MODIFICA, EDIT VELOCE, ELIMINA
            />
            
            {editingClient && (
                <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={'id' in editingClient ? 'Modifica Cliente' : 'Aggiungi Cliente'}>
                     <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Sezione Dati Aziendali */}
                        <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant">
                            <h4 className="text-sm font-bold text-primary mb-4 uppercase tracking-wider flex items-center gap-2">
                                <span className="material-symbols-outlined text-lg">business</span> Dati Aziendali
                            </h4>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-on-surface-variant mb-1">Nome Cliente *</label>
                                    <input type="text" name="name" value={editingClient.name} onChange={handleChange} required className="form-input" placeholder="es. Mario Rossi SPA"/>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-on-surface-variant mb-1">Settore</label>
                                     <SearchableSelect
                                        name="sector"
                                        value={editingClient.sector}
                                        onChange={handleSelectChange}
                                        options={sectorOptions}
                                        placeholder="Seleziona un settore"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-on-surface-variant mb-1">Email Contatto *</label>
                                    <input type="email" name="contactEmail" value={editingClient.contactEmail} onChange={handleChange} required className="form-input" placeholder="es. info@cliente.it"/>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end space-x-3 pt-4 border-t border-outline-variant mt-4">
                            <button type="button" onClick={handleCloseModal} className="px-6 py-2 border border-outline rounded-full hover:bg-surface-container-low text-primary font-semibold transition-colors">Annulla</button>
                             <button type="submit" disabled={isActionLoading('addClient') || isActionLoading(`updateClient-${'id' in editingClient ? editingClient.id : ''}`)} className="flex justify-center items-center px-6 py-2 bg-primary text-on-primary rounded-full disabled:opacity-50 font-semibold hover:opacity-90 shadow-sm transition-all">
                                {(isActionLoading('addClient') || isActionLoading(`updateClient-${'id' in editingClient ? editingClient.id : ''}`)) ? <SpinnerIcon className="w-5 h-5"/> : 'Salva'}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
};

export default ClientsPage;
