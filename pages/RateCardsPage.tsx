
/**
 * @file RateCardsPage.tsx
 * @description Pagina Master-Detail per la gestione dei listini di vendita (Rate Cards) e delle tariffe per ruolo.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useEntitiesContext } from '../context/AppContext';
import { RateCard, RateCardEntry } from '../types';
import Modal from '../components/Modal';
import { SpinnerIcon } from '../components/icons';
import ConfirmationModal from '../components/ConfirmationModal';
import { formatCurrency } from '../utils/formatters';
import { useToast } from '../context/ToastContext';

export default function RateCardsPage() {
    const { 
        rateCards, rateCardEntries, roles, 
        addRateCard, updateRateCard, deleteRateCard, upsertRateCardEntries,
        isActionLoading, loading 
    } = useEntitiesContext();
    const { addToast } = useToast();

    // Selection State
    const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
    
    // Modal State for Master (Rate Card)
    const [isMasterModalOpen, setIsMasterModalOpen] = useState(false);
    const [editingCard, setEditingCard] = useState<RateCard | Omit<RateCard, 'id'> | null>(null);
    const [cardToDelete, setCardToDelete] = useState<RateCard | null>(null);

    // Editing State for Detail (Entries)
    // We keep a local copy of entries as STRINGS to allow proper typing behavior (decimals)
    const [localEntries, setLocalEntries] = useState<Record<string, string>>({});
    const [hasUnsavedChanges, setHasChanges] = useState(false);

    // Default Selection on Load
    useEffect(() => {
        if (!selectedCardId && rateCards.length > 0) {
            setSelectedCardId(rateCards[0].id!);
        }
    }, [rateCards, selectedCardId]);

    // Sync Local Entries when Selection Changes or Data Refreshes
    useEffect(() => {
        if (selectedCardId) {
            const relevantEntries = rateCardEntries.filter(e => e.rateCardId === selectedCardId);
            const map: Record<string, string> = {};
            // Initialize all roles, defaulting to 0.00 if no entry exists
            roles.forEach(r => {
                const entry = relevantEntries.find(e => e.roleId === r.id);
                // Store formatted string to ensure inputs show decimals properly initially
                map[r.id!] = entry ? Number(entry.dailyRate).toFixed(2) : '0.00';
            });
            setLocalEntries(map);
            setHasChanges(false);
        } else {
            setLocalEntries({});
            setHasChanges(false);
        }
    }, [selectedCardId, rateCardEntries, roles]);


    // --- HANDLERS FOR MASTER (RATE CARDS) ---

    const openNewCardModal = () => {
        setEditingCard({ name: '', currency: 'EUR' });
        setIsMasterModalOpen(true);
    };

    const openEditCardModal = (card: RateCard) => {
        setEditingCard({ ...card });
        setIsMasterModalOpen(true);
    };

    const handleMasterSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingCard) return;

        try {
            if ('id' in editingCard) {
                await updateRateCard(editingCard as RateCard);
                addToast('Listino aggiornato', 'success');
            } else {
                await addRateCard(editingCard as Omit<RateCard, 'id'>);
                addToast('Listino creato', 'success');
            }
            setIsMasterModalOpen(false);
        } catch (err) {
            addToast('Errore nel salvataggio', 'error');
        }
    };

    const handleDeleteCard = async () => {
        if (cardToDelete) {
            try {
                await deleteRateCard(cardToDelete.id!);
                setCardToDelete(null);
                if (selectedCardId === cardToDelete.id) setSelectedCardId(null);
                addToast('Listino eliminato', 'success');
            } catch (err) {
                addToast('Errore eliminazione', 'error');
            }
        }
    };


    // --- HANDLERS FOR DETAIL (ENTRIES) ---

    const handleRateChange = (roleId: string, value: string) => {
        // Store raw string value to support typing "12." or "0.0"
        setLocalEntries(prev => ({
            ...prev,
            [roleId]: value
        }));
        setHasChanges(true);
    };

    const handleSaveEntries = async () => {
        if (!selectedCardId) return;

        const entriesPayload: RateCardEntry[] = Object.entries(localEntries).map(([roleId, dailyRateStr]) => ({
            rateCardId: selectedCardId,
            roleId,
            dailyRate: parseFloat(dailyRateStr) || 0
        }));

        try {
            await upsertRateCardEntries(entriesPayload);
            setHasChanges(false);
            addToast('Tariffe aggiornate con successo', 'success');
        } catch (err) {
            addToast('Errore aggiornamento tariffe', 'error');
        }
    };

    const handleApplyStandardCosts = () => {
        if (roles.length === 0) {
            addToast('Nessun ruolo disponibile per inizializzare.', 'warning');
            return;
        }
        if (!confirm('Vuoi sovrascrivere le tariffe attuali con il costo standard + 20% di markup?')) return;
        
        const newEntries: Record<string, string> = {};
        roles.forEach(role => {
            const cost = role.standardCost || role.dailyCost || 0;
            // Store as string to be consistent with localEntries type
            newEntries[role.id!] = (cost * 1.2).toFixed(2);
        });
        setLocalEntries(newEntries);
        setHasChanges(true);
    };

    const activeCard = rateCards.find(c => c.id === selectedCardId);

    return (
        <div className="h-full flex flex-col md:flex-row gap-6 overflow-hidden">
            
            {/* --- LEFT PANEL: LIST OF CARDS --- */}
            <div className="w-full md:w-1/3 lg:w-1/4 flex flex-col gap-4 min-w-[250px]">
                <div className="flex justify-between items-center px-2">
                    <h2 className="text-xl font-bold text-on-surface">Listini</h2>
                    <button onClick={openNewCardModal} className="p-2 bg-primary text-on-primary rounded-full shadow hover:opacity-90">
                        <span className="material-symbols-outlined">add</span>
                    </button>
                </div>
                
                <div className="flex-1 bg-surface rounded-2xl shadow border border-outline-variant overflow-y-auto">
                    {loading ? (
                        <div className="p-4 flex justify-center"><SpinnerIcon className="w-6 h-6 text-primary"/></div>
                    ) : rateCards.length === 0 ? (
                        <div className="p-4 text-center text-on-surface-variant text-sm">Nessun listino creato.</div>
                    ) : (
                        <ul className="divide-y divide-outline-variant">
                            {rateCards.map(card => (
                                <li 
                                    key={card.id} 
                                    className={`p-4 cursor-pointer transition-colors hover:bg-surface-container-low flex justify-between items-center group ${selectedCardId === card.id ? 'bg-primary-container/30 border-l-4 border-primary' : ''}`}
                                    onClick={() => setSelectedCardId(card.id!)}
                                >
                                    <span className={`font-medium ${selectedCardId === card.id ? 'text-primary' : 'text-on-surface'}`}>
                                        {card.name}
                                    </span>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); openEditCardModal(card); }} 
                                            className="p-1 text-on-surface-variant hover:text-primary"
                                        >
                                            <span className="material-symbols-outlined text-sm">edit</span>
                                        </button>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); setCardToDelete(card); }} 
                                            className="p-1 text-on-surface-variant hover:text-error"
                                        >
                                            <span className="material-symbols-outlined text-sm">delete</span>
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            {/* --- RIGHT PANEL: EDITOR --- */}
            <div className="flex-1 flex flex-col gap-4 overflow-hidden">
                {selectedCardId && activeCard ? (
                    <>
                        <div className="bg-surface p-4 rounded-2xl shadow border border-outline-variant flex justify-between items-center">
                            <div>
                                <h2 className="text-xl font-bold text-on-surface">{activeCard.name}</h2>
                                <p className="text-xs text-on-surface-variant">Definizione tariffe di vendita per ruolo (Valuta: {activeCard.currency})</p>
                            </div>
                            <div className="flex gap-2">
                                <button 
                                    onClick={handleApplyStandardCosts}
                                    className="px-4 py-2 text-sm font-medium text-primary border border-primary rounded-full hover:bg-primary/5"
                                >
                                    Inizializza da Costi Standard
                                </button>
                                {hasUnsavedChanges && (
                                    <button 
                                        onClick={handleSaveEntries}
                                        disabled={isActionLoading('upsertRateCardEntries')}
                                        className="px-6 py-2 text-sm font-bold bg-primary text-on-primary rounded-full shadow hover:opacity-90 flex items-center gap-2"
                                    >
                                        {isActionLoading('upsertRateCardEntries') ? <SpinnerIcon className="w-4 h-4"/> : 'Salva Modifiche'}
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="flex-1 bg-surface rounded-2xl shadow border border-outline-variant overflow-hidden flex flex-col">
                            <div className="overflow-y-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-surface-container-low sticky top-0 z-10 shadow-sm">
                                        <tr>
                                            <th className="p-4 font-semibold text-xs uppercase text-on-surface-variant">Ruolo</th>
                                            <th className="p-4 font-semibold text-xs uppercase text-on-surface-variant text-right">Costo Standard (Rif.)</th>
                                            <th className="p-4 font-semibold text-xs uppercase text-on-surface-variant text-right w-40">Sell Rate (€)</th>
                                            <th className="p-4 font-semibold text-xs uppercase text-on-surface-variant text-right">Margine %</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-outline-variant">
                                        {roles.map(role => {
                                            const sellRateStr = localEntries[role.id!] || '0.00';
                                            const sellRate = parseFloat(sellRateStr) || 0;
                                            const cost = role.standardCost || role.dailyCost || 0;
                                            const margin = sellRate > 0 ? ((sellRate - cost) / sellRate) * 100 : 0;
                                            
                                            return (
                                                <tr key={role.id} className="hover:bg-surface-container-low">
                                                    <td className="p-4 text-sm font-medium text-on-surface">{role.name}</td>
                                                    <td className="p-4 text-sm text-right text-on-surface-variant font-mono">{formatCurrency(cost)}</td>
                                                    <td className="p-4 text-right">
                                                        <input 
                                                            type="number" 
                                                            min="0" 
                                                            step="0.01" 
                                                            value={sellRateStr} 
                                                            onChange={(e) => handleRateChange(role.id!, e.target.value)}
                                                            className="w-full text-right font-mono bg-surface-container-low border-b border-transparent focus:border-primary focus:outline-none px-2 py-1 rounded hover:bg-surface-container"
                                                            placeholder="0.00"
                                                        />
                                                    </td>
                                                    <td className="p-4 text-sm text-right font-mono">
                                                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${margin < 0 ? 'bg-error-container text-on-error-container' : margin < 20 ? 'bg-yellow-container text-on-yellow-container' : 'bg-tertiary-container text-on-tertiary-container'}`}>
                                                            {margin.toFixed(1)}%
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-on-surface-variant opacity-60">
                        <span className="material-symbols-outlined text-6xl mb-4">payments</span>
                        <p>Seleziona un listino per modificare le tariffe</p>
                    </div>
                )}
            </div>

            {/* MASTER MODAL */}
            {isMasterModalOpen && editingCard && (
                <Modal isOpen={isMasterModalOpen} onClose={() => setIsMasterModalOpen(false)} title={'id' in editingCard ? 'Modifica Listino' : 'Nuovo Listino'}>
                    <form onSubmit={handleMasterSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Nome Listino</label>
                            <input 
                                type="text" 
                                value={editingCard.name} 
                                onChange={e => setEditingCard({...editingCard, name: e.target.value})} 
                                className="form-input" 
                                required 
                                autoFocus
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Valuta</label>
                            <select 
                                value={editingCard.currency} 
                                onChange={e => setEditingCard({...editingCard, currency: e.target.value})} 
                                className="form-select"
                            >
                                <option value="EUR">EUR (€)</option>
                                <option value="USD">USD ($)</option>
                                <option value="GBP">GBP (£)</option>
                            </select>
                        </div>
                        <div className="flex justify-end pt-4">
                             <button type="button" onClick={() => setIsMasterModalOpen(false)} className="px-4 py-2 rounded-full border border-outline text-primary mr-2">Annulla</button>
                             <button type="submit" disabled={isActionLoading('addRateCard') || isActionLoading('updateRateCard')} className="px-6 py-2 bg-primary text-on-primary rounded-full font-bold shadow hover:opacity-90">Salva</button>
                        </div>
                    </form>
                </Modal>
            )}

            {/* DELETE MODAL */}
            {cardToDelete && (
                <ConfirmationModal 
                    isOpen={!!cardToDelete}
                    onClose={() => setCardToDelete(null)}
                    onConfirm={handleDeleteCard}
                    title="Elimina Listino"
                    message={`Sei sicuro di voler eliminare il listino "${cardToDelete.name}"? Tutte le tariffe associate verranno perse.`}
                    isConfirming={isActionLoading(`deleteRateCard-${cardToDelete.id}`)}
                />
            )}

        </div>
    );
}
