
import React, { useState, useMemo, useEffect } from 'react';
import { Chart, User, UserProfile } from '../../types';
import CreateChartModal from '../modals/CreateChartModal';
import { TrashIcon, PencilIcon, CheckIcon, XIcon, DuplicateIcon, ShareIcon, ShieldCheckIcon } from '../icons';
import ConfirmDeleteModal from '../modals/ConfirmDeleteModal';
import DuplicateChartModal from '../modals/DuplicateChartModal';
import ShareModal from '../modals/ShareModal';
import { db } from '../../services/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { toast } from 'sonner';

interface MainScreenProps {
    user: User;
    profile: UserProfile | null;
    allCharts: Chart[];
    onStartNew: (className: string, date: string, layoutType: 'rows' | 'groups') => void;
    onLoadChart: (chartOrId: string | Chart, isReadOnly?: boolean) => void;
    onDeleteChart: (chartId: string) => void;
    onDuplicateChart: (chartOrId: string | Chart, keepConstraints: boolean) => void;
    onDeleteClass: (className: string) => void;
    onUpdateClassName: (oldName: string, newName: string) => Promise<boolean>;
    onUpdateChartName: (chartId: string, newName: string) => Promise<boolean>;
    onImportCharts: (charts: Chart[]) => void;
    onReorderCharts: (updatedCharts: Chart[]) => void;
    isCloudSync: boolean;
}

