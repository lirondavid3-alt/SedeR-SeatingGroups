

import React, { useState, useEffect, useRef } from 'react';
import { Student, Chart, RowsLayoutDetails, Constraints } from '../../types';
import { UserIcon } from '../icons';
import { DEFAULT_STUDENT_CONSTRAINTS } from '../../constants';


const MultiSelectDropdown: React.FC<{
    label: string;
    options: { value: number; label: string }[];
    selectedValues: number[] | null;
    onChange: (values: number[] | null) => void;
}> = ({ label, options, selectedValues, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [ref]);

    const handleOptionChange = (isChecked: boolean, value: number) => {
        const currentValues = Array.isArray(selectedValues) ? selectedValues : [];
        let newValues;
        if (isChecked) {
            newValues = [...currentValues, value].sort((a,b) => a-b);
        } else {
            newValues = currentValues.filter(v => v !== value);
        }
        onChange(newValues.length === 0 ? null : newValues);
    };

    const handleAnyChange = (isChecked: boolean) => {
        onChange(isChecked ? null : []);
    };
    
    const summary = selectedValues === null ? 'לא משנה' : selectedValues.length > 0 ? `${selectedValues.length} נבחרו` : 'לא נבחר';

    return (
        <div className="relative" ref={ref}>
            <label className="font-medium text-slate-600 block mb-1">{label}</label>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full text-right p-2 border rounded-md bg-white flex justify-between items-center"
            >
                <span>{summary}</span>
                <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
            </button>
            {isOpen && (
                <div className="absolute z-20 w-full mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto">
                    <div className="p-2 border-b">
                        <label className="flex items-center">
                            <input type="checkbox" checked={selectedValues === null} onChange={(e) => handleAnyChange(e.target.checked)} className="ml-2"/>
                            <span>לא משנה</span>
                        </label>
                    </div>
                    <div className="p-2">
                        {options.map(option => (
                            <label key={option.value} className="flex items-center">
                                <input
                                    type="checkbox"
                                    checked={selectedValues?.includes(option.value) ?? false}
                                    onChange={(e) => handleOptionChange(e.target.checked, option.value)}
                                    disabled={selectedValues === null}
                                    className="ml-2"
                                />
                                <span>{option.label}</span>
                            </label>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};


interface StudentModalProps {
    student: Student;
    chart: Chart;
    onClose: () => void;
    onSave: (student: Student) => void;
}

const StudentModal: React.FC<StudentModalProps> = ({ student, chart, onClose, onSave }) => {
    const [editedStudent, setEditedStudent] = useState<Student>(student);

    useEffect(() => {
        setEditedStudent(student);
    }, [student]);

    const otherStudents = chart.students.filter(s => s.id !== student.id);
    const isRowsLayout = chart.layoutType === 'rows';
    const rowsLayoutDetails = isRowsLayout ? chart.layoutDetails as RowsLayoutDetails : null;
    const studentConstraints = { ...DEFAULT_STUDENT_CONSTRAINTS, ...(editedStudent.constraints || {}) };

    const handleConstraintChange = (constraintUpdates: Partial<Constraints>) => {
        setEditedStudent(prev => ({
            ...prev,
            constraints: { ...studentConstraints, ...constraintUpdates },
        }));
    };
    
    const handleMultiSelectChange = (key: 'sitWith' | 'dontSitWith', studentId: string, isChecked: boolean) => {
        setEditedStudent(prev => {
            const currentList = prev.constraints[key] || [];
            const newList = isChecked 
                ? [...currentList, studentId]
                : currentList.filter(id => id !== studentId);
            return { ...prev, constraints: { ...prev.constraints, [key]: newList } };
        });
    };

    const handlePictureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const reader = new FileReader();
            reader.onload = (event) => {
                setEditedStudent(prev => ({ ...prev, picture: event.target?.result as string }));
            };
            reader.readAsDataURL(e.target.files[0]);
        }
    };

    const handleClearConstraints = () => {
        setEditedStudent(prev => ({
            ...prev,
            constraints: { ...DEFAULT_STUDENT_CONSTRAINTS }
        }));
    };
    
    const handleSave = () => {
        const newConstraints = { ...DEFAULT_STUDENT_CONSTRAINTS, ...editedStudent.constraints };
        const getStudent = (id: string) => chart.students.find(s => s.id === id);

        // --- START: ROBUST CONFLICT VALIDATION ---

        // Conflict 1: Sit alone but also sit with someone.
        if (newConstraints.sitAlone && newConstraints.sitWith.length > 0) {
            const partner = getStudent(newConstraints.sitWith[0]);
            alert(`התנגשות העדפות: הגדרת ש"${editedStudent.name}" חייב/ת לשבת לבד, אך גם ביקשת שישב/תשב עם "${partner?.name}".`);
            return;
        }
        
        // Conflict 2: Sit with vs Don't Sit with (internal to this student)
        for (const sitWithId of newConstraints.sitWith) {
            if (newConstraints.dontSitWith.includes(sitWithId)) {
                const partner = getStudent(sitWithId);
                alert(`התנגשות העדפות: הגדרת ש"${editedStudent.name}" ישב/תשב עם "${partner?.name}", אך גם הגדרת שאסור לו/לה לשבת איתו/איתה.`);
                return;
            }
        }

        // Conflict 3: Symmetrical checks against partners' constraints
        for (const sitWithId of newConstraints.sitWith) {
            const partner = getStudent(sitWithId);
            if (partner) {
                const partnerConstraints = { ...DEFAULT_STUDENT_CONSTRAINTS, ...partner.constraints };
                if (partnerConstraints.sitAlone) {
                    alert(`התנגשות העדפות: הגדרת ש"${editedStudent.name}" ישב/תשב עם "${partner.name}", אבל "${partner.name}" מוגדר/ת כ"חייב/ת לשבת לבד".`);
                    return;
                }
                if (partnerConstraints.dontSitWith.includes(editedStudent.id)) {
                    alert(`התנגשות העדפות: "${partner.name}" מוגדר/ת לא לשבת עם "${editedStudent.name}". לא ניתן לשמור את ההעדפה ההפוכה.`);
                    return;
                }
            }
        }
        
        for (const dontSitWithId of newConstraints.dontSitWith) {
            const partner = getStudent(dontSitWithId);
            if (partner) {
                const partnerConstraints = { ...DEFAULT_STUDENT_CONSTRAINTS, ...partner.constraints };
                if (partnerConstraints.sitWith.includes(editedStudent.id)) {
                    alert(`התנגשות העדפות: "${partner.name}" מוגדר/ת לשבת עם "${editedStudent.name}". לא ניתן לשמור את ההעדפה ההפוכה.`);
                    return;
                }
            }
        }
        // --- END: ROBUST CONFLICT VALIDATION ---
        
        const isFixedSeat = newConstraints.allowedRows?.length === 1 &&
                            newConstraints.allowedCols?.length === 1 &&
                            newConstraints.allowedSeats?.length === 1;

        if (isFixedSeat) {
            const fixedRow = newConstraints.allowedRows![0];
            const fixedCol = newConstraints.allowedCols![0];
            const fixedSeat = newConstraints.allowedSeats![0];

            const conflictingStudent = chart.students.find(s => {
                if (s.id === editedStudent.id) return false;

                const otherConstraints = { ...DEFAULT_STUDENT_CONSTRAINTS, ...s.constraints };
                const isOtherFixed = otherConstraints.allowedRows?.length === 1 &&
                                     otherConstraints.allowedCols?.length === 1 &&
                                     otherConstraints.allowedSeats?.length === 1;

                if (isOtherFixed) {
                    return otherConstraints.allowedRows![0] === fixedRow &&
                           otherConstraints.allowedCols![0] === fixedCol &&
                           otherConstraints.allowedSeats![0] === fixedSeat;
                }
                return false;
            });

            if (conflictingStudent) {
                alert(`המקום שבחרת (שורה ${fixedRow}, טור ${fixedCol}, כיסא ${fixedSeat}) כבר שובץ לתלמיד/ה ${conflictingStudent.name}. אנא בחר/י מקום אחר.`);
                return;
            }
        }
        
        onSave(editedStudent);
    };

    const maxRows = rowsLayoutDetails ? Math.max(0, ...rowsLayoutDetails.columnConfiguration) : 0;
    const numCols = rowsLayoutDetails ? rowsLayoutDetails.columnConfiguration.length : 0;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fade-in">
                 <div className="flex flex-col items-center mb-6">
                    <h2 className="text-2xl font-bold mb-2 text-slate-800">{editedStudent.name}</h2>
                    {editedStudent.picture ? <img src={editedStudent.picture} alt={editedStudent.name} className="w-24 h-24 rounded-full object-cover my-2 ring-2 ring-sky-400" /> : <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center my-2 ring-2 ring-gray-300"><UserIcon className="w-12 h-12 text-gray-500" /></div>}
                    <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-1 px-3 rounded-md text-sm">
                        העלאת תמונה <input type="file" className="hidden" accept="image/*" onChange={handlePictureUpload} />
                    </label>
                </div>

                <div className="space-y-6">
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="font-medium text-slate-600 block mb-2">מגדר</label>
                            <select value={editedStudent.gender} onChange={(e) => setEditedStudent(prev => ({ ...prev, gender: e.target.value as any }))} className="w-full p-2 border rounded-md bg-white">
                                <option value="">לא נבחר</option>
                                <option value="זכר">זכר</option>
                                <option value="נקבה">נקבה</option>
                            </select>
                        </div>
                         <div>
                            <label className="font-medium text-slate-600 block mb-2">רמת לימוד</label>
                            <select 
                                value={editedStudent.academicLevel || 0} 
                                onChange={(e) => setEditedStudent(prev => ({ ...prev, academicLevel: parseInt(e.target.value, 10) || undefined }))} 
                                className="w-full p-2 border rounded-md bg-white"
                            >
                                <option value="0">לא נבחר</option>
                                <option value="1">1 (נמוכה מאוד)</option>
                                <option value="2">2 (נמוכה)</option>
                                <option value="3">3 (ממוצעת)</option>
                                <option value="4">4 (גבוהה)</option>
                                <option value="5">5 (גבוהה מאוד)</option>
                            </select>
                        </div>
                         <div>
                            <label className="font-medium text-slate-600 block mb-2">התנהגות</label>
                            <select 
                                value={editedStudent.behaviorLevel || 0} 
                                onChange={(e) => setEditedStudent(prev => ({ ...prev, behaviorLevel: parseInt(e.target.value, 10) || undefined }))} 
                                className="w-full p-2 border rounded-md bg-white"
                            >
                                <option value="0">לא נבחר</option>
                                <option value="1">1 (מאתגרת מאוד)</option>
                                <option value="2">2 (מאתגרת)</option>
                                <option value="3">3 (רגילה)</option>
                                <option value="4">4 (טובה)</option>
                                <option value="5">5 (טובה מאוד)</option>
                            </select>
                        </div>
                    </div>

                    {isRowsLayout && rowsLayoutDetails && (
                        <div>
                            <h3 className="font-bold text-lg mb-3 text-teal-700 border-b pb-2">העדפות מיקום</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-2">
                                <MultiSelectDropdown 
                                    label="שורות מועדפות"
                                    options={Array.from({ length: maxRows }, (_, i) => ({ value: i + 1, label: `שורה ${i + 1}` }))}
                                    selectedValues={studentConstraints.allowedRows}
                                    onChange={(values) => handleConstraintChange({ allowedRows: values })}
                                />
                                <MultiSelectDropdown 
                                    label="טורים מועדפים"
                                    options={Array.from({ length: numCols }, (_, i) => ({ value: i + 1, label: `טור ${i + 1}` }))}
                                    selectedValues={studentConstraints.allowedCols}
                                    onChange={(values) => handleConstraintChange({ allowedCols: values })}
                                />
                                <MultiSelectDropdown 
                                    label="מיקום בשולחן"
                                    options={[{ value: 1, label: '1 (ימין)' }, { value: 2, label: '2 (שמאל)' }]}
                                    selectedValues={studentConstraints.allowedSeats}
                                    onChange={(values) => handleConstraintChange({ allowedSeats: values })}
                                />
                            </div>
                            <div className="flex items-center p-3 mt-2 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer" onClick={() => handleConstraintChange({ sitAlone: !studentConstraints.sitAlone })}>
                                <input type="checkbox" id="sitAlone" checked={studentConstraints.sitAlone} onChange={(e) => handleConstraintChange({ sitAlone: e.target.checked })} className="h-6 w-6 text-sky-600 rounded border-slate-300" />
                                <label htmlFor="sitAlone" className="mr-3 font-medium text-slate-700 cursor-pointer flex-1 py-1">חייב לשבת לבד</label>
                            </div>
                        </div>
                    )}

                    <div>
                        <h3 className="font-bold text-lg mb-2 text-teal-700 border-b pb-2">העדפות חברתיות</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                            {(['sitWith', 'dontSitWith'] as const).map(key => (
                                <div key={key}>
                                    <label className="font-medium text-slate-600 block mb-2">{isRowsLayout ? {sitWith:'מומלץ לשבת ליד', dontSitWith:'לא מומלץ לשבת ליד'}[key] : {sitWith:'חשוב להיות בקבוצה עם', dontSitWith:'אסור להיות בקבוצה עם'}[key]}</label>
                                    <div className="space-y-2 max-h-32 overflow-y-auto border rounded-md p-2 bg-white">
                                        {otherStudents.map(s => (
                                            <label key={s.id} className="flex items-center text-sm p-2 hover:bg-slate-50 rounded-md cursor-pointer transition-colors">
                                                <input 
                                                    type="checkbox" 
                                                    checked={(studentConstraints[key] || []).includes(s.id)} 
                                                    onChange={(e) => handleMultiSelectChange(key, s.id, e.target.checked)} 
                                                    className="h-5 w-5 text-teal-600 rounded border-slate-300" 
                                                />
                                                <span className="mr-3 flex-1 py-1">{s.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="mt-8 flex justify-between items-center">
                    <button 
                        type="button" 
                        onClick={handleClearConstraints} 
                        className="py-2 px-4 bg-amber-100 text-amber-800 rounded-md hover:bg-amber-200 font-semibold text-sm"
                    >
                        נקה את כל ההעדפות
                    </button>
                    <div className="space-x-3 space-x-reverse">
                        <button onClick={onClose} className="py-2 px-4 bg-slate-200 text-slate-700 rounded-md hover:bg-slate-300">ביטול</button>
                        <button onClick={handleSave} className="py-2 px-4 bg-sky-500 text-white rounded-md hover:bg-sky-600">שמירה</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StudentModal;