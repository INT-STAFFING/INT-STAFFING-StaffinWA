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
                <h1 className="text-3xl font-bold text-foreground dark:text-dark-foreground">Gestione Calendario</h1>
                <button
                    onClick={openModalForNew}
                    className="px-4 py-2 bg-primary text-dark-foreground dark:text-dark-sidebar-foreground font-semibold rounded-md shadow-sm hover:bg-primary-darker"
                >
                    Aggiungi Evento
                </button>
            </div>
            
            <div className="bg-card dark:bg-dark-card rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-border dark:divide-dark-border">
                        <thead className="bg-muted dark:bg-dark-muted">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground dark:text-dark-muted-foreground uppercase tracking-wider">Nome Evento</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground dark:text-dark-muted-foreground uppercase tracking-wider">Data</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground dark:text-dark-muted-foreground uppercase tracking-wider">Tipo</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground dark:text-dark-muted-foreground uppercase tracking-wider">Sede (se locale)</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground dark:text-dark-muted-foreground uppercase tracking-wider">Azioni</th>
                            </tr>
                        </thead>
                        <tbody className="bg-card dark:bg-dark-card divide-y divide-border dark:divide-dark-border">
                            {sortedCalendar.map((event) => {
                                const isDeleting = isActionLoading(`deleteCalendarEvent-${event.id}`);
                                return (
                                <tr key={event.id} className="hover:bg-muted dark:hover:bg-dark-muted/50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground dark:text-dark-foreground">{event.name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground dark:text-dark-muted-foreground">{formatDateForDisplay(event.date)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground dark:text-dark-muted-foreground">{formatEventType(event.type)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground dark:text-dark-muted-foreground">{event.location || 'N/A'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="flex items-center justify-end space-x-3">
                                            <button onClick={() => openModalForEdit(event)} className="text-muted-foreground hover:text-primary" title="Modifica"><span className="text-xl">✏️</span></button>
                                            <button onClick={() => deleteCalendarEvent(event.id!)} className="text-muted-foreground hover:text-destructive" title="Elimina" disabled={isDeleting}>
                                                {isDeleting ? <SpinnerIcon className="w-5 h-5"/> : <span className="text-xl">🗑️</span>}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {editingEvent && (
                <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={'id' in editingEvent ? 'Modifica Evento' : 'Aggiungi Evento'}>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-foreground dark:text-dark-muted-foreground mb-1">Nome Evento *</label>
                            <input type="text" name="name" value={editingEvent.name} onChange={handleChange} required className="form-input"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-foreground dark:text-dark-muted-foreground mb-1">Data *</label>
                            <input type="date" name="date" value={editingEvent.date} onChange={handleChange} required className="form-input"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-foreground dark:text-dark-muted-foreground mb-1">Tipo *</label>
                            <select name="type" value={editingEvent.type} onChange={handleChange} required className="form-select">
                                {eventTypeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                            </select>
                        </div>
                        {editingEvent.type === 'LOCAL_HOLIDAY' && (
                            <div>
                                <label className="block text-sm font-medium text-foreground dark:text-dark-muted-foreground mb-1">Sede *</label>
                                <SearchableSelect name="location" value={editingEvent.location || ''} onChange={handleSelectChange} options={locationOptions} placeholder="Seleziona una sede" required/>
                            </div>
                        )}
                        <div className="flex justify-end space-x-3 pt-4">
                            <button type="button" onClick={handleCloseModal} className="px-4 py-2 bg-muted rounded-md">Annulla</button>
                            <button type="submit" disabled={isActionLoading('addCalendarEvent') || isActionLoading(`updateCalendarEvent-${'id' in editingEvent ? editingEvent.id : ''}`)} className="flex justify-center items-center px-4 py-2 bg-primary text-dark-foreground dark:text-dark-sidebar-foreground rounded-md hover:bg-primary-darker disabled:bg-primary/50">
                               {(isActionLoading('addCalendarEvent') || isActionLoading(`updateCalendarEvent-${'id' in editingEvent ? editingEvent.id : ''}`)) ? <SpinnerIcon className="w-5 h-5"/> : 'Salva'}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
            <style>{`.form-input, .form-select { display: block; width: 100%; border-radius: 0.375rem; border: 1px solid var(--color-border); background-color: var(--color-card); padding: 0.5rem 0.75rem; font-size: 0.875rem; line-height: 1.25rem; } .dark .form-input, .dark .form-select { border-color: var(--color-dark-border); background-color: var(--color-dark-card); color: var(--color-dark-foreground); }`}</style>
        </div>
    );
};

export default CalendarPage;
