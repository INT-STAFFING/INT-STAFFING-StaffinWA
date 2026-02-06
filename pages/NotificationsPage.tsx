import React, { useMemo, useState } from 'react';
import { useEntitiesContext } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { formatDateFull } from '../utils/dateUtils';
import { SpinnerIcon } from '../components/icons';

const NotificationsPage: React.FC = () => {
    const { notifications, markNotificationAsRead, fetchNotifications } = useEntitiesContext();
    const navigate = useNavigate();
    const [isMarkingAll, setIsMarkingAll] = useState(false);

    const sortedNotifications = useMemo(() => {
        return [...notifications].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [notifications]);

    const handleNotificationClick = async (id: string, link?: string) => {
        await markNotificationAsRead(id);
        if (link) {
            navigate(link);
        }
    };

    const handleMarkAllRead = async () => {
        setIsMarkingAll(true);
        try {
            await markNotificationAsRead(); // Empty ID triggers bulk read on server
            await fetchNotifications(); // Refresh local state
        } finally {
            setIsMarkingAll(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-surface p-6 rounded-3xl shadow-sm border border-outline-variant">
                <div>
                    <h1 className="text-3xl font-bold text-on-surface flex items-center gap-3">
                        <span className="material-symbols-outlined text-primary text-4xl">notifications</span>
                        Le tue Notifiche
                    </h1>
                    <p className="text-sm text-on-surface-variant mt-1">Rimani aggiornato su assegnazioni, assenze e attività dei progetti.</p>
                </div>
                {notifications.some(n => !n.isRead) && (
                    <button 
                        onClick={handleMarkAllRead}
                        disabled={isMarkingAll}
                        className="px-6 py-2 bg-primary-container text-on-primary-container rounded-full text-sm font-bold flex items-center gap-2 hover:bg-primary-container/80 transition-colors disabled:opacity-50"
                    >
                        {isMarkingAll ? <SpinnerIcon className="w-4 h-4" /> : <span className="material-symbols-outlined text-lg">done_all</span>}
                        Segna tutte come lette
                    </button>
                )}
            </div>

            {sortedNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-surface rounded-[2.5rem] border-2 border-dashed border-outline-variant">
                    <div className="w-20 h-20 rounded-full bg-surface-container flex items-center justify-center mb-4">
                        <span className="material-symbols-outlined text-4xl text-on-surface-variant/50">notifications_off</span>
                    </div>
                    <p className="text-lg font-bold text-on-surface-variant">Ancora nessuna notifica</p>
                    <p className="text-sm text-on-surface-variant opacity-60">Ti avviseremo qui quando accadrà qualcosa di rilevante.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {sortedNotifications.map(notification => (
                        <div 
                            key={notification.id}
                            onClick={() => handleNotificationClick(notification.id, notification.link)}
                            className={`
                                p-5 rounded-[1.5rem] border cursor-pointer transition-all duration-300 relative group
                                ${notification.isRead 
                                    ? 'bg-surface border-outline-variant/50' 
                                    : 'bg-surface border-primary ring-1 ring-primary/10 shadow-lg'
                                }
                                hover:translate-x-1 hover:shadow-xl
                            `}
                        >
                            {!notification.isRead && (
                                <div className="absolute top-5 right-5 w-2.5 h-2.5 rounded-full bg-primary animate-pulse"></div>
                            )}
                            
                            <div className="flex gap-4">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${notification.isRead ? 'bg-surface-container' : 'bg-primary-container'}`}>
                                     <span className={`material-symbols-outlined ${notification.isRead ? 'text-on-surface-variant' : 'text-primary'}`}>
                                         {notification.link?.includes('leaves') ? 'event_busy' : 
                                          notification.link?.includes('staffing') ? 'calendar_month' : 
                                          notification.link?.includes('projects') ? 'folder' : 'info'}
                                     </span>
                                </div>
                                <div className="flex-grow pr-6">
                                    <div className="flex justify-between items-baseline mb-1">
                                        <h3 className={`font-bold ${notification.isRead ? 'text-on-surface' : 'text-primary'}`}>
                                            {notification.title}
                                        </h3>
                                        <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60">
                                            {formatDateFull(notification.createdAt)}
                                        </span>
                                    </div>
                                    <p className={`text-sm leading-relaxed ${notification.isRead ? 'text-on-surface-variant' : 'text-on-surface'}`}>
                                        {notification.message}
                                    </p>
                                    
                                    {notification.link && (
                                        <div className={`mt-3 flex items-center text-xs font-bold gap-1 ${notification.isRead ? 'text-on-surface-variant opacity-60' : 'text-primary'}`}>
                                            VAI AL DETTAGLIO <span className="material-symbols-outlined text-sm group-hover:translate-x-1 transition-transform">arrow_right_alt</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default NotificationsPage;