const MainScreen: React.FC<MainScreenProps> = ({ user, profile, allCharts, onStartNew, onLoadChart, onDeleteChart, onDuplicateChart, onDeleteClass, onUpdateClassName, onUpdateChartName, onImportCharts, onReorderCharts, isCloudSync }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [openClass, setOpenClass] = useState<string | null>(null);
    const [editingClassName, setEditingClassName] = useState<string | null>(null);
    const [newClassName, setNewClassName] = useState('');
    const [editingChartNameId, setEditingChartNameId] = useState<string | null>(null);
    const [newChartName, setNewChartName] = useState('');
    const [confirmingDelete, setConfirmingDelete] = useState<{ type: 'class' | 'chart', id: string, message: string } | null>(null);
    const [chartToDuplicate, setChartToDuplicate] = useState<Chart | null>(null);
    const [chartToShare, setChartToShare] = useState<Chart | null>(null);
    const [sharedCharts, setSharedCharts] = useState<Chart[]>([]);
    const [draggedChartId, setDraggedChartId] = useState<string | null>(null);
    const [dragOverChartId, setDragOverChartId] = useState<string | null>(null);

    // Listen for shared charts
    useEffect(() => {
        if (!user.email) return;

        const q = query(
            collection(db, "charts"),
            where("sharedWithEmails", "array-contains", user.email)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const charts: Chart[] = [];
            snapshot.forEach((doc) => {
                const data = doc.data() as Chart;
                // Only show charts shared by OTHERS to avoid confusion
                if (data.ownerId !== user.uid) {
                    const { id: _, ...rest } = data;
                    charts.push({ id: doc.id, ...rest } as Chart);
                }
            });
            setSharedCharts(charts);
        });

        return () => unsubscribe();
    }, [user.email]);

    const groupedCharts = useMemo(() => {
        const groups = allCharts.reduce((acc, chart) => {
            const key = chart.className || 'ללא שם כיתה';
            if (!acc[key]) acc[key] = [];
            acc[key].push(chart);
            return acc;
        }, {} as { [key: string]: Chart[] });

        // Sort charts within each group by order if available, otherwise by creation date
        Object.keys(groups).forEach(className => {
            groups[className].sort((a, b) => {
                if (a.order !== undefined && b.order !== undefined) {
                    return a.order - b.order;
                }
                return new Date(b.creationDate).getTime() - new Date(a.creationDate).getTime();
            });
        });

        return groups;
    }, [allCharts]);

    const handleDragStart = (e: React.DragEvent, chartId: string) => {
        setDraggedChartId(chartId);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent, chartId: string) => {
        e.preventDefault();
        if (draggedChartId === chartId) return;
        setDragOverChartId(chartId);
    };

    const handleDrop = (e: React.DragEvent, targetChartId: string, className: string) => {
        e.preventDefault();
        setDragOverChartId(null);
        if (!draggedChartId || draggedChartId === targetChartId) return;

        const classCharts = groupedCharts[className];
        const draggedIndex = classCharts.findIndex(c => c.id === draggedChartId);
        const targetIndex = classCharts.findIndex(c => c.id === targetChartId);

        if (draggedIndex === -1 || targetIndex === -1) return;

        const newClassCharts = [...classCharts];
        const [draggedChart] = newClassCharts.splice(draggedIndex, 1);
        newClassCharts.splice(targetIndex, 0, draggedChart);

        // Update order property for all charts in this class to ensure consistency
        const updatedCharts = newClassCharts.map((c, index) => ({
            ...c,
            order: index
        }));

        onReorderCharts(updatedCharts);
        setDraggedChartId(null);
    };

    const handleDragEnd = () => {
        setDraggedChartId(null);
        setDragOverChartId(null);
    };

    const handleStartEditing = (currentName: string) => {
        setEditingClassName(currentName);
        setNewClassName(currentName);
    };

    const handleCancelEditing = () => {
        setEditingClassName(null);
        setNewClassName('');
        setEditingChartNameId(null);
        setNewChartName('');
    };

    const handleStartEditingChartName = (chart: Chart) => {
        setEditingChartNameId(chart.id);
        setNewChartName(chart.name || '');
    };

    const handleSaveChartName = async () => {
        if (!editingChartNameId) return;
        
        if (await onUpdateChartName(editingChartNameId, newChartName)) {
            handleCancelEditing();
        }
    };

    const handleSaveClassName = async () => {
        if (!editingClassName || !newClassName.trim()) {
            handleCancelEditing();
            return;
        }
        const trimmedNewName = newClassName.trim();
        if (trimmedNewName === editingClassName) {
            handleCancelEditing();
            return;
        }

        if (await onUpdateClassName(editingClassName, trimmedNewName)) {
            // If class name was updated successfully, also update openClass state if it was open
            if(openClass === editingClassName) {
                setOpenClass(trimmedNewName);
            }
            handleCancelEditing();
        }
    };
    
    const handleModalSave = (className: string, layoutType: 'rows' | 'groups') => {
        const trimmedClassName = className.trim();
        if (trimmedClassName) {
            onStartNew(trimmedClassName, new Date().toISOString(), layoutType);
        }
    };

    const handleConfirmActualDelete = () => {
        if (!confirmingDelete) return;
        if (confirmingDelete.type === 'class') {
            onDeleteClass(confirmingDelete.id);
        } else {
            onDeleteChart(confirmingDelete.id);
        }
        setConfirmingDelete(null);
    };
    
    const handleDuplicate = (keepConstraints: boolean) => {
        if (chartToDuplicate) {
            onDuplicateChart(chartToDuplicate, keepConstraints);
            setChartToDuplicate(null);
        }
    };

    const downloadCharts = (charts: Chart[], fileName: string) => {
        if (!user || charts.length === 0) {
            toast.error('אין מפות לייצוא');
            return;
        }
        
        const dataToExport = {
            user: user.email,
            charts: charts,
            exportDate: new Date().toISOString(),
            version: '1.0'
        };
        
        const dataStr = JSON.stringify(dataToExport, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `${fileName}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        toast.success(`הקובץ "${fileName}" נשמר בהצלחה`);
    };

    const handleExportAll = () => {
        const fileName = `כל_המפות_${user.email?.replace('@', '_')}_${new Date().toLocaleDateString('he-IL').replace(/\./g, '_')}`;
        downloadCharts(allCharts, fileName);
    };

    const handleExportClass = (className: string, charts: Chart[]) => {
        const fileName = `גיבוי_כיתה_${className.replace(/\s+/g, '_')}_${new Date().toLocaleDateString('he-IL').replace(/\./g, '_')}`;
        downloadCharts(charts, fileName);
    };

    const handleExportSingle = (chart: Chart) => {
        const dateStr = new Date(chart.creationDate).toLocaleDateString('he-IL').replace(/\./g, '_');
        const typeStr = chart.layoutType === 'rows' ? 'מפה' : 'קבוצות';
        const chartName = chart.name ? `_${chart.name.replace(/\s+/g, '_')}` : '';
        const fileName = `${typeStr}${chartName}_${chart.className.replace(/\s+/g, '_')}_${dateStr}`;
        downloadCharts([chart], fileName);
    };

    const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target?.result as string);
                if (!importedData.charts || !Array.isArray(importedData.charts)) {
                    toast.error('קובץ לא תקין');
                    return;
                }
                
                const existingIds = new Set(allCharts.map(chart => chart.id));
                const newCharts = importedData.charts.filter((chart: Chart) => !existingIds.has(chart.id));
                
                if (newCharts.length === 0) {
                    toast.info('כל המפות כבר קיימות במכשיר זה');
                    return;
                }
                
                onImportCharts(newCharts);
                
            } catch (error) {
                console.error('Import error:', error);
                toast.error('שגיאה בקריאת הקובץ.');
            } finally {
                // Reset input value so the same file can be selected again
                event.target.value = '';
            }
        };
        reader.readAsText(file);
    };

    return (
        <div className="w-full max-w-4xl mx-auto text-center p-4 md:p-8">
            <h1 className="text-3xl md:text-5xl font-bold text-slate-800 mb-2 md:mb-4">הכיתות שלי</h1>
            <p className="text-base md:text-lg text-slate-600 mb-6 md:mb-8 max-w-2xl mx-auto" translate="no">
                <span className="text-slate-600">התחל ביצירת מפה או קבוצה חדשה, או טען מפה קיימת מאחת הכיתות שלך.</span>
            </p>

            <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-3 md:gap-4 mb-6 md:mb-8">
                <button onClick={() => setIsModalOpen(true)} className="w-full sm:w-auto bg-sky-500 text-white font-bold py-3 md:py-3 px-6 md:px-8 rounded-lg text-base md:text-lg hover:bg-sky-600 transition duration-300 shadow-lg active:scale-90 touch-manipulation select-none" translate="no">
                    <span className="text-white !text-white">התחל מפה או קבוצה חדשה</span>
                </button>

                {allCharts.length > 0 && (
                    <button onClick={handleExportAll} className="w-full sm:w-auto bg-green-500 text-white font-bold py-3 md:py-3 px-6 rounded-lg text-base md:text-lg hover:bg-green-600 transition duration-300 shadow-lg active:scale-90 touch-manipulation select-none">
                        📤 יצוא כל המפות
                    </button>
                )}
                
                <label className="w-full sm:w-auto bg-purple-500 text-white font-bold py-3 md:py-3 px-6 rounded-lg text-base md:text-lg hover:bg-purple-600 transition duration-300 shadow-lg cursor-pointer active:scale-90 touch-manipulation select-none">
                    📥 יבוא מפות
                    <input type="file" accept=".json" className="hidden" onChange={handleImport} />
                </label>
            </div>

            {isCloudSync ? (
                <div className="mb-6 md:mb-8 max-w-3xl mx-auto bg-white border border-slate-200 rounded-lg shadow-sm p-4 text-right">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-sky-100 rounded-full text-sky-600">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 md:h-6 md:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /></svg>
                        </div>
                        <h4 className="font-bold text-base md:text-lg text-slate-800">הנתונים מסונכרנים לענן</h4>
                    </div>
                    <p className="text-sm md:text-base text-slate-600 md:mr-12">
                        כל השינויים נשמרים אוטומטית. ניתן להתחבר מכל מכשיר (מחשב, טלפון, טאבלט) ולצפות בנתונים בזמן אמת באמצעות המייל והסיסמה.
                    </p>
                    <div className="md:mr-12 mt-2 flex flex-wrap gap-3 md:gap-4 text-xs md:text-sm text-slate-500">
                        <span className="flex items-center gap-1">
                            <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                            גיבוי אוטומטי
                        </span>
                        <span className="flex items-center gap-1">
                            <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                            גישה מאובטחת
                        </span>
                    </div>
                </div>
            ) : (
                <div className="mb-8 max-w-2xl mx-auto text-sm text-amber-700 bg-amber-50 border border-amber-200 p-4 rounded-md text-right">
                    <h4 className="font-bold mb-1">מצב מקומי (Demo)</h4>
                    <p>האפליקציה פועלת במצב מקומי. כדי להפעיל סנכרון לענן וגישה מרובת משתמשים, יש להגדיר את מפתחות ה-Firebase בקובץ services/firebase.ts.</p>
                </div>
            )}

            {allCharts.length > 0 ? (
                <div className="mt-4 md:mt-8">
                    <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-2 md:p-4 space-y-2 md:space-y-3 text-right">
                        {/* FIX: Explicitly type 'classCharts' to resolve 'unknown' type errors when using .filter and .map. */}
                        {Object.entries(groupedCharts).map(([className, classCharts]: [string, Chart[]]) => {
                            const mapsCount = classCharts.filter(c => c.layoutType === 'rows').length;
                            const groupsCount = classCharts.filter(c => c.layoutType === 'groups').length;
                            
                            const countParts = [];
                            if (mapsCount > 0) {
                                countParts.push(`${mapsCount} ${mapsCount === 1 ? 'מפה' : 'מפות'}`);
                            }
                            if (groupsCount > 0) {
                                countParts.push(`${groupsCount} ${groupsCount === 1 ? 'קבוצה' : 'קבוצות'}`);
                            }
                            const countText = countParts.join(', ');

                            return (
                                <div key={className} className="border rounded-lg overflow-hidden">
                                    <div className="w-full flex items-center p-3 md:p-4 bg-teal-50">
                                        {editingClassName === className ? (
                                            <div className="flex items-center gap-2 w-full">
                                                <input
                                                    type="text"
                                                    value={newClassName}
                                                    onChange={(e) => setNewClassName(e.target.value)}
                                                    onKeyPress={(e) => e.key === 'Enter' && handleSaveClassName()}
                                                    className="p-1 border rounded-md text-lg md:text-xl font-bold w-full"
                                                    autoFocus
                                                />
                                                <button onClick={handleSaveClassName} className="p-1 md:p-2 text-green-500 hover:text-green-700" title="שמור"><CheckIcon /></button>
                                                <button onClick={handleCancelEditing} className="p-1 md:p-2 text-red-500 hover:text-red-700" title="בטל"><XIcon /></button>
                                            </div>
                                        ) : (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={() => setOpenClass(openClass === className ? null : className)}
                                                    className="flex items-center gap-2 md:gap-3 text-right"
                                                    aria-expanded={openClass === className}
                                                >
                                                    <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-3">
                                                        <span className="font-bold text-lg md:text-xl text-teal-800">{className}</span>
                                                        {countText && (
                                                            <span className="text-[10px] md:text-xs font-semibold bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full w-fit">
                                                                {countText}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <svg className={`w-5 h-5 md:w-6 md:h-6 transition-transform text-slate-500 ${openClass === className ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                                    </svg>
                                                </button>
                                                
                                                <div className="flex-grow" />
                                                
                                                <div className="flex items-center flex-shrink-0 gap-1">
                                                    <button 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleExportClass(className, classCharts);
                                                        }} 
                                                        className="p-2 text-green-600 hover:bg-green-50 rounded-md active:scale-90 touch-manipulation" 
                                                        title="יצוא כיתה"
                                                    >
                                                        <span className="text-lg">📤</span>
                                                    </button>
                                                    <button onClick={() => handleStartEditing(className)} className="p-2 md:p-2 text-slate-500 hover:text-sky-600 active:scale-90 touch-manipulation" title="ערוך שם כיתה">
                                                        <PencilIcon className="h-5 w-5 md:h-5 md:w-5" />
                                                    </button>
                                                    <button onClick={(e) => {
                                                        e.stopPropagation();
                                                        setConfirmingDelete({ type: 'class', id: className, message: `את כל המערכים של כיתה "${className}"` });
                                                    }} className="p-2 md:p-2 text-rose-500 hover:bg-rose-50 hover:text-rose-700 rounded-md flex items-center gap-1 active:scale-90 touch-manipulation" title="מחק כיתה">
                                                        <TrashIcon className="h-5 w-5 md:h-5 md:w-5" />
                                                        <span className="text-xs font-bold hidden sm:inline">מחק כיתה</span>
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                    {openClass === className && (
                                        <div className="p-2 md:p-4 space-y-1 md:space-y-2 bg-white">
                                            {classCharts.map(chart => {
                                                const formattedDateTime = new Date(chart.creationDate).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', ' ');
                                                return (
                                                <div 
                                                    key={chart.id} 
                                                    className={`flex justify-between items-center p-2 rounded-md hover:bg-slate-50 border-b border-slate-50 last:border-0 transition-all ${draggedChartId === chart.id ? 'opacity-40' : ''} ${dragOverChartId === chart.id ? 'bg-teal-50 ring-2 ring-teal-400' : ''}`}
                                                    draggable="true"
                                                    onDragStart={(e) => handleDragStart(e, chart.id)}
                                                    onDragOver={(e) => handleDragOver(e, chart.id)}
                                                    onDragLeave={() => setDragOverChartId(null)}
                                                    onDrop={(e) => handleDrop(e, chart.id, className)}
                                                    onDragEnd={handleDragEnd}
                                                >
                                                    <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-3 flex-grow">
                                                        <div className="flex items-center gap-2">
                                                            <div className="cursor-move text-slate-300 hover:text-slate-500 p-1">
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8h16M4 16h16" />
                                                                </svg>
                                                            </div>
                                                            <span className={`text-[10px] md:text-xs font-bold py-0.5 px-2 rounded-full w-fit ${
                                                                chart.layoutType === 'rows' 
                                                                    ? 'bg-sky-100 text-sky-800' 
                                                                    : 'bg-purple-100 text-purple-800'
                                                            }`}>
                                                                {chart.layoutType === 'rows' ? 'מפה' : 'קבוצה'}
                                                            </span>
                                                        </div>
                                                        
                                                        {editingChartNameId === chart.id ? (
                                                            <div className="flex items-center gap-1 flex-grow max-w-xs">
                                                                <input
                                                                    type="text"
                                                                    value={newChartName}
                                                                    onChange={(e) => setNewChartName(e.target.value)}
                                                                    onKeyPress={(e) => e.key === 'Enter' && handleSaveChartName()}
                                                                    className="p-1 border rounded-md text-sm w-full"
                                                                    placeholder="שם המפה..."
                                                                    autoFocus
                                                                />
                                                                <button onClick={handleSaveChartName} className="p-1 text-green-500 hover:text-green-700"><CheckIcon className="h-4 w-4" /></button>
                                                                <button onClick={handleCancelEditing} className="p-1 text-red-500 hover:text-red-700"><XIcon className="h-4 w-4" /></button>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-2 group">
                                                                {chart.name ? (
                                                                    <span className="text-sm font-bold text-slate-700">{chart.name}</span>
                                                                ) : (
                                                                    <span className="text-xs md:text-sm font-medium text-slate-800">{formattedDateTime}</span>
                                                                )}
                                                                <button 
                                                                    onClick={() => handleStartEditingChartName(chart)}
                                                                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-sky-600 transition-opacity"
                                                                    title="ערוך שם"
                                                                >
                                                                    <PencilIcon className="h-3 w-3" />
                                                                </button>
                                                                {chart.name && (
                                                                    <span className="text-[10px] text-slate-400 hidden md:inline">({formattedDateTime})</span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <button onClick={() => onLoadChart(chart)} className="text-sky-600 hover:text-sky-800 font-bold px-3 py-2 text-sm md:text-sm active:scale-90 touch-manipulation">טען</button>
                                                        <button 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleExportSingle(chart);
                                                            }}
                                                            className="p-2 text-green-600 hover:bg-green-50 rounded-md active:scale-90 touch-manipulation"
                                                            title="יצוא מפה"
                                                        >
                                                            <span className="text-lg">📤</span>
                                                        </button>
                                                        <button 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setChartToShare(chart);
                                                            }}
                                                            className="p-2 md:p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 rounded-md active:scale-90 touch-manipulation"
                                                            title="שתף"
                                                        >
                                                            <ShareIcon className="h-5 w-5 md:h-5 md:w-5" />
                                                        </button>
                                                        <button 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setChartToDuplicate(chart);
                                                            }}
                                                            className="p-2 md:p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 rounded-md active:scale-90 touch-manipulation"
                                                            title="שכפל"
                                                        >
                                                            <DuplicateIcon className="h-5 w-5 md:h-5 md:w-5" />
                                                        </button>
                                                        <button onClick={(e) => {
                                                            e.stopPropagation();
                                                            const chartType = chart.layoutType === 'rows' ? 'המפה' : 'הקבוצה';
                                                            setConfirmingDelete({ type: 'chart', id: chart.id, message: `את ${chartType} מתאריך ${formattedDateTime}` });
                                                        }} className="p-2 md:p-2 text-rose-500 hover:bg-rose-50 hover:text-rose-700 rounded-md flex items-center gap-1 active:scale-90 touch-manipulation" title="מחק">
                                                            <TrashIcon className="h-5 w-5 md:h-5 md:w-5" />
                                                            <span className="text-xs font-bold">מחק</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            )})}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
            ) : (
                <div className="mt-8 bg-amber-50 border-r-4 border-amber-400 p-4 rounded-md max-w-2xl mx-auto" translate="no">
                    <p className="text-amber-800">עדיין לא יצרת מפות או קבוצות. לחץ על "התחל מפה או קבוצה חדשה" כדי להתחיל.</p>
                </div>
            )}

            {sharedCharts.length > 0 && (
                <div className="mt-12 text-right">
                    <h2 className="text-2xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <ShareIcon className="h-6 w-6 text-sky-600" />
                        מפות ששותפו איתי
                    </h2>
                    <div className="bg-white rounded-lg shadow-md p-4 space-y-3">
                        {sharedCharts.map(chart => {
                            const formattedDateTime = new Date(chart.creationDate).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', ' ');
                            const shareInfo = chart.sharedWith?.find(s => s.email === user.email);
                            const isEditor = shareInfo?.role === 'editor';
                            
                            return (
                                <div key={chart.id} className="flex justify-between items-center p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-slate-800">{chart.className}</span>
                                            <span className={`text-[10px] font-bold py-0.5 px-2 rounded-full ${
                                                chart.layoutType === 'rows' ? 'bg-sky-100 text-sky-800' : 'bg-purple-100 text-purple-800'
                                            }`}>
                                                {chart.layoutType === 'rows' ? 'מפה' : 'קבוצה'}
                                            </span>
                                        </div>
                                        <div className="text-xs text-slate-500">
                                            שותף על ידי: <span className="font-semibold">{chart.ownerName}</span> ({chart.ownerSchool})
                                        </div>
                                        <div className="text-[10px] text-slate-400">{formattedDateTime}</div>
                                        {shareInfo?.message && (
                                            <div className="mt-2 p-2 bg-amber-50 border border-amber-100 rounded-md text-xs text-amber-800 italic relative">
                                                <div className="absolute -top-2 right-2 bg-amber-100 px-1 text-[8px] font-bold rounded uppercase tracking-tighter">הודעה אישית</div>
                                                "{shareInfo.message}"
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button 
                                            onClick={() => onLoadChart(chart, true)} 
                                            className="bg-sky-50 text-sky-600 hover:bg-sky-100 font-bold py-2.5 px-5 rounded-md text-sm transition-colors active:scale-90 touch-manipulation"
                                        >
                                            צפייה בלבד!
                                        </button>
                                        <div className="flex flex-col items-center">
                                            <button 
                                                onClick={() => setChartToDuplicate(chart)} 
                                                className="bg-slate-50 text-slate-600 hover:bg-slate-100 font-bold py-2.5 px-5 rounded-md text-sm transition-colors flex items-center gap-1 active:scale-90 touch-manipulation"
                                                title="צור עותק לעריכה"
                                            >
                                                <DuplicateIcon className="h-4 w-4" />
                                                צור עותק
                                            </button>
                                            <span className="text-[10px] text-slate-400 mt-0.5">על מנת לשמור</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {isModalOpen && <CreateChartModal onClose={() => setIsModalOpen(false)} onSave={handleModalSave} />}
            {confirmingDelete && (
                <ConfirmDeleteModal
                    message={`האם למחוק ${confirmingDelete.message}? פעולה זו אינה הפיכה.`}
                    onConfirm={handleConfirmActualDelete}
                    onCancel={() => setConfirmingDelete(null)}
                />
            )}
            {chartToDuplicate && (
                <DuplicateChartModal
                    chart={chartToDuplicate}
                    onClose={() => setChartToDuplicate(null)}
                    onDuplicate={handleDuplicate}
                />
            )}
            {chartToShare && profile && (
                <ShareModal
                    chart={
                        allCharts.find(c => c.id === chartToShare.id) || 
                        sharedCharts.find(c => c.id === chartToShare.id) || 
                        chartToShare
                    }
                    currentProfile={profile}
                    onClose={() => setChartToShare(null)}
                    onUpdate={() => {
                        // The onSnapshot listeners in App.tsx and MainScreen.tsx 
                        // will update the respective chart lists, triggering a re-render.
                    }}
                />
            )}
        </div>
    );
};

export default MainScreen;
