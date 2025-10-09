import React, { useState } from 'react';
import { useStaffingContext } from '../context/StaffingContext';
import { Client } from '../types';
import Modal from '../components/Modal';
import { PencilIcon, TrashIcon } from '../components/icons';

const ClientsPage: React.FC = () => {
    const { clients, clientSectors, addClient, updateClient, deleteClient } = useStaffingContext();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingClient, setEditingClient] = useState<Client | Omit<Client, 'id'> | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const handleOpenModal = (client: Client | null = null) => {
        setEditingClient(client || { name: '', sector: '', contactEmail: '' });
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingClient(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (editingClient) {
            try {
                if ('id' in editingClient) {
                    await updateClient(editingClient as Client);
                } else {
                    await addClient(editingClient as Omit<Client, 'id'>);
                }
                handleCloseModal();
            } catch (error) {
                console.error("Failed to save client:", error);
                // The context already shows an alert, but you could add more specific error handling here
            }
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        if (editingClient) {
            setEditingClient({ ...editingClient, [e.target.name]: e.target.value });
        }
    };

    const filteredClients = clients.filter(client =>
        client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.sector.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.contactEmail.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div>
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white self-start">Gestione Clienti</h1>
                <div className="self-end w-full md:w-auto flex gap-4">
                     <input
                        type="text"
                        placeholder="Cerca cliente..."
                        className="form-input w-full md:w-64"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <button onClick={() => handleOpenModal()} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-md shadow-sm hover:bg-blue-700 whitespace-nowrap">
                        Aggiungi Cliente
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Nome</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Settore</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Email Contatto</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Azioni</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {filteredClients.map(client => (
                            <tr key={client.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{client.name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{client.sector}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{client.contactEmail}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button onClick={() => handleOpenModal(client)} className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-200 mr-3" title="Modifica">
                                        <PencilIcon className="w-5 h-5" />
                                    </button>
                                    <button onClick={() => deleteClient(client.id!)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-200" title="Elimina">
                                        <TrashIcon className="w-5 h-5" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {editingClient && (
                <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={('id' in editingClient ? 'Modifica' : 'Aggiungi') + ' Cliente'}>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nome *</label>
                            <input type="text" name="name" id="name" value={editingClient.name} onChange={handleChange} required className="mt-1 w-full form-input" />
                        </div>
                         <div>
                            <label htmlFor="sector" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Settore *</label>
                            <select name="sector" id="sector" value={editingClient.sector} onChange={handleChange} required className="mt-1 w-full form-select">
                                <option value="">Seleziona un settore...</option>
                                {clientSectors.map(s => <option key={s.id} value={s.value}>{s.value}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="contactEmail" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email Contatto *</label>
                            <input type="email" name="contactEmail" id="contactEmail" value={editingClient.contactEmail} onChange={handleChange} required className="mt-1 w-full form-input" />
                        </div>
                        <div className="flex justify-end space-x-3 pt-2">
                            <button type="button" onClick={handleCloseModal} className="px-4 py-2 bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500">Annulla</button>
                            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Salva</button>
                        </div>
                    </form>
                </Modal>
            )}
             <style>{`
                .form-input, .form-select { display: block; width: 100%; border-radius: 0.375rem; border: 1px solid #D1D5DB; background-color: #FFFFFF; padding: 0.5rem 0.75rem; font-size: 0.875rem; line-height: 1.25rem; }
                .dark .form-input, .dark .form-select { border-color: #4B5563; background-color: #374151; color: #F9FAFB; }
            `}</style>
        </div>
    );
};

export default ClientsPage;
