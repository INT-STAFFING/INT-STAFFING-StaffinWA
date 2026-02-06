
import React, { useMemo } from 'react';
import { useEntitiesContext } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { formatDateFull } from '../utils/dateUtils';

const NotificationsPage: React.FC = () => {
    const { notifications, markNotificationAsRead } = useEntitiesContext();
    const navigate = useNavigate();

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
        await markNotificationAsRead(); // No ID means all
    };

    return (
        <div className="max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-on-surface">Notifiche</h1>
                {notifications.some(n => !n.isRead) && (
                    <button 
                        onClick={handleMarkAllRead}
                        className="text-primary text-sm font-medium hover:underline flex items-center gap-1"
                    >
                        <span className="material-symbols-outlined text-sm">done_all</span>
                        Segna tutte come lette
                    </button>
                )}
            </div>

            {sortedNotifications.length === 0 ? (
                <div className="text-center py-12 bg-surface rounded-2xl shadow">
                    <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-2">notifications_off</span>
                    <p className="text-on-surface-variant">Non hai notifiche.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {sortedNotifications.map(notification => (
                        <div 
                            key={notification.id}
                            onClick={() => handleNotificationClick(notification.id, notification.link)}
                            className={`
                                p-4 rounded-xl border cursor-pointer transition-all duration-200 relative
                                ${notification.isRead 
                                    ? 'bg-surface border-outline-variant' 
                                    : 'bg-primary-container/20 border-primary/30 shadow-sm'
                                }
                                hover:shadow-md
                            `}
                        >
                            {!notification.isRead && (
                                <div className="absolute top-4 right-4 w-3 h-3 rounded-full bg-primary"></div>
                            )}
                            
                            <div className="flex justify-between items-start mb-1 pr-6">
                                <h3 className={`font-semibold ${notification.isRead ? 'text-on-surface' : 'text-primary'}`}>
                                    {notification.title}
                                </h3>
                                <span className="text-xs text-on-surface-variant whitespace-nowrap ml-2">
                                    {formatDateFull(notification.createdAt)} {new Date(notification.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </span>
                            </div>
                            
                            <p className={`text-sm ${notification.isRead ? 'text-on-surface-variant' : 'text-on-surface'}`}>
                                {notification.message}
                            </p>
                            
                            {notification.link && (
                                <div className="mt-2 flex items-center text-xs text-primary font-medium">
                                    Vedi dettagli <span className="material-symbols-outlined text-sm ml-1">arrow_forward</span>
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