
import React, { useState, useEffect } from 'react';
import { listAllUsers, AdminUserRecord, saveUserCharts, updateUserAdminFields, deleteUserAccount, loadUserCharts, loadChartsSharedWithUser, deleteChart, deleteChartsBatch } from '../../services/storageService';
import { Chart, User } from '../../types';
import { analyzeUserChartWithAI, AIDiagnosis } from '../../services/aiSupportService';
import { Trash2, Lock, Unlock, RefreshCw, Search, Info, ChevronLeft, ChevronRight, Share2, Users, Eye } from 'lucide-react';

interface AdminPanelProps {
    user: User;
    onBack: () => void;
    onLoadChart?: (chart: Chart) => void;
}

const SUPER_ADMIN_EMAIL = "lirondavid3@gmail.com";

const AdminPanel: React.FC<AdminPanelProps> = ({ user: currentUser, onBack, onLoadChart }) => {
    const isSuperAdmin = currentUser.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
    const [users, setUsers] = useState<AdminUserRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [updatingEmail, setUpdatingEmail] = useState<string | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<{ uid: string; email: string } | null>(null);
    const [adminMessage, setAdminMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
    const [confirmAction, setConfirmAction] = useState<{ 
        title: string; 
        message: string; 
        onConfirm: () => void; 
        type: 'danger' | 'warning' 
    } | null>(null);

    // Debugging states
    const [selectedUserCharts, setSelectedUserCharts] = useState<{ 
        email: string; 
        uid: string; 
        role: 'admin' | 'user';
        charts: Chart[]; 
        sharedWithMe: Chart[];
        stats?: AdminUserRecord['stats'];
        shareHistory?: AdminUserRecord['shareHistory'];
    } | null>(null);
    const [loadingCharts, setLoadingCharts] = useState(false);
    const [debuggingChart, setDebuggingChart] = useState<Chart | null>(null);
    const [problemDescription, setProblemDescription] = useState('');
    const [aiDiagnosis, setAiDiagnosis] = useState<AIDiagnosis | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const showNotification = (text: string, type: 'success' | 'error' = 'success') => {
        setAdminMessage({ text, type });
    };

    useEffect(() => {
        console.log("[Admin] Panel mounted. Current User:", {
            uid: currentUser.uid,
            email: currentUser.email,
            role: currentUser.role
        });
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const allUsers = await listAllUsers();
            console.log("Fetched users:", allUsers.map(u => ({ email: u.email, uid: u.uid })));
            setUsers(allUsers);
        } catch (error) {
            console.error("Failed to fetch users:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleInspectUser = async (user: AdminUserRecord) => {
        setLoadingCharts(true);
        try {
            const [charts, sharedWithMe] = await Promise.all([
                loadUserCharts(user.uid),
                loadChartsSharedWithUser(user.email)
            ]);
            setSelectedUserCharts({ 
                email: user.email, 
                uid: user.uid, 
                role: user.role,
                charts, 
                sharedWithMe,
                stats: user.stats,
                shareHistory: user.shareHistory 
            });
        } catch (error) {
            console.error("Failed to load user data:", error);
            showNotification("טעינת נתוני המשתמש נכשלה", 'error');
        } finally {
            setLoadingCharts(false);
        }
    };

    const handleAnalyzeWithAI = async () => {
        if (!debuggingChart) return;
        setIsAnalyzing(true);
        try {
            const diagnosis = await analyzeUserChartWithAI(debuggingChart, problemDescription);
            setAiDiagnosis(diagnosis);
        } catch (error) {
            console.error("AI Analysis failed:", error);
            showNotification("אבחון ה-AI נכשל", 'error');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleUpdateUser = async (
        uid: string, 
        newRole: 'admin' | 'user', 
        newIsFrozen: boolean,
        newPlan?: 'free' | 'pro' | 'enterprise',
        newExpiry?: string
    ) => {
        setUpdatingEmail(uid);
        try {
            await updateUserAdminFields(uid, {
                role: newRole,
                isFrozen: newIsFrozen,
                subscriptionPlan: newPlan,
                subscriptionExpiry: newExpiry
            });
            
            // Update local state
            setUsers(prev => prev.map(u => 
                u.uid === uid ? { 
                    ...u, 
                    role: newRole, 
                    isFrozen: newIsFrozen,
                    subscriptionPlan: newPlan || u.subscriptionPlan,
                    subscriptionExpiry: newExpiry || u.subscriptionExpiry
                } : u
            ));
            showNotification("המשתמש עודכן בהצלחה");
        } catch (error) {
            console.error("Failed to update user:", error);
            showNotification("עדכון המשתמש נכשל", 'error');
        } finally {
            setUpdatingEmail(null);
        }
    };

    const handleDeleteUser = async (uid: string, email: string) => {
        console.log(`[Admin] Delete clicked for user: ${email} (${uid})`);
        if (uid === currentUser.uid) {
            setAdminMessage({ text: "לא ניתן למחוק את החשבון המחובר כעת", type: 'error' });
            return;
        }
        setConfirmDelete({ uid, email });
    };

    const executeDelete = async () => {
        if (!confirmDelete) {
            console.warn("[Admin] executeDelete called but confirmDelete is null");
            return;
        }
        const { uid, email } = confirmDelete;
        console.log(`[Admin] Starting deletion process for: ${email} (${uid})`);
        
        setConfirmDelete(null);
        setUpdatingEmail(uid);
        
        try {
            await deleteUserAccount(uid);
            console.log(`[Admin] Successfully deleted user: ${uid}`);
            
            // Update local state
            setUsers(prev => prev.filter(u => u.uid !== uid));
            
            // If we were inspecting this user, close the modal
            if (selectedUserCharts?.uid === uid) {
                setSelectedUserCharts(null);
            }
            
            setAdminMessage({ text: "המשתמש נמחק בהצלחה", type: 'success' });
        } catch (error: any) {
            console.error("[Admin] Deletion failed:", error);
            let errorMessage = "מחיקת המשתמש נכשלה";
            if (error?.message) {
                try {
                    const parsed = JSON.parse(error.message);
                    errorMessage += `: ${parsed.error || parsed.message || error.message}`;
                } catch {
                    errorMessage += `: ${error.message}`;
                }
            }
            setAdminMessage({ text: errorMessage, type: 'error' });
        } finally {
            setUpdatingEmail(null);
        }
    };

    // Auto-clear admin message
    useEffect(() => {
        if (adminMessage) {
            const timer = setTimeout(() => setAdminMessage(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [adminMessage]);

    const handleResetLoginCount = async (uid: string, currentStats: AdminUserRecord['stats']) => {
        setConfirmAction({
            title: "איפוס מונה כניסות",
            message: "האם לאפס את מונה הכניסות של משתמש זה ל-0? (היסטוריית הכניסות ויומן הפעילות יישארו ללא שינוי)",
            type: 'warning',
            onConfirm: async () => {
                try {
                    setConfirmAction(null);
                    setUpdatingEmail(uid);
                    const newStats = { 
                        ...(currentStats || { firstLogin: '', lastLogin: '', loginHistory: [] }), 
                        loginCount: 0 
                    };
                    await updateUserAdminFields(uid, { stats: newStats });
                    
                    // Update main users list
                    setUsers(prev => prev.map(u => u.uid === uid ? { ...u, stats: newStats } : u));
                    
                    // Update selected user view if open
                    if (selectedUserCharts && selectedUserCharts.uid === uid) {
                        setSelectedUserCharts({
                            ...selectedUserCharts,
                            stats: newStats
                        });
                    }
                    
                    showNotification("מונה הכניסות אופס");
                } catch (e) { 
                    console.error("Reset failed:", e);
                    showNotification("הפעולה נכשלה", 'error'); 
                } finally {
                    setUpdatingEmail(null);
                }
            }
        });
    };

    const handleApplyAIFix = async () => {
        if (!selectedUserCharts || !debuggingChart || !aiDiagnosis?.suggestedFixJson) return;
        
        try {
            const fixedChart = JSON.parse(aiDiagnosis.suggestedFixJson) as Chart;
            const updatedCharts = selectedUserCharts.charts.map(c => c.id === fixedChart.id ? fixedChart : c);
            
            await saveUserCharts(selectedUserCharts.uid, updatedCharts);
            setSelectedUserCharts({ ...selectedUserCharts, charts: updatedCharts });
            setDebuggingChart(null);
            setAiDiagnosis(null);
            showNotification("התיקון הוחל בהצלחה!");
        } catch (error) {
            console.error("Failed to apply fix:", error);
            showNotification("החלת התיקון נכשלה", 'error');
        }
    };

    const handleDeleteUserChart = async (chartId: string, className: string) => {
        if (!selectedUserCharts) return;
        
        const chart = selectedUserCharts.charts.find(c => c.id === chartId) || 
                      selectedUserCharts.sharedWithMe.find(c => c.id === chartId);
        const chartType = chart?.layoutType === 'groups' ? 'הקבוצה' : 'המפה';
        
        setConfirmAction({
            title: `מחיקת ${chartType}`,
            message: `האם אתה בטוח שברצונך למחוק לצמיתות את ${chartType} של כיתה "${className}"?`,
            type: 'danger',
            onConfirm: async () => {
                try {
                    setConfirmAction(null);
                    // 1. Delete from Firestore
                    await deleteChart(chartId);
                    
                    // 2. Update local state
                    const updatedCharts = selectedUserCharts.charts.filter(c => c.id !== chartId);
                    const updatedSharedWithMe = selectedUserCharts.sharedWithMe.filter(c => c.id !== chartId);
                    setSelectedUserCharts({ 
                        ...selectedUserCharts, 
                        charts: updatedCharts,
                        sharedWithMe: updatedSharedWithMe
                    });
                    
                    // 3. Update the users list in the background
                    setUsers(prev => prev.map(u => u.uid === selectedUserCharts.uid ? { ...u, chartsCount: (u as any).chartsCount - 1 } : u));
                    
                    showNotification(`${chartType} נמחקה בהצלחה`);
                } catch (error) {
                    console.error("Failed to delete user chart:", error);
                    showNotification(`מחיקת ${chartType} נכשלה`, 'error');
                }
            }
        });
    };

    const handleDeleteShareHistoryItem = async (timestamp: string) => {
        if (!selectedUserCharts || !selectedUserCharts.shareHistory) return;
        
        const updatedHistory = selectedUserCharts.shareHistory.filter(s => s.sharedAt !== timestamp);
        
        try {
            await updateUserAdminFields(selectedUserCharts.uid, { shareHistory: updatedHistory });
            setSelectedUserCharts({ ...selectedUserCharts, shareHistory: updatedHistory });
            showNotification("היסטוריית השיתוף עודכנה");
        } catch (error) {
            console.error("Failed to delete share history item:", error);
            showNotification("מחיקת הפריט נכשלה", 'error');
        }
    };

    const handleClearInboundHistory = async () => {
        if (!selectedUserCharts || !selectedUserCharts.sharedWithMe.length) return;
        
        setConfirmAction({
            title: "ניקוי היסטוריית שיתופים נכנסים",
            message: "האם אתה בטוח שברצונך למחוק את כל המפות ששותפו עם משתמש זה? פעולה זו תמחק את המפות לצמיתות מהמערכת.",
            type: 'danger',
            onConfirm: async () => {
                try {
                    setConfirmAction(null);
                    const chartIds = selectedUserCharts.sharedWithMe.map(c => c.id);
                    await deleteChartsBatch(chartIds);
                    
                    setSelectedUserCharts({ 
                        ...selectedUserCharts, 
                        sharedWithMe: [] 
                    });
                    
                    showNotification("כל המפות ששותפו נוקו בהצלחה");
                } catch (error) {
                    console.error("Failed to clear inbound history:", error);
                    showNotification("ניקוי ההיסטוריה נכשל", 'error');
                }
            }
        });
    };

    const handleDeleteActivityLogItem = async (timestamp: string) => {
        if (!selectedUserCharts || !selectedUserCharts.stats?.activityLog) return;
        
        const updatedLog = selectedUserCharts.stats.activityLog.filter(a => a.timestamp !== timestamp);
        
        try {
            await updateUserAdminFields(selectedUserCharts.uid, {
                stats: { 
                    ...selectedUserCharts.stats,
                    activityLog: updatedLog 
                }
            });
            setSelectedUserCharts({ 
                ...selectedUserCharts, 
                stats: { ...selectedUserCharts.stats, activityLog: updatedLog } 
            });
            showNotification("יומן הפעילות עודכן");
        } catch (error) {
            console.error("Failed to delete activity log item:", error);
            showNotification("מחיקת הפריט נכשלה", 'error');
        }
    };

    const filteredUsers = users.filter(u => 
        u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        `${u.firstName} ${u.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.schoolName && u.schoolName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (u.schoolLocation && u.schoolLocation.toLowerCase().includes(searchTerm.toLowerCase()))
    ).sort((a, b) => {
        const aIsSuper = a.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
        const bIsSuper = b.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
        if (aIsSuper && !bIsSuper) return -1;
        if (!aIsSuper && bIsSuper) return 1;
        return 0;
    });

    return (
        <div className="flex flex-col h-full bg-slate-50 p-6 overflow-hidden" dir="rtl">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-3xl font-bold text-slate-800">פאנל ניהול (Admin)</h2>
                    <p className="text-slate-500">ניהול משתמשים ומנויים ({users.length} משתמשים רשומים)</p>
                </div>
                <button 
                    onClick={onBack}
                    className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg hover:bg-indigo-700 transition-all active:scale-90 text-base touch-manipulation select-none relative z-10"
                >
                    <ChevronRight className="h-5 w-5" />
                    חזרה לאפליקציה
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-grow flex flex-col overflow-hidden">
                <div className="p-4 border-b bg-amber-50 text-amber-800 text-sm font-medium flex items-center gap-2">
                    <Info size={20} />
                    <span>שים לב: לא ניתן למחוק את החשבון שבו אתה משתמש כרגע (מסומן ב-"אתה"). כדי למחוק חשבון כפול, וודא שאתה מחובר לחשבון הראשי שלך.</span>
                </div>
                <div className="p-4 border-b bg-slate-50 flex gap-4">
                    <div className="relative flex-grow">
                        <input 
                            type="text" 
                            placeholder="חיפוש לפי שם או אימייל..." 
                            className="w-full pl-4 pr-10 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <Search size={20} className="absolute left-3 top-2.5 text-slate-400" />
                    </div>
                    <button 
                        onClick={fetchUsers}
                        className="bg-teal-500 text-white px-4 py-2 rounded-lg hover:bg-teal-600 transition-colors flex items-center gap-2"
                    >
                        <RefreshCw size={16} />
                        רענן
                    </button>
                </div>

                <div className="overflow-auto flex-grow">
                    {loading ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500"></div>
                        </div>
                    ) : (
                        <table className="w-full text-right border-collapse">
                            <thead className="bg-slate-50 sticky top-0 z-10">
                                <tr>
                                    <th className="p-4 border-b font-bold text-slate-700">שם מלא</th>
                                    <th className="p-4 border-b font-bold text-slate-700">אימייל</th>
                                    <th className="p-4 border-b font-bold text-slate-700">בית ספר</th>
                                    <th className="p-4 border-b font-bold text-slate-700">מיקום בית ספר</th>
                                    <th className="p-4 border-b font-bold text-slate-700 text-center">כניסות</th>
                                    <th className="p-4 border-b font-bold text-slate-700 text-center">שיתופים (יוצא)</th>
                                    <th className="p-4 border-b font-bold text-slate-700">כניסה ראשונה</th>
                                    <th className="p-4 border-b font-bold text-slate-700">כניסה אחרונה</th>
                                    <th className="p-4 border-b font-bold text-slate-700">סטטוס</th>
                                    <th className="p-4 border-b font-bold text-slate-700">מנוי</th>
                                    <th className="p-4 border-b font-bold text-slate-700">תוקף</th>
                                    <th className="p-4 border-b font-bold text-slate-700">תפקיד</th>
                                    <th className="p-4 border-b font-bold text-slate-700">עדכון אחרון</th>
                                    <th className="p-4 border-b font-bold text-slate-700">פעולות</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredUsers.length > 0 ? (
                                    filteredUsers.map((user) => (
                                        <tr key={user.uid} className="hover:bg-slate-50 transition-colors border-b last:border-0">
                                            <td className="p-4 text-slate-800 font-bold">
                                                {user.firstName} {user.lastName}
                                            </td>
                                            <td className="p-4 text-slate-800 font-medium">
                                                <div className="flex flex-col">
                                                    <div className="flex items-center">
                                                        {user.email}
                                                        {user.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase() && (
                                                            <span className="mr-2 bg-amber-100 text-amber-700 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                                                                אדמין ראשי
                                                            </span>
                                                        )}
                                                        {user.uid === currentUser.uid && (
                                                            <span className="mr-2 bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                                                                אתה
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                                                        UID: {user.uid}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="p-4 text-slate-600">
                                                {user.schoolName || '-'}
                                            </td>
                                            <td className="p-4 text-slate-600">
                                                {user.schoolLocation || '-'}
                                            </td>
                                            <td className="p-4 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <span className="font-bold text-teal-600">
                                                        {user.stats?.loginCount || 0}
                                                    </span>
                                                    <button 
                                                        onClick={() => handleResetLoginCount(user.uid, user.stats)}
                                                        disabled={updatingEmail === user.uid}
                                                        className="text-rose-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition-colors disabled:opacity-30"
                                                        title="אפס מונה כניסות"
                                                    >
                                                        <RefreshCw size={12} className={updatingEmail === user.uid ? 'animate-spin' : ''} />
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="p-4 text-center">
                                                <span className="font-bold text-blue-600" title="כמות המפות שהמורה שיתף עם אחרים">
                                                    {user.shareHistory?.length || 0}
                                                </span>
                                            </td>
                                            <td className="p-4 text-slate-500 text-xs">
                                                {user.stats?.firstLogin ? new Date(user.stats.firstLogin).toLocaleDateString('he-IL', {
                                                    day: '2-digit',
                                                    month: '2-digit',
                                                    year: 'numeric'
                                                }) : '-'}
                                            </td>
                                            <td className="p-4 text-slate-500 text-xs">
                                                {user.stats?.lastLogin ? new Date(user.stats.lastLogin).toLocaleDateString('he-IL', {
                                                    day: '2-digit',
                                                    month: '2-digit',
                                                    year: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                }) : '-'}
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${user.isFrozen ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                                    {user.isFrozen ? 'מוקפא' : 'פעיל'}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <select 
                                                    value={user.subscriptionPlan || 'free'}
                                                    disabled={!isSuperAdmin}
                                                    onChange={(e) => setUsers(prev => prev.map(u => u.uid === user.uid ? { ...u, subscriptionPlan: e.target.value as any } : u))}
                                                    className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-teal-500"
                                                >
                                                    <option value="free">חינם</option>
                                                    <option value="pro">פרו</option>
                                                    <option value="enterprise">ארגוני</option>
                                                </select>
                                            </td>
                                            <td className="p-4">
                                                <input 
                                                    type="date"
                                                    value={user.subscriptionExpiry ? user.subscriptionExpiry.split('T')[0] : ''}
                                                    disabled={!isSuperAdmin}
                                                    onChange={(e) => setUsers(prev => prev.map(u => u.uid === user.uid ? { ...u, subscriptionExpiry: e.target.value ? new Date(e.target.value).toISOString() : '' } : u))}
                                                    className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-teal-500"
                                                />
                                            </td>
                                            <td className="p-4">
                                                <select 
                                                    value={user.role}
                                                    disabled={!isSuperAdmin || user.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()}
                                                    onChange={(e) => setUsers(prev => prev.map(u => u.uid === user.uid ? { ...u, role: e.target.value as 'admin' | 'user' } : u))}
                                                    className={`bg-slate-50 border border-slate-200 rounded px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-teal-500 ${(!isSuperAdmin || user.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                >
                                                    <option value="user">משתמש</option>
                                                    <option value="admin">אדמין</option>
                                                </select>
                                            </td>
                                            <td className="p-4 text-slate-500 text-sm">
                                                {user.lastUpdated ? new Date(user.lastUpdated).toLocaleDateString('he-IL', {
                                                    day: '2-digit',
                                                    month: '2-digit',
                                                    year: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                }) : 'לעולם לא'}
                                            </td>
                                            <td className="p-4">
                                                <div className="flex gap-2">
                                                    <button 
                                                        onClick={() => handleUpdateUser(user.uid, user.role, user.isFrozen, user.subscriptionPlan, user.subscriptionExpiry)}
                                                        disabled={updatingEmail === user.uid}
                                                        className="bg-teal-500 text-white px-3 py-1 rounded hover:bg-teal-600 transition-all disabled:opacity-50 text-sm font-bold flex items-center gap-1"
                                                    >
                                                        {updatingEmail === user.uid ? 'מעדכן...' : 'שמור'}
                                                    </button>
                                                    <button 
                                                        onClick={() => handleUpdateUser(user.uid, user.role, !user.isFrozen, user.subscriptionPlan, user.subscriptionExpiry)}
                                                        disabled={updatingEmail === user.uid || user.uid === currentUser.uid || user.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()}
                                                        className={`${user.isFrozen ? 'bg-green-500 hover:bg-green-600' : 'bg-amber-500 hover:bg-amber-600'} text-white px-3 py-1 rounded transition-colors disabled:opacity-50 text-sm font-bold flex items-center gap-1`}
                                                        title={user.isFrozen ? "הפשר" : "הקפא"}
                                                    >
                                                        {user.isFrozen ? <Unlock size={14} /> : <Lock size={14} />}
                                                        <span>{user.isFrozen ? 'הפשר' : 'הקפא'}</span>
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDeleteUser(user.uid, user.email)}
                                                        disabled={updatingEmail === user.uid || user.uid === currentUser.uid}
                                                        title={user.uid === currentUser.uid ? "לא ניתן למחוק את החשבון המחובר כעת" : "מחק משתמש"}
                                                        className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 transition-colors disabled:opacity-50 text-sm font-bold flex items-center gap-1"
                                                    >
                                                        <Trash2 size={14} />
                                                        <span>מחק</span>
                                                    </button>
                                                    <button 
                                                        onClick={() => handleInspectUser(user)}
                                                        className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition-colors text-sm font-bold flex items-center gap-1 shadow-sm"
                                                        title="צפה בדוח פעילות, כניסות ושיתופים מפורט"
                                                    >
                                                        <Info size={14} />
                                                        <span>דוח פעילות</span>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={5} className="p-12 text-center text-slate-400">
                                            לא נמצאו משתמשים
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Custom Confirmation Modal */}
            {confirmDelete && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4" dir="rtl">
                    <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border-t-4 border-red-500">
                        <h3 className="text-xl font-bold text-slate-800 mb-2">אישור מחיקה</h3>
                        <p className="text-slate-600 mb-6">האם אתה בטוח שברצונך למחוק את המשתמש <span className="font-bold text-red-600">{confirmDelete.email}</span>? פעולה זו סופית ולא ניתנת לביטול.</p>
                        <div className="flex gap-3">
                            <button 
                                onClick={executeDelete}
                                className="flex-grow bg-red-500 text-white py-2 rounded-xl font-bold hover:bg-red-600 transition-colors"
                            >
                                מחק לצמיתות
                            </button>
                            <button 
                                onClick={() => setConfirmDelete(null)}
                                className="flex-grow bg-slate-100 text-slate-600 py-2 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                            >
                                ביטול
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Admin Message Toast */}
            {adminMessage && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[300] animate-in fade-in slide-in-from-bottom-4">
                    <div className={`px-6 py-3 rounded-full shadow-xl text-white font-bold flex items-center gap-2 ${adminMessage.type === 'success' ? 'bg-teal-500' : 'bg-red-500'}`}>
                        <span>{adminMessage.text}</span>
                        <button onClick={() => setAdminMessage(null)} className="hover:opacity-70 text-xl leading-none">×</button>
                    </div>
                </div>
            )}

            {/* General Action Confirmation Modal */}
            {confirmAction && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[250] flex items-center justify-center p-4" dir="rtl">
                    <div className={`bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border-t-8 ${confirmAction.type === 'danger' ? 'border-red-500' : 'border-amber-500'}`}>
                        <h3 className="text-2xl font-bold text-slate-800 mb-2">{confirmAction.title}</h3>
                        <p className="text-slate-600 mb-8 text-lg">{confirmAction.message}</p>
                        <div className="flex gap-4">
                            <button 
                                onClick={confirmAction.onConfirm}
                                className={`flex-grow py-3 rounded-xl font-bold text-white shadow-lg transition-all active:scale-95 ${confirmAction.type === 'danger' ? 'bg-red-500 hover:bg-red-600' : 'bg-amber-500 hover:bg-amber-600'}`}
                            >
                                אישור וביצוע
                            </button>
                            <button 
                                onClick={() => setConfirmAction(null)}
                                className="flex-grow bg-slate-100 text-slate-600 py-3 rounded-xl font-bold hover:bg-slate-200 transition-all"
                            >
                                ביטול
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* User Charts Inspection Modal */}
            {selectedUserCharts && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4" dir="rtl">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
                        <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">מפות של: {selectedUserCharts.email}</h3>
                                <p className="text-sm text-slate-500">צפייה ואבחון תקלות</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <button 
                                    onClick={() => handleInspectUser({ uid: selectedUserCharts.uid, email: selectedUserCharts.email, role: selectedUserCharts.role } as any)}
                                    className="bg-white border border-slate-200 text-slate-600 p-2 rounded-lg hover:bg-slate-100 transition-colors"
                                    title="רענן נתונים"
                                >
                                    <RefreshCw size={18} className={loadingCharts ? 'animate-spin' : ''} />
                                </button>
                                <button 
                                    onClick={() => handleDeleteUser(selectedUserCharts.uid, selectedUserCharts.email)}
                                    disabled={selectedUserCharts.uid === currentUser.uid}
                                    className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors text-sm font-bold flex items-center gap-2 shadow-sm disabled:opacity-50"
                                    title={selectedUserCharts.uid === currentUser.uid ? "לא ניתן למחוק את עצמך" : "מחק משתמש זה לצמיתות"}
                                >
                                    <Trash2 size={18} />
                                    <span>מחק משתמש</span>
                                </button>
                                <button onClick={() => setSelectedUserCharts(null)} className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-200 rounded-full transition-colors">
                                    <ChevronLeft size={24} />
                                </button>
                            </div>
                        </div>
                        
                        <div className="p-6 overflow-auto flex-grow space-y-8">
                            {loadingCharts ? (
                                <div className="flex items-center justify-center h-32">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div>
                                </div>
                            ) : (
                                <>
                                    {/* Pedagogical Insights Section - NEW */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="bg-gradient-to-br from-teal-50 to-emerald-50 rounded-2xl p-5 border border-teal-100 shadow-sm">
                                            <h4 className="font-bold text-teal-900 mb-4 flex items-center gap-2">
                                                <Info size={20} className="text-teal-600" />
                                                תובנות פדגוגיות ומדדי ROI
                                            </h4>
                                            <div className="space-y-4">
                                                <div className="flex justify-between items-center bg-white/60 p-3 rounded-xl border border-teal-100">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center text-teal-600">
                                                            <RefreshCw size={16} />
                                                        </div>
                                                        <span className="text-sm font-medium text-slate-700">חיסכון בזמן (ROI)</span>
                                                    </div>
                                                    <span className="text-lg font-bold text-teal-700">
                                                        {Math.round((selectedUserCharts.charts.length * 20 + selectedUserCharts.charts.reduce((acc, c) => acc + c.students.length, 0) * 2) / 60)} שעות
                                                    </span>
                                                </div>
                                                
                                                <div className="flex justify-between items-center bg-white/60 p-3 rounded-xl border border-teal-100">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
                                                            <Users size={16} />
                                                        </div>
                                                        <span className="text-sm font-medium text-slate-700">אימוץ תכונות (Adoption)</span>
                                                    </div>
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-xs font-bold text-blue-700">
                                                            {Math.round((selectedUserCharts.charts.filter(c => c.layoutType === 'groups').length / (selectedUserCharts.charts.length || 1)) * 100)}% קבוצות
                                                        </span>
                                                        <span className="text-[10px] text-slate-500">
                                                            {selectedUserCharts.charts.filter(c => c.students.some(s => s.constraints.allowedRows !== null || s.constraints.allowedCols !== null)).length} מפות עם נעיצות
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="flex justify-between items-center bg-white/60 p-3 rounded-xl border border-teal-100">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center text-rose-600">
                                                            <Lock size={16} />
                                                        </div>
                                                        <span className="text-sm font-medium text-slate-700">בריאות הכיתה (Health)</span>
                                                    </div>
                                                    <span className={`text-sm font-bold ${
                                                        selectedUserCharts.charts.some(c => (c.students.reduce((acc, s) => acc + (s.constraints?.dontSitWith?.length || 0), 0) / 2) >= 15)
                                                        ? 'text-rose-600' : 'text-emerald-600'
                                                    }`}>
                                                        {selectedUserCharts.charts.some(c => (c.students.reduce((acc, s) => acc + (s.constraints?.dontSitWith?.length || 0), 0) / 2) >= 15)
                                                        ? 'דרוש מעקב' : 'תקין'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-5 border border-blue-100 shadow-sm">
                                            <div className="flex justify-between items-center mb-4">
                                                <h4 className="font-bold text-blue-900 flex items-center gap-2">
                                                    <Share2 size={20} className="text-blue-600" />
                                                    ניתוח שיתופים וייצוא
                                                </h4>
                                                <button 
                                                    onClick={() => {
                                                        const headers = ["שם כיתה", "כמות תלמידים", "כמות העדפות", "תאריך יצירה", "סוג פריסה"];
                                                        const rows = selectedUserCharts.charts.map(c => [
                                                            c.className,
                                                            c.students.length,
                                                            c.students.reduce((acc, s) => acc + (s.constraints?.dontSitWith?.length || 0), 0) / 2,
                                                            new Date(c.creationDate).toLocaleDateString(),
                                                            c.layoutType
                                                        ]);

                                                        // Add sharing data to CSV
                                                        const groupedShares = selectedUserCharts.shareHistory?.reduce((acc, share) => {
                                                            const key = share.targetUserId;
                                                            if (!acc[key]) {
                                                                acc[key] = {
                                                                    name: share.targetUserName,
                                                                    count: 0,
                                                                    lastShared: share.sharedAt
                                                                };
                                                            }
                                                            acc[key].count += 1;
                                                            if (new Date(share.sharedAt) > new Date(acc[key].lastShared)) {
                                                                acc[key].lastShared = share.sharedAt;
                                                            }
                                                            return acc;
                                                        }, {} as Record<string, { name: string, count: number, lastShared: string }>);

                                                        const sharesList = groupedShares ? Object.values(groupedShares).sort((a, b) => b.count - a.count) : [];
                                                        const sharingHeaders = ["שם קולגה", "כמות שיתופים", "שיתוף אחרון"];
                                                        const sharingRows = sharesList.map(s => [s.name, s.count, new Date(s.lastShared).toLocaleDateString()]);

                                                        const csvContent = [
                                                            ["דוח פעילות משתמש - " + selectedUserCharts.email],
                                                            [""],
                                                            ["נתוני מפות וכיתות"],
                                                            headers,
                                                            ...rows,
                                                            [""],
                                                            ["נתוני שיתופים (רשת חברתית)"],
                                                            sharingHeaders,
                                                            ...sharingRows
                                                        ].map(e => e.join(",")).join("\n");
                                                        
                                                        // Add BOM for Excel to recognize Hebrew (UTF-8)
                                                        const blob = new Blob(["\uFEFF", csvContent], { type: 'text/csv;charset=utf-8;' });
                                                        const url = URL.createObjectURL(blob);
                                                        const link = document.createElement("a");
                                                        link.setAttribute("href", url);
                                                        link.setAttribute("download", `report_${selectedUserCharts.email}.csv`);
                                                        link.click();
                                                        showNotification("הדוח יוצא בהצלחה");
                                                    }}
                                                    className="bg-white text-blue-600 border border-blue-200 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-50 flex items-center gap-1 transition-all shadow-sm"
                                                >
                                                    <RefreshCw size={14} />
                                                    ייצא לאקסל (CSV)
                                                </button>
                                            </div>
                                            <div className="mt-4">
                                                <div className="overflow-hidden border border-blue-100 rounded-lg bg-white shadow-sm">
                                                    <table className="w-full text-right text-xs">
                                                        <thead className="bg-blue-50 text-blue-700">
                                                            <tr>
                                                                <th className="px-3 py-2 font-bold border-b border-blue-100">שם המורה (קולגה)</th>
                                                                <th className="px-3 py-2 font-bold text-center border-b border-blue-100">כמות שיתופים</th>
                                                                <th className="px-3 py-2 font-bold border-b border-blue-100">שיתוף אחרון</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-blue-50">
                                                            {(() => {
                                                                const groupedShares = selectedUserCharts.shareHistory?.reduce((acc, share) => {
                                                                    const key = share.targetUserId;
                                                                    if (!acc[key]) {
                                                                        acc[key] = {
                                                                            name: share.targetUserName,
                                                                            count: 0,
                                                                            lastShared: share.sharedAt
                                                                        };
                                                                    }
                                                                    acc[key].count += 1;
                                                                    if (new Date(share.sharedAt) > new Date(acc[key].lastShared)) {
                                                                        acc[key].lastShared = share.sharedAt;
                                                                    }
                                                                    return acc;
                                                                }, {} as Record<string, { name: string, count: number, lastShared: string }>);

                                                                const sharesList = groupedShares ? Object.values(groupedShares).sort((a, b) => b.count - a.count) : [];

                                                                if (sharesList.length === 0) {
                                                                    return (
                                                                        <tr>
                                                                            <td colSpan={3} className="px-3 py-4 text-center text-slate-400 italic">
                                                                                אין היסטוריית שיתופים למשתמש זה
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                }

                                                                return sharesList.map((s, idx) => (
                                                                    <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                                                                        <td className="px-3 py-2 font-medium text-slate-700">{s.name}</td>
                                                                        <td className="px-3 py-2 text-center">
                                                                            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">
                                                                                {s.count}
                                                                            </span>
                                                                        </td>
                                                                        <td className="px-3 py-2 text-slate-500">
                                                                            {new Date(s.lastShared).toLocaleDateString('he-IL')}
                                                                        </td>
                                                                    </tr>
                                                                ));
                                                            })()}
                                                        </tbody>
                                                    </table>
                                                </div>
                                                <div className="mt-2 flex justify-between items-center px-1">
                                                    <p className="text-[10px] text-slate-400">
                                                        סה"כ {selectedUserCharts.shareHistory?.length || 0} שיתופים מצטברים
                                                    </p>
                                                    <p className="text-[10px] text-blue-500 font-medium">
                                                        {new Set(selectedUserCharts.shareHistory?.map(s => s.targetUserId)).size} קולגות שונים
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Charts Section - MOVED TO TOP */}
                                    <div>
                                        <div className="flex justify-between items-center mb-4">
                                            <h4 className="font-bold text-slate-800 flex items-center gap-2">
                                                <RefreshCw size={18} className="text-amber-500" />
                                                מפות וכיתות ({selectedUserCharts.charts.length})
                                            </h4>
                                            {selectedUserCharts.charts.length > 0 && (
                                                <button 
                                                    onClick={() => {
                                                        setConfirmAction({
                                                            title: "מחיקת כל המפות",
                                                            message: `האם אתה בטוח שברצונך למחוק את כל ${selectedUserCharts.charts.length} המפות של משתמש זה? פעולה זו אינה ניתנת לביטול.`,
                                                            type: 'danger',
                                                            onConfirm: async () => {
                                                                try {
                                                                    setConfirmAction(null);
                                                                    // 1. Delete all charts from Firestore
                                                                    const chartIds = selectedUserCharts.charts.map(c => c.id);
                                                                    await deleteChartsBatch(chartIds);
                                                                    
                                                                    // 2. Update local state
                                                                    setSelectedUserCharts({ ...selectedUserCharts, charts: [] });
                                                                    
                                                                    // 3. Update users list
                                                                    setUsers(prev => prev.map(u => u.uid === selectedUserCharts.uid ? { ...u, chartsCount: 0 } : u));
                                                                    
                                                                    showNotification("כל המפות נמחקו בהצלחה");
                                                                } catch (e) {
                                                                    showNotification("שגיאה במחיקת המפות", 'error');
                                                                }
                                                            }
                                                        });
                                                    }}
                                                    className="bg-rose-100 text-rose-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-rose-200 flex items-center gap-1 transition-colors"
                                                >
                                                    <Trash2 size={14} />
                                                    מחק את כל המפות
                                                </button>
                                            )}
                                        </div>
                                        
                                        {/* Red Flags Summary */}
                                        {selectedUserCharts.charts.some(c => {
                                            const sepCount = c.students.reduce((acc, s) => acc + (s.constraints?.dontSitWith?.length || 0), 0) / 2;
                                            return sepCount >= 15;
                                        }) && (
                                            <div className="mb-6 bg-red-50 border-r-4 border-red-500 p-4 rounded-l-xl">
                                                <div className="flex items-center gap-2 text-red-700 font-bold mb-1">
                                                    <span className="text-xl">🚩</span>
                                                    דגל אדום פדגוגי
                                                </div>
                                                <p className="text-sm text-red-600">
                                                    זוהו כיתות עם רמת מתח חברתי חריגה (15 אילוצי הפרדה ומעלה). מומלץ לערב יועצת שכבתית.
                                                </p>
                                            </div>
                                        )}

                                        {selectedUserCharts.charts.length > 0 ? (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {selectedUserCharts.charts.map(chart => {
                                                    const totalRequests = chart.students.reduce((acc, s) => acc + (s.constraints?.dontSitWith?.length || 0), 0);
                                                    const separationCount = totalRequests / 2;
                                                    const healthStatus = separationCount >= 15 ? 'critical' : separationCount > 5 ? 'warning' : 'healthy';
                                                    const studentCount = chart.students.length;
                                                    const possiblePairs = (studentCount * (studentCount - 1)) / 2;
                                                    
                                                    return (
                                                        <div key={chart.id} className={`border rounded-xl p-4 bg-white hover:shadow-md transition-all flex flex-col gap-3 shadow-sm ${
                                                            healthStatus === 'critical' ? 'border-red-200 bg-red-50/30' : 
                                                            healthStatus === 'warning' ? 'border-amber-200' : 'border-slate-200'
                                                        }`}>
                                                            <div className="flex justify-between items-start">
                                                                <div>
                                                                    <h4 className="font-bold text-slate-800 text-lg">{chart.className}</h4>
                                                                    <p className="text-xs text-slate-500">נוצר ב: {new Date(chart.creationDate).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                                                                </div>
                                                                <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                                                                    healthStatus === 'critical' ? 'bg-red-100 text-red-700' : 
                                                                    healthStatus === 'warning' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                                                                }`}>
                                                                    {healthStatus === 'critical' ? 'מתח גבוה' : healthStatus === 'warning' ? 'בבדיקה' : 'תקין'}
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center gap-4 text-xs">
                                                                <div className="flex items-center gap-1 text-slate-600">
                                                                    <Users size={14} className="text-slate-400" />
                                                                    <span>{chart.students.length} תלמידים</span>
                                                                </div>
                                                                <div className={`flex items-center gap-1 font-bold group relative cursor-help ${
                                                                    separationCount >= 15 ? 'text-red-600' : separationCount > 5 ? 'text-amber-600' : 'text-green-600'
                                                                }`}>
                                                                    <Lock size={14} />
                                                                    <span>{separationCount} זוגות ({totalRequests} בקשות)</span>
                                                                    <Info size={12} className="text-slate-400" />
                                                                    
                                                                    <div className="absolute bottom-full right-0 mb-2 w-72 p-4 bg-indigo-950/95 backdrop-blur-md text-white text-[11px] rounded-xl shadow-2xl opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none z-50 leading-relaxed border border-indigo-500/30">
                                                                        <div className="font-bold mb-2 text-cyan-300 border-b border-indigo-500/30 pb-1 flex items-center gap-2">
                                                                            <Info size={14} />
                                                                            <span>הסבר על החישוב:</span>
                                                                        </div>
                                                                        <p className="mb-2">
                                                                            המספר <span className="font-bold text-cyan-200">{separationCount}</span> מייצג את כמות זוגות התלמידים שהוגדרו עבורם <span className="text-cyan-200 font-medium">העדפות פדגוגיות או התנהגותיות</span> המונעות ישיבה משותפת.
                                                                        </p>
                                                                        <div className="mt-1 bg-indigo-900/40 p-2 rounded-lg font-mono text-center border border-indigo-500/20 text-cyan-100">
                                                                            {totalRequests} בקשות ÷ 2 = {separationCount} זוגות
                                                                        </div>
                                                                        <div className="mt-3 text-indigo-100/90">
                                                                            בכיתה של <span className="font-bold">{studentCount}</span> תלמידים ישנם <span className="font-bold">{possiblePairs}</span> זוגות אפשריים. 
                                                                            <br />
                                                                            מתוכם הוגדרו <span className="font-bold text-cyan-200">{separationCount}</span> זוגות כבעלי העדפות הפרדה ({((separationCount / possiblePairs) * 100).toFixed(1)}%).
                                                                        </div>
                                                                        <div className="mt-2 text-indigo-300/80 italic text-[10px] border-t border-indigo-500/10 pt-2">
                                                                            * חצי העדפה (0.5) נובע ממקרה בו הוגדרה העדפת הפרדה עבור תלמיד אחד בלבד מתוך הצמד (העדפה חד-צדדית).
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="pt-3 border-t flex justify-between items-center gap-2">
                                                                <div className="text-[10px] text-slate-400">
                                                                    {chart.layoutType === 'rows' ? 'סידור טורים' : 'סידור קבוצות'}
                                                                </div>
                                                                <div className="flex gap-2">
                                                                    <button 
                                                                        onClick={() => {
                                                                            if (onLoadChart) {
                                                                                onLoadChart(chart);
                                                                            } else {
                                                                                alert(`צפייה במפת הכיתה: ${chart.className}\n(בגרסה הבאה תוכל להיכנס ישירות לעורך במצב צפייה)`);
                                                                            }
                                                                        }}
                                                                        className="bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-slate-200 flex items-center gap-2"
                                                                    >
                                                                        <Eye size={14} />
                                                                        צפה
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => { setDebuggingChart(chart); setAiDiagnosis(null); setProblemDescription(''); }}
                                                                        className="bg-amber-100 text-amber-700 px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-amber-200 flex items-center gap-2"
                                                                    >
                                                                        <RefreshCw size={14} />
                                                                        אבחון
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => handleDeleteUserChart(chart.id, chart.className)}
                                                                        className="bg-rose-500 text-white px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-rose-600 flex items-center gap-2 shadow-sm transition-colors"
                                                                    >
                                                                        <Trash2 size={14} />
                                                                        מחק
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <p className="text-center text-slate-500 py-12 bg-slate-50 rounded-xl border border-dashed">למשתמש זה אין מפות שמורות.</p>
                                        )}
                                    </div>

                                    {/* User Stats Section */}
                                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                                        <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                            <Info size={18} className="text-teal-500" />
                                            נתוני פעילות
                                        </h4>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div className="bg-white p-3 rounded-lg border shadow-sm">
                                                <div className="flex justify-between items-start mb-1">
                                                    <p className="text-xs text-slate-500">סה"כ כניסות</p>
                                                    <button 
                                                        onClick={() => handleResetLoginCount(selectedUserCharts.uid, selectedUserCharts.stats!)}
                                                        className="text-rose-500 hover:bg-rose-50 p-1 rounded transition-colors"
                                                        title="אפס מונה כניסות"
                                                    >
                                                        <RefreshCw size={12} />
                                                    </button>
                                                </div>
                                                <p className="text-xl font-bold text-teal-600">{selectedUserCharts.stats?.loginCount || 0}</p>
                                            </div>
                                            <div className="bg-white p-3 rounded-lg border shadow-sm">
                                                <p className="text-xs text-slate-500 mb-1">כניסה ראשונה</p>
                                                <p className="text-sm font-bold text-slate-700">
                                                    {selectedUserCharts.stats?.firstLogin ? new Date(selectedUserCharts.stats.firstLogin).toLocaleString('he-IL') : '-'}
                                                </p>
                                            </div>
                                            <div className="bg-white p-3 rounded-lg border shadow-sm">
                                                <p className="text-xs text-slate-500 mb-1">כניסה אחרונה</p>
                                                <p className="text-sm font-bold text-slate-700">
                                                    {selectedUserCharts.stats?.lastLogin ? new Date(selectedUserCharts.stats.lastLogin).toLocaleString('he-IL') : '-'}
                                                </p>
                                            </div>
                                        </div>
                                        
                                        {selectedUserCharts.stats?.activityLog && selectedUserCharts.stats.activityLog.length > 0 && (
                                            <div className="mt-6">
                                                <div className="flex justify-between items-center mb-2">
                                                    <p className="text-xs font-bold text-slate-600">יומן פעילות מפורט (ה"דופק" של המערכת):</p>
                                                    <button 
                                                        onClick={async (e) => {
                                                            const btn = e.currentTarget;
                                                            setConfirmAction({
                                                                title: "ניקוי יומן פעילות",
                                                                message: "האם למחוק את כל יומן הפעילות המפורט של משתמש זה?",
                                                                type: 'warning',
                                                                onConfirm: async () => {
                                                                    try {
                                                                        setConfirmAction(null);
                                                                        btn.disabled = true;
                                                                        await updateUserAdminFields(selectedUserCharts.uid, {
                                                                            stats: { 
                                                                                ...selectedUserCharts.stats!,
                                                                                activityLog: [] 
                                                                            }
                                                                        });
                                                                        setSelectedUserCharts({ ...selectedUserCharts, stats: { ...selectedUserCharts.stats!, activityLog: [] } });
                                                                        showNotification("יומן הפעילות נוקה");
                                                                    } catch (e) { showNotification("הפעולה נכשלה", 'error'); }
                                                                    finally { btn.disabled = false; }
                                                                }
                                                            });
                                                        }}
                                                        className="bg-rose-100 text-rose-700 px-2 py-1 rounded-lg text-[10px] font-bold hover:bg-rose-200 flex items-center gap-1 disabled:opacity-50 transition-colors"
                                                    >
                                                        <Trash2 size={10} />
                                                        נקה יומן
                                                    </button>
                                                </div>
                                                <div className="max-h-48 overflow-y-auto border rounded-xl bg-white shadow-inner">
                                                    <table className="w-full text-[10px] text-right">
                                                        <thead className="bg-slate-50 sticky top-0">
                                                            <tr>
                                                                <th className="p-2 border-b">זמן</th>
                                                                <th className="p-2 border-b">פעולה</th>
                                                                <th className="p-2 border-b">פרטים / כיתה</th>
                                                                <th className="p-2 border-b"></th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {selectedUserCharts.stats.activityLog.slice().reverse().map((log, i) => (
                                                                <tr key={i} className="border-b last:border-0 hover:bg-slate-50 group">
                                                                    <td className="p-2 text-slate-400">
                                                                        {new Date(log.timestamp).toLocaleDateString('he-IL')} {new Date(log.timestamp).toLocaleTimeString('he-IL', {hour:'2-digit', minute:'2-digit'})}
                                                                    </td>
                                                                    <td className="p-2 font-bold text-slate-700">{log.action}</td>
                                                                    <td className="p-2 text-teal-600 font-medium">{log.details}</td>
                                                                    <td className="p-2 text-left">
                                                                        <button 
                                                                            onClick={() => handleDeleteActivityLogItem(log.timestamp)}
                                                                            className="text-rose-400 hover:text-rose-600 p-1 opacity-0 group-hover:opacity-100 transition-all"
                                                                            title="מחק פעולה זו מהיומן"
                                                                        >
                                                                            <Trash2 size={10} />
                                                                        </button>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}

                                        {selectedUserCharts.stats?.loginHistory && selectedUserCharts.stats.loginHistory.length > 0 && (
                                            <div className="mt-4">
                                                <div className="flex justify-between items-center mb-2">
                                                    <p className="text-xs font-bold text-slate-600">היסטוריית כניסות מלאה ({selectedUserCharts.stats.loginHistory.length}):</p>
                                                    <button 
                                                        onClick={async (e) => {
                                                            const btn = e.currentTarget;
                                                            setConfirmAction({
                                                                title: "ניקוי היסטוריית כניסות",
                                                                message: "האם למחוק את כל היסטוריית הכניסות של משתמש זה?",
                                                                type: 'warning',
                                                                onConfirm: async () => {
                                                                    try {
                                                                        setConfirmAction(null);
                                                                        btn.disabled = true;
                                                                        const originalText = btn.innerText;
                                                                        btn.innerText = "מנקה...";
                                                                        await updateUserAdminFields(selectedUserCharts.uid, {
                                                                            stats: { 
                                                                                firstLogin: selectedUserCharts.stats?.firstLogin || '',
                                                                                lastLogin: selectedUserCharts.stats?.lastLogin || '',
                                                                                loginCount: selectedUserCharts.stats?.loginCount || 0,
                                                                                loginHistory: [] 
                                                                            }
                                                                        });
                                                                        setSelectedUserCharts({ ...selectedUserCharts, stats: { ...selectedUserCharts.stats!, loginHistory: [] } });
                                                                        showNotification("היסטוריית הכניסות נוקתה");
                                                                        btn.innerText = originalText;
                                                                    } catch (e) { 
                                                                        showNotification("הפעולה נכשלה", 'error'); 
                                                                    } finally { 
                                                                        btn.disabled = false; 
                                                                    }
                                                                }
                                                            });
                                                        }}
                                                        className="bg-rose-100 text-rose-700 px-2 py-1 rounded-lg text-[10px] font-bold hover:bg-rose-200 flex items-center gap-1 disabled:opacity-50 transition-colors"
                                                    >
                                                        <Trash2 size={10} />
                                                        נקה היסטוריה
                                                    </button>
                                                </div>
                                                <div className="max-h-32 overflow-y-auto border rounded-lg bg-white p-2">
                                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                        {selectedUserCharts.stats.loginHistory.slice().reverse().map((date, i) => (
                                                            <div key={i} className="text-[10px] bg-slate-50 border px-2 py-1 rounded text-slate-600 flex justify-between">
                                                                <span>{new Date(date).toLocaleDateString('he-IL')}</span>
                                                                <span className="text-slate-400">{new Date(date).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Sharing Stats Section */}
                                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                                        <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                            <Share2 size={18} className="text-blue-500" />
                                            נתוני שיתוף (הרשת החברתית)
                                        </h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="bg-white p-3 rounded-lg border shadow-sm">
                                                <p className="text-xs text-slate-500 mb-1">מפות ששיתף (Outbound)</p>
                                                <p className="text-xl font-bold text-blue-600">{selectedUserCharts.shareHistory?.length || 0}</p>
                                            </div>
                                            <div className="bg-white p-3 rounded-lg border shadow-sm">
                                                <p className="text-xs text-slate-500 mb-1">מפות ששותפו איתו (Inbound)</p>
                                                <p className="text-xl font-bold text-purple-600">{selectedUserCharts.sharedWithMe?.length || 0}</p>
                                            </div>
                                        </div>

                                        {selectedUserCharts.shareHistory && selectedUserCharts.shareHistory.length > 0 && (
                                            <div className="mt-4">
                                                <div className="flex justify-between items-center mb-2">
                                                    <p className="text-xs font-bold text-slate-600">פירוט שיתופים שביצע (עם מי שיתף):</p>
                                                    <button 
                                                        onClick={async (e) => {
                                                            const btn = e.currentTarget;
                                                            setConfirmAction({
                                                                title: "ניקוי היסטוריית שיתופים",
                                                                message: "האם למחוק את כל היסטוריית השיתופים שביצע משתמש זה?",
                                                                type: 'warning',
                                                                onConfirm: async () => {
                                                                    try {
                                                                        setConfirmAction(null);
                                                                        btn.disabled = true;
                                                                        const originalText = btn.innerText;
                                                                        btn.innerText = "מנקה...";
                                                                        await updateUserAdminFields(selectedUserCharts.uid, { shareHistory: [] });
                                                                        setSelectedUserCharts({ ...selectedUserCharts, shareHistory: [] });
                                                                        showNotification("היסטוריית השיתופים נוקתה");
                                                                        btn.innerText = originalText;
                                                                    } catch (e) { 
                                                                        showNotification("הפעולה נכשלה", 'error'); 
                                                                    } finally { 
                                                                        btn.disabled = false; 
                                                                    }
                                                                }
                                                            });
                                                        }}
                                                        className="bg-rose-100 text-rose-700 px-2 py-1 rounded-lg text-[10px] font-bold hover:bg-rose-200 flex items-center gap-1 disabled:opacity-50 transition-colors"
                                                    >
                                                        <Trash2 size={10} />
                                                        נקה היסטוריה
                                                    </button>
                                                </div>
                                                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                                                    {selectedUserCharts.shareHistory.slice().reverse().map((share, i) => (
                                                        <div key={i} className="text-[11px] bg-white border px-3 py-2 rounded-lg flex justify-between items-center shadow-sm group">
                                                            <div className="flex items-center gap-3">
                                                                 <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-500">
                                                                     <Share2 size={14} />
                                                                 </div>
                                                                 <div>
                                                                     <p className="font-bold text-slate-800">שיתף את המפה: <span className="text-blue-600">"{share.chartName}"</span></p>
                                                                     <p className="text-slate-500">עם המורה: <span className="font-medium text-slate-700">{share.targetUserName}</span></p>
                                                                 </div>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <div className="text-left">
                                                                    <p className="text-slate-400 text-[10px]">{new Date(share.sharedAt).toLocaleDateString('he-IL')}</p>
                                                                    <p className="text-slate-300 text-[9px]">{new Date(share.sharedAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</p>
                                                                </div>
                                                                <button 
                                                                    onClick={() => handleDeleteShareHistoryItem(share.sharedAt)}
                                                                    className="text-rose-400 hover:text-rose-600 p-1 opacity-0 group-hover:opacity-100 transition-all"
                                                                    title="מחק רישום זה מההיסטוריה"
                                                                >
                                                                    <Trash2 size={12} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {selectedUserCharts.sharedWithMe && selectedUserCharts.sharedWithMe.length > 0 && (
                                            <div className="mt-4">
                                                <div className="flex justify-between items-center mb-2">
                                                    <p className="text-xs font-bold text-slate-600">פירוט מפות ששותפו איתו (מי שיתף איתו):</p>
                                                    <button 
                                                        onClick={handleClearInboundHistory}
                                                        className="bg-rose-100 text-rose-700 px-2 py-1 rounded-lg text-[10px] font-bold hover:bg-rose-200 flex items-center gap-1 transition-colors"
                                                    >
                                                        <Trash2 size={10} />
                                                        נקה היסטוריה
                                                    </button>
                                                </div>
                                                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                                                    {selectedUserCharts.sharedWithMe.slice().reverse().map((chart, i) => (
                                                        <div key={i} className="text-[11px] bg-white border px-3 py-2 rounded-lg flex justify-between items-center shadow-sm">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center text-purple-500">
                                                                    <Users size={14} />
                                                                </div>
                                                                <div>
                                                                    <p className="font-bold text-slate-800">קיבל את המפה: <span className="text-purple-600">"{chart.className}"</span></p>
                                                                    <p className="text-slate-500">מאת המורה: <span className="font-medium text-slate-700">{chart.ownerName || 'מורה אחר'}</span></p>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                <div className="text-left">
                                                                    <p className="text-slate-400 text-[10px]">{new Date(chart.creationDate).toLocaleDateString('he-IL')}</p>
                                                                    <p className="text-slate-300 text-[9px]">{new Date(chart.creationDate).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</p>
                                                                </div>
                                                                <button 
                                                                    onClick={() => handleDeleteUserChart(chart.id, chart.className)}
                                                                    className="text-rose-500 hover:bg-rose-50 p-1.5 rounded-lg transition-colors"
                                                                    title="מחק מפה זו מהמערכת"
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Danger Zone */}
                                    <div className="bg-rose-50 rounded-xl p-6 border border-rose-200 mt-8">
                                        <h4 className="font-bold text-rose-800 mb-4 flex items-center gap-2">
                                            <Trash2 size={18} className="text-rose-600" />
                                            אזור מסוכן (פעולות בלתי הפיכות)
                                        </h4>
                                        <div className="flex flex-col gap-4">
                                            <p className="text-sm text-rose-700">
                                                פעולות אלו ימחקו נתונים לצמיתות. השתמש בזהירות רבה.
                                            </p>
                                            <button 
                                                onClick={() => {
                                                    setConfirmAction({
                                                        title: "מחיקת חשבון משתמש",
                                                        message: `האם אתה בטוח שברצונך למחוק לצמיתות את כל המשתמש ${selectedUserCharts.email}? כל המפות והנתונים שלו יימחקו! פעולה זו אינה ניתנת לביטול.`,
                                                        type: 'danger',
                                                        onConfirm: async () => {
                                                            setConfirmAction(null);
                                                            executeDelete();
                                                            setSelectedUserCharts(null);
                                                        }
                                                    });
                                                }}
                                                className="bg-rose-600 text-white py-3 rounded-xl font-bold hover:bg-rose-700 shadow-lg shadow-rose-500/20 transition-all flex items-center justify-center gap-2"
                                            >
                                                <Trash2 size={20} />
                                                מחק את כל חשבון המשתמש לצמיתות
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* AI Debugger Modal */}
            {debuggingChart && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[110] flex items-center justify-center p-4" dir="rtl">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
                        <div className="p-6 border-b flex justify-between items-center bg-amber-50">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                                    <RefreshCw size={24} className="text-amber-600" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-slate-800">אבחון AI חכם</h3>
                                    <p className="text-sm text-slate-500">מנתח את המפה: {debuggingChart.className}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button 
                                    onClick={() => {
                                        const chartType = debuggingChart.layoutType === 'groups' ? 'הקבוצה' : 'המפה';
                                        setConfirmAction({
                                            title: `מחיקת ${chartType}`,
                                            message: `האם אתה בטוח שברצונך למחוק לצמיתות את ${chartType} "${debuggingChart.className}"?`,
                                            type: 'danger',
                                            onConfirm: async () => {
                                                setConfirmAction(null);
                                                handleDeleteUserChart(debuggingChart.id, debuggingChart.className);
                                                setDebuggingChart(null);
                                            }
                                        });
                                    }}
                                    className="bg-red-600 text-white px-4 py-2 rounded-xl hover:bg-red-700 transition-colors flex items-center gap-2 text-sm font-bold shadow-lg shadow-red-500/20"
                                    title="מחק מפה זו"
                                >
                                    <Trash2 size={20} />
                                    <span>מחק מפה זו לצמיתות</span>
                                </button>
                                <button onClick={() => setDebuggingChart(null)} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-full transition-all">
                                    <ChevronLeft size={24} />
                                </button>
                            </div>
                        </div>
                        
                        <div className="p-6 overflow-auto flex-grow space-y-6">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">תאר את הבעיה (מה המשתמש דיווח?):</label>
                                <textarea 
                                    className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-amber-500 outline-none h-24"
                                    placeholder="למשל: המפה לא נטענת, תלמיד נעלם, האפליקציה קורסת כשלוחצים על ערבוב..."
                                    value={problemDescription}
                                    onChange={(e) => setProblemDescription(e.target.value)}
                                ></textarea>
                            </div>

                            {!aiDiagnosis && (
                                <button 
                                    onClick={handleAnalyzeWithAI}
                                    disabled={isAnalyzing || !problemDescription}
                                    className="w-full py-4 bg-amber-500 text-white rounded-xl font-bold text-lg hover:bg-amber-600 shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50"
                                >
                                    {isAnalyzing ? 'מנתח נתונים...' : 'התחל אבחון AI'}
                                </button>
                            )}

                            {aiDiagnosis && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                                        <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                                            <Info size={20} className="text-teal-500" />
                                            אבחון ה-AI:
                                        </h4>
                                        <p className="text-slate-700 leading-relaxed">{aiDiagnosis.diagnosis}</p>
                                    </div>

                                    {aiDiagnosis.isCodeBug ? (
                                        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
                                            <h4 className="font-bold text-rose-800 mb-2 flex items-center gap-2">
                                                <Info size={20} className="text-rose-500" />
                                                זהו באג בקוד האפליקציה!
                                            </h4>
                                            <p className="text-rose-700 text-sm mb-4">ה-AI זיהה שהבעיה היא לוגית ולא בנתונים. העתק את הדו"ח הבא ושלח אותו למפתח:</p>
                                            <pre className="bg-white/50 p-3 rounded border border-rose-200 text-xs font-mono overflow-auto max-h-40">
                                                {aiDiagnosis.technicalReport}
                                            </pre>
                                        </div>
                                    ) : aiDiagnosis.suggestedFixJson ? (
                                        <div className="bg-teal-50 border border-teal-200 rounded-xl p-4">
                                            <h4 className="font-bold text-teal-800 mb-2 flex items-center gap-2">
                                                <RefreshCw size={20} className="text-teal-500" />
                                                נמצא תיקון לנתונים!
                                            </h4>
                                            <p className="text-teal-700 text-sm mb-4">ה-AI יצר גרסה מתוקנת של המפה שתפתור את הבעיה עבור המשתמש.</p>
                                            <button 
                                                onClick={handleApplyAIFix}
                                                className="w-full py-3 bg-teal-500 text-white rounded-lg font-bold hover:bg-teal-600 transition-all"
                                            >
                                                החל תיקון AI על נתוני המשתמש
                                            </button>
                                        </div>
                                    ) : null}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminPanel;
