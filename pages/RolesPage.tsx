/**
 * @file RolesPage.tsx
 * @description Pagina per la gestione dei ruoli professionali (CRUD e visualizzazione).
 */

import React, { useState, useMemo } from 'react';
import { useEntitiesContext } from '../context/AppContext';
import { Role } from '../types';
import Modal from '../components/Modal';
import SearchableSelect from '../components/SearchableSelect';
import { SpinnerIcon } from '../components/icons';
import { DataTable, ColumnDef } from '../components/DataTable';
import { formatCurrency } from '../utils/formatters';
import { ExportButton } from '@/components/shared/ExportButton';

const RolesPage: React.FC = () => {
    const { roles, seniorityLevels, addRole, updateRole, deleteRole, isActionLoading, loading } = useEntitiesContext();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRole, setEditingRole] = useState<Role | Omit<Role, 'id'> | null>(null);
    const [filters, setFilters] = useState({ name: '', seniorityLevel: '' });
    
    const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
    const [inlineEditingData, setInlineEditingData] = useState<Role | null>(null);

    const emptyRole: Omit<Role, 'id'> = { name: '', seniorityLevel: seniorityLevels[0]?.value || '', dailyCost: 0, standardCost: 0 };

    const filteredRoles = useMemo(() => {
        return roles.filter(role => {
            const nameMatch = role.name.toLowerCase().includes(filters.name.toLowerCase());
            const seniorityMatch = filters.seniorityLevel ? role.seniorityLevel === filters.seniorityLevel : true;
            return nameMatch && seniorityMatch;
        });
    }, [roles, filters]);

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const handleFilterSelectChange = (name: string, value: string) => setFilters(prev => ({ ...prev, [name]: value }));
    const resetFilters = () => setFilters({ name: '', seniorityLevel: '' });

    const openModalForNew = () => { setEditingRole(emptyRole); setIsModalOpen(true); };
    const openModalForEdit = (role: Role) => { setEditingRole(role); setIsModalOpen(true); handleCancelInlineEdit(); };
    const handleCloseModal = () => { setIsModalOpen(false); setEditingRole(null); };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (editingRole) {
            try {
                if ('id' in editingRole) await updateRole(editingRole);
                else await addRole(editingRole);
                handleCloseModal();
            } catch (e) {}
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (editingRole) {
            const { name, value } = e.target;
            const numericFields = ['dailyCost', 'standardCost'];
            setEditingRole({ ...editingRole, [name]: numericFields.includes(name) ? parseFloat(value) || 0 : value } as Role | Omit<Role, 'id'>);
        }
    };

    const handleSelectChange = (name: string, value: string) => {
        if (editingRole) setEditingRole({ ...editingRole, [name]: value });
    };
    
    const handleStartInlineEdit = (role: Role) => { setInlineEditingId(role.id!); setInlineEditingData({ ...role }); };
    const handleCancelInlineEdit = () => { setInlineEditingId(null); setInlineEditingData(null); };

    const handleInlineFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (inlineEditingData) {
            const { name, value } = e.target;
            const isNumeric = ['dailyCost', 'standardCost'].includes(name);
            setInlineEditingData({ ...inlineEditingData, [name]: isNumeric ? parseFloat(value) || 0 : value });
        }
    };
    
    const handleInlineSelectChange = (name: string, value: string) => {
        if (inlineEditingData) setInlineEditingData({ ...inlineEditingData, [name]: value });
    };

    const handleSaveInlineEdit = async () => { if (inlineEditingData) { await updateRole(inlineEditingData); handleCancelInlineEdit(); } };

    const seniorityOptions = useMemo(() => seniorityLevels.sort((a,b)=>a.value.localeCompare(b.value)).map(s => ({ value: s.value, label: s.value })), [seniorityLevels]);

    const columns: ColumnDef<Role>[] = [
        { header: 'Nome Ruolo', sortKey: 'name', cell: (role) => <span className="font-medium text-on-surface sticky left-0 bg-inherit pl-6">{role.name}</span> },
        { header: 'Livello Seniority', sortKey: 'seniorityLevel', cell: (role) => <span className="text-sm text-on-surface-variant">{role.seniorityLevel}</span> },
        { header: 'Costo Giornaliero', sortKey: 'dailyCost', cell: (role) => <span className="text-sm text-on-surface-variant">{formatCurrency(role.dailyCost)}</span> },
        { header: 'Costo Standard', sortKey: 'standardCost', cell: (role) => <span className="text-sm text-on-surface-variant">{formatCurrency(role.standardCost)}</span> },
        { header: 'Spese Giornaliere', sortKey: 'dailyExpenses', cell: (role) => <span className="text-sm text-on-surface-variant">{formatCurrency(role.dailyExpenses)}</span> },
    ];
    
    const renderRow = (role: Role) => {
        const isEditing = inlineEditingId === role.id;
        const isSaving = isActionLoading(`updateRole-${role.id}`);
        if (isEditing) {
            return (
                <tr key={role.id} className="h-16">
                    <td className="px-6 py-4 sticky left-0 bg-inherit"><input type="text" name="name" value={inlineEditingData!.name} onChange={handleInlineFormChange} className="w-full form-input p-1"/></td>
                    <td className="px-6 py-4"><SearchableSelect name="seniorityLevel" value={inlineEditingData!.seniorityLevel} onChange={handleInlineSelectChange} options={seniorityOptions} placeholder="Seleziona livello"/></td>
                    <td className="px-6 py-4"><input type="number" step="0.01" name="dailyCost" value={inlineEditingData!.dailyCost} onChange={handleInlineFormChange} className="w-full form-input p-1"/></td>
                    <td className="px-6 py-4"><input type="number" step="0.01" name="standardCost" value={inlineEditingData!.standardCost || 0} onChange={handleInlineFormChange} className="w-full form-input p-1"/></td>
                    <td className="px-6 py-4 text-sm">{formatCurrency((inlineEditingData!.dailyCost || 0) * 0.035)}</td>
                    <td className="px-6 py-4 text-right sticky right-0 bg-inherit"><div className="flex items-center justify-end space-x-2">
                        <button onClick={handleSaveInlineEdit} disabled={isSaving} className="p-2 rounded-full hover:bg-surface-container text-primary disabled:opacity-50">
                           {isSaving ? <SpinnerIcon className="w-5 h-5"/> : <span className="material-symbols-outlined">check</span>}
                        </button>
                        <button onClick={handleCancelInlineEdit} className="p-2 rounded-full hover:bg-surface-container text-on-surface-variant"><span className="material-symbols-outlined">close</span></button>
                    </div></td>
                </tr>
            );
        }
        return (
            <tr key={role.id} className="group h-16 hover:bg-surface-container">
                {columns.map((col, i) => <td key={i} className={`px-6 py-4 whitespace-nowrap overflow-hidden text-ellipsis bg-inherit`} title={col.sortKey ? String((role as any)[col.sortKey] || '') : undefined}>{col.cell(role)}</td>)}
                 <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium sticky right-0 bg-inherit">
                    <div className="flex items-center justify-end space-x-2">
                        <button onClick={() => openModalForEdit(role)} className="p-2 rounded-full hover:bg-surface-container text-on-surface-variant hover:text-primary" title="Modifica Dettagli"><span className="material-symbols-outlined">edit_note</span></button>
                        <button onClick={() => handleStartInlineEdit(role)} className="p-2 rounded-full hover:bg-surface-container text-on-surface-variant hover:text-primary" title="Modifica Rapida"><span className="material-symbols-outlined">edit</span></button>
                        <button onClick={() => deleteRole(role.id!)} className="p-2 rounded-full hover:bg-surface-container text-on-surface-variant hover:text-error" title="Elimina">
                           {isActionLoading(`deleteRole-${role.id}`) ? <SpinnerIcon className="w-5 h-5"/> : <span className="material-symbols-outlined">delete</span>}
                        </button>
                    </div>
                </td>
            </tr>
        );
    };

    const renderMobileCard = (role: Role) => {
        const isEditing = inlineEditingId === role.id;
        const isSaving = isActionLoading(`updateRole-${role.id}`);
        if (isEditing) {
             return (
                <div key={role.id} className="p-4 rounded-lg shadow-md bg-surface-container border border-primary">
                    <div className="space-y-3">
                         <div><label className="text-xs font-medium text-on-surface-variant">Nome Ruolo</label><input type="text" name="name" value={inlineEditingData!.name} onChange={handleInlineFormChange} className="w-full form-input p-1"/></div>
                         <div><label className="text-xs font-medium text-on-surface-variant">Livello</label><SearchableSelect name="seniorityLevel" value={inlineEditingData!.seniorityLevel} onChange={handleInlineSelectChange} options={seniorityOptions} placeholder="Seleziona livello"/></div>
                         <div><label className="text-xs font-medium text-on-surface-variant">Costo Giornaliero</label><input type="number" step="0.01" name="dailyCost" value={inlineEditingData!.dailyCost} onChange={handleInlineFormChange} className="w-full form-input p-1"/></div>
                         <div><label className="text-xs font-medium text-on-surface-variant">Costo Standard</label><input type="number" step="0.01" name="standardCost" value={inlineEditingData!.standardCost || 0} onChange={handleInlineFormChange} className="w-full form-input p-1"/></div>
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
            <div key={role.id} className="p-4 rounded-lg shadow-md bg-surface-container border-l-4 border-primary">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="font-bold text-lg text-on-surface">{role.name}</p>
                        <p className="text-sm text-on-surface-variant">{role.seniorityLevel}</p>
                    </div>
                    <div className="flex items-center space-x-1 flex-shrink-0 ml-4">
                        <button onClick={() => openModalForEdit(role)} className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container-high"><span className="material-symbols-outlined">edit_note</span></button>
                        <button onClick={() => handleStartInlineEdit(role)} className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container-high"><span className="material-symbols-outlined">edit</span></button>
                        <button onClick={() => deleteRole(role.id!)} className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container-high">
                             {isActionLoading(`deleteRole-${role.id}`) ? <SpinnerIcon className="w-5 h-5"/> : <span className="material-symbols-outlined">delete</span>}
                        </button>
                    </div>
                </div>
                <div className="mt-4 pt-4 border-t border-outline-variant grid grid-cols-2 gap-4 text-sm">
                    <div><p className="text-on-surface-variant">Costo Giornaliero</p><p className="font-medium text-on-surface">{formatCurrency(role.dailyCost)}</p></div>
                    <div><p className="text-on-surface-variant">Costo Standard</p><p className="font-medium text-on-surface">{formatCurrency(role.standardCost)}</p></div>
                </div>
            </div>
        );
    };

    const filtersNode = (
         <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <input type="text" name="name" value={filters.name} onChange={handleFilterChange} className="w-full form-input" placeholder="Cerca per nome..."/>
            <SearchableSelect name="seniorityLevel" value={filters.seniorityLevel} onChange={handleFilterSelectChange} options={seniorityOptions} placeholder="Tutti i livelli" />
            <button onClick={resetFilters} className="px-4 py-2 bg-surface-container-high text-on-surface-variant rounded-full hover:bg-surface-container-highest w-full md:w-auto">Reset</button>
        </div>
    );

    return (
        <div>
            <DataTable
                title="Gestione Ruoli"
                addNewButtonLabel="Aggiungi Ruolo"
                data={filteredRoles}
                columns={columns}
                filtersNode={filtersNode}
                onAddNew={openModalForNew}
                renderRow={renderRow}
                renderMobileCard={renderMobileCard}
                headerActions={<ExportButton data={filteredRoles} title="Gestione Ruoli" />}
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
            
            {editingRole && (
                <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={'id' in editingRole ? 'Modifica Ruolo' : 'Aggiungi Ruolo'}>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-on-surface-variant mb-1">Nome Ruolo *</label>
                            <input type="text" name="name" value={editingRole.name} onChange={handleChange} required className="form-input"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-on-surface-variant mb-1">Livello Seniority</label>
                            <SearchableSelect name="seniorityLevel" value={editingRole.seniorityLevel} onChange={handleSelectChange} options={seniorityOptions} placeholder="Seleziona un livello" />
                        </div>
                         <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-on-surface-variant mb-1">Costo Giornaliero (€) *</label>
                                <input type="number" step="0.01" name="dailyCost" value={editingRole.dailyCost} onChange={handleChange} required className="form-input"/>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-on-surface-variant mb-1">Costo Standard (€)</label>
                                <input type="number" step="0.01" name="standardCost" value={editingRole.standardCost || 0} onChange={handleChange} className="form-input"/>
                            </div>
                        </div>
                        <div className="flex justify-end space-x-3 pt-4 border-t border-outline-variant mt-4">
                            <button type="button" onClick={handleCloseModal} className="px-6 py-2 border border-outline rounded-full hover:bg-surface-container-low text-primary font-semibold">Annulla</button>
                             <button type="submit" disabled={isActionLoading('addRole') || isActionLoading(`updateRole-${'id' in editingRole ? editingRole.id : ''}`)} className="flex justify-center items-center px-6 py-2 bg-primary text-on-primary rounded-full disabled:opacity-50 font-semibold hover:opacity-90">
                                {(isActionLoading('addRole') || isActionLoading(`updateRole-${'id' in editingRole ? editingRole.id : ''}`)) ? <SpinnerIcon className="w-5 h-5"/> : 'Salva'}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
};

export default RolesPage;
