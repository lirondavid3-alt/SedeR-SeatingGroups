

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Chart, Student, RowsLayoutDetails, GeneratedRowsLayout, GroupsLayoutDetails, Constraints, GeneratedLayout, LevelConsiderationOptions } from '../../types';
import { generateId } from '../../utils';
import { DEFAULT_STUDENT_CONSTRAINTS, SUBJECTS, DEFAULT_ROWS_LAYOUT } from '../../constants';
import { PlusIcon, TrashIcon, PencilIcon, CheckIcon, XIcon, SparklesIcon, NoPreferenceIcon, BalancedIcon, PairingIcon, EdgesIcon, CameraIcon } from '../icons';
import ClassroomPreview from '../chart/ClassroomPreview';
import StudentModal from '../modals/StudentModal';
import SmartImportModal from '../modals/SmartImportModal';
import { ExtractedStudent } from '../../services/visionService';
import { generateLayout } from '../../services/layoutService';
import { getAIConstraintUpdates } from '../../services/aiService';
import { toast } from 'sonner';

// --- START: NEW AI CHAT INTERFACE ---
interface ChatMessage {
    id: string;
    type: 'user' | 'ai-success' | 'ai-error';
    text: string;
    appliedUpdates?: { studentId: string; originalStudent: Student }[];
}

interface AIUpdateItem {
    studentName: string;
    academicLevel?: number;
    behaviorLevel?: number;
    constraints?: Partial<{
        sitWith: string[];
        dontSitWith: string[];
        allowedRows: number[] | null;
        allowedCols: number[] | null;
        allowedSeats: number[] | null;
        sitAlone: boolean;
    }>;
}

// Renamed interface to avoid any potential conflict or mis-inference with 'Student' type
interface StudentUpdateDraft {
    academicLevel?: number;
    behaviorLevel?: number;
    constraints?: Partial<Constraints>;
}

