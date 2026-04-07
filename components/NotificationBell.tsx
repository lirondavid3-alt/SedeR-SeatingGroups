import React, { useState, useRef, useEffect } from 'react';
import { Notification } from '../types';
import { BellIcon, XIcon } from './icons';

interface NotificationBellProps {
    notifications: Notification[];
    onRead: (id: string) => void;
    onDelete: (id: string) => void;
    onClearAll: () => void;
    onAction: (notification: Notification) => void;
}

const NotificationBell: React.FC<NotificationBellProps> = ({ notifications, onRead, onDelete, onClearAll, onAction }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const unreadCount = notifications.filter(n => !n.read).length;

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    return (
        <div className="relative" ref={dropdownRef}>
            <button 
                onClick={() => {
                    setIsOpen(!isOpen);
                    if (!isOpen && unreadCount > 0) {
                        // Mark all as read when opening the simple message
                        notifications.forEach(n => {
                            if (!n.read) onRead(n.id);
                        });
                    }
                }}
                className="p-2.5 rounded-full hover:bg-slate-100 transition-all relative group active:scale-90"
                title="התראות"
            >
                <BellIcon className={`h-6 w-6 transition-colors ${unreadCount > 0 ? 'text-teal-600' : 'text-slate-400'}`} />
                {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 bg-rose-500 text-white text-[10px] font-black h-4.5 w-4.5 flex items-center justify-center rounded-full border-2 border-white shadow-sm animate-bounce">
                        {unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute left-0 sm:left-[-20px] md:left-[-40px] mt-3 w-64 bg-white rounded-2xl shadow-2xl border border-slate-100 z-[1000] p-4 animate-in slide-in-from-top-2 duration-200 origin-top text-center">
                    <div className="flex justify-end mb-2">
                        <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-slate-100 rounded-full">
                            <XIcon className="h-4 w-4 text-slate-400" />
                        </button>
                    </div>
                    <p className="text-sm font-black text-slate-700 leading-relaxed">
                        שים לב שיתפו אותך במפה / מפות חדשות
                    </p>
                    <p className="text-[10px] text-slate-400 mt-2">
                        גלול למטה כדי לראות את המפות ששותפו איתך
                    </p>
                </div>
            )}
        </div>
    );
};

export default NotificationBell;
