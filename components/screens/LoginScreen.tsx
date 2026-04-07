
import React, { useState } from 'react';
import { auth, googleProvider } from '../../services/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup } from "firebase/auth";

interface LoginScreenProps {
    onLogin: (email: string) => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isRegistering, setIsRegistering] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showSetupModal, setShowSetupModal] = useState(false);
    const [showResetButton, setShowResetButton] = useState(false);

    const handleGoogleLogin = async () => {
        setLoading(true);
        setError(null);
        setShowResetButton(false);
        
        // Show reset button after 10 seconds if still loading
        const timer = setTimeout(() => {
            if (loading) setShowResetButton(true);
        }, 10000);

        const performLogin = async (retryCount = 0): Promise<void> => {
            try {
                console.log(`Starting Google Login with signInWithPopup (attempt ${retryCount + 1})...`);
                const result = await signInWithPopup(auth, googleProvider);
                console.log("Google Login successful:", result.user.email);
            } catch (err: any) {
                if (err.code === 'auth/network-request-failed' && retryCount < 1) {
                    console.warn("Network error during login, retrying once...");
                    await new Promise(resolve => setTimeout(resolve, 1500));
                    return performLogin(retryCount + 1);
                }
                throw err;
            }
        };

        try {
            await performLogin();
            // Auth state listener in App.tsx will handle the transition
        } catch (err: any) {
            console.error("Google Login Error:", err);
            let msg = "אירעה שגיאה בכניסה עם גוגל.";
            if (err.code === 'auth/popup-closed-by-user') {
                msg = "החלון נסגר לפני השלמת ההתחברות.";
            } else if (err.code === 'auth/operation-not-allowed') {
                msg = "כניסה עם גוגל אינה מופעלת בפרויקט ה-Firebase שלך.";
            } else if (err.code === 'auth/unauthorized-domain') {
                msg = "הדומיין הזה אינו מורשה לכניסה בפרויקט ה-Firebase. יש להוסיף אותו ב-Console.";
            } else if (err.code === 'auth/network-request-failed') {
                msg = "שגיאת תקשורת. ייתכן שהדפדפן חוסם את החיבור. נסה לרענן את הדף.";
            }
            setError(`${msg} (${err.code || 'unknown'})`);
        } finally {
            clearTimeout(timer);
            setLoading(false);
        }
    };

    const handleRefresh = () => {
        window.location.reload();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!email || !email.includes('@')) {
            setError('אנא הכנס כתובת מייל תקינה');
            return;
        }
        if (password.length < 6) {
            setError('הסיסמה חייבת להכיל לפחות 6 תווים');
            return;
        }

        if (!auth) {
            setError('שגיאה בחיבור לשרת. אנא נסה שוב מאוחר יותר.');
            return;
        }

        setLoading(true);
        try {
            if (isRegistering) {
                await createUserWithEmailAndPassword(auth, email, password);
                // Auth state listener in App.tsx will handle the transition
            } else {
                await signInWithEmailAndPassword(auth, email, password);
                // Auth state listener in App.tsx will handle the transition
            }
        } catch (err: any) {
            console.error(err);
            let msg = "אירעה שגיאה בתהליך.";
            if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
                msg = "מייל או סיסמה שגויים.";
            } else if (err.code === 'auth/email-already-in-use') {
                msg = "המייל הזה כבר רשום במערכת.";
            } else if (err.code === 'auth/network-request-failed') {
                msg = "שגיאת תקשורת. ייתכן שהדפדפן חוסם את החיבור. נסה לרענן את הדף.";
            } else if (err.code === 'auth/operation-not-allowed') {
                 msg = "כניסה עם אימייל/סיסמה אינה מופעלת בפרויקט ה-Firebase שלך. יש להפעיל את Authentication.";
            }
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-md mx-auto text-center p-4">
            <div className="bg-white rounded-lg shadow-xl p-8 animate-fade-in relative">
                <h1 className="text-4xl font-black text-slate-800 mb-2 leading-tight">
                    מפות ישיבה<br />
                    וחלוקה לקבוצות
                </h1>
                
                <div className="bg-amber-50 p-4 rounded-lg border border-amber-200 mb-8">
                    <p className="text-lg font-bold text-slate-600">
                        מערכת מחוברת לענן
                    </p>
                    <p className="text-lg font-bold text-slate-600">
                        נתונים נשמרים ומסתנכרנים בין מכשירים
                    </p>
                </div>

                <h2 className="text-2xl font-medium text-slate-600 mb-6">כניסה למערכת</h2>
                
                <button 
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-3 bg-white border border-slate-300 text-slate-700 font-bold py-4 px-6 rounded-xl text-xl hover:bg-slate-50 transition duration-300 disabled:opacity-50 mb-6 shadow-sm"
                >
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="h-6 w-6" />
                    התחברות עם גוגל
                </button>

                <div className="flex items-center my-4">
                    <div className="flex-1 border-t border-slate-200"></div>
                    <span className="px-3 text-slate-400 text-sm">או</span>
                    <div className="flex-1 border-t border-slate-200"></div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="user-email" className="block text-sm font-medium text-slate-700 mb-1 text-right">מייל:</label>
                        <input 
                            type="email" 
                            id="user-email" 
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="your@email.com" 
                            className="w-full p-3 border rounded-md text-right ltr" 
                            required 
                            autoFocus
                            dir="ltr"
                        />
                    </div>
                    <div>
                        <label htmlFor="user-pass" className="block text-sm font-medium text-slate-700 mb-1 text-right">סיסמה:</label>
                        <input 
                            type="password" 
                            id="user-pass" 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="******" 
                            className="w-full p-3 border rounded-md text-right ltr" 
                            required 
                            minLength={6}
                            dir="ltr"
                        />
                    </div>
                    
                    {error && (
                        <div className="bg-rose-50 p-3 rounded-lg border border-rose-200">
                            <p className="text-rose-500 text-sm font-bold mb-2">{error}</p>
                            {error.includes('auth/network-request-failed') && (
                                <button 
                                    type="button"
                                    onClick={handleRefresh}
                                    className="text-xs bg-rose-500 text-white py-1 px-3 rounded hover:bg-rose-600 transition-colors"
                                >
                                    לחץ כאן לרענון הדף
                                </button>
                            )}
                        </div>
                    )}

                    {showResetButton && (
                        <button 
                            type="button"
                            onClick={() => { setLoading(false); setShowResetButton(false); }}
                            className="w-full text-sky-600 text-sm font-medium hover:underline mb-2"
                        >
                            ההתחברות לוקחת יותר מדי זמן? לחץ כאן לביטול
                        </button>
                    )}

                    <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full bg-sky-500 text-white font-bold py-3 px-6 rounded-md text-lg hover:bg-sky-600 transition duration-300 disabled:opacity-50"
                    >
                        {loading ? 'מעבד...' : (isRegistering ? 'הרשמה' : 'כניסה')}
                    </button>
                </form>
                
                <div className="mt-6 pt-4 border-t">
                    <button 
                        onClick={() => { setIsRegistering(!isRegistering); setError(null); }}
                        className="text-sm text-slate-600 hover:text-sky-600 font-medium"
                    >
                        {isRegistering ? 'יש לך כבר חשבון? היכנס כאן' : 'אין לך חשבון? הירשם כאן בחינם'}
                    </button>
                </div>

            </div>
        </div>
    );
};

export default LoginScreen;
