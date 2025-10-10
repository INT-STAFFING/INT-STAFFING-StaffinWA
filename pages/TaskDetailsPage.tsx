import React, { useState, useMemo } from 'react';
import { useStaffingContext } from '../context/StaffingContext';
import SearchableSelect from '../components/SearchableSelect';

const formatCurrency = (value: number | null | undefined) => (value || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });

const TaskDetailsPage: React.FC = () => {
    const { tasks, projects, clients, roles } = useStaffingContext();
    const [selectedTaskId, setSelectedTaskId] = useState<string>('');

    const taskOptions = useMemo(() => 
        tasks
            .map(t => ({ value: t.id!, label: `${t.wbs} - ${t.name || 'Senza nome'}` }))
            .sort((a, b) => a.label.localeCompare(b.label)), 
        [tasks]
    );

    const selectedTaskData = useMemo(() => {
        if (!selectedTaskId) return null;

        const task = tasks.find(t => t.id === selectedTaskId);
        if (!task) return null;

        const project = projects.find(p => p.id === task.projectId);
        const client = clients.find(c => c.id === project?.clientId);

        const roleBreakdown = Object.entries(task.roleEfforts || {}).map(([roleId, days]) => {
            const role = roles.find(r => r.id === roleId);
            const dailyCost = role?.dailyCost ?? 0;
            const standardCost = role?.standardCost ?? dailyCost;
            return {
                roleName: role?.name ?? 'N/A',
                days: Number(days) || 0,
                dailyCost,
                standardCost,
                totalDailyCost: (Number(days) || 0) * dailyCost,
                totalStandardCost: (Number(days) || 0) * standardCost,
            };
        });

        const sumOfDailyCosts = roleBreakdown.reduce((acc, item) => acc + item.totalDailyCost, 0);
        const sumOfStandardCosts = roleBreakdown.reduce((acc, item) => acc + item.totalStandardCost, 0);

        return {
            task,
            project,
            client,
            sumOfDailyCosts,
            sumOfStandardCosts,
            roleBreakdown,
        };
    }, [selectedTaskId, tasks, projects, clients, roles]);

    const renderCalculationDetail = (title: string, items: { label: string, value: string }[], formula: string, result: string) => (
        <div className="mt-4">
            <h4 className="font-semibold text-md text-gray-700 dark:text-gray-300">{title}</h4>
            <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 mt-2 space-y-1">
                {items.map(item => <li key={item.label}><strong>{item.label}:</strong> {item.value}</li>)}
            </ul>
            <p className="text-sm font-mono bg-gray-100 dark:bg-gray-700 p-2 rounded-md mt-2">
                <strong>Formula:</strong> {formula}
            </p>
            <p className="text-md font-semibold text-right mt-1">Risultato: {result}</p>
        </div>
    );
    
    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-6">Dettagli Incarichi</h1>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8 max-w-2xl">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Seleziona un Incarico</label>
                <SearchableSelect
                    name="selectedTask"
                    value={selectedTaskId}
                    onChange={(_, value) => setSelectedTaskId(value)}
                    options={taskOptions}
                    placeholder="Cerca per WBS o nome..."
                />
            </div>

            {!selectedTaskData ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    <p>Seleziona un incarico per visualizzarne i dettagli.</p>
                </div>
            ) : (
                <div className="space-y-8">
                    {/* Card Dettagli Principali */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                        <h2 className="text-xl font-semibold mb-4">Dettagli Principali</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div><p className="text-gray-500">WBS</p><p className="font-medium">{selectedTaskData.task.wbs}</p></div>
                            <div><p className="text-gray-500">Nome Incarico</p><p className="font-medium">{selectedTaskData.task.name ?? 'N/A'}</p></div>
                            <div><p className="text-gray-500">Progetto</p><p className="font-medium">{selectedTaskData.project?.name ?? 'N/A'}</p></div>
                            <div><p className="text-gray-500">Cliente</p><p className="font-medium">{selectedTaskData.client?.name ?? 'N/A'}</p></div>
                        </div>
                    </div>
                    
                    {/* Card Dati Economici */}
                     <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                        <h2 className="text-xl font-semibold mb-4">Dati Economici Riepilogativi</h2>
                         <div className="grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-6 text-sm">
                            <div><p className="text-gray-500">Onorari Totali</p><p className="font-medium text-lg">{formatCurrency(selectedTaskData.task.totalFees)}</p></div>
                            <div><p className="text-gray-500">Onorari Interni</p><p className="font-medium text-lg">{formatCurrency(selectedTaskData.task.internalFees)}</p></div>
                            <div><p className="text-gray-500">Onorari Esterni</p><p className="font-medium text-lg">{formatCurrency(selectedTaskData.task.externalFees)}</p></div>
                            <div><p className="text-gray-500">Spese</p><p className="font-medium text-lg">{formatCurrency(selectedTaskData.task.expenses)}</p></div>
                            <div><p className="text-gray-500">Realizzo</p><p className="font-medium text-lg">{(selectedTaskData.task.realization ?? 0).toFixed(2)}%</p></div>
                            <div><p className="text-gray-500">Margine</p><p className="font-medium text-lg">{(selectedTaskData.task.margin ?? 0).toFixed(2)}%</p></div>
                        </div>
                    </div>

                    {/* Card Sforzo e Costi per Ruolo */}
                     <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                        <h2 className="text-xl font-semibold mb-4">Dettaglio Sforzo e Costi per Ruolo</h2>
                         <div className="overflow-x-auto">
                             <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                <thead className="bg-gray-50 dark:bg-gray-700">
                                    <tr>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Ruolo</th>
                                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Giornate Previste</th>
                                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Costo G.</th>
                                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Costo Std.</th>
                                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Costo Totale</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                    {selectedTaskData.roleBreakdown.map(item => (
                                        <tr key={item.roleName}>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm font-medium">{item.roleName}</td>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm text-right">{item.days}</td>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm text-right">{formatCurrency(item.dailyCost)}</td>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm text-right">{formatCurrency(item.standardCost)}</td>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm text-right">{formatCurrency(item.totalDailyCost)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="font-bold bg-gray-50 dark:bg-gray-700">
                                        <td className="px-4 py-2 text-left text-sm">Totale</td>
                                        <td className="px-4 py-2 text-right text-sm">{selectedTaskData.roleBreakdown.reduce((sum, item) => sum + item.days, 0)}</td>
                                        <td colSpan={2}></td>
                                        <td className="px-4 py-2 text-right text-sm">{formatCurrency(selectedTaskData.sumOfDailyCosts)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                    
                    {/* Card Dettaglio Calcoli */}
                     <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                         <h2 className="text-xl font-semibold mb-4">Dettaglio Calcoli</h2>
                         {renderCalculationDetail(
                             "Calcolo Realizzo",
                             [
                                 { label: "Onorari Interni", value: formatCurrency(selectedTaskData.task.internalFees) },
                                 { label: "Costo Totale Giorni/Uomo", value: formatCurrency(selectedTaskData.sumOfDailyCosts) },
                             ],
                             `(${formatCurrency(selectedTaskData.task.internalFees)} / ${formatCurrency(selectedTaskData.sumOfDailyCosts)}) * 100`,
                             `${(selectedTaskData.task.realization ?? 0).toFixed(2)}%`
                         )}
                         <div className="border-t my-6 dark:border-gray-700"></div>
                          {renderCalculationDetail(
                             "Calcolo Margine",
                             [
                                 { label: "Onorari Totali", value: formatCurrency(selectedTaskData.task.totalFees) },
                                 { label: "Costo Standard Totale", value: formatCurrency(selectedTaskData.sumOfStandardCosts) },
                             ],
                             `((${formatCurrency(selectedTaskData.task.totalFees)} - ${formatCurrency(selectedTaskData.sumOfStandardCosts)}) / ${formatCurrency(selectedTaskData.task.totalFees)}) * 100`,
                             `${(selectedTaskData.task.margin ?? 0).toFixed(2)}%`
                         )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default TaskDetailsPage;