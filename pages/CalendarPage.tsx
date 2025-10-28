/**
 * @file CalendarPage.tsx
 * @description Pagina per la gestione del calendario aziendale (festività, chiusure).
 */

import React, { useState, useMemo } from 'react';
import { useEntitiesContext } from '../context/AppContext';
import { CalendarEvent, CalendarEventType } from '../types';
import Modal from '../components/Modal';
import SearchableSelect from '../components/SearchableSelect';
import { SpinnerIcon } from '../components/icons';

/**
 * Formatta una data per la visualizzazione.
 * @param {string | null} dateStr - La stringa della data (YYYY-MM-DD).
 * @returns {string} La data formattata (DD/MM/YYYY) o 'N/A'.
 */
const formatDateForDisplay = (dateStr: string | null): string => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('it-IT', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' });
};

/**
 * Traduce il tipo di evento in una stringa leggibile.
 * @param {CalendarEventType} type - Il tipo di evento.
 * @returns {string} La traduzione in italiano.
 */
const formatEventType = (type: CalendarEventType): string => {
    switch (type) {
        case 'COMPANY_CLOSURE': return 'Chiusura Aziendale';
        case 'NATIONAL_HOLIDAY': return 'Festività Nazionale';
        case 'LOCAL_HOLIDAY': return 'Festività Locale';
        default: return type;
    }
}

const CalendarPage: React.FC = () => {
    const { companyCalendar, addCalendarEvent, updateCalendarEvent, deleteCalendarEvent, locations, isActionLoading } = useEntitiesContext();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingEvent, setEditingEvent] = useState<CalendarEvent | Omit<CalendarEvent, 'id'> | null>(null);

    const emptyEvent: Omit<CalendarEvent, 'id'> = {
        name: '',
        date: new Date().toISOString().split('T')[0],
        type: 'NATIONAL_HOLIDAY',
        location: null
    };

    const sortedCalendar = useMemo(() => {
        return [...companyCalendar].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [companyCalendar]);

    const openModalForNew = () => {
        setEditingEvent(emptyEvent);
        setIsModalOpen(true);
    };

    const openModalForEdit = (event: CalendarEvent) => {
        setEditingEvent(event);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingEvent(null);
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (editingEvent) {
            const eventToSave = { ...editingEvent };
            if (eventToSave.type !== 'LOCAL_HOLIDAY') {
                eventToSave.location = null;
            }
            
            try {
                if ('id' in eventToSave) {
                    await updateCalendarEvent(eventToSave as CalendarEvent);
                } else {
                    await addCalendarEvent(eventToSave as Omit<CalendarEvent, 'id'>);
                }
                handleCloseModal();
            } catch(e) {}
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        if (editingEvent) {
            const { name, value } = e.target;
            setEditingEvent({ ...editingEvent, [name]: value });
        }
    };
    
    const handleSelectChange = (name: string, value: string) => {
         if (editingEvent) {
            setEditingEvent({ ...editingEvent, [name]: value });
        }
    };

    const locationOptions = useMemo(() => locations.map(l => ({ value: l.value, label: l.value })), [locations]);
    const eventTypeOptions: { value: CalendarEventType, label: string }[] = [
        { value: 'NATIONAL_HOLIDAY', label: 'Festività Nazionale' },
        { value: 'COMPANY_CLOSURE', label: 'Chiusura Aziendale' },
        { value: 'LOCAL_HOLIDAY', label: 'Festività Locale' }
    ];

    return (
        <div>
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white self-start">Calendario Aziendale</h1>
                <button onClick={openModalForNew} className="w-full md:w-auto px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700">Aggiungi Evento</button>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
                <table className="min-w-full">
                    <thead className="border-b border-gray-200 dark:border-gray-700">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Data</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Nome Evento</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Tipo</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Sede</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Azioni</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {sortedCalendar.map(event => (
                            <tr key={event.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{formatDateForDisplay(event.date)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{event.name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{formatEventType(event.type)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{event.location || 'Tutte'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <div className="flex items-center justify-end space-x-3">
                                        <button onClick={() => openModalForEdit(event)} className="text-gray-500 hover:text-blue-600" title="Modifica"><span className="text-xl">✏️</span></button>
                                        <button onClick={() => deleteCalendarEvent(event.id!)} className="text-gray-500 hover:text-red-600" title="Elimina">
                                            {isActionLoading(`deleteCalendarEvent-${event.id}`) ? <SpinnerIcon className="w-5 h-5" /> : <span className="text-xl">🗑️</span>}
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {editingEvent && (
                <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={'id' in editingEvent ? 'Modifica Evento' : 'Aggiungi Evento'}>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <input type="text" name="name" value={editingEvent.name} onChange={handleChange} required className="form-input" placeholder="Nome evento (es. Natale) *"/>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data</label>
                                <input type="date" name="date" value={editingEvent.date} onChange={handleChange} required className="form-input"/>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tipo Evento</label>
                                <select name="type" value={editingEvent.type} onChange={handleChange} className="form-select w-full">
                                    {eventTypeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                </select>
                            </div>
                        </div>
                        {editingEvent.type === 'LOCAL_HOLIDAY' && (
                            <div>
                                 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sede</label>
                                <SearchableSelect
                                    name="location"
                                    value={editingEvent.location || ''}
                                    onChange={handleSelectChange}
                                    options={locationOptions}
                                    placeholder="Seleziona una sede *"
                                    required
                                />
                            </div>
                        )}

                        <div className="flex justify-end space-x-3 pt-4">
                            <button type="button" onClick={handleCloseModal} className="px-4 py-2 bg-gray-200 rounded-md">Annulla</button>
                            <button type="submit" disabled={isActionLoading('addCalendarEvent') || isActionLoading(`updateCalendarEvent-${'id' in editingEvent ? editingEvent.id : ''}`)} className="flex justify-center items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400">
                                {(isActionLoading('addCalendarEvent') || isActionLoading(`updateCalendarEvent-${'id' in editingEvent ? editingEvent.id : ''}`)) ? <SpinnerIcon className="w-5 h-5"/> : 'Salva'}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
             <style>{`.form-input, .form-select { display: block; width: 100%; border-radius: 0.375rem; border: 1px solid #D1D5DB; background-color: #FFFFFF; padding: 0.5rem 0.75rem; font-size: 0.875rem; line-height: 1.25rem; } .dark .form-input, .dark .form-select { border-color: #4B5563; background-color: #374151; color: #F9FAFB; }`}</style>
        </div>
    );
};

export default CalendarPage;