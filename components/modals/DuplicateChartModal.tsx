import React from 'react';
import { Chart } from '../../types';

interface DuplicateChartModalProps {
    chart: Chart;
    onClose: () => void;
    onDuplicate: (keepConstraints: boolean) => void;
}

const DuplicateChartModal: React.FC<DuplicateChartModalProps> = ({ chart, onClose, onDuplicate }) => {
    const formattedDate = new Date(chart.creationDate).toLocaleDateString('he-IL');
    const chartType = chart.layoutType === 'rows' ? 'המפה' : 'הקבוצה';

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4 animate-fade-in">
            <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-md">
                <h2 className="text-2xl font-bold mb-4 text-slate-800">שכפול {chart.layoutType === 'rows' ? 'מפה' : 'קבוצה'}</h2>
                <p className="text-slate-600 mb-6">
                    כיצד לשכפל את {chartType} של כיתה <span className="font-semibold text-slate-700">{chart.className}</span> מתאריך {formattedDate}?
                </p>
                <div className="flex flex-col gap-4">
                    <button
                        onClick={() => onDuplicate(true)}
                        className="w-full text-right bg-slate-50 hover:bg-sky-100 border border-slate-200 hover:border-sky-300 p-4 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-sky-400"
                    >
                        <h3 className="font-bold text-slate-800">שכפול עם העדפות</h3>
                        <p className="text-sm text-slate-600">צור עותק חדש עם אותה רשימת תלמידים וכל ההעדפות שהוגדרו עבורם.</p>
                    </button>
                    <button
                        onClick={() => onDuplicate(false)}
                        className="w-full text-right bg-slate-50 hover:bg-sky-100 border border-slate-200 hover:border-sky-300 p-4 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-sky-400"
                    >
                        <h3 className="font-bold text-slate-800">שכפול רשימת תלמידים בלבד</h3>
                        <p className="text-sm text-slate-600">צור עותק עם אותה רשימת תלמידים, אך ללא העדפות כלל (להתחלה חדשה).</p>
                    </button>
                </div>
                <div className="flex justify-end mt-6">
                    <button
                        onClick={onClose}
                        className="py-2 px-6 bg-slate-200 text-slate-700 rounded-md hover:bg-slate-300 font-semibold"
                    >
                        ביטול
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DuplicateChartModal;
