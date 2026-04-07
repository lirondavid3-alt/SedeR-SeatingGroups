
import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMessage: '',
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, errorMessage: error.message };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private parseErrorMessage(message: string) {
    if (message.includes('network-request-failed') || message.includes('unavailable')) {
      return "שגיאת תקשורת עם השרת. ייתכן שהחיבור לאינטרנט הופסק או שהדפדפן חוסם את הבקשה.";
    }
    try {
      const parsed = JSON.parse(message);
      if (parsed.error && parsed.operationType) {
        let errText = parsed.error;
        if (errText.includes('network-request-failed') || errText.includes('unavailable')) {
          errText = "שגיאת תקשורת עם השרת";
        }
        return `שגיאת מסד נתונים: ${errText} (פעולה: ${parsed.operationType}, נתיב: ${parsed.path})`;
      }
    } catch (e) {
      // Not a JSON error message
    }
    return message;
  }

  public render() {
    if (this.state.hasError) {
      const displayMessage = this.parseErrorMessage(this.state.errorMessage);
      
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4" dir="rtl">
          <div className="bg-white p-8 rounded-xl shadow-xl max-w-md w-full text-center">
            <div className="text-rose-500 mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-4">אופס! משהו השתבש</h2>
            <p className="text-slate-600 mb-6">
              נתקלנו בשגיאה לא צפויה. נסה לרענן את הדף או ליצור קשר עם התמיכה אם הבעיה נמשכת.
            </p>
            <div className="bg-slate-50 p-3 rounded border border-slate-200 text-sm text-slate-500 font-mono break-all mb-6 text-right">
              {displayMessage}
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-teal-500 text-white rounded-lg font-bold hover:bg-teal-600 transition-colors"
            >
              רענן דף
            </button>
          </div>
        </div>
      );
    }

    const { children } = this.props;
    return children;
  }
}

export default ErrorBoundary;
