/**
 * @file CalendarPage.tsx
 * @description Pagina per la gestione del calendario aziendale (festività, chiusure) utilizzando DataTable.
 */

import React, { useState, useMemo } from 'react';
import { useEntitiesContext } from '../context/AppContext';
import { CalendarEvent, CalendarEventType } from '../types';
import Modal from '../components/Modal';
import SearchableSelect from '../components/SearchableSelect';
import { SpinnerIcon } from '../components/icons';
import { DataTable, ColumnDef } from '../components/DataTable';
import { formatDateFull } from '../utils/dateUtils';

/**
 * Traduce il tipo di evento in una stringa leggibile.
 */
const formatEventType = (type: CalendarEventType): string => {
    switch (type) {
        case 'COMPANY_CLOSURE': return 'Chiusura Aziendale';
        case 'NATIONAL_HOLIDAY': return 'Festività Nazionale';
        case 'LOCAL_HOLIDAY': return 'Festività Locale';
        default: return type;
    }
};

const getEventTypeBadgeClass = (type: CalendarEventType): string => {
    switch (type) {
        case 'NATIONAL_HOLIDAY': return 'bg-primary-container text-on-primary-container';
        case 'COMPANY_CLOSURE': return 'bg-tertiary-container text-on-tertiary-container';
        case 'LOCAL_HOLIDAY': return 'bg-secondary-container text-on-secondary-container';
        default: return 'bg-surface-variant text-on-surface-variant';
    }
};

