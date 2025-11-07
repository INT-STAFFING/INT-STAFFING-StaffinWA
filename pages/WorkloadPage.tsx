/**
 * @file WorkloadPage.tsx
 * @description Pagina di visualizzazione del carico totale per risorsa (sola lettura).
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useEntitiesContext, useAllocationsContext } from '../context/AppContext';
import { Resource } from '../types';
import {
  getCalendarDays,
  formatDate,
  addDays,
  isHoliday,
  getWorkingDaysBetween,
} from '../utils/dateUtils';
import SearchableSelect from '../components/SearchableSelect';
import MultiSelectDropdown from '../components/MultiSelectDropdown';
import { useSearchParams } from 'react-router-dom';

type ViewMode = 'day' | 'week' | 'month';

// ReadonlyDailyTotalCell e ReadonlyAggregatedWorkloadCell li puoi lasciare come sono ora

const WorkloadPage: React.FC = () => {
  // tutta la tua logica attuale: currentDate, viewMode, contesti, filters, displayResources, timeColumns, ecc.
  // ----------------------------------------------
  // COPIA QUI tutta la parte di stato/logica che hai già
  // ----------------------------------------------

  return (
    <div className="flex flex-col w-full max-w-full gap-4">
      {/* CONTROLLI + FILTRI */}
      <div className="w-full max-w-full space-y-4">
        {/* Barra controlli periodo */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div className="flex items-center justify-start space-x-2">
            <button
              onClick={handlePrev}
              className="px-3 py-2 bg-white dark:bg-gray-700 border dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 text-sm"
            >
              ← Prec.
            </button>
            <button
              onClick={handleToday}
              className="px-4 py-2 bg-white dark:bg-gray-700 border dark:border-gray-600 rounded-md shadow-sm font-semibold text-blue-600 dark:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              Oggi
            </button>
            <button
              onClick={handleNext}
              className="px-3 py-2 bg-white dark:bg-gray-700 border dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 text-sm"
            >
              Succ. →
            </button>
          </div>
          <div className="flex items-center justify-start space-x-1 bg-gray-200 dark:bg-gray-700 p-1 rounded-md">
            {(['day', 'week', 'month'] as ViewMode[]).map((level) => (
              <button
                key={level}
                onClick={() => setViewMode(level)}
                className={`px-3 py-1 text-sm font-medium rounded-md capitalize ${
                  viewMode === level
                    ? 'bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 shadow'
                    : 'text-gray-600 dark:text-gray-300'
                }`}
              >
                {level === 'day' ? 'Giorno' : level === 'week' ? 'Settimana' : 'Mese'}
              </button>
            ))}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400 text-left md:text-right">
            Vista di sola lettura.{' '}
            <a href="/staffing" className="text-blue-500 hover:underline">
              Vai a Staffing per modifiche
            </a>
            .
          </div>
        </div>

        {/* FILTRI */}
        <div className="w-full max-w-full">
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow relative z-10">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
              <div className="min-w-0">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Risorsa
                </label>
                <SearchableSelect
                  name="resourceId"
                  value={filters.resourceId}
                  onChange={handleFilterChange}
                  options={resourceOptions}
                  placeholder="Tutte le Risorse"
                />
              </div>
              <div className="min-w-0">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Ruolo
                </label>
                <MultiSelectDropdown
                  name="roleIds"
                  selectedValues={filters.roleIds}
                  onChange={handleMultiSelectFilterChange}
                  options={roleOptions}
                  placeholder="Tutti i Ruoli"
                />
              </div>
              <div className="min-w-0">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Progetto
                </label>
                <SearchableSelect
                  name="projectId"
                  value={filters.projectId}
                  onChange={handleFilterChange}
                  options={projectOptions}
                  placeholder="Tutti i Progetti"
                />
              </div>
              <div className="min-w-0">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Cliente
                </label>
                <SearchableSelect
                  name="clientId"
                  value={filters.clientId}
                  onChange={handleFilterChange}
                  options={clientOptions}
                  placeholder="Tutti i Clienti"
                />
              </div>
              <div className="min-w-0">
                <button
                  onClick={clearFilters}
                  className="w-full px-4 py-2 bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500"
                >
                  Reset Filtri
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* TABELLA: contenitore SCROLLABILE interno con max-h come Staffing */}
      <div className="w-full max-w-full overflow-y-auto overflow-x-scroll max-h-[680px] bg-white dark:bg-gray-800 rounded-lg shadow">
        {displayResources.length > 0 ? (
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            {/* thead + tbody come già li hai, invariati */}
          </table>
        ) : (
          <div className="text-center py-8 text-gray-500">
            Nessuna risorsa trovata con i filtri correnti.
          </div>
        )}
      </div>

      <style>{`
        .form-input, .form-select {
          display: block;
          width: 100%;
          border-radius: 0.375rem;
          border: 1px solid #D1D5DB;
          background-color: #FFFFFF;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          line-height: 1.25rem;
        }
        .dark .form-input, .dark .form-select {
          border-color: #4B5563;
          background-color: #374151;
          color: #F9FAFB;
        }
      `}</style>
    </div>
  );
};

export default WorkloadPage;
