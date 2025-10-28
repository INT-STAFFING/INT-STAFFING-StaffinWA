import React, { useState, useEffect } from 'react';
import { useToast } from '../context/ToastContext';
import { SpinnerIcon } from '../components/icons';
import ConfirmationModal from '../components/ConfirmationModal';

interface Column {
    column_name: string;
    data_type: string;
}

interface TableData {
    columns: Column[];
    rows: any[];
}

const DbInspectorPage: React.FC = () => {
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
    const { addToast } = useToast();

    useEffect(() => {
        const fetchTables = async () => {
            setIsLoading(true);
            try {
                const response = await fetch('/api/resources?entity=db_inspector&action=list_tables');
                if (!response.ok) throw new Error('Failed to fetch table list');
                const data = await response.json();
                setTables(data);
                if (data.length > 0) {
                    setSelectedTable(data[0]);
                }
            } catch (error) {
                addToast((error as Error).message, 'error');
            } finally {
                setIsLoading(false);
            }
        };
        fetchTables();
    }, [addToast]);

    useEffect(() => {
        if (!selectedTable) {
            setTableData(null);
            return;
        }
        const fetchTableData = async () => {
            setIsLoading(true);
            setTableData(null);
            setEditingRowId(null);
            try {
                const response = await fetch(`/api/resources?entity=db_inspector&action=get_table_data&table=${selectedTable}`);
                if (!response.ok) throw new Error(`Failed to fetch data for table ${selectedTable}`);
                const data = await response.json();
                setTableData(data);
            } catch (error) {
                addToast((error as Error).message, 'error');
            } finally {
                setIsLoading(false);
            }
        };
        fetchTableData();
    }, [selectedTable, addToast]);
    
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

            const response = await fetch(`/api/resources?entity=db_inspector&action=update_row&table=${selectedTable}&id=${editingRowId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to save changes');
            }
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
            addToast((error as Error).message, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteAll = async () => {
        if (!selectedTable) return;
        setIsSaving(true);
        try {
            const response = await fetch(`/api/resources?entity=db_inspector&action=delete_all_rows&table=${selectedTable}`, {
                method: 'DELETE',
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to delete all rows');
            }
            addToast(`Tutte le righe dalla tabella '${selectedTable}' sono state eliminate.`, 'success');
            setTableData(prev => prev ? { ...prev, rows: [] } : null); // Clear the data locally
            handleCancel(); // Close any inline editing
        } catch (error) {
            addToast((error as Error).message, 'error');
        } finally {
            setIsSaving(false);
            setIsDeleteAllModalOpen(false);
        }
    };

    const handleExport = async (dialect: 'postgres' | 'mysql') => {
        if (dialect === 'postgres') setIsExportingPg(true);
        else setIsExportingMysql(true);
    
        try {
            const response = await fetch(`/api/resources?entity=db_inspector&action=export_sql&dialect=${dialect}`);
            if (!response.ok) {
                const errorData = await response.json();
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
            addToast((error as Error).message, 'error');
        } finally {
            if (dialect === 'postgres') setIsExportingPg(false);
            else setIsExportingMysql(false);
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

    const renderCellContent = (value: any, columnName: string) => {
        const currencyColumns = [
            'daily_cost', 'standard_cost', 'daily_expenses', 'budget', 'capienza', 'backlog',
            'produzione_lorda', 'produzione_lorda_network_italia', 'perdite', 'spese_onorari_esterni',
            'spese_altro', 'fatture_onorari', 'fatture_spese', 'iva', 'incassi'
        ];
    
        if (currencyColumns.includes(columnName) && (typeof value === 'number' || (typeof value === 'string' && !isNaN(Number(value))))) {
            return (Number(value) || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
        }
        
        if (value === null || value === undefined) return <i className="text-gray-400">NULL</i>;
        if (typeof value === 'boolean') return value ? 'true' : 'false';
        if (typeof value === 'object' && value !== null) return JSON.stringify(value);
        return String(value);
    };

    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-6">Database Inspector</h1>
            
            <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="table-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Seleziona una Tabella</label>
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
                         <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Azioni Globali</label>
                         <div className="flex items-center gap-2">
                             <button
                                onClick={() => handleExport('postgres')}
                                disabled={isLoading || isExportingPg || isExportingMysql}
                                className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                            >
                                {isExportingPg ? <SpinnerIcon className="w-5 h-5"/> : 'Export Neon (PG)'}
                            </button>
                            <button
                                onClick={() => handleExport('mysql')}
                                disabled={isLoading || isExportingPg || isExportingMysql}
                                className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                            >
                                {isExportingMysql ? <SpinnerIcon className="w-5 h-5"/> : 'Export MySQL'}
                            </button>
                            <button
                                onClick={() => setIsDeleteAllModalOpen(true)}
                                disabled={isLoading || !selectedTable || !tableData || tableData.rows.length === 0}
                                className="px-4 py-2 bg-destructive text-white rounded-md hover:opacity-90 disabled:opacity-50"
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
                    <SpinnerIcon className="w-8 h-8 text-blue-500" />
                </div>
            )}
            
            {tableData && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto relative">
                    {(isLoading || isSaving) && (
                        <div className="absolute inset-0 bg-white/50 dark:bg-gray-800/50 flex justify-center items-center z-10">
                            <SpinnerIcon className="w-8 h-8 text-blue-500" />
                        </div>
                    )}
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                            <tr>
                                {tableData.columns.map(col => (
                                    <th key={col.column_name} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                        {col.column_name}
                                        <span className="block text-gray-400 font-normal normal-case">{col.data_type}</span>
                                    </th>
                                ))}
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Azioni</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-dark-border">
                            {tableData.rows.map(row => (
                                <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                    {tableData.columns.map(col => (
                                        <td key={col.column_name} className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300 align-top">
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
                                                <button onClick={handleSave} disabled={isSaving} className="p-1 text-green-600 hover:text-green-500 disabled:opacity-50">
                                                    {isSaving ? <SpinnerIcon className="w-5 h-5"/> : <span className="text-xl">✔️</span>}
                                                </button>
                                                <button onClick={handleCancel} disabled={isSaving} className="p-1 text-gray-500 hover:text-gray-400 disabled:opacity-50"><span className="text-xl">❌</span></button>
                                            </div>
                                        ) : (
                                            <button onClick={() => handleEdit(row)} className="text-gray-500 hover:text-blue-600" title="Modifica"><span className="text-xl">✏️</span></button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                     {tableData.rows.length === 0 && (
                        <p className="text-center text-gray-500 py-8">La tabella è vuota.</p>
                    )}
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
                        <strong className="text-destructive">Questa azione è irreversibile.</strong>
                    </>
                }
                isConfirming={isSaving}
            />

            <style>{`.form-input, .form-select { display: block; width: 100%; border-radius: 0.375rem; border: 1px solid #D1D5DB; background-color: #FFFFFF; padding: 0.5rem 0.75rem; font-size: 0.875rem; line-height: 1.25rem; } .dark .form-input, .dark .form-select { border-color: #4B5563; background-color: #374151; color: #F9FAFB; }`}</style>
        </div>
    );
};

export default DbInspectorPage;