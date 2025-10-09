/**
 * @file ForecastingPage.tsx
 * @description Pagina di forecasting e capacity planning per analizzare il carico di lavoro futuro.
 */

import React, { useState, useMemo } from 'react';
import { useStaffingContext } from '../context/StaffingContext';
import { getWorkingDaysBetween } from '../utils/dateUtils';

/**
 * Componente per la pagina di Forecasting e Capacity Planning.
 * Mostra una vista aggregata e previsionale del carico di lavoro del team.
 * @returns {React.ReactElement} La pagina di Forecasting.
 */
const ForecastingPage: React.FC = () => {
    const { resources, assignments, allocations, horizontals } = useStaffingContext();
    const [forecastHorizon] = useState(12); // Orizzonte temporale in mesi
    const [selectedHorizontal, setSelectedHorizontal] = useState('');

    const forecastData = useMemo(() => {
        const results = [];
        const today = new Date();

        const filteredResources = selectedHorizontal
            ? resources.filter(r => r.horizontal === selectedHorizontal)
            : resources;
        
        const totalResources = filteredResources.length;

        for (let i = 0; i < forecastHorizon; i++) {
            const date = new Date(today.getFullYear(), today.getMonth() + i, 1);
            const monthName = date.toLocaleString('it-IT', { month: 'long', year: 'numeric' });
            const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
            const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);

            const workingDays = getWorkingDaysBetween(firstDay, lastDay);
            const availablePersonDays = totalResources * workingDays;

            let allocatedPersonDays = 0;
            filteredResources.forEach(resource => {
                const resourceAssignments = assignments.filter(a => a.resourceId === resource.id);
                resourceAssignments.forEach(assignment => {
                    const assignmentAllocations = allocations[assignment.id];
                    if (assignmentAllocations) {
                        for (const dateStr in assignmentAllocations) {
                            const allocDate = new Date(dateStr);
                            if (allocDate >= firstDay && allocDate <= lastDay) {
                                allocatedPersonDays += (assignmentAllocations[dateStr] / 100);
                            }
                        }
                    }
                });
            });

            const utilization = availablePersonDays > 0 ? (allocatedPersonDays / availablePersonDays) * 100 : 0;
            
            results.push({
                monthName,
                availablePersonDays,
                allocatedPersonDays,
                utilization,
                surplusDeficit: availablePersonDays - allocatedPersonDays,
            });
        }

        return results;

    }, [resources, assignments, allocations, forecastHorizon, selectedHorizontal]);

    const maxUtilization = Math.max(...forecastData.map(d => d.utilization), 100);

    const getUtilizationColor = (utilization: number) => {
        if (utilization > 100) return 'bg-red-500';
        if (utilization > 90) return 'bg-yellow-500';
        return 'bg-green-500';
    };

    return (
        <div>
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Forecasting & Capacity</h1>
                <div className="w-full md:w-64">
                    <label htmlFor="horizontal-filter" className="sr-only">Filtra per Horizontal</label>
                    <select
                        id="horizontal-filter"
                        value={selectedHorizontal}
                        onChange={(e) => setSelectedHorizontal(e.target.value)}
                        className="form-select w-full"
                    >
                        <option value="">Tutti gli Horizontal</option>
                        {horizontals.sort((a,b) => a.value.localeCompare(b.value)).map(h => (
                            <option key={h.id} value={h.value}>{h.value}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Grafico Utilizzo */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
                <h2 className="text-xl font-semibold mb-4">Utilizzo Mensile Previsto (%)</h2>
                <div className="flex items-end space-x-2 md:space-x-4 h-64 overflow-x-auto pb-4">
                    {forecastData.map((data, index) => (
                        <div key={index} className="flex-1 min-w-[50px] text-center">
                            <div className="group relative">
                                <div
                                    className={`w-full rounded-t-md transition-all duration-300 ${getUtilizationColor(data.utilization)}`}
                                    style={{ height: `${(data.utilization / maxUtilization) * 100}%` }}
                                ></div>
                                <div className="absolute bottom-full mb-2 w-full opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                    <div className="bg-gray-900 text-white text-xs rounded py-1 px-2">
                                        {data.utilization.toFixed(1)}%
                                    </div>
                                </div>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 whitespace-nowrap transform -rotate-45 -translate-y-2">
                                {data.monthName.split(' ')[0]}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Tabella Dettagliata */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Mese</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">G/U Disponibili</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">G/U Allocati</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Utilizzo</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Surplus/Deficit (G/U)</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {forecastData.map((data, index) => (
                            <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{data.monthName}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-300">{data.availablePersonDays.toFixed(0)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-300">{data.allocatedPersonDays.toFixed(1)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold">
                                    <span className={data.utilization > 100 ? 'text-red-600 dark:text-red-400' : data.utilization > 90 ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'}>
                                        {data.utilization.toFixed(1)}%
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold">
                                     <span className={data.surplusDeficit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                                        {data.surplusDeficit.toFixed(1)}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
             <style>{`.form-select { display: block; width: 100%; border-radius: 0.375rem; border: 1px solid #D1D5DB; background-color: #FFFFFF; padding: 0.5rem 0.75rem; font-size: 0.875rem; line-height: 1.25rem; } .dark .form-select { border-color: #4B5563; background-color: #374151; color: #F9FAFB; }`}</style>
        </div>
    );
};

export default ForecastingPage;