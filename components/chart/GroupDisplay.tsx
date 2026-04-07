import React, { useState } from 'react';
import { Chart, GeneratedGroupsLayout, Student } from '../../types';
import { UserIcon, MaleIcon, FemaleIcon } from '../icons';

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
        <div className="flex items-center gap-1.5" title={title}>
            <span className="text-xs font-medium text-slate-600 w-12 text-right">{label}</span>
            <span className={`text-sm font-bold ${colorClass}`}>{level}</span>
        </div>
    );
};

interface GroupDisplayProps {
    chart: Chart;
    onEditStudent: (studentId: string) => void;
    onStudentSwap: (draggedStudentId: string, droppedStudentId: string) => void;
    showConstraints?: boolean;
    isStudentView?: boolean;
}

const GroupDisplay: React.FC<GroupDisplayProps> = ({ chart, onEditStudent, onStudentSwap, showConstraints = true, isStudentView = false }) => {
    const { generatedLayout } = chart;
    const { groups, unplacedStudents } = generatedLayout as GeneratedGroupsLayout;
    const [dragOverStudent, setDragOverStudent] = useState<string | null>(null); // studentId
    const [selectedStudent, setSelectedStudent] = useState<string | null>(null); // studentId
    const [scale, setScale] = useState(1);
    
    if (!groups) {
        return <div className="text-center p-8"><p className="text-lg text-red-600">שגיאה: לא נמצאו קבוצות</p></div>;
    }

    const handleDragStart = (e: React.DragEvent<HTMLElement>, studentId: string) => {
        if (isStudentView) return;
        e.dataTransfer.setData('studentId', studentId);
        e.dataTransfer.effectAllowed = 'move';
        
        // Improve visual feedback: set drag image to just the student's avatar/icon
        const target = e.currentTarget as HTMLElement;
        const dragImage = target.querySelector('.student-picture');
        if (dragImage) {
            // Center the drag image under the cursor
            e.dataTransfer.setDragImage(dragImage, 24, 24);
        }
    };

    const handleDragOver = (e: React.DragEvent<HTMLElement>, studentId: string) => {
        if (isStudentView) return;
        e.preventDefault();
        setDragOverStudent(studentId);
    };

    const handleDragLeave = () => {
        setDragOverStudent(null);
    };

    const handleDrop = (e: React.DragEvent<HTMLElement>, droppedStudentId: string) => {
        if (isStudentView) return;
        e.preventDefault();
        setDragOverStudent(null);
        const draggedStudentId = e.dataTransfer.getData('studentId');
        
        if (draggedStudentId && draggedStudentId !== droppedStudentId) {
            onStudentSwap(draggedStudentId, droppedStudentId);
        }
    };

    const handleStudentClick = (studentId: string) => {
        if (isStudentView) return;
        if (selectedStudent) {
            if (selectedStudent === studentId) {
                setSelectedStudent(null);
            } else {
                onStudentSwap(selectedStudent, studentId);
                setSelectedStudent(null);
            }
        } else {
            setSelectedStudent(studentId);
        }
    };

    const groupColors = ['border-sky-400', 'border-teal-400', 'border-amber-400', 'border-rose-400', 'border-indigo-400'];

    const formattedDateTime = new Date(chart.creationDate).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', ' ');

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
            </div>

            <div className="w-full overflow-auto flex justify-center pb-8">
                <div 
                    id="printable-area" 
                    className="p-4 md:p-8 bg-white rounded-xl shadow-xl w-fit mx-auto origin-top transition-transform duration-200 ease-out"
                    style={{ transform: `scale(${scale})` }}
                >
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-bold text-slate-800">{chart.className}</h1>
                        <h2 className="text-xl text-slate-500">{formattedDateTime}</h2>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 groups-grid">
                        {groups.sort((a,b) => a.groupNumber - b.groupNumber).map(group => (
                            <div key={group.groupNumber} className={`bg-white rounded-lg shadow-md p-6 border-t-4 ${groupColors[(group.groupNumber - 1) % groupColors.length]}`}>
                                <h3 className="text-2xl font-bold mb-4 text-slate-700">
                                    קבוצה {group.groupNumber}
                                    {group.level && <span className="text-lg font-normal text-slate-500 mr-2">(רמה {group.level})</span>}
                                </h3>
                                <ul className="space-y-3">
                                    {group.students.map(name => {
                                        const student = chart.students.find(s => s.name === name);
                                        if (!student) return null;
                                        const genderColor = student.gender === 'זכר' ? 'text-sky-600' : student.gender === 'נקבה' ? 'text-pink-500' : 'text-slate-800';
                                        return (
                                            <li key={student.id}>
                                                <div 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleStudentClick(student.id);
                                                    }} 
                                                    className={`w-full flex items-center bg-slate-50 p-3 rounded-md shadow-sm text-right transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-sky-500 relative ${isStudentView ? 'cursor-default' : 'hover:bg-sky-100 cursor-pointer'} ${dragOverStudent === student.id ? 'bg-sky-200 ring-2 ring-sky-500 scale-105' : selectedStudent === student.id ? 'bg-amber-100 ring-2 ring-amber-400 z-10 scale-105' : ''}`}
                                                    draggable={!isStudentView}
                                                    onDragStart={(e) => handleDragStart(e, student.id)}
                                                    onDragOver={(e) => handleDragOver(e, student.id)}
                                                    onDragLeave={handleDragLeave}
                                                    onDrop={(e) => handleDrop(e, student.id)}
                                                    role="button"
                                                    tabIndex={isStudentView ? -1 : 0}
                                                    onKeyDown={(e) => {
                                                        if (isStudentView) return;
                                                        if (e.key === 'Enter' || e.key === ' ') {
                                                            e.preventDefault();
                                                            handleStudentClick(student.id);
                                                        }
                                                    }}
                                                >
                                                    {!isStudentView && (
                                                        student.picture ? <img src={student.picture} alt={name} className="student-picture w-12 h-12 rounded-full object-cover mr-3"/> : <div className="student-picture w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center mr-3 flex-shrink-0"><UserIcon className='w-7 h-7 text-gray-500' /></div>
                                                    )}
                                                    <div className={`flex flex-col ${isStudentView ? 'items-center' : 'items-start'} flex-grow`}>
                                                        <div className="flex items-center gap-2">
                                                            {isStudentView ? (
                                                                <div className={`${genderColor} font-bold text-xl text-center leading-tight flex flex-col items-center`}>
                                                                    {name.split(' ').length > 1 ? (
                                                                        <>
                                                                            <span>{name.split(' ')[0]}</span>
                                                                            <span>{name.split(' ').slice(1).join(' ')}</span>
                                                                        </>
                                                                    ) : (
                                                                        <span>{name}</span>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <span className={`${genderColor} font-medium text-lg`}>{name}</span>
                                                            )}
                                                            {!isStudentView && student.gender === 'זכר' && <MaleIcon title="זכר" className="h-5 w-5 text-sky-500" />}
                                                            {!isStudentView && student.gender === 'נקבה' && <FemaleIcon title="נקבה" className="h-5 w-5 text-pink-500" />}
                                                        </div>
                                                        {!isStudentView && (
                                                            <div className="flex flex-col gap-1 mt-1.5 items-start">
                                                                {showConstraints && student.academicLevel && <RatingIndicator type="academic" level={student.academicLevel} />}
                                                                {showConstraints && student.behaviorLevel && <RatingIndicator type="behavior" level={student.behaviorLevel} />}
                                                            </div>
                                                        )}
                                                    </div>
                                                    {!isStudentView && (
                                                        <div className="absolute top-1 left-1 z-30">
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); onEditStudent(student.id); }}
                                                                className="p-1 bg-white/80 rounded-full text-slate-400 hover:text-teal-600 shadow-sm"
                                                                title="ערוך פרטי תלמיד"
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        ))}
                    </div>

                    {unplacedStudents && unplacedStudents.length > 0 && (
                        <div className="mt-12 pt-6 border-t-2 border-dashed border-slate-200 w-full">
                            <h3 className="text-xl font-bold text-rose-600 mb-4 text-center">תלמידים שלא שובצו:</h3>
                            <div className="flex flex-wrap gap-3 justify-center">
                                {unplacedStudents.map(s => (
                                    <div 
                                        key={s.id} 
                                        className="bg-rose-50 border border-rose-200 rounded-xl p-3 shadow-sm flex items-center gap-3"
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

export default GroupDisplay;
