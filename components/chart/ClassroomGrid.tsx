import React, { useState } from 'react';
import { Chart, GeneratedRowsLayout, RowsLayoutDetails, Student } from '../../types';
import { DoorIcon, WindowIcon, UserIcon, MaleIcon, FemaleIcon, PinIcon } from '../icons';

interface RatingIndicatorProps {
    type: 'academic' | 'behavior';
    level: number;
}

const RatingIndicator: React.FC<RatingIndicatorProps> = ({ type, level }) => {
    const label = type === 'academic' ? 'למידה:' : 'התנהגות:';
    const title = `${type === 'academic' ? 'רמת למידה' : 'רמת התנהגות'}: ${level} מתוך 5`;

    const levelTextColorMap: { [key: number]: string } = {
        1: 'text-red-500',
        2: 'text-orange-500',
        3: 'text-amber-500',
        4: 'text-green-600',
        5: 'text-sky-600',
    };
    
    const colorClass = levelTextColorMap[level] || 'text-gray-400';

    return (
        <div className="flex items-center gap-1" title={title}>
            <span className="text-[10px] font-medium text-slate-500 w-12 text-right">{label}</span>
            <span className={`text-[11px] font-bold ${colorClass}`}>{level}</span>
        </div>
    );
};


interface ClassroomGridProps {
    chart: Chart;
    onEditStudent: (studentId: string) => void;
    onTogglePin?: (studentId: string, row: number, col: number, seat: number) => void;
    onStudentSwap: (
        draggedInfo: { studentId: string; row: number; col: number; seat: number },
        droppedInfo: { studentId: string; row: number; col: number; seat: number }
    ) => void;
    onStudentMove: (
        draggedInfo: { studentId: string; row: number; col: number; seat: number },
        droppedInfo: { row: number; col: number; seat: number }
    ) => void;
    showConstraints?: boolean;
    isStudentView?: boolean;
}

interface StudentDisplayProps {
    student: Student | null | undefined;
    isPinned?: boolean;
    onTogglePin?: (e: React.MouseEvent) => void;
    showConstraints?: boolean;
    isStudentView?: boolean;
    seatNumber?: number;
}

const StudentDisplay: React.FC<StudentDisplayProps> = ({ student, isPinned, onTogglePin, showConstraints = true, isStudentView = false, seatNumber }) => {
    const genderColor = student?.gender === 'זכר' ? 'text-sky-600' : student?.gender === 'נקבה' ? 'text-pink-500' : 'text-slate-800';

    return (
        <div className={`w-full h-full flex flex-col items-center ${isStudentView ? 'justify-center' : 'justify-start'} pt-0 relative`}>
            {student ? (
                <>
                    {!isStudentView && (
                        <div className={`absolute ${seatNumber === 1 ? 'top-0 left-0' : 'top-0 right-0'} z-20`}>
                             {student.gender === 'זכר' && <MaleIcon title="זכר" className="h-3.5 w-3.5 text-sky-500" />}
                             {student.gender === 'נקבה' && <FemaleIcon title="נקבה" className="h-3.5 w-3.5 text-pink-500" />}
                        </div>
                    )}
                    {onTogglePin && showConstraints && !isStudentView && (
                        <button 
                            onClick={onTogglePin}
                            className={`absolute ${seatNumber === 1 ? 'top-5 right-0' : 'top-5 left-0'} p-0.5 rounded-full transition-all shadow-sm z-20 ${isPinned ? 'bg-amber-500 text-white' : 'bg-white/80 text-slate-400 hover:text-slate-600 hover:bg-white'}`}
                            title={isPinned ? "התלמיד נעוץ למקום זה (לחץ לביטול)" : "נעץ תלמיד זה למקום הנוכחי"}
                        >
                            <PinIcon className="h-3 w-3" />
                        </button>
                    )}
                    
                    {!isStudentView ? (
                        <>
                            {student.picture ? <img src={student.picture} alt={student.name} className="student-picture w-10 h-10 rounded-full object-cover border border-gray-200"/> : <div className="student-picture w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center border border-gray-200"><UserIcon className='w-6 h-6 text-gray-500' /></div>}
                            <span className={`student-name ${genderColor} text-[11px] font-medium text-center break-words leading-tight mt-0.5 px-0.5`}>{student.name}</span>
                        </>
                    ) : (
                        <div className={`student-name ${genderColor} text-sm font-bold text-center leading-tight px-1 w-full flex flex-col items-center justify-center`}>
                            {student.name.split(' ').length > 1 ? (
                                <>
                                    <span>{student.name.split(' ')[0]}</span>
                                    <span>{student.name.split(' ').slice(1).join(' ')}</span>
                                </>
                            ) : (
                                <span>{student.name}</span>
                            )}
                        </div>
                    )}

                    {showConstraints && !isStudentView && (
                        <div className="flex flex-col items-start mt-auto w-full px-0.5">
                            {student.academicLevel && <RatingIndicator type="academic" level={student.academicLevel} />}
                            {student.behaviorLevel && <RatingIndicator type="behavior" level={student.behaviorLevel} />}
                        </div>
                    )}
                </>
            ) : <div className={`${isStudentView ? 'w-0 h-0' : 'w-10 h-10 rounded-full bg-sky-200/20 mt-2'}`}></div>}
        </div>
    );
};

