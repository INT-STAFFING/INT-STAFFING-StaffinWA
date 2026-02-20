
/**
 * @file RolesPage.tsx
 * @description Pagina per la gestione dei ruoli professionali (CRUD e visualizzazione).
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useAppState } from '../context/AppContext';
import { useResourcesContext } from '../context/ResourcesContext';
import { useLookupContext } from '../context/LookupContext';
import { Role } from '../types';
import Modal from '../components/Modal';
import SearchableSelect from '../components/SearchableSelect';
import { SpinnerIcon } from '../components/icons';
import { DataTable, ColumnDef } from '../components/DataTable';
import { formatCurrency } from '../utils/formatters';
import ExportButton from '../components/ExportButton';
import ConfirmationModal from '../components/ConfirmationModal';
import { useToast } from '../context/ToastContext';

const RolesPage: React.FC = () => {
    const { roles, addRole, updateRole, deleteRole } = useResourcesContext();
    const { seniorityLevels } = useLookupContext();
    const { isActionLoading, loading } = useAppState();
    const { addToast } = useToast();
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRole, setEditingRole] = useState<Role | Omit<Role, 'id'> | null>(null);
    const [filters, setFilters] = useState({ name: '', seniorityLevel: '' });
    
    // Deletion State
    const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);
    
    // Percentages Validation State
    const [pctSum, setPctSum] = useState(100);
    const [pctError, setPctError] = useState<string | null>(null);

    const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
    const [inlineEditingData, setInlineEditingData] = useState<Role | null>(null);

    const emptyRole: Omit<Role, 'id'> = { 
        name: '', 
        seniorityLevel: seniorityLevels[0]?.value || '', 
        dailyCost: 0, 
        standardCost: 0,
        dailyExpenses: 0,
        overheadPct: 0, // Default 0%
        chargeablePct: 100,
        trainingPct: 0,
        bdPct: 0
    };

    useEffect(() => {
        if (editingRole) {
            const sum = (editingRole.chargeablePct || 0) + (editingRole.trainingPct || 0) + (editingRole.bdPct || 0);
            setPctSum(sum);
            setPctError(Math.abs(sum - 100) > 0.01 ? `La somma deve essere 100% (Attuale: ${sum}%)` : null);
        }
    }, [editingRole?.chargeablePct, editingRole?.trainingPct, editingRole?.bdPct]);

    const filteredRoles = useMemo(() => {
        return roles.filter(role => {
            const nameMatch = role.name.toLowerCase().includes(filters.name.toLowerCase());
            const seniorityMatch = filters.seniorityLevel ? role.seniorityLevel === filters.seniorityLevel : true;
            return nameMatch && seniorityMatch;
        });
    }, [roles, filters]);

    const exportData = useMemo(() => {
        return filteredRoles.map(role => ({
            'Nome Ruolo': role.name,
            'Livello Seniority': role.seniorityLevel,
            'Costo Giornaliero': formatCurrency(role.dailyCost),
            'Costo Standard': formatCurrency(role.standardCost),
            'Overhead %': role.overheadPct || 0,
            'Overhead € (Calc)': formatCurrency(role.dailyExpenses),
            'Chargeable %': role.chargeablePct || 100,
            'Training %': role.trainingPct || 0,
            'BD %': role.bdPct || 0
        }));
    }, [filteredRoles]);

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const handleFilterSelectChange = (name: string, value: string) => setFilters(prev => ({ ...prev, [name]: value }));
    const resetFilters = () => setFilters({ name: '', seniorityLevel: '' });

    const openModalForNew = () => { setEditingRole(emptyRole); setIsModalOpen(true); };
    const openModalForEdit = (role: Role) => { 
        // Ensure defaults if missing from old data
        setEditingRole({ 
            ...role,
            dailyExpenses: role.dailyExpenses ?? 0,
            overheadPct: role.overheadPct ?? 0,
            chargeablePct: role.chargeablePct ?? 100,
            trainingPct: role.trainingPct ?? 0,
            bdPct: role.bdPct ?? 0
        }); 
        setIsModalOpen(true); 
        handleCancelInlineEdit(); 
    };
    const handleCloseModal = () => { setIsModalOpen(false); setEditingRole(null); };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (editingRole && !pctError) {
            try {
                if ('id' in editingRole) {
                    await updateRole(editingRole);
                    addToast('Ruolo aggiornato con successo', 'success');
                } else {
                    await addRole(editingRole);
                    addToast('Nuovo ruolo creato', 'success');
                }
                handleCloseModal();
            } catch (e: any) {
                // Error handled by context toast usually, but explicit here for safety
            }
        }
    };

    const handleDeleteConfirm = async () => {
        if (!roleToDelete) return;
        try {
            await deleteRole(roleToDelete.id!);
            addToast(`Ruolo "${roleToDelete.name}" eliminato.`, 'success');
            setRoleToDelete(null);
        } catch (e: any) {
            addToast(`Impossibile eliminare il ruolo. Potrebbe essere assegnato a delle risorse.`, 'error');
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (editingRole) {
            const { name, value } = e.target;
            const numericFields = ['dailyCost', 'standardCost', 'dailyExpenses', 'overheadPct', 'chargeablePct', 'trainingPct', 'bdPct'];
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
            const isNumeric = ['dailyCost', 'standardCost', 'overheadPct'].includes(name);
            setInlineEditingData({ ...inlineEditingData, [name]: isNumeric ? parseFloat(value) || 0 : value });
        }
    };
    
    const handleInlineSelectChange = (name: string, value: string) => {
        if (inlineEditingData) setInlineEditingData({ ...inlineEditingData, [name]: value });
    };

    const handleSaveInlineEdit = async () => { 
        if (inlineEditingData) { 
            try {
                await updateRole(inlineEditingData); 
                addToast('Ruolo aggiornato.', 'success');
                handleCancelInlineEdit(); 
            } catch (e) {
                // Error handled by context
            }
        } 
    };

    const seniorityOptions = useMemo(() => seniorityLevels.sort((a,b)=>a.value.localeCompare(b.value)).map(s => ({ value: s.value, label: s.value })), [seniorityLevels]);

    const columns: ColumnDef<Role>[] = [
        { header: 'Nome Ruolo', sortKey: 'name', cell: (role) => <span className="font-medium text-on-surface sticky left-0 bg-inherit pl-6">{role.name}</span> },
        { header: 'Livello Seniority', sortKey: 'seniorityLevel', cell: (role) => <span className="text-sm text-on-surface-variant">{role.seniorityLevel}</span> },
        { header: 'Costo Giornaliero', sortKey: 'dailyCost', cell: (role) => <span className="text-sm text-on-surface-variant">{formatCurrency(role.dailyCost)}</span> },
        { header: 'Overhead %', sortKey: 'overheadPct', cell: (role) => <span className="text-sm text-on-surface-variant">{role.overheadPct || 0}% <span className="text-[10px] opacity-70">({formatCurrency(role.dailyExpenses)})</span></span> },
        { header: 'Mix (Chg/Trn/BD)', cell: (role) => (
            <div className="flex gap-1 text-[10px]">
                <span className="bg-primary/20 text-primary px-1 rounded" title="Chargeable">{role.chargeablePct ?? 100}%</span>
                <span className="bg-tertiary/20 text-tertiary px-1 rounded" title="Training">{role.trainingPct ?? 0}%</span>
                <span className="bg-secondary/20 text-secondary px-1 rounded" title="BD">{role.bdPct ?? 0}%</span>
            </div>
        ) },
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
                    <td className="px-6 py-4"><input type="number" step="0.01" name="overheadPct" value={inlineEditingData!.overheadPct || 0} onChange={handleInlineFormChange} className="w-full form-input p-1"/></td>
                    <td className="px-6 py-4 text-xs text-on-surface-variant">Modifica dettagli per mix</td>
                    <td className="px-6 py-4 text-right sticky right-0 bg-inherit"><div className="flex items-center justify-end space-x-2">
                        <button onClick={handleSaveInlineEdit} disabled={isSaving} className="p-2 rounded-full hover:bg-surface-container text-primary transition-colors disabled:opacity-50">
                           {isSaving ? <SpinnerIcon className="w-5 h-5"/> : <span className="material-symbols-outlined">check</span>}
                        </button>
                        <button onClick={handleCancelInlineEdit} className="p-2 rounded-full hover:bg-surface-container text-on-surface-variant transition-colors"><span className="material-symbols-outlined">close</span></button>
                    </div></td>
                </tr>
            );
        }
        return (
            <tr key={role.id} className="group h-16 hover:bg-surface-container">
                {columns.map((col, i) => <td key={i} className={`px-6 py-4 whitespace-nowrap overflow-hidden text-ellipsis bg-inherit text-sm text-on-surface-variant`} title={col.sortKey ? String((role as any)[col.sortKey] || '') : undefined}>{col.cell(role)}</td>)}
                 <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium sticky right-0 bg-inherit">
                    <div className="flex items-center justify-end space-x-2">
                        <button onClick={() => openModalForEdit(role)} className="p-2 rounded-full hover:bg-surface-container text-on-surface-variant hover:text-primary transition-colors" title="Modifica Dettagli"><span className="material-symbols-outlined">edit_note</span></button>
                        <button onClick={() => handleStartInlineEdit(role)} className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container hover:text-primary transition-colors" title="Modifica Rapida"><span className="material-symbols-outlined">edit</span></button>
                        <button onClick={() => setRoleToDelete(role)} className="p-2 rounded-full hover:bg-surface-container text-on-surface-variant hover:text-error transition-colors" title="Elimina">
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
                         <div><label className="text-xs font-medium text-on-surface-variant">Costo Giornaliero</label><input type="number" step="0.01" name="dailyCost" value={editingRole?.dailyCost} onChange={handleChange} className="w-full form-input p-1"/></div>
                         <div><label className="text-xs font-medium text-on-surface-variant">Overhead %</label><input type="number" step="0.01" name="overheadPct" value={editingRole?.overheadPct || 0} onChange={handleChange} className="w-full form-input p-1"/></div>
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
                        <button onClick={() => setRoleToDelete(role)} className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container-high">
                             {isActionLoading(`deleteRole-${role.id}`) ? <SpinnerIcon className="w-5 h-5"/> : <span className="material-symbols-outlined">delete</span>}
                        </button>
                    </div>
                </div>
                <div className="mt-4 pt-4 border-t border-outline-variant grid grid-cols-2 gap-4 text-sm">
                    <div><p className="text-on-surface-variant">Costo Giornaliero</p><p className="font-medium text-on-surface">{formatCurrency(role.dailyCost)}</p></div>
                    <div><p className="text-on-surface-variant">Overhead</p><p className="font-medium text-on-surface">{role.overheadPct || 0}%</p></div>
                    <div className="col-span-2">
                        <p className="text-on-surface-variant">Mix (C/T/B)</p>
                        <p className="font-medium text-on-surface">{role.chargeablePct || 100}% / {role.trainingPct || 0}% / {role.bdPct || 0}%</p>
                    </div>
                </div>
            </div>
        );
    };

    const filtersNode = (
         <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <input type="text" name="name" value={filters.name} onChange={handleFilterChange} className="w-full form-input" placeholder="Cerca per nome..."/>
            <SearchableSelect name="seniorityLevel" value={filters.seniorityLevel} onChange={handleFilterSelectChange} options={seniorityOptions} placeholder="Tutti i livelli" />
            <button onClick={resetFilters} className="px-6 py-2 bg-secondary-container text-on-secondary-container font-semibold rounded-full hover:opacity-90 w-full md:w-auto">Reset</button>
        </div>
    );

    const calculatedOverhead = (editingRole?.dailyCost || 0) * ((editingRole?.overheadPct || 0) / 100);

    return (
        <div className="space-y-6">
            <DataTable
                title="Gestione Ruoli"
                addNewButtonLabel="Aggiungi Ruolo"
                data={filteredRoles}
                columns={columns}
                filtersNode={filtersNode}
                onAddNew={openModalForNew}
                renderRow={renderRow}
                renderMobileCard={renderMobileCard}
                headerActions={<ExportButton data={exportData} title="Gestione Ruoli" />}
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
                    <form onSubmit={handleSubmit} className="space-y-6">
                        
                        {/* Sezione Identità Ruolo */}
                        <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant">
                            <h4 className="text-sm font-bold text-primary mb-4 uppercase tracking-wider flex items-center gap-2">
                                <span className="material-symbols-outlined text-lg">badge</span> Definizione Ruolo
                            </h4>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-on-surface-variant mb-1">Nome Ruolo *</label>
                                    <input type="text" name="name" value={editingRole.name} onChange={handleChange} required className="form-input" placeholder="es. Senior Developer" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-on-surface-variant mb-1">Livello Seniority</label>
                                    <SearchableSelect name="seniorityLevel" value={editingRole.seniorityLevel} onChange={handleSelectChange} options={seniorityOptions} placeholder="Seleziona un livello" />
                                </div>
                            </div>
                        </div>

                        {/* Sezione Costi */}
                        <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant">
                            <h4 className="text-sm font-bold text-primary mb-4 uppercase tracking-wider flex items-center gap-2">
                                <span className="material-symbols-outlined text-lg">payments</span> Parametri Economici
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-on-surface-variant mb-1">Costo Giornaliero (€) *</label>
                                    <input type="number" step="0.01" name="dailyCost" value={editingRole.dailyCost} onChange={handleChange} required className="form-input" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-on-surface-variant mb-1">Costo Standard (€)</label>
                                    <input type="number" step="0.01" name="standardCost" value={editingRole.standardCost || 0} onChange={handleChange} className="form-input" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-on-surface-variant mb-1">Overhead (%)</label>
                                    <input type="number" step="0.01" name="overheadPct" value={editingRole.overheadPct || 0} onChange={handleChange} className="form-input" />
                                    <p className="text-[10px] text-on-surface-variant mt-1">Corrisponde a: <span className="font-mono text-primary font-bold">{formatCurrency(calculatedOverhead)}</span> al giorno</p>
                                </div>
                            </div>
                        </div>

                        {/* Sezione Mix Attività */}
                        <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant">
                            <h4 className="text-sm font-bold text-primary mb-4 uppercase tracking-wider flex items-center gap-2">
                                <span className="material-symbols-outlined text-lg">pie_chart</span> Mix Attività
                            </h4>
                            <div className="grid grid-cols-3 gap-2 text-center">
                                <div>
                                    <label className="block text-xs font-bold text-primary mb-1">Chargeable %</label>
                                    <input type="number" name="chargeablePct" min="0" max="100" value={editingRole.chargeablePct} onChange={handleChange} className="form-input text-center font-bold" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-tertiary mb-1">Training %</label>
                                    <input type="number" name="trainingPct" min="0" max="100" value={editingRole.trainingPct} onChange={handleChange} className="form-input text-center font-bold" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-secondary mb-1">BD %</label>
                                    <input type="number" name="bdPct" min="0" max="100" value={editingRole.bdPct} onChange={handleChange} className="form-input text-center font-bold" />
                                </div>
                            </div>
                            <div className="mt-2">
                                <div className="h-2 w-full bg-surface-variant rounded-full overflow-hidden flex">
                                    <div className="h-full bg-primary" style={{ width: `${editingRole.chargeablePct || 0}%` }}></div>
                                    <div className="h-full bg-tertiary" style={{ width: `${editingRole.trainingPct || 0}%` }}></div>
                                    <div className="h-full bg-secondary" style={{ width: `${editingRole.bdPct || 0}%` }}></div>
                                </div>
                                <div className={`text-xs mt-1 font-bold text-right ${pctError ? 'text-error' : 'text-on-surface-variant'}`}>
                                    Totale: {pctSum}%
                                </div>
                                {pctError && <p className="text-xs text-error mt-1">{pctError}</p>}
                            </div>
                        </div>

                        <div className="flex justify-end space-x-3 pt-4 border-t border-outline-variant mt-4">
                            <button type="button" onClick={handleCloseModal} className="px-6 py-2 border border-outline rounded-full hover:bg-surface-container-low text-primary font-semibold transition-colors">Annulla</button>
                             <button type="submit" disabled={!!pctError || isActionLoading('addRole') || isActionLoading(`updateRole-${'id' in editingRole ? editingRole.id : ''}`)} className="flex justify-center items-center px-6 py-2 bg-primary text-on-primary rounded-full disabled:opacity-50 font-semibold hover:opacity-90 shadow-sm transition-all">
                                {(isActionLoading('addRole') || isActionLoading(`updateRole-${'id' in editingRole ? editingRole.id : ''}`)) ? <SpinnerIcon className="w-5 h-5"/> : 'Salva'}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            {/* Confirmation Modal for Deletion */}
            {roleToDelete && (
                <ConfirmationModal 
                    isOpen={!!roleToDelete}
                    onClose={() => setRoleToDelete(null)}
                    onConfirm={handleDeleteConfirm}
                    title="Elimina Ruolo"
                    message={
                        <>
                            Sei sicuro di voler eliminare il ruolo <strong>{roleToDelete.name}</strong>?
                            <br/>
                            <span className="text-sm text-error block mt-2">
                                Attenzione: Se il ruolo è assegnato a delle risorse, l'eliminazione fallirà.
                            </span>
                        </>
                    }
                    isConfirming={isActionLoading(`deleteRole-${roleToDelete.id}`)}
                />
            )}
        </div>
    );
};

export default RolesPage;
