import React, { useState } from 'react';

interface CreateChartModalProps {
    onClose: () => void;
    onSave: (className: string, layoutType: 'rows' | 'groups') => void;
}

const CreateChartModal: React.FC<CreateChartModalProps> = ({ onClose, onSave }) => {
    const [className, setClassName] = useState('');
    const [layoutType, setLayoutType] = useState<'rows' | 'groups'>('rows');

    const handleSave = () => {
        if (className.trim()) {
            onSave(className.trim(), layoutType);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-md animate-fade-in">
                <h2 className="text-2xl font-bold mb-4 text-slate-800">יצירה חדשה</h2>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">סוג</label>
                        <div className="flex border rounded-md overflow-hidden">
                            <button onClick={() => setLayoutType('rows')} className={`py-2 px-4 text-sm font-semibold flex-1 ${layoutType === 'rows' ? 'bg-teal-500 text-white' : 'text-slate-600 bg-slate-100 hover:bg-slate-200'}`}>
                                סידור ישיבה
                            </button>
                            <button onClick={() => setLayoutType('groups')} className={`py-2 px-4 text-sm font-semibold flex-1 border-r ${layoutType === 'groups' ? 'bg-teal-500 text-white' : 'text-slate-600 bg-slate-100 hover:bg-slate-200'}`}>
                                חלוקה לקבוצות
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">שם הכיתה</label>
                        <input value={className} onChange={(e) => setClassName(e.target.value)} type="text" placeholder="לדוגמה: ח-ב, ט-מיצוי, י'3" className="w-full p-2 border rounded-md" required />
                    </div>
                    <div className="flex justify-end space-x-3 space-x-reverse pt-4">
                        <button onClick={onClose} className="py-2 px-4 bg-slate-200 text-slate-700 rounded-md hover:bg-slate-300">ביטול</button>
                        <button onClick={handleSave} className="py-2 px-4 bg-sky-500 text-white rounded-md hover:bg-sky-600">צור</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CreateChartModal;