import React, { useState, useEffect } from 'react';
import { Chart, Screen, RowsLayoutDetails } from '../../types';
import { PrintIcon, PencilIcon, ShuffleIcon, SwitchHorizontalIcon, BalancedIcon, DownloadIcon, PdfIcon, PinIcon, TrashIcon, ChevronRightIcon } from '../icons';
import ConfirmActionModal from '../modals/ConfirmActionModal';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface EditorHeaderProps {
    chart: Chart;
    currentScreen: Screen;
    onSaveAndExit: () => void;
    onBackToMain: () => void;
    onGoToEditor: () => void;
    onUpdateChart: (updater: React.SetStateAction<Chart | null>) => void;
    onRegenerate: () => void;
    onConvertLayout: () => void;
    onSpreadStudents: () => void;
    onChangeVersion: (newIndex: number) => void;
    onDeleteChart?: (id: string) => void;
    onClearPins?: () => void;
}

const EditorHeader: React.FC<EditorHeaderProps> = ({ chart, currentScreen, onSaveAndExit, onBackToMain, onGoToEditor, onUpdateChart, onRegenerate, onConvertLayout, onSpreadStudents, onChangeVersion, onDeleteChart, onClearPins }) => {
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [editedClassName, setEditedClassName] = useState(chart.className);
    const [editedName, setEditedName] = useState(chart.name || '');
    const [isConfirmingConvert, setIsConfirmingConvert] = useState(false);
    const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
    
    const formatForDateTimeLocal = (isoString: string) => {
        const date = new Date(isoString);
        const timezoneOffsetInMs = date.getTimezoneOffset() * 60000;
        const localDate = new Date(date.getTime() - timezoneOffsetInMs);
        return localDate.toISOString().slice(0, 16);
    };

    const [editedDate, setEditedDate] = useState(formatForDateTimeLocal(chart.creationDate));

    useEffect(() => {
        setEditedClassName(chart.className);
        setEditedName(chart.name || '');
        setEditedDate(formatForDateTimeLocal(chart.creationDate));
    }, [chart]);

    const handleSaveTitle = () => {
        if (!editedClassName.trim()) {
            alert("שם הכיתה לא יכול להיות ריק.");
            return;
        }
        onUpdateChart(prev => prev ? {
            ...prev,
            className: editedClassName.trim(),
            name: editedName.trim() || undefined,
            creationDate: new Date(editedDate).toISOString(),
        } : null);
        setIsEditingTitle(false);
    };

    const handleCancelEditTitle = () => {
        setEditedClassName(chart.className);
        setEditedName(chart.name || '');
        setEditedDate(formatForDateTimeLocal(chart.creationDate));
        setIsEditingTitle(false);
    };

    const handleConfirmConvert = () => {
        onConvertLayout();
        setIsConfirmingConvert(false);
    };

    const handleConfirmDelete = () => {
        if (onDeleteChart) {
            onDeleteChart(chart.id);
        }
        setIsConfirmingDelete(false);
    };

    const handleDownloadImage = async () => {
        const element = document.getElementById('printable-area');
        if (!element) {
            alert('לא נמצאה המפה להורדה.');
            return;
        }
    
        setIsDownloading(true);
        
        try {
            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false,
            });
    
            const image = canvas.toDataURL('image/png', 1.0);
            const link = document.createElement('a');
            
            const fileName = `${chart.layoutType === 'rows' ? 'map' : 'groups'}_${chart.className.replace(/\s/g, '_')}_${new Date(chart.creationDate).toLocaleDateString('he-IL').replace(/\./g, '_')}.png`;
            link.download = fileName;
            link.href = image;
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error('Error generating image:', error);
            alert('אירעה שגיאה בעת יצירת התמונה.');
        } finally {
            setIsDownloading(false);
        }
    };

    const handleDownloadPdf = async () => {
        const element = document.getElementById('printable-area');
        if (!element) {
            alert('לא נמצאה המפה להורדה.');
            return;
        }
    
        setIsDownloadingPdf(true);
    
        try {
            const canvas = await html2canvas(element, {
                scale: 3, // Higher scale for better PDF quality
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false,
                onclone: (clonedDoc) => {
                    const el = clonedDoc.getElementById('printable-area');
                    if (el) {
                        // Base styles for clean capture
                        el.style.width = '1120px'; // Match UI landscape width
                        el.style.minHeight = '792px'; // Match UI landscape height
                        el.style.margin = '0';
                        el.style.padding = '40px';
                        el.style.boxShadow = 'none';
                        el.style.borderRadius = '0';
                        el.style.backgroundColor = '#ffffff';
                        el.style.display = 'flex';
                        el.style.flexDirection = 'column';
                        el.style.alignItems = 'center';
                        
                        const grid = el.querySelector('.classroom-grid');
                        const groups = el.querySelector('.groups-grid');
                        
                        if (grid) {
                            (grid as HTMLElement).style.margin = '0 auto';
                            (grid as HTMLElement).style.width = 'fit-content';
                            (grid as HTMLElement).style.display = 'inline-grid';
                            (grid as HTMLElement).style.gap = '48px'; // 12 * 4 (approx)
                            const numCols = chart.layoutType === 'rows' ? (chart.layoutDetails as RowsLayoutDetails).columnConfiguration.length : 0;
                            (grid as HTMLElement).style.gridTemplateColumns = `auto repeat(${numCols}, minmax(180px, 1fr))`;
                            
                            const desks = el.querySelectorAll('.desk-container');
                            desks.forEach((desk) => {
                                (desk as HTMLElement).style.width = '180px';
                                (desk as HTMLElement).style.height = '100px';
                            });
                        }
                        
                        if (groups) {
                            (groups as HTMLElement).style.width = '100%';
                            (groups as HTMLElement).style.display = 'grid';
                            (groups as HTMLElement).style.gridTemplateColumns = 'repeat(4, 1fr)';
                            (groups as HTMLElement).style.gap = '24px';
                        }
                    }
                }
            });
    
            const imageData = canvas.toDataURL('image/png', 1.0);
            
            // A4 page in mm: 297 width, 210 height (landscape)
            const pdf = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: 'a4'
            });
    
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const margin = 10; // 10mm margin
            const usableWidth = pdfWidth - (margin * 2);
            const usableHeight = pdfHeight - (margin * 2);
            
            const canvasWidth = canvas.width;
            const canvasHeight = canvas.height;
            const canvasRatio = canvasWidth / canvasHeight;
    
            let imgWidth = usableWidth;
            let imgHeight = imgWidth / canvasRatio;
            
            if (imgHeight > usableHeight) {
                imgHeight = usableHeight;
                imgWidth = imgHeight * canvasRatio;
            }
    
            const x = margin + (usableWidth - imgWidth) / 2;
            const y = margin + (usableHeight - imgHeight) / 2;
            
            pdf.addImage(imageData, 'PNG', x, y, imgWidth, imgHeight);
    
            const fileName = `${chart.layoutType === 'rows' ? 'map' : 'groups'}_${chart.className.replace(/\s/g, '_')}_${new Date(chart.creationDate).toLocaleDateString('he-IL').replace(/\./g, '_')}.pdf`;
            
            pdf.save(fileName);
    
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('אירעה שגיאה בעת יצירת קובץ ה-PDF.');
        } finally {
            setIsDownloadingPdf(false);
        }
    };

    const handlePrint = () => {
        const printContent = document.getElementById('printable-area');
        if (!printContent) {
            alert('לא נמצאה המפה להדפסה.');
            return;
        }

        // Create a new window for printing to bypass iframe restrictions
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert('הדפדפן חסם את פתיחת חלון ההדפסה. אנא אפשר פופ-אפים לאתר זה.');
            return;
        }

        // Get all styles from the current document to ensure the print looks correct
        let styles = '';
        try {
            styles = Array.from(document.styleSheets)
                .map(styleSheet => {
                    try {
                        return Array.from(styleSheet.cssRules)
                            .map(rule => rule.cssText)
                            .join('');
                    } catch (e) {
                        return '';
                    }
                })
                .join('');
        } catch (e) {
            console.warn("Could not copy all styles", e);
        }

        printWindow.document.write(`
            <html>
                <head>
                    <title>${chart.className} - הדפסת מפה</title>
                    <style>
                        ${styles}
                        body { 
                            padding: 20px; 
                            direction: rtl; 
                            background: white !important; 
                            font-family: sans-serif;
                        }
                        .print-hidden { display: none !important; }
                        #printable-area { 
                            width: 100% !important; 
                            margin: 0 !important; 
                            box-shadow: none !important; 
                            border: none !important;
                        }
                        /* Ensure the grid looks good on print */
                        .classroom-grid, .groups-grid {
                            margin: 0 auto !important;
                        }
                        @page { size: landscape; margin: 1cm; }
                    </style>
                </head>
                <body>
                    <div id="printable-area">
                        ${printContent.innerHTML}
                    </div>
                    <script>
                        window.onload = () => {
                            // Small delay to ensure everything is rendered
                            setTimeout(() => {
                                window.focus();
                                window.print();
                            }, 500);
                        };
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };


    const formattedDateTime = new Date(chart.creationDate).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', ' ');
    const convertButtonText = chart.layoutType === 'rows' ? 'המר לקבוצה' : 'המר למפה';
    const conversionMessage = `האם להפוך את ${chart.layoutType === 'rows' ? 'המפה' : 'הקבוצה'} ל'${chart.layoutType === 'rows' ? 'קבוצה' : 'מפת ישיבה'}'? רשימת התלמידים וההעדפות יישמרו. הגדרות המבנה הישן (כמו מספר שורות וטורים) יוחלפו בהגדרות ברירת מחדל חדשות.`;

    const { layoutHistory, activeLayoutIndex } = chart;
    const showVersionNavigator = currentScreen === 'result' && layoutHistory && layoutHistory.length > 1 && typeof activeLayoutIndex === 'number';

    return (
        <header className="bg-white/95 backdrop-blur-sm shadow-md p-2 md:p-3 flex items-center justify-between print-hidden z-30 shrink-0 gap-2">
            <div className="flex-shrink-0">
                <button 
                    onClick={onBackToMain} 
                    className="bg-indigo-600 text-white px-5 md:px-6 py-3 md:py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg hover:bg-indigo-700 transition-all active:scale-90 text-sm md:text-base touch-manipulation select-none relative z-40"
                    title="חזרה למסך הראשי"
                >
                    <ChevronRightIcon className="h-5 w-5" />
                    <span>חזרה</span>
                </button>
            </div>
            
            <div className="flex-1 flex flex-col items-center gap-1 min-w-0">
                {isEditingTitle ? (
                    <div className="flex flex-col md:flex-row items-center gap-1 md:gap-2 w-full max-w-xs md:max-w-none">
                        <div className="flex flex-col gap-1 w-full md:w-auto">
                            <input 
                                type="text"
                                value={editedName}
                                onChange={(e) => setEditedName(e.target.value)}
                                placeholder="שם המפה..."
                                className="p-2 border rounded-md text-xs md:text-sm w-full md:w-48"
                            />
                            <input 
                                type="text"
                                value={editedClassName}
                                onChange={(e) => setEditedClassName(e.target.value)}
                                placeholder="שם הכיתה..."
                                className="p-2 border rounded-md text-xs md:text-sm w-full md:w-48"
                            />
                        </div>
                        <div className="flex items-center gap-1">
                            <input
                                type="datetime-local"
                                value={editedDate}
                                onChange={(e) => setEditedDate(e.target.value)}
                                className="p-2 border rounded-md text-xs md:text-sm"
                            />
                            <button onClick={handleSaveTitle} className="text-xs bg-green-500 text-white py-2 px-3 rounded-md hover:bg-green-600">שמור</button>
                            <button onClick={handleCancelEditTitle} className="text-xs bg-slate-200 text-slate-700 py-2 px-3 rounded-md hover:bg-slate-300">בטל</button>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center gap-1 md:gap-2 min-w-0">
                        <div className="text-center min-w-0">
                             <h1 className="text-[10px] md:text-lg font-bold text-teal-600 leading-tight truncate">
                                 {chart.name || "מפות ישיבה וחלוקה לקבוצות"}
                             </h1>
                             <h2 className="text-[8px] md:text-sm font-medium text-slate-500 truncate max-w-[60px] xs:max-w-[100px] md:max-w-none">
                                 {chart.className}
                             </h2>
                        </div>
                        {!chart.isReadOnly && (
                            <button onClick={() => setIsEditingTitle(true)} className="p-2 text-slate-400 hover:text-sky-600 shrink-0 transition-all active:scale-90"><PencilIcon className="h-4 w-4 md:h-5 md:w-5" /></button>
                        )}
                    </div>
                )}
                {showVersionNavigator && (
                    <div className="flex items-center gap-1 md:gap-3 text-[9px] md:text-sm font-semibold text-slate-700 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-200">
                        <button 
                            onClick={() => onChangeVersion(activeLayoutIndex - 1)}
                            disabled={activeLayoutIndex === 0}
                            className="p-1 md:p-1.5 leading-none rounded-md bg-slate-200 hover:bg-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-90"
                            aria-label="הגרסה הקודמת"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 md:h-4 md:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                        </button>
                        <span className="whitespace-nowrap">גרסה {activeLayoutIndex + 1} / {layoutHistory.length}</span>
                         <button 
                            onClick={() => onChangeVersion(activeLayoutIndex + 1)}
                            disabled={activeLayoutIndex >= layoutHistory.length - 1}
                            className="p-1 md:p-1.5 leading-none rounded-md bg-slate-200 hover:bg-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-90"
                            aria-label="הגרסה הבאה"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 md:h-4 md:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                        </button>
                    </div>
                )}
            </div>

            <div className="flex-shrink-0 flex items-center justify-end gap-1 md:gap-2">
                {!chart.isReadOnly && (
                    <div className="flex items-center gap-1 md:gap-1.5 flex-wrap justify-end">
                        <button onClick={() => setIsConfirmingConvert(true)} className="text-[10px] md:text-xs bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 p-2 md:p-2.5 rounded-md flex items-center gap-1 border border-slate-200 transition-all active:scale-90" title={convertButtonText}>
                            <SwitchHorizontalIcon className="h-4 w-4 md:h-5 md:w-5" /> <span className="hidden lg:inline">{convertButtonText}</span>
                        </button>
                        {currentScreen === 'result' && (
                            <>
                                {chart.layoutType === 'rows' && (
                                   <>
                                       <button onClick={onSpreadStudents} className="text-[10px] md:text-xs bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 p-2 md:p-2.5 rounded-md flex items-center gap-1 border border-slate-200 transition-all active:scale-90" title="פרוס תלמידים בכיתה">
                                            <BalancedIcon className="h-4 w-4 md:h-5 md:w-5" /> <span className="hidden lg:inline">פריסה</span>
                                       </button>
                                       {onClearPins && (
                                           <button onClick={onClearPins} className="text-[10px] md:text-xs bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 p-2 md:p-2.5 rounded-md flex items-center gap-1 border border-slate-200 transition-all active:scale-90" title="נקה את כל הנעיצות">
                                                <PinIcon className="h-4 w-4 md:h-5 md:w-5" /> <span className="hidden lg:inline">נקה נעיצות</span>
                                           </button>
                                       )}
                                   </>
                                )}
                                <button onClick={onRegenerate} className="text-[10px] md:text-xs bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 p-2 md:p-2.5 rounded-md flex items-center gap-1 border border-slate-200 transition-all active:scale-90" title="ערבב מחדש">
                                    <ShuffleIcon className="h-4 w-4 md:h-5 md:w-5" /> <span className="hidden lg:inline">ערבב</span>
                                </button>
                                <button onClick={onGoToEditor} className="text-[10px] md:text-xs bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 p-2 md:p-2.5 rounded-md flex items-center gap-1 border border-slate-200 transition-all active:scale-90" title="חזרה לעריכה">
                                    <PencilIcon className="h-4 w-4 md:h-5 md:w-5" /> <span className="hidden lg:inline">עריכה</span>
                                </button>
                            </>
                        )}
                    </div>
                )}

                {currentScreen === 'result' && (
                    <div className="flex items-center gap-1">
                        <button 
                            onClick={handlePrint} 
                            className="p-2 md:p-3 bg-slate-100 text-slate-700 rounded-md hover:bg-slate-200 border border-slate-200 transition-all active:scale-90" 
                            title="הדפסה"
                        >
                            <PrintIcon className="h-4 w-4 md:h-5 md:w-5" />
                        </button>
                        <button 
                            onClick={handleDownloadImage} 
                            disabled={isDownloading}
                            className="p-2 md:p-3 bg-slate-100 text-slate-700 rounded-md hover:bg-slate-200 border border-slate-200 disabled:opacity-50 transition-all active:scale-90" 
                            title="הורדה כתמונה"
                        >
                            <DownloadIcon className="h-4 w-4 md:h-5 md:w-5" />
                        </button>
                        <button 
                            onClick={handleDownloadPdf} 
                            disabled={isDownloadingPdf}
                            className="p-2 md:p-3 bg-slate-100 text-slate-700 rounded-md hover:bg-slate-200 border border-slate-200 disabled:opacity-50 transition-all active:scale-90" 
                            title="הורדה כ-PDF"
                        >
                            <PdfIcon className="h-4 w-4 md:h-5 md:w-5" />
                        </button>
                    </div>
                )}

                 {!chart.isReadOnly && (
                     <button 
                        onClick={onSaveAndExit} 
                        className="py-2 md:py-3 px-3 md:px-6 bg-teal-500 text-white font-bold rounded-md hover:bg-teal-600 text-[10px] md:text-sm shadow-sm whitespace-nowrap transition-all active:scale-95"
                    >
                        שמירה
                    </button>
                 )}

                {onDeleteChart && !chart.isReadOnly && (
                    <button 
                        onClick={() => setIsConfirmingDelete(true)} 
                        className="p-2 md:p-3 text-rose-500 hover:bg-rose-50 hover:text-rose-700 rounded-md transition-all active:scale-90"
                        title="מחק מפה זו"
                    >
                        <TrashIcon className="h-4 w-4 md:h-5 md:w-5" />
                    </button>
                )}
            </div>
            {isConfirmingConvert && (
                <ConfirmActionModal
                    title={`אישור המרת ${chart.layoutType === 'rows' ? 'מפה' : 'קבוצה'}`}
                    message={conversionMessage}
                    confirmText="אשר המרה"
                    onConfirm={handleConfirmConvert}
                    onCancel={() => setIsConfirmingConvert(false)}
                />
            )}
            {isConfirmingDelete && (
                <ConfirmActionModal
                    title="מחיקת מפה"
                    message={`האם למחוק את ${chart.layoutType === 'rows' ? 'המפה' : 'הקבוצה'} של כיתה "${chart.className}"? פעולה זו אינה הפיכה.`}
                    confirmText="מחק לצמיתות"
                    onConfirm={handleConfirmDelete}
                    onCancel={() => setIsConfirmingDelete(false)}
                    danger={true}
                />
            )}
        </header>
    );
};

export default EditorHeader;