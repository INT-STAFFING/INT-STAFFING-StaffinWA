
import React, { useMemo, useState } from 'react';
import { useUIConfigContext } from '../context/UIConfigContext';
import { useNavigate } from 'react-router-dom';

const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
        return 'Ieri';
    } else {
        return date.toLocaleDateString();
    }
};

const NotificationsPage: React.FC = () => {
    const { notifications, markNotificationAsRead } = useUIConfigContext();
    const navigate = useNavigate();
    const [filter, setFilter] = useState<'all' | 'unread'>('unread');

    const sortedNotifications = useMemo(() => {
        let filtered = [...notifications];
        if (filter === 'unread') {
            filtered = filtered.filter(n => !n.isRead);
        }
        return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [notifications, filter]);

    const handleNotificationClick = async (id: string, link?: string) => {
        await markNotificationAsRead(id);
        if (link) {
            navigate(link);
        }
    };

    const handleMarkAllRead = async () => {
        await markNotificationAsRead(); // Call without ID for bulk update
    };

    const unreadCount = notifications.filter(n => !n.isRead).length;

    return (
        <div className="max-w-3xl mx-auto space-y-6 pb-20">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-surface p-4 rounded-2xl shadow-sm border border-outline-variant">
                <div className="flex items-center gap-3">
                     <div className="p-3 bg-primary-container text-on-primary-container rounded-xl">
                        <span className="material-symbols-outlined text-2xl">notifications</span>
                     </div>
                     <div>
                        <h1 className="text-2xl font-bold text-on-surface">Notifiche</h1>
                        <p className="text-sm text-on-surface-variant">
                            Hai <span className="font-bold text-primary">{unreadCount}</span> notifiche non lette
                        </p>
                     </div>
                </div>
                
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <div className="bg-surface-container p-1 rounded-full flex gap-1 w-full md:w-auto">
                         <button 
                            onClick={() => setFilter('all')}
                            className={`flex-1 md:flex-none px-4 py-1.5 rounded-full text-sm font-bold transition-all ${filter === 'all' ? 'bg-surface text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
                        >
                            Tutte
                        </button>
                        <button 
                            onClick={() => setFilter('unread')}
                            className={`flex-1 md:flex-none px-4 py-1.5 rounded-full text-sm font-bold transition-all ${filter === 'unread' ? 'bg-surface text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
                        >
                            Da Leggere
                        </button>
                    </div>
                </div>
            </div>

            {unreadCount > 0 && (
                <div className="flex justify-end">
                     <button 
                        onClick={handleMarkAllRead}
                        className="text-primary text-sm font-bold hover:underline flex items-center gap-1 px-3 py-1 rounded hover:bg-surface-container transition-colors"
                    >
                        <span className="material-symbols-outlined text-lg">done_all</span>
                        Segna tutte come lette
                    </button>
                </div>
            )}

            {sortedNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-surface rounded-3xl border border-dashed border-outline-variant text-on-surface-variant opacity-60">
                    <span className="material-symbols-outlined text-6xl mb-4">notifications_off</span>
                    <p className="text-lg font-medium">Non ci sono notifiche {filter === 'unread' ? 'da leggere' : ''}.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {sortedNotifications.map(notification => (
                        <div 
                            key={notification.id}
                            onClick={() => handleNotificationClick(notification.id, notification.link)}
                            className={`
                                group relative p-5 rounded-2xl cursor-pointer transition-all duration-200 border
                                ${notification.isRead 
                                    ? 'bg-surface border-transparent hover:border-outline-variant' 
                                    : 'bg-primary-container/10 border-primary/20 hover:shadow-md hover:bg-primary-container/20'
                                }
                            `}
                        >
                            <div className="flex justify-between items-start gap-4">
                                <div className="flex gap-4">
                                    <div className={`
                                        w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0
                                        ${notification.isRead ? 'bg-surface-container-high text-on-surface-variant' : 'bg-primary text-on-primary'}
                                    `}>
                                        <span className="material-symbols-outlined text-xl">
                                            {notification.title.includes('Richiesta') ? 'assignment' : 
                                             notification.title.includes('Assegnazione') ? 'work' :
                                             notification.title.includes('Allocazione') ? 'calendar_month' :
                                             'info'}
                                        </span>
                                    </div>
                                    <div>
                                        <h3 className={`font-bold text-base mb-1 ${notification.isRead ? 'text-on-surface' : 'text-primary'}`}>
                                            {notification.title}
                                        </h3>
                                        <p className={`text-sm leading-relaxed ${notification.isRead ? 'text-on-surface-variant' : 'text-on-surface'}`}>
                                            {notification.message}
                                        </p>
                                    </div>
                                </div>
                                
                                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                                    <span className="text-xs font-medium text-on-surface-variant bg-surface-container px-2 py-1 rounded-lg whitespace-nowrap">
                                        {formatDate(notification.createdAt)}
                                    </span>
                                    {!notification.isRead && (
                                        <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse"></span>
                                    )}
                                </div>
                            </div>
                            
                            {notification.link && (
                                <div className="mt-3 pl-14 flex items-center text-xs font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity transform translate-y-1 group-hover:translate-y-0">
                                    Vai al dettaglio <span className="material-symbols-outlined text-sm ml-1">arrow_forward</span>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default NotificationsPage;
