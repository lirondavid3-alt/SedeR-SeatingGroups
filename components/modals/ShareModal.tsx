import React, { useState, useEffect } from 'react';
import { Chart, UserProfile, ShareInfo } from '../../types';
import { searchTeachers, shareChart, revokeShare, getTeachersInSchool } from '../../services/firebase';
import { XIcon, SearchIcon, UserPlusIcon, TrashIcon, SchoolIcon, ShieldCheckIcon, ShieldIcon } from '../icons';
import { toast } from 'sonner';

interface ShareModalProps {
    chart: Chart;
    currentProfile: UserProfile;
    onClose: () => void;
    onUpdate: () => void;
}

const ShareModal: React.FC<ShareModalProps> = ({ chart, currentProfile, onClose, onUpdate }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
    const [schoolTeachers, setSchoolTeachers] = useState<UserProfile[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [selectedTeacher, setSelectedTeacher] = useState<UserProfile | null>(null);
    const [message, setMessage] = useState('');
    const [role, setRole] = useState<'viewer' | 'editor'>('viewer');
    const [isSharing, setIsSharing] = useState(false);

    useEffect(() => {
        const loadSchoolTeachers = async () => {
            if (currentProfile.schoolName) {
                const teachers = await getTeachersInSchool(currentProfile.schoolName);
                // Filter out current user and already shared users
                const filtered = teachers.filter(t => 
                    t.uid !== currentProfile.uid && 
                    !(chart.sharedWithEmails || []).some(email => email.toLowerCase() === t.email.toLowerCase())
                );
                setSchoolTeachers(filtered);
            }
        };
        loadSchoolTeachers();
    }, [currentProfile, chart.sharedWithEmails]);

    const handleSearch = async () => {
        const term = searchTerm.trim();
        if (term.length < 2) return;
        setIsSearching(true);
        setHasSearched(true);
        try {
            // 1. Local search in schoolTeachers (very reliable for same-school sharing)
            const localMatches = schoolTeachers.filter(t => 
                t.firstName.toLowerCase().includes(term.toLowerCase()) ||
                t.lastName.toLowerCase().includes(term.toLowerCase()) ||
                `${t.firstName} ${t.lastName}`.toLowerCase().includes(term.toLowerCase()) ||
                t.email.toLowerCase().includes(term.toLowerCase())
            );

            // 2. Server search for broader results
            const results = await searchTeachers(term);
            
            // Combine and deduplicate by UID
            const combined = [...localMatches];
            results.forEach(r => {
                if (!combined.some(c => c.uid === r.uid)) {
                    combined.push(r);
                }
            });

            const isSelfSearch = results.some(u => u.uid === currentProfile.uid);
            
            // Filter out current user and already shared users
            const filtered = combined.filter(u => 
                u.uid !== currentProfile.uid && 
                !(chart.sharedWithEmails || []).some(email => email.toLowerCase() === u.email.toLowerCase())
            );
            
            setSearchResults(filtered);
            
            if (filtered.length === 0) {
                if (isSelfSearch) {
                    toast.info('זהו המשתמש שלך. המפה כבר בבעלותך.');
                } else if (results.some(u => (chart.sharedWithEmails || []).some(email => email.toLowerCase() === u.email.toLowerCase()))) {
                    toast.info('המשתמש כבר מופיע ברשימת השיתוף.');
                }
            }
        } catch (error) {
            toast.error('שגיאה בחיפוש מורים');
        } finally {
            setIsSearching(false);
        }
    };

    const handleShare = async () => {
        if (!selectedTeacher) return;
        setIsSharing(true);
        try {
            // The shareChart function in services/firebase.ts expects:
            // chartId, chartName, targetUser, ownerProfile, message, role
            await shareChart(
                chart.id,
                chart.className || 'מפה ללא שם',
                selectedTeacher,
                currentProfile,
                message,
                role
            );
            
            const chartType = chart.layoutType === 'groups' ? 'הקבוצה' : 'המפה';
            toast.success(`${chartType} שותפה בהצלחה עם ${selectedTeacher.firstName}`);
            setSelectedTeacher(null);
            setMessage('');
            setSearchTerm('');
            setSearchResults([]);
            onUpdate();
        } catch (error: any) {
            console.error('Full Share Error:', error);
            let errorMsg = 'שגיאה בשיתוף המפה. וודאי שהמורה רשום במערכת.';
            
            // Check for specific Firebase error codes or messages
            if (error?.code === 'permission-denied' || error?.message?.includes('permission-denied')) {
                errorMsg = 'אין לך הרשאות לשתף מפה זו או לעדכן את המורה.';
            } else if (error?.message) {
                // If it's a known error message from our service
                errorMsg = `שגיאה: ${error.message}`;
            }
            
            toast.error(errorMsg);
        } finally {
            setIsSharing(false);
        }
    };

    const handleRevoke = async (uid: string, email: string) => {
        try {
            // revokeShare(chartId, targetUserId, targetUserEmail)
            await revokeShare(chart.id, uid, email);
            toast.success('השיתוף בוטל');
            onUpdate();
        } catch (error) {
            console.error('Revoke error:', error);
            toast.error('שגיאה בביטול השיתוף');
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 font-sans text-right" dir="rtl">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-6 border-b bg-slate-50 flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-black text-slate-800">שיתוף מפה</h2>
                        <p className="text-slate-500 text-sm font-medium">שתף את המפה "{chart.className}" עם מורים אחרים</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-all active:scale-90">
                        <XIcon className="h-6 w-6 text-slate-500" />
                    </button>
                </div>

                <div className="flex-grow overflow-y-auto p-6 space-y-8">
                    {/* Search Section */}
                    <div className="space-y-4">
                        <label className="block text-sm font-black text-slate-700">חיפוש מורה לשיתוף</label>
                        <div className="flex gap-2">
                            <div className="relative flex-grow">
                                <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                <input 
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                    placeholder="חפש לפי שם או אימייל..."
                                    className="w-full pr-10 pl-4 py-3 bg-slate-100 border-none rounded-xl focus:ring-2 focus:ring-teal-500 transition-all font-medium"
                                />
                            </div>
                            <button 
                                onClick={handleSearch}
                                disabled={isSearching || searchTerm.trim().length < 2}
                                className="px-6 py-3 bg-teal-600 text-white rounded-xl font-black hover:bg-teal-700 transition-all disabled:opacity-50 active:scale-95"
                            >
                                {isSearching ? 'מחפש...' : 'חפש'}
                            </button>
                        </div>

                        {/* Search Results */}
                        {isSearching ? (
                            <div className="py-8 text-center">
                                <div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full mx-auto mb-3"></div>
                                <p className="text-slate-500 font-medium">מחפש...</p>
                            </div>
                        ) : searchResults.length > 0 ? (
                            <div className="bg-slate-50 rounded-xl border border-slate-200 divide-y overflow-hidden">
                                {searchResults.map(teacher => (
                                    <button 
                                        key={teacher.uid}
                                        onClick={() => setSelectedTeacher(teacher)}
                                        className={`w-full p-4 flex items-center justify-between hover:bg-white transition-all ${selectedTeacher?.uid === teacher.uid ? 'bg-teal-50 ring-2 ring-teal-500 ring-inset' : ''}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-black">
                                                {teacher.firstName?.[0] || '?'}{teacher.lastName?.[0] || ''}
                                            </div>
                                            <div className="text-right">
                                                <p className="font-bold text-slate-800">{teacher.firstName} {teacher.lastName}</p>
                                                <p className="text-xs text-slate-500">{teacher.email} | {teacher.schoolName}</p>
                                            </div>
                                        </div>
                                        <UserPlusIcon className="h-5 w-5 text-teal-600" />
                                    </button>
                                ))}
                            </div>
                        ) : hasSearched && searchTerm.trim().length >= 2 && !isSearching && (
                            <div className="py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300">
                                <p className="text-slate-500">לא נמצאו מורים העונים לחיפוש "{searchTerm}"</p>
                                <p className="text-xs text-slate-400 mt-1">נסה לחפש לפי שם פרטי, שם משפחה או אימייל מדויק</p>
                            </div>
                        )}

                        {/* School Suggestions */}
                        {!selectedTeacher && searchResults.length === 0 && schoolTeachers.length > 0 && (
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 text-slate-400">
                                    <SchoolIcon className="h-4 w-4" />
                                    <span className="text-xs font-bold uppercase tracking-wider">מורים מבית הספר שלך ({currentProfile.schoolName})</span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {schoolTeachers.map(teacher => (
                                        <button 
                                            key={teacher.uid}
                                            onClick={() => setSelectedTeacher(teacher)}
                                            className="p-3 flex items-center gap-3 bg-slate-50 hover:bg-teal-50 border border-slate-200 rounded-xl transition-all text-right group"
                                        >
                                            <div className="h-8 w-8 rounded-full bg-white flex items-center justify-center text-xs font-black text-slate-400 group-hover:text-teal-600 transition-colors">
                                                {teacher.firstName[0]}{teacher.lastName[0]}
                                            </div>
                                            <div className="overflow-hidden">
                                                <p className="font-bold text-slate-700 text-sm truncate">{teacher.firstName} {teacher.lastName}</p>
                                                <p className="text-[10px] text-slate-400 truncate">{teacher.email}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Selected Teacher & Message */}
                    {selectedTeacher && (
                        <div className="bg-teal-50 rounded-2xl p-6 border border-teal-100 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="h-12 w-12 rounded-full bg-teal-600 flex items-center justify-center text-white font-black text-lg">
                                        {selectedTeacher.firstName[0]}{selectedTeacher.lastName[0]}
                                    </div>
                                    <div>
                                        <p className="font-black text-teal-900">משתף עם: {selectedTeacher.firstName} {selectedTeacher.lastName}</p>
                                        <p className="text-xs text-teal-700">{selectedTeacher.email}</p>
                                    </div>
                                </div>
                                <button onClick={() => setSelectedTeacher(null)} className="text-teal-600 hover:text-teal-800 text-sm font-bold">ביטול</button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-black text-teal-800 mb-2 uppercase tracking-wider">הרשאת גישה</label>
                                    <div className="flex gap-2">
                                        <div 
                                            className="flex-1 p-4 rounded-xl border-2 bg-white border-teal-500 text-teal-700 shadow-md flex flex-col items-center gap-2"
                                        >
                                            <ShieldIcon className="h-6 w-6" />
                                            <span className="text-base font-black">שיתוף לצפייה או יצירת עותק</span>
                                            <span className="text-xs opacity-70 text-center">
                                                המשתמש יוכל לצפות {chart.layoutType === 'groups' ? 'בקבוצות' : 'במפה'} ולשכפל {chart.layoutType === 'groups' ? 'אותן' : 'אותה'} לעצמו לצורך עריכה
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-black text-teal-800 mb-2 uppercase tracking-wider">הודעה אישית (אופציונלי)</label>
                                    <textarea 
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        placeholder="היי, הנה מפת הישיבה של הכיתה שלנו..."
                                        className="w-full p-4 bg-white border-none rounded-xl focus:ring-2 focus:ring-teal-500 transition-all font-medium text-sm min-h-[100px] resize-none"
                                    />
                                </div>
                            </div>

                            <button 
                                onClick={handleShare}
                                disabled={isSharing}
                                className="w-full py-4 bg-teal-600 text-white rounded-xl font-black text-lg hover:bg-teal-700 transition-all shadow-lg shadow-teal-600/20 active:scale-[0.98] disabled:opacity-50"
                            >
                                {isSharing ? 'משתף...' : 'שתף עכשיו'}
                            </button>
                        </div>
                    )}

                    {/* Already Shared With */}
                    {chart.sharedWith && chart.sharedWith.filter(s => 
                        s.uid !== chart.ownerId && 
                        s.email && currentProfile.email && 
                        s.email.toLowerCase() !== currentProfile.email.toLowerCase()
                    ).length > 0 && (
                        <div className="space-y-4">
                            <h3 className="text-sm font-black text-slate-700 flex items-center gap-2">
                                <ShieldCheckIcon className="h-4 w-4 text-teal-600" />
                                משתמשים עם גישה למפה
                            </h3>
                            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y">
                                {chart.sharedWith.filter(s => 
                                    s.uid !== chart.ownerId && 
                                    s.email && currentProfile.email && 
                                    s.email.toLowerCase() !== currentProfile.email.toLowerCase()
                                ).map((s, index) => (
                                    <div key={`${s.email}-${index}`} className="p-4 flex items-center justify-between group hover:bg-slate-50 transition-all">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs">
                                                {(s.name?.[0] || '?').toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-slate-800">{s.name || 'משתמש ללא שם'}</p>
                                                <p className="text-[10px] text-slate-400 font-medium">
                                                    {s.role === 'editor' ? 'עורך' : 'צופה'} | {s.schoolName || 'בית ספר לא ידוע'}
                                                </p>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => handleRevoke(s.uid, s.email)}
                                            className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                            title="בטל שיתוף"
                                        >
                                            <TrashIcon className="h-5 w-5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-slate-50 border-top text-center">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">מערכת שיתוף מפות ישיבה חכמה</p>
                </div>
            </div>
        </div>
    );
};

export default ShareModal;
