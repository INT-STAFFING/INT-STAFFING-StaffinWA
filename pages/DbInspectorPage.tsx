
import React, { useState, useEffect } from 'react';
import { useToast } from '../context/ToastContext';
import { SpinnerIcon } from '../components/icons';
import ConfirmationModal from '../components/ConfirmationModal';
import { formatCurrency } from '../utils/formatters';
import { useAuth } from '../context/AuthContext';
import ErrorBoundary from '../components/ErrorBoundary';
import { apiFetch } from '../services/apiClient';

interface Column {
    column_name: string;
    data_type: string;
}

interface TableData {
    columns: Column[];
    rows: any[];
}

interface QueryResult {
    rows: any[];
    fields: any[];
    rowCount: number;
    command: string;
}

type ViewMode = 'inspector' | 'query' | 'bulk_password';

const DbInspectorPage: React.FC = () => {
    const [mode, setMode] = useState<ViewMode>('inspector');
    const [tables, setTables] = useState<string[]>([]);
    const [selectedTable, setSelectedTable] = useState<string>('');
    const [tableData, setTableData] = useState<TableData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editingRowId, setEditingRowId] = useState<string | null>(null);
    const [editingRowData, setEditingRowData] = useState<any | null>(null);
    const [isDeleteAllModalOpen, setIsDeleteAllModalOpen] = useState(false);
    const [isExportingPg, setIsExportingPg] = useState(false);
    const [isExportingMysql, setIsExportingMysql] = useState(false);
    
    // Query Mode State
    const [sqlQuery, setSqlQuery] = useState('');
    const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
    const [queryError, setQueryError] = useState<string | null>(null);

    // Bulk Password Mode State
    const [bulkPasswordsInput, setBulkPasswordsInput] = useState('');
    const [bulkPassLoading, setBulkPassLoading] = useState(false);

    const { addToast } = useToast();
    const { logout } = useAuth(); 

    // Used only for manual fetch (Export SQL) where apiFetch is not suitable (Blob response)
    const getAuthToken = () => localStorage.getItem('authToken');

    const handleApiError = (error: Error, responseStatus?: number) => {
        console.error(error);
        if (responseStatus === 401 || responseStatus === 403) {
            addToast('Sessione scaduta o permessi insufficienti. Effettua nuovamente il login.', 'error');
        } else {
            addToast(error.message, 'error');
        }
    };

    useEffect(() => {
        const fetchTables = async () => {
            setIsLoading(true);
            try {
                const data = await apiFetch<string[]>('/api/resources?entity=db_inspector&action=list_tables');
                setTables(data);
                if (data.length > 0) {
                    setSelectedTable(data[0]);
                }
            } catch (error) {
                handleApiError(error as Error, (error as any).status);
            } finally {
                setIsLoading(false);
            }
        };
        fetchTables();
    }, []);

    useEffect(() => {
        if (mode !== 'inspector' || !selectedTable) {
            setTableData(null);
            return;
        }
        const fetchTableData = async () => {
            setIsLoading(true);
            setTableData(null);
            setEditingRowId(null);
            try {
                const data = await apiFetch<TableData>(`/api/resources?entity=db_inspector&action=get_table_data&table=${selectedTable}`);
                setTableData(data);
            } catch (error) {
                handleApiError(error as Error, (error as any).status);
            } finally {
                setIsLoading(false);
            }
        };
        fetchTableData();
    }, [selectedTable, mode]);
    
    const handleEdit = (row: any) => {
        setEditingRowId(row.id);
        setEditingRowData({ ...row });
    };

    const handleCancel = () => {
        setEditingRowId(null);
        setEditingRowData(null);
    };

    const handleSave = async () => {
        if (!editingRowData || !selectedTable) return;
        setIsSaving(true);
        try {
            const updates = { ...editingRowData };
            delete updates.id;

            await apiFetch(`/api/resources?entity=db_inspector&action=update_row&table=${selectedTable}&id=${editingRowId}`, {
                method: 'PUT',
                body: JSON.stringify(updates),
            });

            addToast('Riga aggiornata con successo.', 'success');
            setTableData(prev => {
                if (!prev) return null;
                return {
                    ...prev,
                    rows: prev.rows.map(row => (row.id === editingRowId ? editingRowData : row)),
                };
            });
            handleCancel();
        } catch (error) {
            handleApiError(error as Error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteAll = async () => {
        if (!selectedTable) return;
        setIsSaving(true);
        try {
            await apiFetch(`/api/resources?entity=db_inspector&action=delete_all_rows&table=${selectedTable}`, {
                method: 'DELETE'
            });
            addToast(`Tutte le righe dalla tabella '${selectedTable}' sono state eliminate.`, 'success');
            setTableData(prev => prev ? { ...prev, rows: [] } : null); 
            handleCancel(); 
        } catch (error) {
            handleApiError(error as Error);
        } finally {
            setIsSaving(false);
            setIsDeleteAllModalOpen(false);
        }
    };

    const handleExport = async (dialect: 'postgres' | 'mysql') => {
        if (dialect === 'postgres') setIsExportingPg(true);
        else setIsExportingMysql(true);
    
        try {
            // NOTE: apiFetch is for JSON. Using raw fetch for BLOB response.
            const response = await fetch(`/api/export-sql?dialect=${dialect}`, {
                headers: { 'Authorization': `Bearer ${getAuthToken()}` }
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Failed to export ${dialect} SQL`);
            }
            const sql = await response.text();
            const blob = new Blob([sql], { type: 'application/sql' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `db_export_${dialect}.sql`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            addToast(`Export ${dialect.toUpperCase()} SQL completato.`, 'success');
        } catch (error) {
            handleApiError(error as Error);
        } finally {
            if (dialect === 'postgres') setIsExportingPg(false);
            else setIsExportingMysql(false);
        }
    };

    const handleRunQuery = async () => {
        if (!sqlQuery.trim()) return;
        setIsLoading(true);
        setQueryResult(null);
        setQueryError(null);

        try {
            const data = await apiFetch<QueryResult>('/api/resources?entity=db_inspector&action=run_raw_query', {
                method: 'POST',
                body: JSON.stringify({ query: sqlQuery })
            });
            setQueryResult(data);
        } catch (e) {
            setQueryError((e as Error).message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleBulkPasswordUpdate = async () => {
        if (!bulkPasswordsInput.trim()) return;
        
        const lines = bulkPasswordsInput.split('\n').filter(l => l.trim().length > 0);
        const users = lines.map(line => {
            const [username, password] = line.split(',').map(s => s.trim());
            return { username, password };
        }).filter(u => u.username && u.password);

        if (users.length === 0) {
            addToast('Nessuna coppia username/password valida trovata.', 'error');
            return;
        }

        if (!confirm(`Stai per reimpostare la password per ${users.length} utenti. Confermi?`)) return;

        setBulkPassLoading(true);
        try {
            const data = await apiFetch<{successCount: number, failCount: number}>('/api/resources?entity=app-users&action=bulk_password_reset', {
                method: 'POST',
                body: JSON.stringify({ users })
            });

            addToast(`Operazione completata: ${data.successCount} successi, ${data.failCount} errori.`, 'success');
            setBulkPasswordsInput('');
        } catch (e) {
            addToast((e as Error).message, 'error');
        } finally {
            setBulkPassLoading(false);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>, colName: string, colType: string) => {
        if (!editingRowData) return;
        let value: any = e.target.value;
        
        if (colType.includes('boolean')) {
            value = value === 'true';
        } else if (colType.includes('int') || colType.includes('numeric')) {
            value = value === '' ? null : Number(value);
        }
        
        setEditingRowData({ ...editingRowData, [colName]: value });
    };

    const renderInputField = (col: Column, value: any) => {
        const colName = col.column_name;
        const colType = col.data_type;
    
        if (colType.includes('timestamp') || colType.includes('date')) {
            const dateValue = value ? new Date(value).toISOString().split('T')[0] : '';
            return (
                <input
                    type="date"
                    value={dateValue}
                    onChange={e => handleInputChange(e, colName, colType)}
                    className="form-input text-sm p-1"
                />
            );
        }
        if (colType.includes('int') || colType.includes('numeric')) {
            return (
                <input
                    type="number"
                    value={value ?? ''}
                    onChange={e => handleInputChange(e, colName, colType)}
                    className="form-input text-sm p-1"
                />
            );
        }
        if (colType.includes('boolean')) {
            return (
                <select
                    value={String(value ?? 'false')}
                    onChange={e => handleInputChange(e, colName, colType)}
                    className="form-select text-sm p-1"
                >
                    <option value="true">true</option>
                    <option value="false">false</option>
                </select>
            );
        }
        return (
            <input
                type="text"
                value={value ?? ''}
                onChange={e => handleInputChange(e, colName, colType)}
                className="form-input text-sm p-1"
            />
        );
    };

    const renderCellContent = (value: any, columnName?: string) => {
        const currencyColumns = [
            'daily_cost', 'standard_cost', 'daily_expenses', 'budget', 'capienza', 'backlog',
            'produzione_lorda', 'produzione_lorda_network_italia', 'perdite', 'spese_onorari_esterni',
            'spese_altro', 'fatture_onorari', 'fatture_spese', 'iva', 'incassi'
        ];
    
        if (columnName && currencyColumns.includes(columnName) && (typeof value === 'number' || (typeof value === 'string' && !isNaN(Number(value))))) {
            return formatCurrency(Number(value));
        }
        
        if (value === null || value === undefined) return <i className="text-on-surface-variant/70">NULL</i>;
        if (typeof value === 'boolean') return value ? 'true' : 'false';
        if (typeof value === 'object' && value !== null) return JSON.stringify(value);
        return String(value);
    };

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-on-surface">Database Inspector</h1>
            
            <div className="flex border-b border-outline-variant">
                <button 
                    onClick={() => setMode('inspector')}
                    className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${mode === 'inspector' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}
                >
                    Ispettore Tabelle
                </button>
                <button 
                    onClick={() => setMode('query')}
                    className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${mode === 'query' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}
                >
                    <span className="material-symbols-outlined text-sm">terminal</span> SQL Editor
                </button>
                <button 
                    onClick={() => setMode('bulk_password')}
                    className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${mode === 'bulk_password' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}
                >
                    <span className="material-symbols-outlined text-sm">password</span> Bulk Password
                </button>
            </div>

            {mode === 'inspector' && (
                <div className="animate-fade-in">
                    <div className="mb-6 p-4 bg-surface rounded-2xl shadow">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="table-select" className="block text-sm font-medium text-on-surface-variant mb-2">Seleziona una Tabella</label>
                                <select
                                    id="table-select"
                                    value={selectedTable}
                                    onChange={e => setSelectedTable(e.target.value)}
                                    className="form-select w-full"
                                    disabled={isLoading}
                                >
                                    {tables.map(table => <option key={table} value={table}>{table}</option>)}
                                </select>
                            </div>
                             <div className="space-y-2">
                                 <label className="block text-sm font-medium text-on-surface-variant mb-2">Azioni Globali</label>
                                 <div className="flex items-center gap-2">
                                     <button
                                        onClick={() => handleExport('postgres')}
                                        disabled={isLoading || isExportingPg || isExportingMysql}
                                        className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-primary text-on-primary font-semibold rounded-full disabled:opacity-50"
                                    >
                                        {isExportingPg ? <SpinnerIcon className="w-5 h-5"/> : 'Export Neon (PG)'}
                                    </button>
                                    <button
                                        onClick={() => handleExport('mysql')}
                                        disabled={isLoading || isExportingPg || isExportingMysql}
                                        className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-tertiary text-on-tertiary font-semibold rounded-full hover:opacity-90 disabled:opacity-50"
                                    >
                                        {isExportingMysql ? <SpinnerIcon className="w-5 h-5"/> : 'Export MySQL'}
                                    </button>
                                    <button
                                        onClick={() => setIsDeleteAllModalOpen(true)}
                                        disabled={isLoading || !selectedTable || !tableData || tableData.rows.length === 0}
                                        className="px-4 py-2 bg-error text-on-error font-semibold rounded-full hover:opacity-90 disabled:opacity-50"
                                        title="Elimina Tutte le Righe dalla Tabella Selezionata"
                                    >
                                        Svuota
                                    </button>
                                 </div>
                            </div>
                        </div>
                    </div>

                    {isLoading && !tableData && (
                        <div className="flex justify-center items-center py-12">
                            <SpinnerIcon className="w-8 h-8 text-primary" />
                        </div>
                    )}
                    
                    {tableData && (
                        <ErrorBoundary label="Errore Visualizzazione Tabella">
                            <div className="bg-surface rounded-2xl shadow overflow-x-auto relative">
                                {(isLoading || isSaving) && (
                                    <div className="absolute inset-0 bg-surface/50 flex justify-center items-center z-10">
                                        <SpinnerIcon className="w-8 h-8 text-primary" />
                                    </div>
                                )}
                                <table className="min-w-full divide-y divide-outline-variant">
                                    <thead className="bg-surface-container-low">
                                        <tr>
                                            {tableData.columns.map(col => (
                                                <th key={col.column_name} className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                                                    {col.column_name}
                                                    <span className="block text-on-surface-variant/70 font-normal normal-case">{col.data_type}</span>
                                                </th>
                                            ))}
                                            <th className="px-4 py-3 text-right text-xs font-medium text-on-surface-variant uppercase tracking-wider">Azioni</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-outline-variant">
                                        {tableData.rows.map(row => (
                                            <tr key={row.id} className="hover:bg-surface-container">
                                                {tableData.columns.map(col => (
                                                    <td key={col.column_name} className="px-4 py-3 whitespace-nowrap text-sm text-on-surface-variant align-top">
                                                        {editingRowId === row.id && col.column_name !== 'id' ? (
                                                            renderInputField(col, editingRowData[col.column_name])
                                                        ) : (
                                                            renderCellContent(row[col.column_name], col.column_name)
                                                        )}
                                                    </td>
                                                ))}
                                                <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                                                    {editingRowId === row.id ? (
                                                        <div className="flex items-center justify-end space-x-2">
                                                            <button onClick={handleSave} disabled={isSaving} className="p-1 text-tertiary hover:opacity-80 disabled:opacity-50">
                                                                {isSaving ? <SpinnerIcon className="w-5 h-5"/> : <span className="material-symbols-outlined">check</span>}
                                                            </button>
                                                            <button onClick={handleCancel} disabled={isSaving} className="p-1 text-on-surface-variant hover:opacity-80 disabled:opacity-50"><span className="material-symbols-outlined">close</span></button>
                                                        </div>
                                                    ) : (
                                                        <button onClick={() => handleEdit(row)} className="text-on-surface-variant hover:text-primary" title="Modifica"><span className="material-symbols-outlined">edit</span></button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {tableData.rows.length === 0 && (
                                    <p className="text-center text-on-surface-variant py-8">La tabella è vuota.</p>
                                )}
                            </div>
                        </ErrorBoundary>
                    )}
                </div>
            )}

            {mode === 'query' && (
                <div className="animate-fade-in space-y-4">
                    <div className="bg-surface rounded-2xl shadow p-6">
                        <label className="block text-sm font-medium text-on-surface mb-2">Query SQL Raw</label>
                        <textarea 
                            value={sqlQuery}
                            onChange={e => setSqlQuery(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && e.ctrlKey) {
                                    handleRunQuery();
                                }
                            }}
                            className="form-textarea font-mono text-sm w-full h-40 bg-surface-container text-on-surface border-outline-variant focus:ring-primary"
                            placeholder="SELECT * FROM users WHERE..."
                        ></textarea>
                        <div className="mt-4 flex justify-end">
                            <button 
                                onClick={handleRunQuery}
                                disabled={isLoading || !sqlQuery.trim()}
                                className="px-6 py-2 bg-primary text-on-primary font-semibold rounded-full hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
                            >
                                {isLoading ? <SpinnerIcon className="w-5 h-5" /> : <span className="material-symbols-outlined">play_arrow</span>}
                                Esegui (Ctrl+Enter)
                            </button>
                        </div>
                    </div>

                    {queryError && (
                        <div className="p-4 bg-error-container text-on-error-container rounded-lg border border-error">
                            <strong>Errore SQL:</strong>
                            <pre className="mt-1 text-xs whitespace-pre-wrap">{queryError}</pre>
                        </div>
                    )}

                    {queryResult && (
                        <ErrorBoundary label="Errore Risultati Query">
                            <div className="bg-surface rounded-2xl shadow overflow-hidden">
                                <div className="p-4 bg-surface-container border-b border-outline-variant flex justify-between items-center">
                                    <span className="text-sm font-bold text-on-surface">Risultati Query</span>
                                    <span className="text-xs text-on-surface-variant bg-surface px-2 py-1 rounded">Rows: {queryResult.rowCount} | Cmd: {queryResult.command}</span>
                                </div>
                                <div className="overflow-x-auto max-h-[500px]">
                                    <table className="min-w-full divide-y divide-outline-variant">
                                        <thead className="bg-surface-container-low sticky top-0">
                                            <tr>
                                                {queryResult.fields.map((field: any) => (
                                                    <th key={field.name} className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                                                        {field.name}
                                                        <span className="block text-[10px] opacity-50 normal-case">ID: {field.dataTypeID}</span>
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-outline-variant bg-surface">
                                            {queryResult.rows.map((row, i) => (
                                                <tr key={i} className="hover:bg-surface-container">
                                                    {queryResult.fields.map((field: any) => (
                                                        <td key={field.name} className="px-4 py-2 whitespace-nowrap text-sm text-on-surface font-mono">
                                                            {renderCellContent(row[field.name])}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {queryResult.rows.length === 0 && (
                                        <p className="text-center text-on-surface-variant py-8">Nessun risultato restituito.</p>
                                    )}
                                </div>
                            </div>
                        </ErrorBoundary>
                    )}
                </div>
            )}

            {mode === 'bulk_password' && (
                <div className="animate-fade-in space-y-4">
                    <div className="bg-surface rounded-2xl shadow p-6">
                        <h2 className="text-xl font-bold text-on-surface mb-4">Importazione Bulk Password</h2>
                        <p className="text-sm text-on-surface-variant mb-4">
                            Inserisci qui sotto l'elenco delle coppie <strong>Username, Password</strong> (una per riga, separate da virgola).
                            <br />
                            Le password verranno crittografate (hash) e aggiornate nel database. Gli utenti saranno costretti a cambiare password al prossimo accesso.
                        </p>
                        
                        <textarea 
                            value={bulkPasswordsInput}
                            onChange={e => setBulkPasswordsInput(e.target.value)}
                            className="form-textarea font-mono text-sm w-full h-64 bg-surface-container text-on-surface border-outline-variant focus:ring-primary"
                            placeholder="mario.rossi, Password123!&#10;luigi.verdi, Segreta2024&#10;..."
                        ></textarea>
                        
                        <div className="mt-4 flex justify-end">
                            <button 
                                onClick={handleBulkPasswordUpdate}
                                disabled={bulkPassLoading || !bulkPasswordsInput.trim()}
                                className="px-6 py-2 bg-tertiary-container text-on-tertiary-container font-semibold rounded-full hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
                            >
                                {bulkPassLoading ? <SpinnerIcon className="w-5 h-5" /> : <span className="material-symbols-outlined">upload</span>}
                                Aggiorna Password
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            <ConfirmationModal
                isOpen={isDeleteAllModalOpen}
                onClose={() => setIsDeleteAllModalOpen(false)}
                onConfirm={handleDeleteAll}
                title={`Conferma Eliminazione Totale`}
                message={
                    <>
                        Sei assolutamente sicuro di voler eliminare <strong>tutte le righe</strong> dalla tabella <strong>{selectedTable}</strong>?
                        <br />
                        <strong className="text-error">Questa azione è irreversibile.</strong>
                    </>
                }
                isConfirming={isSaving}
            />
        </div>
    );
};

export default DbInspectorPage;
