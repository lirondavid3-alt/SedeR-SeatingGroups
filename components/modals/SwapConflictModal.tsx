import React from 'react';
import { Violation } from '../../types';

interface SwapConflictModalProps {
    violations: Violation[];
    onConfirm: () => void;
    onCancel: () => void;
}

const SwapConflictModal: React.FC<SwapConflictModalProps> = ({ violations, onConfirm, onCancel }) => {
    // Group violations by student
    const violationsByStudent = violations.reduce((acc, violation) => {
        if (!acc[violation.studentName]) {
            acc[violation.studentName] = [];
        }
        acc[violation.studentName].push(violation.message);
        return acc;
    }, {} as Record<string, string[]>);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4 animate-fade-in">
            <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-md">
                <h2 className="text-xl font-bold mb-4 text-rose-700">התנגשות העדפות</h2>
                <p className="text-slate-600 mb-6">ההחלפה המבוקשת פוגעת בהעדפות הבאות:</p>
                <div className="space-y-4 mb-6 bg-rose-50 border border-rose-200 rounded-md p-4 max-h-60 overflow-y-auto">
                    {/* FIX: Explicitly type 'messages' as string[] to resolve 'unknown' type error from Object.entries. */}
                    {Object.entries(violationsByStudent).map(([studentName, messages]: [string, string[]]) => (
                        <div key={studentName}>
                            <h3 className="font-bold text-slate-800">{studentName}</h3>
                            <ul className="list-disc list-inside mr-4 text-slate-700">
                                {messages.map((message, index) => (
                                    <li key={index}>{message}</li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
                <p className="text-slate-600 font-medium mb-6 text-center">האם לבצע את ההחלפה למרות זאת?</p>
                <div className="flex justify-center space-x-4 space-x-reverse">
                    <button 
                        onClick={onCancel} 
                        className="py-2 px-6 bg-slate-200 text-slate-700 rounded-md hover:bg-slate-300 font-semibold"
                    >
                        ביטול
                    </button>
                    <button 
                        onClick={onConfirm} 
                        className="py-2 px-6 bg-rose-500 text-white rounded-md hover:bg-rose-600 font-semibold"
                    >
                        החלף בכל זאת
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SwapConflictModal;