const CalendarPage: React.FC = () => {
    const { companyCalendar, addCalendarEvent, updateCalendarEvent, deleteCalendarEvent, locations, isActionLoading, loading } = useEntitiesContext();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingEvent, setEditingEvent] = useState<CalendarEvent | Omit<CalendarEvent, 'id'> | null>(null);
    const [filters, setFilters] = useState({ name: '', type: '' });

    const emptyEvent: Omit<CalendarEvent, 'id'> = {
        name: '',
        date: new Date().toISOString().split('T')[0],
        type: 'NATIONAL_HOLIDAY',
        location: null
    };

    // --- Data Processing ---
    const filteredData = useMemo(() => {
        return companyCalendar
            .filter(event => {
                const nameMatch = event.name.toLowerCase().includes(filters.name.toLowerCase());
                const typeMatch = filters.type ? event.type === filters.type : true;
                return nameMatch && typeMatch;
            })
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [companyCalendar, filters]);

    // --- Handlers ---
    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const handleFilterSelectChange = (name: string, value: string) => setFilters(prev => ({ ...prev, [name]: value }));
    const resetFilters = () => setFilters({ name: '', type: '' });

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

    // --- Options ---
    const locationOptions = useMemo(() => locations.map(l => ({ value: l.value, label: l.value })), [locations]);
    const eventTypeOptions: { value: CalendarEventType, label: string }[] = [
        { value: 'NATIONAL_HOLIDAY', label: 'Festività Nazionale' },
        { value: 'COMPANY_CLOSURE', label: 'Chiusura Aziendale' },
        { value: 'LOCAL_HOLIDAY', label: 'Festività Locale' }
    ];

    // --- DataTable Configuration ---
    const columns: ColumnDef<CalendarEvent>[] = [
        { header: 'Data', sortKey: 'date', cell: e => <span className="font-mono text-sm text-on-surface">{formatDateFull(e.date)}</span> },
        { header: 'Nome Evento', sortKey: 'name', cell: e => <span className="font-medium text-on-surface">{e.name}</span> },
        { header: 'Tipo', sortKey: 'type', cell: e => <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getEventTypeBadgeClass(e.type)}`}>{formatEventType(e.type)}</span> },
        { header: 'Sede', sortKey: 'location', cell: e => <span className="text-sm text-on-surface-variant">{e.location || '-'}</span> },
    ];

    const renderRow = (event: CalendarEvent) => (
        <tr key={event.id} className="group hover:bg-surface-container">
            {columns.map((col, i) => <td key={i} className="px-6 py-4 whitespace-nowrap overflow-hidden text-ellipsis bg-inherit" title={col.sortKey ? String((event as any)[col.sortKey]) : undefined}>{col.cell(event)}</td>)}
            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium sticky right-0 bg-inherit">
                <div className="flex items-center justify-end space-x-2">
                    <button onClick={() => openModalForEdit(event)} className="p-2 rounded-full hover:bg-surface-container text-on-surface-variant hover:text-primary" title="Modifica"><span className="material-symbols-outlined">edit</span></button>
                    <button onClick={() => deleteCalendarEvent(event.id!)} className="p-2 rounded-full hover:bg-surface-container text-on-surface-variant hover:text-error" title="Elimina">
                        {isActionLoading(`deleteCalendarEvent-${event.id}`) ? <SpinnerIcon className="w-5 h-5"/> : <span className="material-symbols-outlined">delete</span>}
                    </button>
                </div>
            </td>
        </tr>
    );

    const renderMobileCard = (event: CalendarEvent) => (
        <div key={event.id} className={`p-4 rounded-lg shadow-md bg-surface-container border-l-4 ${event.type === 'COMPANY_CLOSURE' ? 'border-tertiary' : 'border-primary'}`}>
            <div className="flex justify-between items-start">
                <div>
                    <p className="font-bold text-lg text-on-surface">{event.name}</p>
                    <p className="text-sm text-on-surface-variant font-mono">{formatDateFull(event.date)}</p>
                </div>
                <div className="flex items-center space-x-1">
                    <button onClick={() => openModalForEdit(event)} className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container-high"><span className="material-symbols-outlined">edit</span></button>
                    <button onClick={() => deleteCalendarEvent(event.id!)} className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container-high">
                        {isActionLoading(`deleteCalendarEvent-${event.id}`) ? <SpinnerIcon className="w-5 h-5"/> : <span className="material-symbols-outlined">delete</span>}
                    </button>
                </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
                <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getEventTypeBadgeClass(event.type)}`}>{formatEventType(event.type)}</span>
                {event.location && <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-surface-variant text-on-surface-variant">{event.location}</span>}
            </div>
        </div>
    );

    const filtersNode = (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <input type="text" name="name" value={filters.name} onChange={handleFilterChange} className="w-full form-input" placeholder="Cerca evento..." />
            <SearchableSelect name="type" value={filters.type} onChange={handleFilterSelectChange} options={eventTypeOptions} placeholder="Tutti i tipi" />
            <button onClick={resetFilters} className="px-4 py-2 bg-secondary-container text-on-secondary-container rounded-full hover:opacity-90 w-full">Reset</button>
        </div>
    );

    return (
        <div>
            <DataTable<CalendarEvent>
                title="Gestione Calendario"
                addNewButtonLabel="Aggiungi Evento"
                data={filteredData}
                columns={columns}
                filtersNode={filtersNode}
                onAddNew={openModalForNew}
                renderRow={renderRow}
                renderMobileCard={renderMobileCard}
                initialSortKey="date"
                isLoading={loading}
                tableLayout={{ dense: true, striped: true, headerSticky: true, headerBackground: true, headerBorder: true }}
                tableClassNames={{ base: 'w-full text-sm' }}
                numActions={2} // MODIFICA, ELIMINA
            />

            {editingEvent && (
                <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={'id' in editingEvent ? 'Modifica Evento' : 'Aggiungi Evento'}>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-on-surface-variant mb-1">Nome Evento *</label>
                            <input type="text" name="name" value={editingEvent.name} onChange={handleChange} required className="form-input"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-on-surface-variant mb-1">Data *</label>
                            <input type="date" name="date" value={editingEvent.date} onChange={handleChange} required className="form-input"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-on-surface-variant mb-1">Tipo *</label>
                            <select name="type" value={editingEvent.type} onChange={handleChange} required className="form-select">
                                {eventTypeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                            </select>
                        </div>
                        {editingEvent.type === 'LOCAL_HOLIDAY' && (
                            <div>
                                <label className="block text-sm font-medium text-on-surface-variant mb-1">Sede *</label>
                                <SearchableSelect name="location" value={editingEvent.location || ''} onChange={handleSelectChange} options={locationOptions} placeholder="Seleziona una sede" required/>
                            </div>
                        )}
                        <div className="flex justify-end space-x-3 pt-4 border-t border-outline-variant mt-4">
                            <button type="button" onClick={handleCloseModal} className="px-6 py-2 border border-outline rounded-full hover:bg-surface-container-low text-primary font-semibold">Annulla</button>
                            <button type="submit" disabled={isActionLoading('addCalendarEvent') || isActionLoading(`updateCalendarEvent-${'id' in editingEvent ? editingEvent.id : ''}`)} className="flex justify-center items-center px-6 py-2 bg-primary text-on-primary rounded-full disabled:opacity-50 font-semibold hover:opacity-90">
                               {(isActionLoading('addCalendarEvent') || isActionLoading(`updateCalendarEvent-${'id' in editingEvent ? editingEvent.id : ''}`)) ? <SpinnerIcon className="w-5 h-5"/> : 'Salva'}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
};

export default CalendarPage;