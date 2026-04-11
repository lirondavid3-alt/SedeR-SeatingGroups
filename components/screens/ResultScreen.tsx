import React, { useState } from 'react';
import { Chart, Student, GeneratedRowsLayout, Violation, GeneratedGroupsLayout, Constraints } from '../../types';
import ClassroomGrid from '../chart/ClassroomGrid';
import GroupDisplay from '../chart/GroupDisplay';
import StudentModal from '../modals/StudentModal';
import SwapConflictModal from '../modals/SwapConflictModal';
import { DEFAULT_STUDENT_CONSTRAINTS } from '../../constants';
import { sendToWebhook } from '../../services/webhookService';
import { toast } from 'sonner';

interface ResultScreenProps {
    chart: Chart;
    onRegenerate: (chart: Chart) => void;
    onGoToEditor: () => void;
    onUpdateChart: (chart: Chart) => void;
    onClearPins?: () => void;
    isAdmin?: boolean;
}

const ResultScreen: React.FC<ResultScreenProps> = ({ chart, onRegenerate, onGoToEditor, onUpdateChart, onClearPins, isAdmin }) => {
    const [studentToEdit, setStudentToEdit] = useState<Student | null>(null);
    const [swapConflict, setSwapConflict] = useState<{ violations: Violation[]; onConfirm: () => void } | null>(null);
    const [viewMode, setViewMode] = useState<'teacher' | 'student'>('teacher');
    const [isExporting, setIsExporting] = useState(false);

    if (!chart.generatedLayout) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <p className="text-lg text-slate-600 mb-4">אין מפה להצגה. נסה ליצור אחת.</p>
                {!chart.isReadOnly && (
                    <button onClick={onGoToEditor} className="py-3 px-6 bg-teal-500 text-white rounded-xl font-bold shadow-md hover:bg-teal-600 transition-all active:scale-90 touch-manipulation select-none">
                        חזרה לעריכה
                    </button>
                )}
            </div>
        );
    }

    const handleOpenStudentModal = (studentId: string) => {
        if (chart.isReadOnly) return;
        const student = chart.students.find(s => s.id === studentId);
        if (student) {
            setStudentToEdit(student);
        }
    };

    const handleSaveStudent = (updatedStudent: Student) => {
        const updatedStudents = chart.students.map(s => s.id === updatedStudent.id ? updatedStudent : s);
        const updatedChart = { ...chart, students: updatedStudents };
        onRegenerate(updatedChart);
        setStudentToEdit(null);
    };

    const handleCloseModal = () => {
        setStudentToEdit(null);
    };

    const checkStudentConstraints = (
        studentToCheck: Student,
        newPos: { row: number; col: number; seat: number },
        currentDeskMateId: string | undefined,
        allStudents: Student[]
    ): Violation[] => {
        if (newPos.row === -1) return [];
        const studentViolations: Violation[] = [];
        const constraints = { ...DEFAULT_STUDENT_CONSTRAINTS, ...(studentToCheck.constraints || {}) };
        const deskMate = allStudents.find(s => s.id === currentDeskMateId);

        if (constraints.allowedRows && constraints.allowedRows.length > 0 && !constraints.allowedRows.includes(newPos.row)) {
            studentViolations.push({ studentName: studentToCheck.name, message: `חייב להיות בשורות: ${constraints.allowedRows.join(', ')}` });
        }
        if (constraints.allowedCols && constraints.allowedCols.length > 0 && !constraints.allowedCols.includes(newPos.col)) {
            studentViolations.push({ studentName: studentToCheck.name, message: `חייב להיות בטורים: ${constraints.allowedCols.join(', ')}` });
        }
        if (constraints.allowedSeats && constraints.allowedSeats.length > 0 && !constraints.allowedSeats.includes(newPos.seat)) {
            studentViolations.push({ studentName: studentToCheck.name, message: `חייב להיות בכיסא: ${constraints.allowedSeats.join(', ')}` });
        }
        if (constraints.sitAlone && !!deskMate) {
            studentViolations.push({ studentName: studentToCheck.name, message: 'חייב לשבת לבד' });
        }
        if (deskMate && constraints.dontSitWith?.includes(deskMate.id)) {
            studentViolations.push({ studentName: studentToCheck.name, message: `אסור לשבת ליד ${deskMate.name}` });
        }
        if (constraints.sitWith && constraints.sitWith.length > 0 && (!deskMate || !constraints.sitWith.includes(deskMate.id))) {
            const requiredPartners = constraints.sitWith.map(id => allStudents.find(s => s.id === id)?.name).filter(Boolean);
            if (requiredPartners.length > 0) {
                studentViolations.push({ studentName: studentToCheck.name, message: `חייב לשבת ליד ${requiredPartners.join(', ')}` });
            }
        }
        return studentViolations;
    };
    
    const handleStudentSwap = (
        draggedInfo: { studentId: string; row: number; col: number; seat: number },
        droppedInfo: { studentId: string; row: number; col: number; seat: number }
    ) => {
        if (chart.isReadOnly) return;
        const { students, generatedLayout } = chart;
        if (!generatedLayout || !('desks' in generatedLayout)) return;

        const draggedStudent = students.find(s => s.id === draggedInfo.studentId);
        const droppedStudent = students.find(s => s.id === droppedInfo.studentId);

        if (!draggedStudent || !droppedStudent) return;

        const draggedDesk = draggedInfo.row === -1 ? null : (generatedLayout as GeneratedRowsLayout).desks.find(d => d.row === draggedInfo.row && d.col === draggedInfo.col);
        const droppedDesk = (generatedLayout as GeneratedRowsLayout).desks.find(d => d.row === droppedInfo.row && d.col === droppedInfo.col);
        
        let draggedDeskMateId: string | undefined;
        let droppedDeskMateId: string | undefined;

        if (draggedInfo.row === droppedInfo.row && draggedInfo.col === droppedInfo.col) {
            draggedDeskMateId = droppedInfo.studentId;
            droppedDeskMateId = draggedInfo.studentId;
        } else {
            draggedDeskMateId = droppedDesk?.students.find(s => s.seat !== droppedInfo.seat)?.id;
            droppedDeskMateId = draggedDesk?.students.find(s => s.seat !== draggedInfo.seat)?.id;
        }

        const violations: Violation[] = [
            ...checkStudentConstraints(draggedStudent, droppedInfo, droppedDeskMateId, students),
            ...checkStudentConstraints(droppedStudent, draggedInfo, draggedDeskMateId, students)
        ];

        const performSwap = () => {
            const newChart = JSON.parse(JSON.stringify(chart));
            const newLayout = newChart.generatedLayout as GeneratedRowsLayout;
            
            if (draggedInfo.row === -1) {
                const unplacedIndex = newLayout.unplacedStudents.findIndex(s => s.id === draggedInfo.studentId);
                const desk2 = newLayout.desks.find(d => d.row === droppedInfo.row && d.col === droppedInfo.col);
                const seat2 = desk2?.students.find(s => s.seat === droppedInfo.seat);
                
                if (unplacedIndex > -1 && seat2) {
                    const displacedName = seat2.name;
                    const displacedId = seat2.id;
                    seat2.name = draggedStudent.name;
                    seat2.id = draggedStudent.id;
                    newLayout.unplacedStudents[unplacedIndex] = { id: displacedId, name: displacedName, reason: "הוצא מהכיתה עקב החלפה ידנית" };
                }
            } else {
                const desk1 = newLayout.desks.find(d => d.row === draggedInfo.row && d.col === draggedInfo.col);
                const desk2 = newLayout.desks.find(d => d.row === droppedInfo.row && d.col === droppedInfo.col);
                if (!desk1 || !desk2) return;

                const seat1 = desk1.students.find(s => s.seat === draggedInfo.seat);
                const seat2 = desk2.students.find(s => s.seat === droppedInfo.seat);
                if (!seat1 || !seat2) return;
                
                const tempName = seat1.name;
                const tempId = seat1.id;
                
                seat1.name = seat2.name;
                seat1.id = seat2.id;
                
                seat2.name = tempName;
                seat2.id = tempId;
            }
            
            onUpdateChart(newChart);
            setSwapConflict(null);
        };
        
        if (violations.length > 0) {
            setSwapConflict({ violations, onConfirm: performSwap });
        } else {
            performSwap();
        }
    };

    const handleStudentMove = (
        draggedInfo: { studentId: string; row: number; col: number; seat: number },
        droppedInfo: { row: number; col: number; seat: number }
    ) => {
        const { students, generatedLayout } = chart;
        if (!generatedLayout || !('desks' in generatedLayout)) return;

        const draggedStudent = students.find(s => s.id === draggedInfo.studentId);
        if (!draggedStudent) return;

        const targetDesk = (generatedLayout as GeneratedRowsLayout).desks.find(d => d.row === droppedInfo.row && d.col === droppedInfo.col);
        const targetDeskMateId = targetDesk?.students.find(s => s.seat !== droppedInfo.seat)?.id;
        const violations = checkStudentConstraints(draggedStudent, droppedInfo, targetDeskMateId, students);

        const performMove = () => {
            const newChart = JSON.parse(JSON.stringify(chart));
            const newLayout = newChart.generatedLayout as GeneratedRowsLayout;
            
            if (draggedInfo.row === -1) {
                if (newLayout.unplacedStudents) {
                    const studentIndex = newLayout.unplacedStudents.findIndex(s => s.id === draggedInfo.studentId);
                    if (studentIndex > -1) {
                        newLayout.unplacedStudents.splice(studentIndex, 1);
                    }
                }
            } else {
                const sourceDesk = newLayout.desks.find(d => d.row === draggedInfo.row && d.col === draggedInfo.col);
                if (sourceDesk) {
                    const studentIndex = sourceDesk.students.findIndex(s => s.seat === draggedInfo.seat);
                    if (studentIndex > -1) {
                        sourceDesk.students.splice(studentIndex, 1);
                    }
                }
            }

            let destDesk = newLayout.desks.find(d => d.row === droppedInfo.row && d.col === droppedInfo.col);
            
            if (!destDesk) {
                destDesk = { row: droppedInfo.row, col: droppedInfo.col, students: [] };
                newLayout.desks.push(destDesk);
            }

            const existingSeatIndex = destDesk.students.findIndex(s => s.seat === droppedInfo.seat);
            if (existingSeatIndex > -1) {
                destDesk.students.splice(existingSeatIndex, 1);
            }

            destDesk.students.push({ id: draggedStudent.id, name: draggedStudent.name, seat: droppedInfo.seat });

            onUpdateChart(newChart);
            setSwapConflict(null);
        };
        
        if (violations.length > 0) {
            setSwapConflict({ violations, onConfirm: performMove });
        } else {
            performMove();
        }
    };

    const handleGroupStudentSwap = (draggedStudentId: string, droppedStudentId: string) => {
        const { students, generatedLayout } = chart;
        if (!generatedLayout || !('groups' in generatedLayout)) return;

        const draggedStudent = students.find(s => s.id === draggedStudentId);
        const droppedStudent = students.find(s => s.id === droppedStudentId);
        if (!draggedStudent || !droppedStudent) return;

        const sourceGroup = (generatedLayout as GeneratedGroupsLayout).groups.find(g => g.students.includes(draggedStudent.name));
        const destGroup = (generatedLayout as GeneratedGroupsLayout).groups.find(g => g.students.includes(droppedStudent.name));

        if (!sourceGroup || !destGroup || sourceGroup.groupNumber === destGroup.groupNumber) return;

        const violations: Violation[] = [];

        const draggedConstraints = { ...DEFAULT_STUDENT_CONSTRAINTS, ...(draggedStudent.constraints || {}) };
        if (draggedConstraints.dontSitWith && draggedConstraints.dontSitWith.length > 0) {
            for (const studentNameInDest of destGroup.students) {
                if (studentNameInDest === droppedStudent.name) continue;
                const studentInDest = students.find(s => s.name === studentNameInDest);
                if (studentInDest && draggedConstraints.dontSitWith.includes(studentInDest.id)) {
                    violations.push({ studentName: draggedStudent.name, message: `אסור להיות בקבוצה עם ${studentInDest.name}` });
                }
            }
        }

        const droppedConstraints = { ...DEFAULT_STUDENT_CONSTRAINTS, ...(droppedStudent.constraints || {}) };
        if (droppedConstraints.dontSitWith && droppedConstraints.dontSitWith.length > 0) {
            for (const studentNameInSource of sourceGroup.students) {
                if (studentNameInSource === draggedStudent.name) continue;
                const studentInSource = students.find(s => s.name === studentNameInSource);
                if (studentInSource && droppedConstraints.dontSitWith.includes(studentInSource.id)) {
                    violations.push({ studentName: droppedStudent.name, message: `אסור להיות בקבוצה עם ${studentInSource.name}` });
                }
            }
        }

        const performSwap = () => {
            const newChart = JSON.parse(JSON.stringify(chart));
            const newLayout = newChart.generatedLayout as GeneratedGroupsLayout;
            
            const group1 = newLayout.groups.find(g => g.students.includes(draggedStudent.name));
            const group2 = newLayout.groups.find(g => g.students.includes(droppedStudent.name));
            if (!group1 || !group2) return;

            const index1 = group1.students.indexOf(draggedStudent.name);
            const index2 = group2.students.indexOf(droppedStudent.name);
            
            if (index1 > -1 && index2 > -1) {
                group1.students[index1] = droppedStudent.name;
                group2.students[index2] = draggedStudent.name;
            }

            onUpdateChart(newChart);
            setSwapConflict(null);
        };
        
        if (violations.length > 0) {
            setSwapConflict({ violations, onConfirm: performSwap });
        } else {
            performSwap();
        }
    };

    const handleTogglePin = (studentId: string, row: number, col: number, seat: number) => {
        const student = chart.students.find(s => s.id === studentId);
        if (!student) return;

        const isCurrentlyPinned = student.constraints.allowedRows?.length === 1 && 
                                 student.constraints.allowedRows[0] === row &&
                                 student.constraints.allowedCols?.length === 1 && 
                                 student.constraints.allowedCols[0] === col &&
                                 student.constraints.allowedSeats?.length === 1 && 
                                 student.constraints.allowedSeats[0] === seat;

        const newConstraints: Constraints = { ...student.constraints };

        if (isCurrentlyPinned) {
            newConstraints.allowedRows = [];
            newConstraints.allowedCols = [];
            newConstraints.allowedSeats = [];
        } else {
            newConstraints.allowedRows = [row];
            newConstraints.allowedCols = [col];
            newConstraints.allowedSeats = [seat];
        }

        const updatedStudents = chart.students.map(s => s.id === student.id ? { ...s, constraints: newConstraints } : s);
        onUpdateChart({ ...chart, students: updatedStudents });
    };

    const handleExportToMake = async () => {
        if (!chart.webhookUrl) {
            toast.error('לא הוגדר URL של Webhook בהגדרות הכיתה');
            return;
        }

        setIsExporting(true);
        const success = await sendToWebhook(chart.webhookUrl, {
            chartId: chart.id,
            className: chart.className,
            layoutType: chart.layoutType,
            students: chart.students.map(s => ({
                id: s.id,
                name: s.name,
                gender: s.gender,
                academicLevel: s.academicLevel,
                behaviorLevel: s.behaviorLevel
            })),
            layout: chart.generatedLayout,
            timestamp: new Date().toISOString()
        });

        setIsExporting(false);
        if (success) {
            toast.success('הנתונים נשלחו בהצלחה ל-Make.com');
        } else {
            toast.error('כשלונו בשליחת הנתונים ל-Make.com');
        }
    };

    const handlePrint = () => {
        const printContent = document.getElementById('printable-area');
        if (!printContent) {
            toast.error('לא נמצאה המפה להדפסה.');
            return;
        }

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            toast.error('הדפדפן חסם את פתיחת חלון ההדפסה. אנא אפשר פופ-אפים לאתר זה.');
            return;
        }

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
                            setTimeout(() => {
                                window.focus();
                                window.print();
                                window.onfocus = () => {};
                            }, 500);
                        };
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    return (
        <div className="w-full flex flex-col items-center animate-fade-in flex-grow overflow-y-auto printable-container-wrapper pb-20">
            <div className="w-full max-w-7xl px-4 py-4 flex flex-wrap justify-center items-center gap-4 print-hidden">
                <div className="flex gap-2 bg-white p-1 rounded-xl shadow-sm border border-slate-200">
                    <button 
                        onClick={() => setViewMode('teacher')}
                        className={`py-3 px-5 md:px-8 rounded-lg font-bold transition-all text-sm md:text-base active:scale-95 ${viewMode === 'teacher' ? 'bg-teal-600 text-white shadow-md' : 'text-teal-700 hover:bg-teal-50'}`}
                    >
                        למורה
                    </button>
                    <button 
                        onClick={() => setViewMode('student')}
                        className={`py-3 px-5 md:px-8 rounded-lg font-bold transition-all text-sm md:text-base active:scale-95 ${viewMode === 'student' ? 'bg-teal-600 text-white shadow-md' : 'text-teal-700 hover:bg-teal-50'}`}
                    >
                        לתלמידים
                    </button>
                </div>

                <div className="flex flex-wrap justify-center gap-3">
                    {isAdmin && chart.webhookUrl && (
                        <button 
                            onClick={handleExportToMake}
                            disabled={isExporting}
                            className="py-3 px-5 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-sm disabled:opacity-50 active:scale-95"
                        >
                            {isExporting ? (
                                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                                </svg>
                            )}
                            שלח ל-Make
                        </button>
                    )}

                    <button 
                        onClick={handlePrint}
                        className="py-3 px-5 bg-slate-800 text-white rounded-lg font-bold hover:bg-slate-900 transition-all flex items-center gap-2 shadow-sm active:scale-95"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                        </svg>
                        הדפס מפה
                    </button>
                </div>

                {viewMode === 'teacher' && onClearPins && chart.students.some(s => s.constraints.allowedRows?.length === 1) && (
                    <button 
                        onClick={onClearPins}
                        className="py-3 px-5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg font-bold hover:bg-amber-100 transition-all flex items-center gap-2 active:scale-95"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        בטל את כל הנעיצות
                    </button>
                )}
            </div>

            {chart.layoutType === 'rows' ? (
                <ClassroomGrid 
                    chart={chart} 
                    onEditStudent={handleOpenStudentModal} 
                    onStudentSwap={handleStudentSwap}
                    onStudentMove={handleStudentMove} 
                    onTogglePin={handleTogglePin}
                    showConstraints={viewMode === 'teacher'}
                    isStudentView={viewMode === 'student'}
                />
            ) : (
                <GroupDisplay 
                    chart={chart} 
                    onEditStudent={handleOpenStudentModal} 
                    onStudentSwap={handleGroupStudentSwap} 
                    showConstraints={viewMode === 'teacher'}
                    isStudentView={viewMode === 'student'}
                />
            )}
            {studentToEdit && (
                <StudentModal 
                    student={studentToEdit}
                    chart={chart}
                    onClose={handleCloseModal}
                    onSave={handleSaveStudent}
                />
            )}
            {swapConflict && (
                <SwapConflictModal
                    violations={swapConflict.violations}
                    onConfirm={swapConflict.onConfirm}
                    onCancel={() => setSwapConflict(null)}
                />
            )}
        </div>
    );
};

export default ResultScreen;