const AIConstraintAssistant: React.FC<{
    chart: Chart;
    setChart: (updater: React.SetStateAction<Chart | null>) => void;
}> = ({ chart, setChart }) => {
    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [showHelp, setShowHelp] = useState(false);
    const noStudents = chart.students.length === 0;

    const handleApplySinglePrompt = async () => {
        if (!prompt.trim() || !chart || noStudents) return;
        
        const userMessage: ChatMessage = { id: generateId(), type: 'user', text: prompt };
        setChatHistory(prev => [...prev, userMessage]);
        setPrompt('');
        setIsLoading(true);

        try {
            const aiUpdates = await getAIConstraintUpdates(prompt, chart.students, chart.layoutType, chart.layoutDetails);

            if (!aiUpdates || !aiUpdates.updates || aiUpdates.updates.length === 0) {
                 const errorMessage: ChatMessage = { id: generateId(), type: 'ai-error', text: "הבקשה מכילה סתירה או שלא הצלחתי להבין אותה. אנא נסה/י לנסח מחדש ולשלוח בקשה אחת בכל פעם." };
                 setChatHistory(prev => [...prev, errorMessage]);
                 setIsLoading(false);
                 return;
            }

            const { students: currentStudents } = chart;
            const studentNameMap = new Map<string, Student>(currentStudents.map(s => [s.name.toLowerCase(), s]));

            const findStudentByName = (name: string): Student | undefined => {
                const lowercasedName = name.toLowerCase();
                const exactMatch = studentNameMap.get(lowercasedName);
                if (exactMatch) return exactMatch;

                const potentialMatches = currentStudents.filter(s => s.name.toLowerCase().includes(lowercasedName));
                if (potentialMatches.length === 1) return potentialMatches[0];

                return undefined;
            };
            
            // Explicitly typed student map
            const studentMap = new Map<string, Student>(currentStudents.map(s => [s.id, JSON.parse(JSON.stringify(s)) as Student]));
            
            const appliedUpdates: { studentId: string; originalStudent: Student }[] = [];
            const updatedStudentIds = new Set<string>();
            const unmappedNames = new Set<string>();

            // --- START: ROBUST PRE-APPLICATION VALIDATION ---
            // Use the new interface name to ensure type safety
            const proposedChanges = new Map<string, StudentUpdateDraft>();

            for (const update of aiUpdates.updates as AIUpdateItem[]) {
                if (!update.studentName) continue;

                const student = findStudentByName(update.studentName);
                if (!student) {
                    unmappedNames.add(update.studentName);
                    continue;
                }
                
                if (!proposedChanges.has(student.id)) {
                    // Explicitly type the initial object using the new interface
                    const initialChanges: StudentUpdateDraft = {};
                    proposedChanges.set(student.id, initialChanges);
                }
                const changes = proposedChanges.get(student.id)!;
                
                if (update.academicLevel) changes.academicLevel = update.academicLevel;
                if (update.behaviorLevel) changes.behaviorLevel = update.behaviorLevel;

                if (update.constraints) {
                    if (!changes.constraints) changes.constraints = {};
                    const { sitWith, dontSitWith, ...otherConstraints } = update.constraints;

                    if (sitWith) {
                        const sitWithIds = sitWith.map(name => findStudentByName(name)?.id).filter(Boolean) as string[];
                        changes.constraints.sitWith = [...new Set([...(changes.constraints.sitWith || []), ...sitWithIds])];
                    }
                    if (dontSitWith) {
                         const dontSitWithIds = dontSitWith.map(name => findStudentByName(name)?.id).filter(Boolean) as string[];
                        changes.constraints.dontSitWith = [...new Set([...(changes.constraints.dontSitWith || []), ...dontSitWithIds])];
                    }
                    
                    Object.assign(changes.constraints, otherConstraints);
                }
            }

            // --- START: SYMMETRY ENFORCEMENT ---
            // Ensure that sitWith and dontSitWith are reciprocal in the proposed changes.
            const symmetricUpdates = new Map<string, StudentUpdateDraft>();
            
            for (const [studentId, changes] of proposedChanges.entries()) {
                if (changes.constraints?.sitWith) {
                    for (const partnerId of changes.constraints.sitWith) {
                        if (!proposedChanges.has(partnerId) && !symmetricUpdates.has(partnerId)) {
                            symmetricUpdates.set(partnerId, { constraints: { sitWith: [studentId] } });
                        } else {
                            const target = proposedChanges.get(partnerId) || symmetricUpdates.get(partnerId)!;
                            if (!target.constraints) target.constraints = {};
                            target.constraints.sitWith = [...new Set([...(target.constraints.sitWith || []), studentId])];
                        }
                    }
                }
                if (changes.constraints?.dontSitWith) {
                    for (const partnerId of changes.constraints.dontSitWith) {
                        if (!proposedChanges.has(partnerId) && !symmetricUpdates.has(partnerId)) {
                            symmetricUpdates.set(partnerId, { constraints: { dontSitWith: [studentId] } });
                        } else {
                            const target = proposedChanges.get(partnerId) || symmetricUpdates.get(partnerId)!;
                            if (!target.constraints) target.constraints = {};
                            target.constraints.dontSitWith = [...new Set([...(target.constraints.dontSitWith || []), studentId])];
                        }
                    }
                }
            }
            
            // Merge symmetric updates back into proposedChanges
            for (const [id, update] of symmetricUpdates.entries()) {
                if (!proposedChanges.has(id)) {
                    proposedChanges.set(id, update);
                } else {
                    const existing = proposedChanges.get(id)!;
                    if (update.constraints?.sitWith) {
                        if (!existing.constraints) existing.constraints = {};
                        existing.constraints.sitWith = [...new Set([...(existing.constraints.sitWith || []), ...(update.constraints.sitWith)])];
                    }
                    if (update.constraints?.dontSitWith) {
                        if (!existing.constraints) existing.constraints = {};
                        existing.constraints.dontSitWith = [...new Set([...(existing.constraints.dontSitWith || []), ...(update.constraints.dontSitWith)])];
                    }
                }
            }
            // --- END: SYMMETRY ENFORCEMENT ---

            // Create a temporary "final state" map to validate against
            const finalStateMap = new Map<string, Student>(currentStudents.map(s => [s.id, JSON.parse(JSON.stringify(s)) as Student]));
            for (const [studentId, changes] of proposedChanges.entries()) {
                const studentToUpdate = finalStateMap.get(studentId)!;
                if (changes.academicLevel) studentToUpdate.academicLevel = changes.academicLevel;
                if (changes.behaviorLevel) studentToUpdate.behaviorLevel = changes.behaviorLevel;
                if (changes.constraints) {
                    studentToUpdate.constraints = { ...studentToUpdate.constraints, ...changes.constraints };
                }
            }
            
            // Validate the final proposed state for each student to prevent logical contradictions.
            for (const [studentId, student] of finalStateMap.entries()) {
                 const { constraints } = student;

                 // Conflict 1: Sit alone vs Sit with
                 if (constraints.sitAlone && constraints.sitWith && constraints.sitWith.length > 0) {
                    const partnerName = finalStateMap.get(constraints.sitWith[0])?.name || "another student";
                    const conflictMessage: ChatMessage = { 
                        id: generateId(), 
                        type: 'ai-error', 
                        text: `הבקשה שלך מכילה התנגשות: אי אפשר גם לבקש ש"${student.name}" ישב/תשב לבד וגם שישב/תשב עם "${partnerName}". לא בוצעו שינויים.` 
                    };
                    setChatHistory(prev => [...prev, conflictMessage]);
                    setIsLoading(false);
                    return; // ABORT all changes
                 }

                 // Conflict 2: Sit with vs Don't sit with (self)
                 if (constraints.sitWith && constraints.dontSitWith) {
                    const overlap = constraints.sitWith.filter(id => constraints.dontSitWith!.includes(id));
                    if (overlap.length > 0) {
                        const partnerName = finalStateMap.get(overlap[0])?.name || "another student";
                        const conflictMessage: ChatMessage = { 
                            id: generateId(), 
                            type: 'ai-error', 
                            text: `הבקשה שלך מכילה התנגשות: אי אפשר גם לבקש ש"${student.name}" ישב/תשב עם "${partnerName}" וגם לא ישב/תשב איתו/איתה. לא בוצעו שינויים.` 
                        };
                        setChatHistory(prev => [...prev, conflictMessage]);
                        setIsLoading(false);
                        return; // ABORT all changes
                    }
                }

                // Conflict 3: Symmetrical checks (cross-student)
                if (constraints.sitWith) {
                    for (const partnerId of constraints.sitWith) {
                        const partner = finalStateMap.get(partnerId);
                        if (partner) {
                            if (partner.constraints.sitAlone) {
                                const conflictMessage: ChatMessage = { 
                                    id: generateId(), 
                                    type: 'ai-error', 
                                    text: `התנגשות העדפות: הגדרת ש"${student.name}" ישב/תשב עם "${partner.name}", אבל "${partner.name}" מוגדר/ת כ"חייב/ת לשבת לבד". לא בוצעו שינויים.` 
                                };
                                setChatHistory(prev => [...prev, conflictMessage]);
                                setIsLoading(false);
                                return;
                            }
                            if (partner.constraints.dontSitWith && partner.constraints.dontSitWith.includes(studentId)) {
                                const conflictMessage: ChatMessage = { 
                                    id: generateId(), 
                                    type: 'ai-error', 
                                    text: `התנגשות העדפות: "${partner.name}" מוגדר/ת לא לשבת עם "${student.name}". לא ניתן לשמור את ההעדפה ההפוכה. לא בוצעו שינויים.` 
                                };
                                setChatHistory(prev => [...prev, conflictMessage]);
                                setIsLoading(false);
                                return;
                            }
                        }
                    }
                }
            }
            // --- END: ROBUST PRE-APPLICATION VALIDATION ---
            
            // If validation passes, apply the changes
            for (const [studentId, changes] of proposedChanges.entries()) {
                const studentToUpdate = studentMap.get(studentId)!;
                
                if (!updatedStudentIds.has(studentId)) {
                    appliedUpdates.push({ studentId: studentId, originalStudent: JSON.parse(JSON.stringify(studentToUpdate)) });
                }

                if (changes.academicLevel) studentToUpdate.academicLevel = changes.academicLevel;
                if (changes.behaviorLevel) studentToUpdate.behaviorLevel = changes.behaviorLevel;
                if (changes.constraints) {
                    studentToUpdate.constraints = { ...studentToUpdate.constraints, ...changes.constraints };
                }

                updatedStudentIds.add(studentId);
            }


            const nextStudentsState = Array.from(studentMap.values());
            
            let responseMessage: ChatMessage;

            if (updatedStudentIds.size > 0) {
                const updatedNames = Array.from(updatedStudentIds).map(id => studentMap.get(id)!.name);
                let text = `אוקיי, עדכנתי נתונים עבור: ${[...new Set(updatedNames)].join(', ')}`;
                if (unmappedNames.size > 0) {
                    text += `. לא הצלחתי לזהות את: ${Array.from(unmappedNames).join(', ')}.`;
                }
                responseMessage = {
                    id: generateId(),
                    type: 'ai-success',
                    text: text,
                    appliedUpdates: appliedUpdates
                };
            } else if (unmappedNames.size > 0) {
                responseMessage = { 
                    id: generateId(), 
                    type: 'ai-error', 
                    text: `לא הצלחתי לזהות את התלמידים: ${Array.from(unmappedNames).join(', ')}. ודא/י שהשם ברור וחד משמעי.` 
                };
            } else {
                responseMessage = { id: generateId(), type: 'ai-error', text: "לא הצלחתי להבין את הבקשה או שלא נמצאו תלמידים מתאימים. נסה/י לנסח מחדש." };
            }
            
            setChart(prevChart => prevChart ? { ...prevChart, students: nextStudentsState } : null);
            setChatHistory(prev => [...prev, responseMessage]);

        } catch (e) {
            console.error(e);
            const errorMessage: ChatMessage = { id: generateId(), type: 'ai-error', text: `אירעה שגיאה: ${e instanceof Error ? e.message : String(e)}` };
            setChatHistory(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleUndoUpdates = (messageId: string, updatesToUndo?: ChatMessage['appliedUpdates']) => {
        if (!updatesToUndo) return;

        setChart(prevChart => {
            if (!prevChart) return null;
            const studentMap = new Map(prevChart.students.map(s => [s.id, s]));
            updatesToUndo.forEach(({ studentId, originalStudent }) => {
                if (studentMap.has(studentId)) {
                    studentMap.set(studentId, originalStudent);
                }
            });
            return { ...prevChart, students: Array.from(studentMap.values()) };
        });

        setChatHistory(prev => prev.filter(msg => msg.id !== messageId));
    };
    
    const placeholderText = "לדוגמה: שדני ויעל ישבו יחד";

    return (
        <CollapsibleSection title="עוזר AI חכם" icon={<SparklesIcon className="h-5 w-5 text-purple-500" />}>
            <div className="p-2 space-y-3">
                 <div className="flex justify-between items-center">
                    <p className="text-sm font-semibold bg-amber-100 text-amber-800 p-2 rounded-md">הזן/י העדפה אחת בכל פעם ולחץ/י 'שלח'.</p>
                    <button onClick={() => setShowHelp(!showHelp)} className="text-sm text-sky-600 hover:underline">
                        {showHelp ? 'הסתר הנחיות' : 'איך כותבים בקשות?'}
                    </button>
                </div>
                
                {showHelp && (
                    <div className="p-3 bg-sky-50 border border-sky-200 rounded-lg text-sm text-slate-700 space-y-2 animate-fade-in">
                        <h4 className="font-bold">כך תדברו עם העוזר החכם:</h4>
                        <ul className="list-disc list-inside space-y-1">
                            <li><span className="font-semibold">עיקרון מנחה:</span> בקשה אחת בכל פעם. אחרי כל בקשה, בדקו שהעוזר הבין אתכם נכון.</li>
                            <li><span className="font-semibold">השתמשו בשמות התלמידים</span> כפי שהם מופיעים ברשימה.</li>
                        </ul>
                        <h5 className="font-semibold pt-2">מילות מפתח מומלצות:</h5>
                        <ul className="space-y-1 text-xs">
                            <li><strong className="text-slate-800">לחיבור תלמידים:</strong> "ישבו יחד", "לשבץ את... עם...", "באותו שולחן". <br/><em>דוגמה: "שדני ויעל ישבו יחד"</em></li>
                            <li><strong className="text-slate-800">להפרדת תלמידים:</strong> "להפריד", "לא ליד", "לא באותו שולחן". <br/><em>דוגמה: "להפריד בין רון לגיל"</em></li>
                            <li><strong className="text-slate-800">למיקום בשורה:</strong> "שורה ראשונה", "מקדימה", "מאחורה", "לא בשורה 5". <br/><em>דוגמה: "שמאיה תשב בשורה הראשונה"</em></li>
                            <li><strong className="text-slate-800">למיקום בטור:</strong> "טור ימני", "טור 1", "ליד החלון". <br/><em>דוגמה: "שיוסי ישב בטור 3"</em></li>
                            <li><strong className="text-slate-800">לשבת לבד:</strong> "לבד", "שולחן נפרד", "לבודד". <br/><em>דוגמה: "שאור ישב לבד"</em></li>
                            <li><strong className="text-slate-800">לקביעת רמה לימודית:</strong> "תלמיד/ה חזק/ה", "חלש/ה", "מצטיין/ת". <br/><em>דוגמה: "שירי היא תלמידה חזקה"</em></li>
                            <li><strong className="text-slate-800">לקביעת רמת התנהגות:</strong> "מפריע/ה", "שקט/ה", "מאתגר/ת". <br/><em>דוגמה: "יונתן תלמיד מאתגר"</em></li>
                        </ul>
                         <p className="pt-2 text-slate-600"><strong>טיפ:</strong> הגדרת רמות התנהגות ולימוד תסייע לאסטרטגיות הסידור החכמות (כמו 'שכן חזק-חלש') לפעול בצורה מדויקת יותר.</p>
                    </div>
                )}

                <div className="bg-slate-50 border rounded-lg p-2 space-y-2 h-40 overflow-y-auto">
                    {noStudents && chatHistory.length === 0 && (
                        <div className="flex items-center justify-center h-full text-center text-slate-500 text-sm">
                            <p>יש להוסיף תלמידים לרשימה<br/>כדי להשתמש בעוזר ה-AI.</p>
                        </div>
                    )}
                    {chatHistory.map(msg => (
                        <div key={msg.id} className={`flex items-start gap-2 text-sm ${msg.type === 'user' ? 'justify-end' : 'items-center'}`}>
                            {msg.type.startsWith('ai') && <SparklesIcon className="h-4 w-4 text-purple-500 mt-1 shrink-0" />}
                            <div className={`p-2 rounded-lg max-w-[90%] ${
                                msg.type === 'user' ? 'bg-sky-100 text-sky-800' : 
                                msg.type === 'ai-success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                                {msg.text}
                            </div>
                             {msg.type === 'ai-success' && msg.appliedUpdates && (
                                <button 
                                    onClick={() => handleUndoUpdates(msg.id, msg.appliedUpdates)} 
                                    className="text-xs text-rose-600 hover:underline font-semibold"
                                    title="בטל פעולה"
                                >
                                    בטל
                                </button>
                            )}
                        </div>
                    ))}
                     {isLoading && (
                        <div className="flex items-center gap-2 text-sm">
                            <SparklesIcon className="h-4 w-4 text-purple-500 mt-1 shrink-0" />
                            <div className="p-2 rounded-lg bg-slate-100 text-slate-600">
                                <div className="flex items-center gap-2">
                                    <div className="animate-spin-fast rounded-full h-4 w-4 border-b-2 border-slate-500"></div>
                                    <span>חושב...</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                <div className="flex">
                    <input 
                        value={prompt}
                        onChange={e => setPrompt(e.target.value)}
                        onKeyPress={e => e.key === 'Enter' && handleApplySinglePrompt()}
                        placeholder={noStudents ? "יש להוסיף תלמידים תחילה" : placeholderText}
                        className="flex-grow p-2 border rounded-r-md disabled:bg-slate-100"
                        disabled={isLoading || noStudents}
                    />
                    <button 
                        onClick={handleApplySinglePrompt}
                        disabled={isLoading || !prompt.trim() || noStudents}
                        className="bg-purple-500 text-white p-2 rounded-l-md hover:bg-purple-600 disabled:bg-purple-300 flex items-center justify-center gap-2 font-semibold"
                    >
                        שלח
                    </button>
                </div>
            </div>
        </CollapsibleSection>
    );
};

// --- END: NEW AI CHAT INTERFACE ---

const StepNumber: React.FC<{ number: number; className?: string }> = ({ number, className }) => (
    <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shadow-sm select-none ${className}`}>
        {number}
    </div>
);

const CollapsibleSection: React.FC<{ title: string; children: React.ReactNode; defaultOpen?: boolean; icon?: React.ReactNode }> = ({ title, children, defaultOpen = false, icon }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="border-b">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex justify-between items-center py-4 font-semibold text-lg text-slate-700"
            >
                <span className="flex items-center gap-2">
                    {icon}
                    <span>{title}</span>
                </span>
                <svg className={`w-5 h-5 transition-transform text-slate-500 ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            {isOpen && <div className="pb-4">{children}</div>}
        </div>
    );
};

// Helper function to check for non-default constraints
const hasConstraints = (student: Student): boolean => {
    const constraints = { ...DEFAULT_STUDENT_CONSTRAINTS, ...(student.constraints || {}) };
    return constraints.sitAlone ||
           (constraints.sitWith?.length ?? 0) > 0 ||
           (constraints.dontSitWith?.length ?? 0) > 0 ||
           (constraints.allowedRows?.length ?? 0) > 0 ||
           (constraints.allowedCols?.length ?? 0) > 0 ||
           (constraints.allowedSeats?.length ?? 0) > 0;
};

const LevelConsiderationSelector: React.FC<{
    selectedValues: LevelConsiderationOptions;
    onChange: (option: keyof LevelConsiderationOptions) => void;
    isReadOnly?: boolean;
}> = ({ selectedValues, onChange, isReadOnly }) => {
    const options = [
        { value: 'balanced', label: 'פיזור מאוזן', description: 'פיזור מאוזן לפי שילוב רמה לימודית והתנהגות.', icon: <BalancedIcon /> },
        { value: 'strong_weak_neighbor', label: 'שכן חזק-חלש', description: 'הושבת תלמיד חזק ליד חלש ללמידת עמיתים.', icon: <PairingIcon /> },
        { value: 'challenge_at_edges', label: 'אתגר בקצוות', description: 'מיקום תלמידים מאתגרים בקצוות הכיתה.', icon: <EdgesIcon /> },
    ] as const;

    const noOptionsSelected = !Object.values(selectedValues).some(v => v);
    const selectedCount = Object.values(selectedValues).filter(v => v).length;

    return (
        <div className="col-span-2 mt-4">
            <label className="text-sm font-medium text-slate-600 mb-1 block">אסטרטגיות סידור חכמות (אופציונלי)</label>
            <p className="text-xs text-slate-500 mb-3">
                בחר/י אסטרטגיה אחת או יותר. המערכת תמיד תכבד את ההעדפות הידניות, ותפעיל את האסטרטגיות על שאר התלמידים.
                {noOptionsSelected && <strong> כרגע, הסידור יתבצע לפי העדפות בלבד.</strong>}
            </p>
            <div className="grid grid-cols-2 gap-2">
                {options.map(option => (
                    <button
                        key={option.value}
                        type="button"
                        onClick={() => !isReadOnly && onChange(option.value)}
                        disabled={isReadOnly}
                        className={`p-3 rounded-lg border-2 text-right transition-all ${selectedValues[option.value] ? 'bg-teal-50 border-teal-500 shadow-md' : 'bg-slate-50 border-slate-200 hover:border-slate-300'} ${isReadOnly ? 'opacity-70 cursor-not-allowed' : ''}`}
                    >
                        <div className="flex items-center gap-3">
                            <div className={selectedValues[option.value] ? 'text-teal-600' : 'text-slate-500'}>{React.cloneElement(option.icon, { className: 'h-6 w-6' })}</div>
                            <div>
                                <h4 className="font-bold text-sm text-slate-800">{option.label}</h4>
                                <p className="text-xs text-slate-500">{option.description}</p>
                            </div>
                        </div>
                    </button>
                ))}
            </div>
            {selectedCount > 1 && (
                <div className="mt-3 p-3 bg-teal-50 border border-teal-200 rounded-lg text-sm text-teal-800 animate-fade-in">
                    <h5 className="font-bold flex items-center gap-1.5"><SparklesIcon className="h-4 w-4" /> שילוב חכם</h5>
                    <p className="mt-1">המערכת תשלב את הבחירות שלך בצורה אופטימלית. לדוגמה, בבחירת 'שכן חזק-חלש' ו'אתגר בקצוות', המערכת תיתן עדיפות לשיבוץ זוגות של תלמידים חזקים עם תלמידים חלשים-מאתגרים בקצוות הכיתה.</p>
                </div>
            )}
        </div>
    );
};

const RowsSettings: React.FC<{
    layoutDetails: RowsLayoutDetails;
    onLayoutDetailsChange: (newDetails: Partial<RowsLayoutDetails>) => void;
    handleLevelConsiderationChange: (option: keyof LevelConsiderationOptions) => void;
    webhookUrl?: string;
    onWebhookUrlChange: (url: string) => void;
    isReadOnly?: boolean;
}> = ({ layoutDetails, onLayoutDetailsChange, handleLevelConsiderationChange, webhookUrl, onWebhookUrlChange, isReadOnly }) => {
    
    const { columnConfiguration = [5, 5, 5, 5] } = layoutDetails;
    const numCols = columnConfiguration.length;

    const handleNumColsChange = (newNumCols: number) => {
        if (isReadOnly || newNumCols < 1 || newNumCols > 10 || !Number.isInteger(newNumCols)) return;
        const currentAvgRows = columnConfiguration.length > 0
            ? Math.round(columnConfiguration.reduce((a, b) => a + b, 0) / columnConfiguration.length)
            : 5;

        const newConfig = Array(newNumCols).fill(Math.max(1, currentAvgRows));
        onLayoutDetailsChange({ columnConfiguration: newConfig });
    };

    const handleRowsInColChange = (colIndex: number, numRows: number) => {
        if (isReadOnly || numRows < 0 || numRows > 15 || !Number.isInteger(numRows)) return;
        const newConfig = [...columnConfiguration];
        newConfig[colIndex] = numRows;
        onLayoutDetailsChange({ columnConfiguration: newConfig });
    };

    const handleGenericChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        if (isReadOnly) return;
        onLayoutDetailsChange({ [e.target.name]: e.target.value });
    };

    return (
        <div className="space-y-6">
            <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                    <StepNumber number={1} className="bg-teal-100 text-teal-600" />
                    <h4 className="text-sm font-bold text-slate-700">מבנה הכיתה</h4>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                        <label className="text-sm font-medium text-slate-600">מספר טורים</label>
                        <input 
                            type="number" 
                            value={numCols} 
                            onChange={(e) => handleNumColsChange(parseInt(e.target.value, 10))} 
                            min="1" max="10"
                            disabled={isReadOnly}
                            className="w-full mt-1 p-3 border rounded-md text-base disabled:bg-slate-100 disabled:text-slate-500"
                        />
                    </div>
                    <div className="col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-2 border-t pt-4">
                        {columnConfiguration.map((rows, index) => (
                            <div key={index}>
                                <label className="text-xs font-medium text-slate-500">טור {index + 1}</label>
                                <input 
                                    type="number" 
                                    value={rows} 
                                    onChange={(e) => handleRowsInColChange(index, parseInt(e.target.value, 10))} 
                                    min="0" max="15"
                                    disabled={isReadOnly}
                                    className="w-full mt-1 p-3 border rounded-md text-base disabled:bg-slate-100 disabled:text-slate-500"
                                />
                            </div>
                        ))}
                    </div>
                    <div>
                        <label className="text-sm font-medium text-slate-600">שולחן מורה</label>
                        <select 
                            name="teacherDeskPosition" 
                            value={layoutDetails.teacherDeskPosition} 
                            onChange={handleGenericChange} 
                            disabled={isReadOnly}
                            className="w-full mt-1 p-3 border rounded-md bg-white text-base disabled:bg-slate-100 disabled:text-slate-500"
                        >
                            <option value="top">למעלה</option>
                            <option value="bottom">למטה</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-sm font-medium text-slate-600">חלונות</label>
                        <select 
                            name="windowPosition" 
                            value={layoutDetails.windowPosition} 
                            onChange={handleGenericChange} 
                            disabled={isReadOnly}
                            className="w-full mt-1 p-3 border rounded-md bg-white text-base disabled:bg-slate-100 disabled:text-slate-500"
                        >
                            <option value="left">שמאל</option>
                            <option value="right">ימין</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-sm font-medium text-slate-600">דלת</label>
                        <select 
                            name="doorPosition" 
                            value={layoutDetails.doorPosition} 
                            onChange={handleGenericChange} 
                            disabled={isReadOnly}
                            className="w-full mt-1 p-3 border rounded-md bg-white text-base disabled:bg-slate-100 disabled:text-slate-500"
                        >
                            <option value="left">שמאל</option>
                            <option value="right">ימין</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="bg-sky-50/30 p-4 rounded-xl border border-sky-100 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                    <StepNumber number={2} className="bg-sky-100 text-sky-600" />
                    <h4 className="text-sm font-bold text-slate-700">העדפות סידור</h4>
                </div>
                <div>
                    <label className="text-sm font-medium text-slate-600">סידור לפי מגדר</label>
                    <select 
                        name="genderArrangement" 
                        value={layoutDetails.genderArrangement || 'gender_random'} 
                        onChange={handleGenericChange} 
                        disabled={isReadOnly}
                        className="w-full mt-1 p-3 border rounded-md bg-white text-base disabled:bg-slate-100 disabled:text-slate-500"
                    >
                        <option value="gender_random">ללא העדפה</option>
                        <option value="gender_mixed">בן ליד בת</option>
                        <option value="gender_same">בן ליד בן, בת ליד בת</option>
                    </select>
                </div>
                <LevelConsiderationSelector 
                    selectedValues={layoutDetails.levelConsideration || DEFAULT_ROWS_LAYOUT.levelConsideration!}
                    onChange={handleLevelConsiderationChange}
                    isReadOnly={isReadOnly}
                />
            </div>

           
        </div>
    );
};


const GroupsSettings: React.FC<{
    layoutDetails: GroupsLayoutDetails;
    handleDetailChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
    groupingMethod: string;
    setGroupingMethod: (method: string) => void;
    webhookUrl?: string;
    onWebhookUrlChange: (url: string) => void;
    isReadOnly?: boolean;
}> = ({ layoutDetails, handleDetailChange, groupingMethod, setGroupingMethod, webhookUrl, onWebhookUrlChange, isReadOnly }) => (
    <div className="space-y-6">
        <div className="bg-teal-50/30 p-4 rounded-xl border border-teal-100 space-y-3">
            <div className="flex items-center gap-2 mb-1">
                <StepNumber number={1} className="bg-teal-100 text-teal-600" />
                <label className="text-sm font-bold text-slate-700">מספר קבוצות</label>
            </div>
            <input 
                type="number" 
                name="groups" 
                value={layoutDetails.groups} 
                onChange={handleDetailChange} 
                min="1" 
                disabled={isReadOnly}
                className="w-full p-3 border rounded-md text-base bg-white disabled:bg-slate-100 disabled:text-slate-500"
            />
        </div>
        
        <div className="bg-sky-50/30 p-4 rounded-xl border border-sky-100 space-y-3">
            <div className="flex items-center gap-2 mb-1">
                <StepNumber number={2} className="bg-sky-100 text-sky-600" />
                <label className="text-sm font-bold text-slate-700">שיטת חלוקה</label>
            </div>
            <select 
                name="groupingMethod" 
                value={groupingMethod} 
                onChange={(e) => setGroupingMethod(e.target.value)} 
                disabled={isReadOnly}
                className="w-full p-3 border rounded-md bg-white text-base disabled:bg-slate-100 disabled:text-slate-500"
            >
                <option value="random">אקראית</option>
                <option value="gender">איזון מגדרי</option>
                <option value="separate_genders">קבוצות נפרדות (בנים/בנות)</option>
                <option value="same_level">קבוצות הומוגניות (רמה לימודית)</option>
                <option value="heterogeneous">קבוצות הטרוגניות (רמה לימודית)</option>
                <option value="same_behavior">קבוצות הומוגניות (התנהגות)</option>
                <option value="heterogeneous_behavior">קבוצות הטרוגניות (התנהגות)</option>
                <option value="heterogeneous_combined">קבוצות הטרוגניות (משולב לימודים והתנהגות)</option>
            </select>
            {(groupingMethod === 'same_level' || groupingMethod === 'heterogeneous') && (
                <div className="p-2 bg-white/50 rounded-md text-xs text-slate-500 border border-slate-100 italic">
                    החלוקה תתבסס על 'רמת הלימוד' שהוגדרה לכל תלמיד.
                </div>
            )}
            {(groupingMethod === 'same_behavior' || groupingMethod === 'heterogeneous_behavior') && (
                <div className="p-2 bg-white/50 rounded-md text-xs text-slate-500 border border-slate-100 italic">
                    החלוקה תתבסס על 'התנהגות' שהוגדרה לכל תלמיד.
                </div>
            )}
            {groupingMethod === 'heterogeneous_combined' && (
                <div className="p-2 bg-white/50 rounded-md text-xs text-slate-500 border border-slate-100 italic">
                    החלוקה תנסה ליצור קבוצות מאוזנות ככל הניתן, הן מבחינת רמת הלימוד והן מבחינת ההתנהגות.
                </div>
            )}
        </div>

       
    </div>
);

interface EditorScreenProps {
    chart: Chart;
    setChart: (updater: React.SetStateAction<Chart | null>) => void;
    onGenerate: (chart: Chart, layout?: GeneratedLayout | null) => void;
    groupingMethod: string;
    setGroupingMethod: (method: string) => void;
    currentUserId?: string;
}

const EditorScreen: React.FC<EditorScreenProps> = ({ 
    chart, setChart, onGenerate, 
    groupingMethod, setGroupingMethod,
    currentUserId
}) => {
    const [addMode, setAddMode] = useState<'list' | 'single'>('list');
    const [singleStudentName, setSingleStudentName] = useState('');
    const [studentList, setStudentList] = useState('');
    const [studentToEdit, setStudentToEdit] = useState<Student | null>(null);
    const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
    const [editedStudentName, setEditedStudentName] = useState('');

    const { fullLayout, previewLayout } = useMemo(() => {
        if (chart.layoutType !== 'rows') {
            return { fullLayout: null, previewLayout: null };
        }

        // Always generate the full layout based on the current chart state.
        // This is the source of truth for what the user sees in preview and what they will get.
        const layout = generateLayout({ ...chart, generatedLayout: null }, '') as GeneratedRowsLayout;

        // Show all students in the preview for a more intuitive experience.
        return { 
            fullLayout: layout, 
            previewLayout: layout 
        };
    }, [chart]);

    const constrainedStudentsExist = useMemo(() => chart.students.some(hasConstraints), [chart.students]);

    const handleLayoutDetailsChange = (updates: Partial<RowsLayoutDetails>) => {
        setChart(prev => prev ? {
            ...prev,
            layoutDetails: { ...prev.layoutDetails, ...updates }
        } : null);
    };

    const handleGroupsDetailChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        const processedValue = e.target.type === 'number' ? parseInt(value, 10) || 0 : value;
        setChart(prev => prev ? {
            ...prev,
            layoutDetails: { ...prev.layoutDetails, [name]: processedValue }
        } : null);
    };
    
    const handleLevelConsiderationChange = (option: keyof LevelConsiderationOptions) => {
        setChart(prev => {
            if (!prev || prev.layoutType !== 'rows') return prev;
            const currentOptions = (prev.layoutDetails as RowsLayoutDetails).levelConsideration || { ...DEFAULT_ROWS_LAYOUT.levelConsideration! };
            const newOptions = {
                ...currentOptions,
                [option]: !currentOptions[option],
            };
            return {
                ...prev,
                layoutDetails: { ...prev.layoutDetails, levelConsideration: newOptions }
            };
        });
    };

    const parseNameAndGender = (nameInput: string): { name: string; gender: '' | 'זכר' | 'נקבה' } => {
        const trimmedInput = nameInput.trim();
        
        // Match name ending with one or more spaces, then 'ז' or 'נ'
        const match = trimmedInput.match(/^(.*)\s+([זנ])$/);
        
        if (match) {
            const name = match[1].trim();
            const genderChar = match[2];
            const gender = genderChar === 'ז' ? 'זכר' : 'נקבה';
            return { name, gender };
        }
        
        return { name: trimmedInput, gender: '' };
    };
    
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const [showSmartImport, setShowSmartImport] = useState(false);

    const handleClearAllStudents = () => {
        setChart(prev => prev ? { ...prev, students: [] } : null);
        setShowClearConfirm(false);
    };

    const handleAddSingleStudent = () => {
        const { name, gender } = parseNameAndGender(singleStudentName);
        if (!name || !chart) return;

        let finalName = name;
        const baseNameLower = name.toLowerCase();
        const existingCount = chart.students.filter(s => s.name.toLowerCase() === baseNameLower).length;
        
        if (existingCount > 0) {
            finalName = `${name} (${existingCount + 1})`;
        }

        const newStudent: Student = { id: generateId(), name: finalName, gender, ratings: {}, constraints: { ...DEFAULT_STUDENT_CONSTRAINTS } };
        setChart(prev => prev ? { ...prev, students: [...prev.students, newStudent] } : null);
        setSingleStudentName('');
    };
    
    const handleAddListStudents = () => {
        const lines = studentList.split('\n').map(n => n.trim()).filter(Boolean);
        if (!chart) return;

        const currentNames = new Map<string, number>();
        chart.students.forEach(s => {
            const baseName = s.name.toLowerCase();
            currentNames.set(baseName, (currentNames.get(baseName) || 0) + 1);
        });

        const newStudents: Student[] = [];
        lines.forEach(line => {
            const { name, gender } = parseNameAndGender(line);
            if (!name) return;

            let finalName = name;
            const baseNameLower = name.toLowerCase();
            const count = currentNames.get(baseNameLower) || 0;
            
            if (count > 0) {
                finalName = `${name} (${count + 1})`;
            }
            
            currentNames.set(baseNameLower, count + 1);
            newStudents.push({
                id: generateId(),
                name: finalName,
                gender,
                ratings: {},
                constraints: { ...DEFAULT_STUDENT_CONSTRAINTS }
            });
        });

        setChart(prev => prev ? { ...prev, students: [...prev.students, ...newStudents] } : null);
        setStudentList('');
    };

    const handleSmartImportConfirm = (extracted: ExtractedStudent[]) => {
        console.log("Confirming smart import students:", extracted.length);
        if (!chart) return;

        try {
            const currentNames = new Map<string, number>();
            chart.students.forEach(s => {
                const baseName = s.name.toLowerCase();
                currentNames.set(baseName, (currentNames.get(baseName) || 0) + 1);
            });

            const newStudents: Student[] = extracted.map(s => {
                let finalName = s.name;
                const baseNameLower = s.name.toLowerCase();
                const count = currentNames.get(baseNameLower) || 0;
                
                if (count > 0) {
                    finalName = `${s.name} (${count + 1})`;
                }
                
                currentNames.set(baseNameLower, count + 1);
                return {
                    id: generateId(),
                    name: finalName,
                    gender: s.gender,
                    ratings: {},
                    constraints: { ...DEFAULT_STUDENT_CONSTRAINTS }
                };
            });

            setChart(prev => prev ? { ...prev, students: [...prev.students, ...newStudents] } : null);
            toast.success(`נוספו ${newStudents.length} תלמידים בהצלחה!`);
        } catch (err) {
            console.error("Error in handleSmartImportConfirm:", err);
            toast.error("שגיאה בעיבוד התלמידים החדשים.");
        }
    };

    const handleRemoveStudent = (id: string) => {
        setChart(prev => prev ? { ...prev, students: prev.students.filter(s => s.id !== id) } : null);
    };

    const handleSaveStudent = (updatedStudent: Student) => {
        setChart(prev => {
            if (!prev) return null;
    
            const originalStudent = prev.students.find(s => s.id === updatedStudent.id);
            if (!originalStudent) return prev;
    
            // FIX: Explicitly type the newStudents map to ensure values are treated as Student objects, resolving 'unknown' type errors on 'partner.constraints'.
            const newStudents: Map<string, Student> = new Map(prev.students.map(s => [s.id, JSON.parse(JSON.stringify(s)) as Student]));
            newStudents.set(updatedStudent.id, updatedStudent);
    
            const updateSymmetric = (key: 'sitWith' | 'dontSitWith', original: Student, updated: Student) => {
                const originalSet = new Set(original.constraints[key] || []);
                const updatedSet = new Set(updated.constraints[key] || []);
    
                for (const partnerId of updatedSet) {
                    if (!originalSet.has(partnerId)) {
                        const partner = newStudents.get(partnerId);
                        if (partner) {
                            const partnerConstraints = partner.constraints || { ...DEFAULT_STUDENT_CONSTRAINTS };
                            const partnerSet = new Set(partnerConstraints[key] || []);
                            partnerSet.add(updated.id);
                            partner.constraints = { ...partnerConstraints, [key]: Array.from(partnerSet) };
                        }
                    }
                }
    
                for (const partnerId of originalSet) {
                    if (!updatedSet.has(partnerId)) {
                        const partner = newStudents.get(partnerId);
                        if (partner) {
                            const partnerConstraints = partner.constraints || { ...DEFAULT_STUDENT_CONSTRAINTS };
                            const partnerSet = new Set(partnerConstraints[key] || []);
                            partnerSet.delete(updated.id);
                            partner.constraints = { ...partnerConstraints, [key]: Array.from(partnerSet) };
                        }
                    }
                }
            };
            
            updateSymmetric('sitWith', originalStudent, updatedStudent);
            updateSymmetric('dontSitWith', originalStudent, updatedStudent);
            
            return { ...prev, students: Array.from(newStudents.values()) };
        });
        setStudentToEdit(null);
    };

    const handleStartEditName = (student: Student) => {
        setEditingStudentId(student.id);
        const genderSuffix = student.gender === 'זכר' ? ' ז' : student.gender === 'נקבה' ? ' נ' : '';
        setEditedStudentName(student.name + genderSuffix);
    };

    const handleSaveStudentName = () => {
        if (!editingStudentId) return;

        const { name: newName, gender: newGender } = parseNameAndGender(editedStudentName);

        if (!newName) {
            alert('שם התלמיד לא יכול להיות ריק.');
            return;
        }

        const isDuplicate = chart.students.some(s => s.name.toLowerCase() === newName.toLowerCase() && s.id !== editingStudentId);
        if (isDuplicate) {
            alert('שם תלמיד זה כבר קיים ברשימה.');
            return;
        }

        setChart(prev => {
            if (!prev) return null;
            const updatedStudents = prev.students.map(s => 
                s.id === editingStudentId 
                    ? { ...s, name: newName, gender: newGender || s.gender } 
                    : s
            );
            return { ...prev, students: updatedStudents };
        });
        setEditingStudentId(null);
    };

    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const totalSeats = useMemo(() => {
        if (chart.layoutType === 'rows') {
            const { columnConfiguration = [] } = (chart.layoutDetails as RowsLayoutDetails);
            return columnConfiguration.reduce((a, b) => a + b, 0) * 2;
        }
        return 0;
    }, [chart.layoutType, chart.layoutDetails]);

    const studentCount = chart.students.length;
    const hasEnoughSeats = totalSeats >= studentCount;

    return (
        <div className="flex flex-col md:flex-row flex-1 overflow-hidden relative">
            {/* Mobile Sidebar Toggle */}
            <button 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="md:hidden fixed bottom-6 left-6 z-50 p-4 bg-sky-500 text-white rounded-full shadow-2xl hover:bg-sky-600 transition-all active:scale-95"
            >
                {isSidebarOpen ? <XIcon className="h-6 w-6" /> : <PencilIcon className="h-6 w-6" />}
            </button>

            <main className="flex-1 h-full bg-slate-100 p-4 md:p-8 overflow-auto flex items-center justify-center relative">
                 {chart.layoutType === 'rows' ? (
                    <div className="text-center">
                        {chart.students.length === 0 ? (
                            <div className="bg-white p-10 rounded-xl shadow-lg max-w-lg mx-auto text-right border-t-4 border-teal-500">
                                <h3 className="text-2xl font-bold text-teal-600 mb-6 border-b pb-3 text-center">שלבי העבודה ליצירת מפה</h3>
                                
                                <div className="space-y-6">
                                    <div className="flex gap-4">
                                        <div className="flex-shrink-0 w-8 h-8 bg-teal-100 text-teal-600 rounded-full flex items-center justify-center font-bold">1</div>
                                        <div>
                                            <p className="font-bold text-slate-800">הגדירו :</p>
                                            <ul className="text-slate-600 list-disc list-inside pr-2">
                                                <li>מספר טורים</li>
                                                <li>מספר שורות בכל טור</li>
                                                <li>מיקום שולחן, חלונות דלת</li>
                                            </ul>
                                        </div>
                                    </div>

                                    <div className="flex gap-4">
                                        <div className="flex-shrink-0 w-8 h-8 bg-sky-100 text-sky-600 rounded-full flex items-center justify-center font-bold">2</div>
                                        <div>
                                            <p className="font-bold text-slate-800">ניתן להגדיר :</p>
                                            <ul className="text-slate-600 list-disc list-inside pr-2">
                                                <li>סידור לפי מגדר</li>
                                                <li>אסטרטגיות חכמות</li>
                                            </ul>
                                        </div>
                                    </div>

                                    <div className="flex gap-4">
                                        <div className="flex-shrink-0 w-8 h-8 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center font-bold">3</div>
                                        <div>
                                            <p className="font-bold text-slate-800">חובה :</p>
                                            <ul className="text-slate-600 list-disc list-inside pr-2">
                                                <li>הזנת רשימת תלמידים ולחיצה על <span className="font-bold">'הוסף רשימה'</span></li>
                                            </ul>
                                        </div>
                                    </div>

                                    <div className="flex gap-4">
                                        <div className="flex-shrink-0 w-8 h-8 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center font-bold">4</div>
                                        <div>
                                            <p className="font-bold text-teal-600">המלצה לשימוש בכרטיס תלמיד:</p>
                                            <ul className="text-slate-600 list-inside pr-2">
                                                <li className="text-teal-600 font-medium">
                                                    ברשימה שנוספה למטה <br />
                                                    לחצו על שם התלמיד <br />
                                                    לעריכת <span className="underline">כרטיס תלמיד</span> <br />
                                                    (העדפות פדגוגיות, התנהגותיות, <br />
                                                    מיקום ותמונה).
                                                </li>
                                            </ul>
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t border-slate-100">
                                        <div className="flex gap-4 items-center bg-teal-50 p-3 rounded-lg border border-teal-100">
                                            <div className="flex-shrink-0 w-8 h-8 bg-teal-500 text-white rounded-full flex items-center justify-center font-bold shadow-sm">5</div>
                                            <div>
                                                <p className="font-bold text-teal-800">לסיום התהליך :</p>
                                                <p className="text-teal-700">ללחוץ על <span className="font-black underline">צור מפת כיתה</span></p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (chart.isCopy || (currentUserId && chart.ownerId !== currentUserId)) ? (
                            <div className="flex flex-col gap-6">
                                <div className="max-w-5xl mx-auto w-full text-right bg-white p-4 md:p-5 rounded-xl shadow-lg border border-teal-100">
                                    <h3 className="text-lg font-bold text-slate-800 mb-3 border-b pb-2 border-teal-100">
                                        {chart.isCopy ? 'עריכת עותק מפת כיתה' : 'עריכת שיתוף מפת כיתה'}
                                    </h3>
                                    
                                    <div className="space-y-6">
                                        <div className="flex gap-4">
                                            <div className="flex-shrink-0 w-8 h-8 bg-teal-100 text-teal-600 rounded-full flex items-center justify-center font-bold">1</div>
                                            <div>
                                                <p className="font-bold text-base text-slate-700 mb-1">במידת הצורך עדכון :</p>
                                                <ul className="list-disc list-inside text-slate-600 pr-2 text-sm space-y-0.5">
                                                    <li>מבנה הכיתה (טורים ושורות)</li>
                                                    <li>מיקומי דלת/חלון</li>
                                                </ul>
                                            </div>
                                        </div>

                                        <div className="flex gap-4">
                                            <div className="flex-shrink-0 w-8 h-8 bg-sky-100 text-sky-600 rounded-full flex items-center justify-center font-bold">2</div>
                                            <div>
                                                <p className="font-bold text-base text-slate-700 mb-1">ניתן להגדיר :</p>
                                                <ul className="list-disc list-inside text-slate-600 pr-2 text-sm space-y-0.5">
                                                    <li>סידור לפי מגדר</li>
                                                    <li>אסטרטגיות חכמות</li>
                                                </ul>
                                            </div>
                                        </div>

                                        <div className="flex gap-4">
                                            <div className="flex-shrink-0 w-8 h-8 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center font-bold">3</div>
                                            <div>
                                                <p className="font-bold text-base text-slate-700 mb-1">ניהול רשימה :</p>
                                                <ul className="list-disc list-inside text-slate-600 pr-2 text-sm space-y-0.5">
                                                    <li>הוספה או הסרה של תלמידים מהרשימה למטה</li>
                                                </ul>
                                            </div>
                                        </div>

                                        <div className="flex gap-4">
                                            <div className="flex-shrink-0 w-8 h-8 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center font-bold">4</div>
                                            <div>
                                                <p className="font-bold text-base text-teal-600 mb-1">המלצה לשימוש בכרטיס תלמיד:</p>
                                                <p className="text-teal-700 text-sm font-medium">
                                                    ברשימה שנוספה למטה לחצו על שם התלמיד לעריכת <span className="underline">כרטיס תלמיד</span> (העדפות פדגוגיות, התנהגותיות, מיקום ותמונה).
                                                </p>
                                            </div>
                                        </div>

                                        <div className="pt-4 border-t border-slate-100">
                                            <div className="flex gap-4 items-center bg-teal-50 p-3 rounded-lg border border-teal-100">
                                                <div className="flex-shrink-0 w-8 h-8 bg-teal-500 text-white rounded-full flex items-center justify-center font-bold shadow-sm">5</div>
                                                <div>
                                                    <p className="font-bold text-teal-800">לסיום התהליך :</p>
                                                    <p className="text-teal-700">ללחוץ על <span className="font-black underline">צור מפת כיתה</span></p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white p-4 md:p-8 rounded-2xl shadow-xl border border-slate-200 flex-grow">
                                    <div className="flex items-center justify-between mb-6 border-b pb-3">
                                        <h4 className="text-xl font-bold text-teal-600">תצוגה מקדימה של המפה</h4>
                                        <span className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded">פריסה מלאה</span>
                                    </div>
                                    <div className="w-full overflow-x-auto py-4">
                                        <div className="min-w-[600px] mx-auto">
                                            <ClassroomPreview 
                                                layoutDetails={chart.layoutDetails as RowsLayoutDetails}
                                                generatedLayout={previewLayout}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <>
                                <h4 className="text-lg font-bold text-teal-600 mb-2">תצוגה מקדימה של המפה</h4>
                                <ClassroomPreview 
                                    layoutDetails={chart.layoutDetails as RowsLayoutDetails}
                                    generatedLayout={previewLayout}
                                />
                            </>
                        )}
                    </div>
                ) : (
                    <div className="text-center text-slate-500 p-10 bg-white rounded-lg shadow-md">
                        <h2 className="text-2xl font-bold text-teal-600 mb-4">חלוקה לקבוצות</h2>
                        {(chart.isCopy || (currentUserId && chart.ownerId !== currentUserId)) ? (
                            <div className="max-w-xl mx-auto text-right">
                                <h3 className="text-xl font-bold text-slate-800 mb-6 border-b pb-2 border-teal-100">
                                    {chart.isCopy ? 'עריכת עותק חלוקה לקבוצות' : 'עריכת שיתוף חלוקה לקבוצות'}
                                </h3>
                                <div className="space-y-6">
                                    <div className="flex gap-4">
                                        <div className="flex-shrink-0 w-8 h-8 bg-teal-100 text-teal-600 rounded-full flex items-center justify-center font-bold">1</div>
                                        <div>
                                            <p className="font-bold text-slate-800">במידת הצורך עדכון :</p>
                                            <ul className="text-slate-600 list-disc list-inside pr-2">
                                                <li>מספר קבוצות</li>
                                            </ul>
                                        </div>
                                    </div>

                                    <div className="flex gap-4">
                                        <div className="flex-shrink-0 w-8 h-8 bg-sky-100 text-sky-600 rounded-full flex items-center justify-center font-bold">2</div>
                                        <div>
                                            <p className="font-bold text-slate-800">ניתן להגדיר :</p>
                                            <ul className="text-slate-600 list-disc list-inside pr-2">
                                                <li>שיטות חלוקה שונות</li>
                                            </ul>
                                        </div>
                                    </div>

                                    <div className="flex gap-4">
                                        <div className="flex-shrink-0 w-8 h-8 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center font-bold">3</div>
                                        <div>
                                            <p className="font-bold text-slate-800">ניהול רשימה :</p>
                                            <ul className="text-slate-600 list-disc list-inside pr-2">
                                                <li>הוספה או הסרה של תלמידים מהרשימה למטה</li>
                                            </ul>
                                        </div>
                                    </div>

                                    <div className="flex gap-4">
                                        <div className="flex-shrink-0 w-8 h-8 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center font-bold">4</div>
                                        <div>
                                            <p className="font-bold text-teal-600">המלצה לשימוש בכרטיס תלמיד:</p>
                                            <p className="text-teal-700 text-sm font-medium">
                                                ברשימה שנוספה למטה לחצו על שם התלמיד לעריכת <span className="underline">כרטיס תלמיד</span> (העדפות פדגוגיות, התנהגותיות, מיקום ותמונה).
                                            </p>
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t border-slate-100">
                                        <div className="flex gap-4 items-center bg-teal-50 p-3 rounded-lg border border-teal-100">
                                            <div className="flex-shrink-0 w-8 h-8 bg-teal-500 text-white rounded-full flex items-center justify-center font-bold shadow-sm">5</div>
                                            <div>
                                                <p className="font-bold text-teal-800">לסיום התהליך :</p>
                                                <p className="text-teal-700">ללחוץ על <span className="font-black underline">צור קבוצות</span></p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : chart.students.length > 0 ? (
                            <p className="text-slate-600">
                                הגדר/י את מספר הקבוצות ושיטת החלוקה בצד, ולאחר מכן לחץ/י על צור קבוצות!
                            </p>
                        ) : (
                            <div className="text-right space-y-3 max-w-xs mx-auto">
                                <p className="font-bold text-slate-700 mb-2 border-b pb-1 border-teal-100">שלבי העבודה:</p>
                                <ul className="space-y-2.5 text-slate-600">
                                    <li className="flex items-center gap-3">
                                        <span className="flex-shrink-0 w-6 h-6 bg-teal-100 text-teal-600 rounded-full flex items-center justify-center text-sm font-bold shadow-sm">1</span>
                                        <span className="font-medium">מספר קבוצות</span>
                                    </li>
                                    <li className="flex items-center gap-3">
                                        <span className="flex-shrink-0 w-6 h-6 bg-sky-100 text-sky-600 rounded-full flex items-center justify-center text-sm font-bold shadow-sm">2</span>
                                        <span className="font-medium">שיטת חלוקה</span>
                                    </li>
                                    <li className="flex items-center gap-3">
                                        <span className="flex-shrink-0 w-6 h-6 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center text-sm font-bold shadow-sm">3</span>
                                        <span className="font-medium">הזנת תלמידים ולחיצה על 'הוסף רשימה'</span>
                                    </li>
                                    <div className="flex flex-col gap-1">
                                        <span className="text-xs font-bold text-teal-600 mr-9">המלצה לשימוש בכרטיס תלמיד:</span>
                                        <li className="flex items-start gap-3">
                                            <span className="flex-shrink-0 w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-sm font-bold shadow-sm mt-0.5">4</span>
                                            <span className="font-medium text-teal-600">
                                                ברשימה שנוספה למטה <br />
                                                לחצו על שם התלמיד <br />
                                                לעריכת <span className="underline">כרטיס תלמיד</span> <br />
                                                (העדפות פדגוגיות <br />
                                                העדפות והתנהגותיות, <br />
                                                מיקום ותמונה).
                                            </span>
                                        </li>
                                    </div>
                                    <li className="flex items-center gap-3">
                                        <span className="flex-shrink-0 w-6 h-6 bg-teal-500 text-white rounded-full flex items-center justify-center text-sm font-bold shadow-sm">5</span>
                                        <span className="font-medium">צור קבוצות</span>
                                    </li>
                                </ul>
                            </div>
                        )}
                    </div>
                )}
            </main>
            <aside className={`
                fixed inset-0 z-40 md:relative md:inset-auto
                w-full md:w-[380px] lg:w-[420px] bg-white h-full flex flex-col shadow-2xl md:shadow-none border-l border-slate-200
                transition-transform duration-300 ease-in-out
                ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
            `}>
                <div className="md:hidden flex items-center justify-between p-4 border-b bg-slate-50">
                    <h3 className="font-bold text-slate-700">הגדרות ורשימת תלמידים</h3>
                    <button 
                        onClick={() => setIsSidebarOpen(false)}
                        className="p-2 text-slate-500 hover:text-slate-700"
                    >
                        <XIcon className="h-6 w-6" />
                    </button>
                </div>
                <div className="flex-grow p-6 overflow-y-auto">
                    <div className="space-y-6">
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="font-semibold text-lg text-slate-700">
                                    {chart.layoutType === 'rows' ? 'הגדרות מפה' : 'הגדרות קבוצות'}
                                </h3>
                                <div className="flex items-center gap-2">
                                    {!chart.isReadOnly && chart.students.length > 0 && (
                                        <button 
                                            onClick={() => {
                                                if (window.confirm('האם את/ה בטוח/ה שברצונך למחוק את כל התלמידים?')) {
                                                    setChart(prev => prev ? { ...prev, students: [] } : null);
                                                }
                                            }}
                                            className="text-xs text-rose-500 hover:text-rose-700 font-medium underline"
                                        >
                                            מחק הכל
                                        </button>
                                    )}
                                    {chart.layoutType === 'rows' && (
                                        <div className={`px-2 py-1 rounded text-xs font-bold ${hasEnoughSeats ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {studentCount} / {totalSeats} מקומות
                                        </div>
                                    )}
                                </div>
                            </div>
                            {chart.layoutType === 'rows' ? (
                                <RowsSettings 
                                    layoutDetails={chart.layoutDetails as RowsLayoutDetails} 
                                    onLayoutDetailsChange={handleLayoutDetailsChange} 
                                    handleLevelConsiderationChange={handleLevelConsiderationChange}
                                    webhookUrl={chart.webhookUrl}
                                    onWebhookUrlChange={(url) => setChart(prev => prev ? { ...prev, webhookUrl: url } : null)}
                                    isReadOnly={chart.isReadOnly}
                                />
                            ) : (
                                <GroupsSettings 
                                    layoutDetails={chart.layoutDetails as GroupsLayoutDetails} 
                                    handleDetailChange={handleGroupsDetailChange} 
                                    groupingMethod={groupingMethod}
                                    setGroupingMethod={setGroupingMethod}
                                    webhookUrl={chart.webhookUrl}
                                    onWebhookUrlChange={(url) => setChart(prev => prev ? { ...prev, webhookUrl: url } : null)}
                                    isReadOnly={chart.isReadOnly}
                                />
                            )}
                        </div>
                        <CollapsibleSection title={`רשימת תלמידים (${chart.students.length})`} defaultOpen>
                            <div className="space-y-4">
                                {!chart.isReadOnly && <AIConstraintAssistant chart={chart} setChart={setChart} />}
                                <div className="flex justify-between items-center px-1">
                                    <div className="flex items-center gap-3">
                                        <StepNumber 
                                            number={3} 
                                            className="bg-amber-100 text-amber-600" 
                                        />
                                        <div className="flex flex-col">
                                            <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">ניהול תלמידים</span>
                                            <span className="text-[10px] text-slate-400">לחצו על שם תלמיד לעריכת העדפות פדגוגיות ותמונה</span>
                                        </div>
                                    </div>
                                    {chart.students.length > 0 && (
                                        <div className="relative">
                                            {showClearConfirm ? (
                                                <div className="flex items-center gap-2 bg-rose-50 p-1 px-2 rounded-md border border-rose-200 animate-in fade-in zoom-in duration-200">
                                                    <span className="text-[10px] font-bold text-rose-600">בטוח?</span>
                                                    <button onClick={handleClearAllStudents} className="text-[10px] bg-rose-500 text-white px-2 py-0.5 rounded hover:bg-rose-600 font-bold">כן</button>
                                                    <button onClick={() => setShowClearConfirm(false)} className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded hover:bg-slate-300 font-bold">לא</button>
                                                </div>
                                            ) : !chart.isReadOnly && (
                                                <button 
                                                    onClick={() => setShowClearConfirm(true)}
                                                    className="text-xs text-rose-500 hover:text-rose-700 flex items-center gap-1 font-semibold transition-colors"
                                                >
                                                    <TrashIcon className="h-3 w-3" />
                                                    מחק הכל
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                                {!chart.isReadOnly && (
                                    <>
                                        <div className="flex border rounded-md overflow-hidden mb-3">
                                            <button onClick={() => setAddMode('list')} className={`py-3 px-4 text-sm font-bold flex-1 transition-all active:scale-95 ${addMode === 'list' ? 'bg-teal-50 text-teal-700' : 'text-slate-500 bg-slate-50'}`}>מרשימה</button>
                                            <button onClick={() => setAddMode('single')} className={`py-3 px-4 text-sm font-bold flex-1 border-r transition-all active:scale-95 ${addMode === 'single' ? 'bg-teal-50 text-teal-700' : 'text-slate-500 bg-slate-50'}`}>תלמיד בודד</button>
                                        </div>
                                        
                                        <button 
                                            onClick={() => setShowSmartImport(true)}
                                            className="w-full mb-4 py-3 bg-gradient-to-r from-teal-500 to-sky-500 text-white rounded-xl font-bold flex items-center justify-center gap-3 shadow-md hover:shadow-lg transition-all active:scale-95 group"
                                        >
                                            <SparklesIcon className="h-5 w-5 animate-pulse" />
                                            <span>העלאת רשימה חכמה (תמונה/PDF)</span>
                                        </button>
                                        {addMode === 'single' ? (
                                            <div className="flex">
                                                <input type="text" value={singleStudentName} onChange={e => setSingleStudentName(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleAddSingleStudent()} placeholder="שם תלמיד/ה (למשל: דני ז)" className="flex-grow p-3 border rounded-r-md text-base" />
                                                <button onClick={handleAddSingleStudent} className="bg-teal-500 text-white p-3 rounded-l-md hover:bg-teal-600 flex items-center transition-all active:scale-95"><PlusIcon className="h-6 w-6"/></button>
                                            </div>
                                        ) : (
                                            <div>
                                                <textarea value={studentList} onChange={e => setStudentList(e.target.value)} placeholder="הדבק רשימה, שם בשורה. הוסף ' ז' או ' נ' למין." className="w-full p-3 border rounded-md h-32 mb-2 text-base"></textarea>
                                                <button onClick={handleAddListStudents} className="w-full bg-teal-500 text-white p-3 rounded-md hover:bg-teal-600 flex items-center justify-center gap-2 font-bold transition-all active:scale-95"><PlusIcon className="h-6 w-6"/> הוסף רשימה</button>
                                            </div>
                                        )}
                                    </>
                                )}
                                
                                <div className="p-4 bg-teal-50 border border-teal-100 rounded-xl shadow-sm">
                                    <div className="flex gap-3">
                                        <StepNumber 
                                            number={4} 
                                            className="bg-purple-100 text-purple-600" 
                                        />
                                        <div>
                                            <p className="text-sm font-bold text-teal-800 mb-1">שיבוץ חכם:</p>
                                            <p className="text-xs text-teal-700 leading-relaxed">
                                                <span className="font-bold block mb-1">המלצה לשימוש בכרטיס תלמיד:</span>
                                                ברשימה שנוספה למטה לחצו על שם התלמיד <br />
                                                לעריכת כרטיס תלמיד(העדפות פדגוגיות <br />
                                                העדפות והתנהגותיות, מיקום ותמונה).
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                                {chart.students.map(student => (
                                    <div key={student.id} className={`flex items-center justify-between p-3 rounded-lg border border-transparent transition-all group active:bg-slate-100 ${chart.isReadOnly ? 'cursor-default' : 'cursor-pointer hover:bg-slate-50 hover:border-slate-200'}`} onClick={() => !chart.isReadOnly && setStudentToEdit(student)}>
                                        {editingStudentId === student.id ? (
                                            <div className="flex flex-grow items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                                <input
                                                    type="text"
                                                    value={editedStudentName}
                                                    onChange={(e) => setEditedStudentName(e.target.value)}
                                                    onKeyPress={e => e.key === 'Enter' && handleSaveStudentName()}
                                                    onBlur={handleSaveStudentName}
                                                    autoFocus
                                                    className="flex-grow p-2 border rounded-md text-base"
                                                />
                                                <div className="flex items-center">
                                                    <button onClick={handleSaveStudentName} className="p-2 text-green-500 hover:text-green-700 transition-all active:scale-110"><CheckIcon className="h-6 w-6" /></button>
                                                    <button onClick={() => setEditingStudentId(null)} className="p-2 text-red-500 hover:text-red-700 transition-all active:scale-110"><XIcon className="h-6 w-6" /></button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="text-right flex-grow flex items-center justify-end">
                                                    <span className={`font-bold text-base ${student.gender === 'זכר' ? 'text-sky-600' : student.gender === 'נקבה' ? 'text-pink-500' : 'text-slate-800'}`}>{student.name}</span>
                                                    {student.gender && <span className={`text-xs mr-2 font-medium ${student.gender === 'זכר' ? 'text-sky-400' : 'text-pink-400'}`}>{`(${student.gender === 'זכר' ? 'ז' : 'נ'})`}</span>}
                                                </div>
                                                <div className="flex items-center md:opacity-0 group-hover:opacity-100 transition-opacity gap-1">
                                                    <button onClick={(e) => { e.stopPropagation(); handleStartEditName(student); }} className="p-2 text-slate-400 hover:text-sky-500 transition-all active:scale-110" title="ערוך שם">
                                                        <PencilIcon className="h-5 w-5" />
                                                    </button>
                                                    <button onClick={(e) => { e.stopPropagation(); handleRemoveStudent(student.id); }} className="p-2 text-slate-400 hover:text-rose-500 transition-all active:scale-110" title="מחק תלמיד">
                                                        <TrashIcon className="h-5 w-5" />
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                ))}
                                </div>
                            </div>
                        </CollapsibleSection>
                    </div>
                </div>
                <div className="p-6 border-t mt-auto bg-white flex items-center gap-3">
                    <StepNumber 
                        number={5} 
                        className="bg-teal-500 text-white w-8 h-8 text-sm" 
                    />
                    <button onClick={() => onGenerate(chart, chart.layoutType === 'rows' ? fullLayout : null)} className="flex-1 py-3 bg-teal-500 text-white rounded-lg hover:bg-teal-600 font-bold text-lg shadow-lg hover:shadow-xl transition-all active:scale-95">
                        {chart.layoutType === 'rows' ? 'צור מפת כיתה' : 'צור קבוצות'}
                    </button>
                </div>
            </aside>
             {studentToEdit && (
                <StudentModal 
                    student={studentToEdit}
                    chart={chart}
                    onClose={() => setStudentToEdit(null)}
                    onSave={handleSaveStudent}
                />
            )}
            {showSmartImport && (
                <SmartImportModal 
                    onClose={() => setShowSmartImport(false)}
                    onConfirm={handleSmartImportConfirm}
                />
            )}
        </div>
    );
};

export default EditorScreen;
