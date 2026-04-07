import React from 'react';

interface ConfirmDeleteModalProps {
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
}

const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({ message, onConfirm, onCancel }) => {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4 animate-fade-in">
            <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-sm text-center">
                <h2 className="text-xl font-bold mb-4 text-slate-800">אישור מחיקה</h2>
                <p className="text-slate-600 mb-6">{message}</p>
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
                        מחק
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmDeleteModal;
