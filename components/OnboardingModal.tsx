import React, { useState } from 'react';
import { UserProfile } from '../types';
import { auth, createUserProfile } from '../services/firebase';
import { X } from 'lucide-react';

interface OnboardingModalProps {
    email: string;
    uid: string;
    onComplete: (profile: UserProfile) => void;
    onLogout: () => void;
}

const OnboardingModal: React.FC<OnboardingModalProps> = ({ email, uid, onComplete, onLogout }) => {
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [schoolName, setSchoolName] = useState('');
    const [location, setLocation] = useState('');
    const [subjects, setSubjects] = useState('');
    const [classes, setClasses] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firstName || !lastName || !schoolName) {
            setError('אנא מלא את כל שדות החובה (שם פרטי, שם משפחה ושם בית ספר)');
            return;
        }

        setLoading(true);
        setError(null);

        const now = new Date().toISOString();
        const trimmedEmail = email.trim().toLowerCase();
        const isSuperAdmin = trimmedEmail === 'lirondavid3@gmail.com';
        const profile: UserProfile = {
            uid,
            email: trimmedEmail,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            schoolName: schoolName.trim(),
            location: location.trim(),
            subjects: subjects.split(',').map(s => s.trim()).filter(s => s),
            classes: classes.split(',').map(c => c.trim()).filter(c => c),
            role: isSuperAdmin ? 'admin' : 'user',
            isFrozen: false,
            subscriptionPlan: isSuperAdmin ? 'pro' : 'free',
            subscriptionExpiry: isSuperAdmin ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() : '',
            stats: {
                firstLogin: now,
                lastLogin: now,
                loginCount: 1,
                loginHistory: [now]
            },
            shareHistory: [],
            notifications: []
        };

        try {
            await createUserProfile(profile);
            onComplete(profile);
        } catch (err) {
            console.error('Error creating profile:', err);
            setError('אירעה שגיאה בשמירת הפרופיל. אנא נסה שוב.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-300 relative overflow-hidden">
                {/* Header with X */}
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white z-10">
                    <button 
                        onClick={onLogout}
                        className="text-slate-400 hover:text-slate-600 transition-all p-1 hover:bg-slate-100 rounded-full"
                        title="סגור והתנתק"
                    >
                        <X size={24} />
                    </button>
                    <div className="text-right">
                        <h2 className="text-2xl font-black text-slate-800">ברוך הבא!</h2>
                    </div>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-8 pt-4">
                    <div className="mb-6">
                        <button 
                            onClick={onLogout}
                            className="w-full bg-rose-50 text-rose-700 py-2 rounded-xl text-xs font-bold hover:bg-rose-100 transition-all border border-rose-100 mb-4 flex items-center justify-center gap-2"
                        >
                            <span>←</span>
                            התנתקות / החלפת חשבון
                        </button>
                        <p className="text-slate-500 font-medium text-center">לפני שנתחיל, נשמח להכיר אותך קצת יותר</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1 text-right">שם פרטי *</label>
                                <input 
                                    type="text" 
                                    value={firstName} 
                                    onChange={e => setFirstName(e.target.value)}
                                    className="w-full p-3 border-2 border-slate-100 rounded-xl focus:border-teal-500 focus:ring-0 transition-all text-right"
                                    placeholder="ישראל"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1 text-right">שם משפחה *</label>
                                <input 
                                    type="text" 
                                    value={lastName} 
                                    onChange={e => setLastName(e.target.value)}
                                    className="w-full p-3 border-2 border-slate-100 rounded-xl focus:border-teal-500 focus:ring-0 transition-all text-right"
                                    placeholder="ישראלי"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1 text-right">שם בית ספר *</label>
                            <input 
                                type="text" 
                                value={schoolName} 
                                onChange={e => setSchoolName(e.target.value)}
                                className="w-full p-3 border-2 border-slate-100 rounded-xl focus:border-teal-500 focus:ring-0 transition-all text-right"
                                placeholder="למשל: תיכון רבין"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1 text-right">מיקום בית הספר</label>
                            <input 
                                type="text" 
                                value={location} 
                                onChange={e => setLocation(e.target.value)}
                                className="w-full p-3 border-2 border-slate-100 rounded-xl focus:border-teal-500 focus:ring-0 transition-all text-right"
                                placeholder="עיר / יישוב"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1 text-right">מקצועות שאתה מלמד</label>
                            <input 
                                type="text" 
                                value={subjects} 
                                onChange={e => setSubjects(e.target.value)}
                                className="w-full p-3 border-2 border-slate-100 rounded-xl focus:border-teal-500 focus:ring-0 transition-all text-right"
                                placeholder="למשל: מתמטיקה, אנגלית (מופרד בפסיקים)"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1 text-right">כיתות שאתה מלמד</label>
                            <input 
                                type="text" 
                                value={classes} 
                                onChange={e => setClasses(e.target.value)}
                                className="w-full p-3 border-2 border-slate-100 rounded-xl focus:border-teal-500 focus:ring-0 transition-all text-right"
                                placeholder="למשל: ח-ב, ט-מיצוי, י'3 (מופרד בפסיקים)"
                            />
                        </div>

                        {error && (
                            <div className="bg-rose-50 text-rose-600 p-3 rounded-xl text-sm font-bold text-center border border-rose-100">
                                {error}
                            </div>
                        )}

                        <button 
                            type="submit" 
                            disabled={loading}
                            className="w-full bg-teal-600 text-white font-black py-4 rounded-xl text-lg hover:bg-teal-700 shadow-lg hover:shadow-teal-600/20 transition-all disabled:opacity-50 active:scale-95"
                        >
                            {loading ? 'שומר נתונים...' : 'השלם הרשמה והתחל לעבוד'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default OnboardingModal;
