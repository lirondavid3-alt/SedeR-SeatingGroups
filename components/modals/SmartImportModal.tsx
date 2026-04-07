import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
    CameraIcon, 
    UploadIcon, 
    FileTextIcon, 
    CheckIcon, 
    XIcon, 
    Loader2Icon,
    AlertCircleIcon,
    RefreshCwIcon,
    PlusIcon,
    Trash2Icon
} from 'lucide-react';
import { extractStudentsFromImage, ExtractedStudent } from '../../services/visionService';
import { auth } from '../../services/firebase';
import { toast } from 'sonner';

interface SmartImportModalProps {
    onClose: () => void;
    onConfirm: (students: ExtractedStudent[]) => void;
}

const SmartImportModal: React.FC<SmartImportModalProps> = ({ onClose, onConfirm }) => {
    const [step, setStep] = useState<'upload' | 'processing' | 'review'>('upload');
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [extractedStudents, setExtractedStudents] = useState<ExtractedStudent[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isConfirming, setIsConfirming] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    const compressAndGetBase64 = (file: File): Promise<{ base64: string, mimeType: string }> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const maxDimension = 400; // Even smaller for extreme stability
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > maxDimension) {
                            height *= maxDimension / width;
                            width = maxDimension;
                        }
                    } else {
                        if (height > maxDimension) {
                            width *= maxDimension / height;
                            height = maxDimension;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        ctx.imageSmoothingEnabled = true;
                        ctx.imageSmoothingQuality = 'medium';
                        ctx.drawImage(img, 0, 0, width, height);
                    }

                    // Get base64 directly from canvas to save memory
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.4);
                    const base64 = dataUrl.substring(dataUrl.indexOf(',') + 1);
                    
                    // Clean up
                    canvas.width = 0;
                    canvas.height = 0;
                    
                    resolve({ base64, mimeType: 'image/jpeg' });
                };
                img.onerror = () => reject(new Error("שגיאה בטעינת התמונה"));
                img.src = e.target?.result as string;
            };
            reader.onerror = () => reject(new Error("שגיאה בקריאת הקובץ"));
            reader.readAsDataURL(file);
        });
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        try {
            const selectedFile = e.target.files?.[0];
            if (!selectedFile) return;

            if (!selectedFile.type.startsWith('image/') && selectedFile.type !== 'application/pdf') {
                toast.error('אנא העלה/י קובץ תמונה או PDF בלבד.');
                return;
            }

            setStep('processing');
            setIsProcessing(true);
            setError(null);
            toast.info("מעבד את הקובץ...");

            let base64: string;
            let mimeType: string;

            if (selectedFile.type === 'application/pdf') {
                const reader = new FileReader();
                base64 = await new Promise((resolve, reject) => {
                    reader.onload = () => {
                        const res = reader.result as string;
                        resolve(res.substring(res.indexOf(',') + 1));
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(selectedFile);
                });
                mimeType = 'application/pdf';
            } else {
                const compressed = await compressAndGetBase64(selectedFile);
                base64 = compressed.base64;
                mimeType = compressed.mimeType;
            }
            
            if (!auth.currentUser) {
                throw new Error("החיבור נותק. אנא התחבר/י שוב.");
            }

            const students = await extractStudentsFromImage(base64, mimeType);
            
            if (!students || students.length === 0) {
                throw new Error("לא נמצאו שמות תלמידים בתמונה.");
            }
            
            setExtractedStudents(students);
            setStep('review');
            toast.success("השמות חולצו בהצלחה!");
        } catch (err: any) {
            console.error("Import error:", err);
            setError(err.message || "אירעה שגיאה בעיבוד.");
            toast.error(err.message || "אירעה שגיאה בעיבוד.");
            setStep('upload');
        } finally {
            setIsProcessing(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleClose = () => {
        console.log("Closing SmartImportModal");
        onClose();
    };

    const handleCancelProcessing = () => {
        setIsProcessing(false);
        setStep('upload');
        setError(null);
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
            setPreviewUrl(null);
        }
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleRemoveStudent = (index: number) => {
        setExtractedStudents(prev => prev.filter((_, i) => i !== index));
    };

    const handleUpdateStudent = (index: number, updates: Partial<ExtractedStudent>) => {
        setExtractedStudents(prev => prev.map((s, i) => i === index ? { ...s, ...updates } : s));
    };

    const handleAddStudent = () => {
        setExtractedStudents(prev => [...prev, { name: '', gender: '' }]);
    };

    const handleConfirm = () => {
        console.log("Confirming smart import students...");
        const validStudents = extractedStudents.filter(s => s.name.trim() !== '');
        if (validStudents.length === 0) {
            toast.error('לא נמצאו תלמידים תקניים ברשימה.');
            return;
        }
        
        try {
            onConfirm(validStudents);
            handleClose();
        } catch (err) {
            console.error("Error during handleConfirm:", err);
            toast.error("שגיאה בשמירת התלמידים.");
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-[100] p-4 overflow-hidden">
            <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200"
            >
                {/* Header */}
                <div className="p-6 border-b flex items-center justify-between bg-slate-50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-teal-100 text-teal-600 rounded-lg">
                            <FileTextIcon className="h-6 w-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-800">העלאת רשימת תלמידים</h2>
                            <p className="text-xs text-slate-500">תמונה מהנייד והמחשב / PDF מהמחשב בלבד</p>
                        </div>
                    </div>
                    <button 
                        onClick={handleClose}
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"
                    >
                        <XIcon className="h-6 w-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    <AnimatePresence mode="wait">
                        {step === 'upload' && (
                            <motion.div 
                                key="upload"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-8 py-4"
                            >
                                {error && (
                                    <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl">
                                        <div className="flex items-start gap-3 text-rose-700">
                                            <AlertCircleIcon className="h-5 w-5 mt-0.5 flex-shrink-0" />
                                            <div className="flex-1">
                                                <p className="text-sm font-medium">{error}</p>
                                                <div className="mt-3 flex flex-wrap gap-2">
                                                    <button
                                                        onClick={() => {
                                                            setStep('upload');
                                                            setError(null);
                                                        }}
                                                        className="text-xs bg-rose-100 hover:bg-rose-200 text-rose-700 px-3 py-1.5 rounded-lg font-bold transition-colors"
                                                    >
                                                        נסה/י שוב
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setStep('review');
                                                            setExtractedStudents([]);
                                                            setError(null);
                                                        }}
                                                        className="text-xs bg-white border border-rose-200 hover:bg-rose-50 text-rose-700 px-3 py-1.5 rounded-lg font-bold transition-colors"
                                                    >
                                                        הכנס/י שמות ידנית
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="flex flex-col gap-4">
                                    {/* Upload Option */}
                                    <button 
                                        onClick={() => fileInputRef.current?.click()}
                                        className="group p-8 border-2 border-dashed border-slate-200 rounded-2xl hover:border-teal-400 hover:bg-teal-50 transition-all flex flex-col items-center gap-4 text-center bg-slate-50/50"
                                    >
                                        <div className="p-4 bg-white text-slate-400 group-hover:bg-teal-100 group-hover:text-teal-600 rounded-full transition-all shadow-sm">
                                            <UploadIcon className="h-10 w-10" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-700 group-hover:text-teal-700">לחצו לבחירת קובץ</h3>
                                            <p className="text-xs text-slate-500 mt-1">תמונה או קובץ PDF של רשימת השמות</p>
                                        </div>
                                        <input 
                                            type="file" 
                                            ref={fileInputRef} 
                                            onChange={handleFileChange} 
                                            className="hidden" 
                                            accept=".jpg,.jpeg,.png,.webp,.pdf,image/*,application/pdf"
                                        />
                                    </button>

                                    {/* Manual Entry Option - Always visible to reduce frustration */}
                                    <button 
                                        onClick={() => {
                                            setStep('review');
                                            setExtractedStudents([]);
                                            setError(null);
                                        }}
                                        className="p-4 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all flex items-center justify-center gap-3 text-slate-600 font-bold"
                                    >
                                        <PlusIcon className="h-5 w-5 text-teal-500" />
                                        <span>הכנסת שמות ידנית (ללא סריקה)</span>
                                    </button>
                                </div>

                                <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 flex items-start gap-3">
                                    <AlertCircleIcon className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                                    <div className="text-sm text-amber-800">
                                        <p className="font-bold mb-1">טיפ להעלאה מוצלחת:</p>
                                        <ul className="list-disc list-inside space-y-1">
                                            <li>וודאו שהטקסט בתמונה ברור וקריא</li>
                                            <li>בצילום מהנייד, צלמו את הדף מלמעלה בצורה ישרה</li>
                                            <li>וודאו שכל שמות התלמידים מופיעים בבירור</li>
                                        </ul>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {step === 'processing' && (
                            <motion.div 
                                key="processing"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="flex flex-col items-center justify-center py-12 space-y-6"
                            >
                                <div className="relative">
                                    <div className="h-24 w-24 rounded-full border-4 border-teal-100 border-t-teal-500 animate-spin"></div>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <RefreshCwIcon className="h-8 w-8 text-teal-500 animate-pulse" />
                                    </div>
                                </div>
                                <div className="text-center">
                                    <h3 className="text-xl font-bold text-slate-800 mb-2">
                                        מנתח את הרשימה...
                                    </h3>
                                    <p className="text-slate-500 max-w-[250px] mx-auto">
                                        הבינה המלאכותית קוראת את השמות מהתמונה. זה עשוי לקחת כמה שניות.
                                    </p>
                                </div>
                                
                                <button
                                    onClick={handleCancelProcessing}
                                    className="mt-4 px-6 py-2 text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    ביטול
                                </button>
                            </motion.div>
                        )}

                        {step === 'review' && (
                            <motion.div 
                                key="review"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                className="space-y-6"
                            >
                                <div className="flex items-center justify-between">
                                    <h3 className="font-bold text-slate-800">זיהינו {extractedStudents.length} תלמידים:</h3>
                                    <button 
                                        onClick={handleAddStudent}
                                        className="flex items-center gap-1 text-sm font-bold text-teal-600 hover:text-teal-700"
                                    >
                                        <PlusIcon className="h-4 w-4" />
                                        הוסף תלמיד ידנית
                                    </button>
                                </div>

                                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                    {extractedStudents.map((student, index) => (
                                        <div key={index} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 group hover:bg-white hover:border-teal-200 transition-all">
                                            <span className="text-xs font-bold text-slate-400 w-6">{index + 1}</span>
                                            
                                            <input 
                                                type="text" 
                                                value={student.name}
                                                onChange={(e) => handleUpdateStudent(index, { name: e.target.value })}
                                                className="flex-1 bg-transparent border-none focus:ring-0 font-bold text-slate-700 p-0"
                                                placeholder="שם התלמיד"
                                            />

                                            <div className="flex items-center gap-1 bg-white rounded-lg p-1 border shadow-sm">
                                                <button 
                                                    onClick={() => handleUpdateStudent(index, { gender: 'זכר' })}
                                                    className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${student.gender === 'זכר' ? 'bg-sky-500 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-100'}`}
                                                >
                                                    זכר
                                                </button>
                                                <button 
                                                    onClick={() => handleUpdateStudent(index, { gender: 'נקבה' })}
                                                    className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${student.gender === 'נקבה' ? 'bg-pink-500 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-100'}`}
                                                >
                                                    נקבה
                                                </button>
                                            </div>

                                            <button 
                                                onClick={() => handleRemoveStudent(index)}
                                                className="p-2 text-slate-300 hover:text-rose-500 transition-all"
                                            >
                                                <Trash2Icon className="h-4 w-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                <div className="p-4 bg-teal-50 border border-teal-100 rounded-xl text-sm text-teal-800 flex items-start gap-3">
                                    <CheckIcon className="h-5 w-5 text-teal-600 mt-0.5" />
                                    <p>אנא בדקו שהשמות נכונים. ניתן לערוך כל שם ישירות ברשימה.</p>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Footer */}
                <div className="p-6 border-t bg-slate-50 flex items-center justify-between">
                    {step === 'review' ? (
                        <>
                            <button 
                                onClick={() => setStep('upload')}
                                className="px-6 py-2.5 text-slate-600 font-bold hover:bg-slate-200 rounded-xl transition-all"
                            >
                                סרוק שוב
                            </button>
                            <button 
                                onClick={handleConfirm}
                                disabled={isConfirming}
                                className="px-10 py-2.5 bg-teal-500 text-white font-bold rounded-xl hover:bg-teal-600 shadow-lg shadow-teal-200 transition-all active:scale-95 flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {isConfirming ? (
                                    <>
                                        <Loader2Icon className="h-5 w-5 animate-spin" />
                                        מעדכן רשימה...
                                    </>
                                ) : (
                                    <>
                                        <CheckIcon className="h-5 w-5" />
                                        אישור והוספה לרשימה
                                    </>
                                )}
                            </button>
                        </>
                    ) : (
                        <div className="w-full flex justify-center">
                            <p className="text-xs text-slate-400">המידע מעובד בצורה מאובטחת על ידי בינה מלאכותית</p>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
};

export default SmartImportModal;