const ClassroomGrid: React.FC<ClassroomGridProps> = ({ chart, onEditStudent, onTogglePin, onStudentSwap, onStudentMove, showConstraints = true, isStudentView = false }) => {
    const [dragOverInfo, setDragOverInfo] = useState<{ row: number; col: number; seat: number } | null>(null);
    const [selectedStudent, setSelectedStudent] = useState<{ studentId: string; row: number; col: number; seat: number } | null>(null);
    const [scale, setScale] = useState(1);
    const layout = chart.layoutDetails as RowsLayoutDetails;
    const { generatedLayout } = chart;
    const { desks, unplacedStudents } = generatedLayout as GeneratedRowsLayout;
    
    const { columnConfiguration = [], teacherDeskPosition, windowPosition, doorPosition } = layout;
    const numCols = columnConfiguration.length;
    const maxRows = Math.max(0, ...columnConfiguration);

    const handleDragStart = (e: React.DragEvent, studentId: string, row: number, col: number, seat: number) => {
        e.dataTransfer.setData('application/json', JSON.stringify({ studentId, row, col, seat }));
        e.dataTransfer.effectAllowed = 'move';
        
        // Improve visual feedback: set drag image to just the student's avatar/icon
        // This prevents the "dragging two students" visual bug
        const target = e.currentTarget as HTMLElement;
        const dragImage = target.querySelector('.student-picture');
        if (dragImage) {
            // Center the drag image under the cursor
            e.dataTransfer.setDragImage(dragImage, 20, 20);
        }
    };

    const handleDragOver = (e: React.DragEvent, row: number, col: number, seat: number) => {
        e.preventDefault();
        setDragOverInfo({ row, col, seat });
    };

    const handleDragLeave = () => {
        setDragOverInfo(null);
    };

    const handleDropOnStudent = (e: React.DragEvent, droppedOnStudentId: string, row: number, col: number, seat: number) => {
        e.preventDefault();
        setDragOverInfo(null);
        try {
            const draggedInfo = JSON.parse(e.dataTransfer.getData('application/json'));
            if (draggedInfo.studentId === droppedOnStudentId) return;
            
            const droppedInfo = { studentId: droppedOnStudentId, row, col, seat };
            onStudentSwap(draggedInfo, droppedInfo);
        } catch (error) {
            console.error("Failed to parse drag data", error);
        }
    };

    const handleDropOnEmpty = (e: React.DragEvent, row: number, col: number, seat: number) => {
        e.preventDefault();
        setDragOverInfo(null);
        try {
            const draggedInfo = JSON.parse(e.dataTransfer.getData('application/json'));
            const droppedInfo = { row, col, seat };
            onStudentMove(draggedInfo, droppedInfo);
        } catch (error) {
            console.error("Failed to parse drag data", error);
        }
    };

    const handleStudentClick = (studentId: string, row: number, col: number, seat: number) => {
        if (selectedStudent) {
            if (selectedStudent.studentId === studentId) {
                // Deselect if clicking the same student
                setSelectedStudent(null);
            } else {
                // Swap with selected student
                onStudentSwap(selectedStudent, { studentId, row, col, seat });
                setSelectedStudent(null);
            }
        } else {
            // Select student for swapping
            setSelectedStudent({ studentId, row, col, seat });
        }
    };

    const handleEmptyClick = (row: number, col: number, seat: number) => {
        if (selectedStudent) {
            // Move selected student to empty seat
            onStudentMove(selectedStudent, { row, col, seat });
            setSelectedStudent(null);
        }
    };

    const TeacherDesk = () => <div className="bg-teal-600 text-teal-50 flex items-center justify-center rounded-lg shadow-md text-sm font-semibold w-[110px] h-[40px]">שולחן מורה</div>;
    const Door = () => <div className="flex items-center gap-1 text-amber-600 text-sm font-medium"><DoorIcon className="h-8 w-8" /><span>דלת</span></div>;
    const WindowEl = () => <div className="flex items-center gap-1 text-green-600 text-sm font-medium"><WindowIcon className="h-8 w-8" /><span>חלון</span></div>;

    const getStudentById = (id?: string) => id ? chart.students.find(s => s.id === id) : undefined;

    const formattedDateTime = new Date(chart.creationDate).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', ' ');
    
    const SideItems = () => (
        <div className="flex justify-center items-center space-x-6 space-x-reverse">
            <div className="flex items-center space-x-4 space-x-reverse">
                {doorPosition === 'right' && <Door />}
                {windowPosition === 'right' && <WindowEl />}
            </div>
            <TeacherDesk />
            <div className="flex items-center space-x-4 space-x-reverse">
                {doorPosition === 'left' && <Door />}
                {windowPosition === 'left' && <WindowEl />}
            </div>
        </div>
    );

    return (
        <div className="w-full flex flex-col items-center bg-gray-100 p-2 md:p-4 overflow-hidden">
            <div className="w-full max-w-7xl flex justify-between items-center mb-4 px-2 print-hidden">
                <div className="flex items-center gap-2 bg-white p-1 rounded-lg shadow-sm border border-slate-200">
                    <span className="text-xs font-bold text-slate-500 px-2">תצוגה:</span>
                    <button 
                        onClick={() => setScale(Math.max(0.4, scale - 0.1))}
                        className="p-1.5 hover:bg-slate-100 rounded-md text-slate-600 transition-colors"
                        title="הקטן"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4" />
                        </svg>
                    </button>
                    <span className="text-sm font-mono font-bold text-teal-600 min-w-[3rem] text-center">{Math.round(scale * 100)}%</span>
                    <button 
                        onClick={() => setScale(Math.min(1.5, scale + 0.1))}
                        className="p-1.5 hover:bg-slate-100 rounded-md text-slate-600 transition-colors"
                        title="הגדל"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                        </svg>
                    </button>
                    <button 
                        onClick={() => setScale(1)}
                        className="p-1.5 hover:bg-slate-100 rounded-md text-slate-400 hover:text-teal-600 transition-colors"
                        title="איפוס"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </button>
                </div>
                
                <div className="hidden md:block text-xs text-slate-400 italic">
                    * ניתן לגרור תלמידים להחלפת מקומות, או ללחוץ על תלמיד אחד ואז על אחר להחלפה.
                </div>
            </div>

            <div className="w-full overflow-auto flex justify-center pb-8">
                <div 
                    id="printable-area" 
                    className="bg-white shadow-xl p-4 md:p-8 rounded-xl w-fit min-w-max flex flex-col items-center origin-top transition-transform duration-200 ease-out"
                    style={{ transform: `scale(${scale})` }}
                >
                    <div className="text-center mb-6">
                        <h1 className="text-2xl font-bold text-teal-900">{chart.className}</h1>
                        <span className="text-sm text-teal-700 font-normal">{formattedDateTime}</span>
                    </div>

                    <div className="flex flex-col items-center mt-2">
                        {teacherDeskPosition === 'top' && <div className="mb-8 w-full flex justify-center"><SideItems /></div>}
                        
                        <div className="classroom-grid inline-grid gap-x-3 gap-y-4" style={{ gridTemplateColumns: `auto repeat(${numCols}, minmax(145px, 1fr))`}}>
                            <div /> 
                            {Array.from({ length: numCols }).map((_, i) => <div key={i} className="column-header text-center font-bold text-teal-800 text-lg">טור {i + 1}</div>)}
                            
                            {Array.from({ length: maxRows }).map((_, rowIndex) => (
                                <React.Fragment key={rowIndex}>
                                    <div className="row-label text-center font-bold text-teal-800 text-lg flex items-center justify-center min-w-[5rem]">שורה {teacherDeskPosition === 'bottom' ? maxRows - rowIndex : rowIndex + 1}</div>
                                    {Array.from({ length: numCols }).map((_, colIndex) => {
                                        const physicalRow = rowIndex + 1;
                                        const deskCol = colIndex + 1;
                                        const rowsInThisCol = columnConfiguration[colIndex];
                                        
                                        let deskRelativeRow;
                                        if (teacherDeskPosition === 'top') {
                                            deskRelativeRow = physicalRow;
                                        } else {
                                            deskRelativeRow = maxRows + 1 - physicalRow;
                                        }
                                        
                                        const shouldRenderDesk = deskRelativeRow <= rowsInThisCol;

                                        if (!shouldRenderDesk) {
                                            return <div key={colIndex} className="w-[145px] h-[80px]" aria-hidden="true"></div>;
                                        }

                                        const desk = desks?.find(d => d.row === deskRelativeRow && d.col === deskCol);
                                        const student1 = desk?.students.find(s => s.seat === 1);
                                        const student2 = desk?.students.find(s => s.seat === 2);
                                        
                                        const isDragOverSeat1 = dragOverInfo?.row === deskRelativeRow && dragOverInfo?.col === deskCol && dragOverInfo?.seat === 1;
                                        const isDragOverSeat2 = dragOverInfo?.row === deskRelativeRow && dragOverInfo?.col === deskCol && dragOverInfo?.seat === 2;
                                        
                                        const isSelectedSeat1 = selectedStudent?.row === deskRelativeRow && selectedStudent?.col === deskCol && selectedStudent?.seat === 1;
                                        const isSelectedSeat2 = selectedStudent?.row === deskRelativeRow && selectedStudent?.col === deskCol && selectedStudent?.seat === 2;

                                        const getIsPinned = (s: Student | undefined, seat: number) => {
                                            if (!s) return false;
                                            const c = s.constraints;
                                            return c.allowedRows?.length === 1 && c.allowedRows[0] === deskRelativeRow &&
                                                   c.allowedCols?.length === 1 && c.allowedCols[0] === deskCol &&
                                                   c.allowedSeats?.length === 1 && c.allowedSeats[0] === seat;
                                        };

                                        return (
                                            <div key={colIndex} className="desk-container bg-white rounded-lg shadow-lg border-2 border-sky-400 overflow-hidden relative w-[145px] h-[80px]">
                                                <div className="seat-number absolute top-1 right-1 bg-sky-500 text-white text-[10px] font-bold rounded px-1 py-0.5 z-10">1</div>
                                                <div className="seat-number absolute top-1 left-1 bg-sky-500 text-white text-[10px] font-bold rounded px-1 py-0.5 z-10">2</div>
                                                <div className="flex h-full">
                                                    <div className="w-1/2 border-l border-sky-300">
                                                        {student1 ? (
                                                            <div 
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleStudentClick(student1.id, deskRelativeRow, deskCol, 1);
                                                                }} 
                                                                className={`w-full h-full relative text-left transition-colors duration-200 cursor-pointer rounded-r-md ${isDragOverSeat1 ? 'bg-sky-200' : isSelectedSeat1 ? 'bg-amber-100 ring-2 ring-amber-400 z-10' : 'hover:bg-sky-100'}`}
                                                                draggable="true"
                                                                onDragStart={(e) => handleDragStart(e, student1.id, deskRelativeRow, deskCol, 1)}
                                                                onDragOver={(e) => handleDragOver(e, deskRelativeRow, deskCol, 1)}
                                                                onDragLeave={handleDragLeave}
                                                                onDrop={(e) => handleDropOnStudent(e, student1.id, deskRelativeRow, deskCol, 1)}
                                                                role="button"
                                                                tabIndex={0}
                                                                onKeyDown={(e) => e.key === 'Enter' && onEditStudent(student1.id)}
                                                            >
                                                                <StudentDisplay 
                                                                    student={getStudentById(student1.id)} 
                                                                    isPinned={getIsPinned(getStudentById(student1.id), 1)}
                                                                    onTogglePin={onTogglePin ? (e) => { e.stopPropagation(); onTogglePin(student1.id, deskRelativeRow, deskCol, 1); } : undefined}
                                                                    showConstraints={showConstraints}
                                                                    isStudentView={isStudentView}
                                                                    seatNumber={1}
                                                                />
                                                                {!isStudentView && (
                                                                    <div className="absolute top-5 left-0 z-30">
                                                                        <button 
                                                                            onClick={(e) => { e.stopPropagation(); onEditStudent(student1.id); }}
                                                                            className="p-0.5 bg-white/80 rounded-full text-slate-400 hover:text-teal-600 shadow-sm"
                                                                            title="ערוך פרטי תלמיד"
                                                                        >
                                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                                            </svg>
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div
                                                                className={`w-full h-full flex items-center justify-center transition-colors duration-200 rounded-r-md cursor-pointer ${isDragOverSeat1 ? 'bg-sky-200' : 'hover:bg-sky-50'}`}
                                                                onDragOver={(e) => handleDragOver(e, deskRelativeRow, deskCol, 1)}
                                                                onDragLeave={handleDragLeave}
                                                                onDrop={(e) => handleDropOnEmpty(e, deskRelativeRow, deskCol, 1)}
                                                                onClick={() => handleEmptyClick(deskRelativeRow, deskCol, 1)}
                                                            >
                                                                <StudentDisplay student={null} />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="w-1/2">
                                                        {student2 ? (
                                                            <div 
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleStudentClick(student2.id, deskRelativeRow, deskCol, 2);
                                                                }} 
                                                                className={`w-full h-full relative text-left transition-colors duration-200 cursor-pointer rounded-l-md ${isDragOverSeat2 ? 'bg-sky-200' : isSelectedSeat2 ? 'bg-amber-100 ring-2 ring-amber-400 z-10' : 'hover:bg-sky-100'}`}
                                                                draggable="true"
                                                                onDragStart={(e) => handleDragStart(e, student2.id, deskRelativeRow, deskCol, 2)}
                                                                onDragOver={(e) => handleDragOver(e, deskRelativeRow, deskCol, 2)}
                                                                onDragLeave={handleDragLeave}
                                                                onDrop={(e) => handleDropOnStudent(e, student2.id, deskRelativeRow, deskCol, 2)}
                                                                role="button"
                                                                tabIndex={0}
                                                                onKeyDown={(e) => e.key === 'Enter' && onEditStudent(student2.id)}
                                                            >
                                                                <StudentDisplay 
                                                                    student={getStudentById(student2.id)} 
                                                                    isPinned={getIsPinned(getStudentById(student2.id), 2)}
                                                                    onTogglePin={onTogglePin ? (e) => { e.stopPropagation(); onTogglePin(student2.id, deskRelativeRow, deskCol, 2); } : undefined}
                                                                    showConstraints={showConstraints}
                                                                    isStudentView={isStudentView}
                                                                    seatNumber={2}
                                                                />
                                                                {!isStudentView && (
                                                                    <div className="absolute top-5 right-0 z-30">
                                                                        <button 
                                                                            onClick={(e) => { e.stopPropagation(); onEditStudent(student2.id); }}
                                                                            className="p-0.5 bg-white/80 rounded-full text-slate-400 hover:text-teal-600 shadow-sm"
                                                                            title="ערוך פרטי תלמיד"
                                                                        >
                                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                                            </svg>
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div
                                                                className={`w-full h-full flex items-center justify-center transition-colors duration-200 rounded-l-md cursor-pointer ${isDragOverSeat2 ? 'bg-sky-200' : 'hover:bg-sky-50'}`}
                                                                onDragOver={(e) => handleDragOver(e, deskRelativeRow, deskCol, 2)}
                                                                onDragLeave={handleDragLeave}
                                                                onDrop={(e) => handleDropOnEmpty(e, deskRelativeRow, deskCol, 2)}
                                                                onClick={() => handleEmptyClick(deskRelativeRow, deskCol, 2)}
                                                            >
                                                                <StudentDisplay student={null} />
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </React.Fragment>
                            ))}
                        </div>

                        {teacherDeskPosition === 'bottom' && <div className="mt-8 w-full flex justify-center"><SideItems /></div>}
                    </div>

                    {unplacedStudents && unplacedStudents.length > 0 && (
                        <div className="mt-12 pt-6 border-t-2 border-dashed border-slate-200 w-full">
                            <h3 className="text-xl font-bold text-rose-600 mb-4 text-center">תלמידים שלא שובצו:</h3>
                            <div className="flex flex-wrap gap-3 justify-center">
                                {unplacedStudents.map(s => (
                                    <div 
                                        key={s.id} 
                                        className={`bg-rose-50 border rounded-xl p-3 shadow-sm flex items-center gap-3 transition-all ${isStudentView ? 'cursor-default border-rose-200' : 'cursor-move hover:shadow-md border-rose-200'} ${selectedStudent?.studentId === s.id ? 'ring-2 ring-rose-500 bg-rose-100' : ''}`}
                                        draggable={!isStudentView}
                                        onDragStart={(e) => !isStudentView && handleDragStart(e, s.id, -1, -1, -1)}
                                        onClick={() => !isStudentView && handleStudentClick(s.id, -1, -1, -1)}
                                        title={showConstraints ? s.reason : ''}
                                    >
                                        {!isStudentView && (
                                            <div className="student-picture w-10 h-10 rounded-full bg-rose-200 flex items-center justify-center text-rose-700 font-bold text-lg">
                                                {s.name.charAt(0)}
                                            </div>
                                        )}
                                        <div className="flex flex-col flex-grow">
                                            {isStudentView ? (
                                                <div className="text-lg font-bold text-rose-900 leading-tight flex flex-col">
                                                    {s.name.split(' ').length > 1 ? (
                                                        <>
                                                            <span>{s.name.split(' ')[0]}</span>
                                                            <span>{s.name.split(' ').slice(1).join(' ')}</span>
                                                        </>
                                                    ) : (
                                                        <span>{s.name}</span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-sm font-bold text-rose-900">{s.name}</span>
                                            )}
                                            {showConstraints && <span className="text-[10px] text-rose-600 max-w-[150px] leading-tight">{s.reason}</span>}
                                        </div>
                                        {!isStudentView && (
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); onEditStudent(s.id); }}
                                                className="p-1 bg-white/80 rounded-full text-slate-400 hover:text-teal-600 shadow-sm"
                                                title="ערוך פרטי תלמיד"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ClassroomGrid;
