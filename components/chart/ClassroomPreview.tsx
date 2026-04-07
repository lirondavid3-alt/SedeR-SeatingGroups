import React from 'react';
import { GeneratedRowsLayout, RowsLayoutDetails } from '../../types';
import { DoorIcon, WindowIcon } from '../icons';

interface ClassroomPreviewProps {
    layoutDetails: RowsLayoutDetails;
    generatedLayout: GeneratedRowsLayout | null;
}

const ClassroomPreview: React.FC<ClassroomPreviewProps> = ({ layoutDetails, generatedLayout }) => {
    const { columnConfiguration = [], teacherDeskPosition, windowPosition, doorPosition } = layoutDetails;
    const numCols = columnConfiguration.length;
    const maxRows = Math.max(0, ...columnConfiguration);

    const TeacherDesk = () => <div className="bg-slate-300 text-slate-600 flex items-center justify-center rounded-lg text-sm font-bold w-[110px] h-[40px]">שולחן מורה</div>;
    const Door = () => <div className="flex items-center gap-1 text-amber-600/80 text-sm"><DoorIcon className="h-7 w-7" /><span>דלת</span></div>;
    const WindowEl = () => <div className="flex items-center gap-1 text-green-600/80 text-sm"><WindowIcon className="h-7 w-7" /><span>חלון</span></div>;
    
    const sideItems = (
        <div className="flex justify-center items-center space-x-6 space-x-reverse">
            <div className="flex items-center space-x-4 space-x-reverse">
                {doorPosition === 'right' && <Door />} 
                {windowPosition === 'right' && <WindowEl />}
            </div>
            <TeacherDesk />
            <div className="flex items-center space-x-4 space-x-reverse">
                {doorPosition === 'left' && <Door />} 
                {windowPosition === 'left' && <WindowEl />}
            </div>
        </div>
    );

    const desks = generatedLayout?.desks || [];

    return (
        <div className="w-full bg-white rounded-xl shadow-lg p-6 transform scale-90">
            <div className="flex flex-col items-center">
                {teacherDeskPosition === 'top' && <div className="mb-6 w-full flex justify-center">{sideItems}</div>}
                
                <div className="inline-grid gap-x-2 gap-y-3" style={{ gridTemplateColumns: `auto repeat(${numCols}, minmax(120px, 1fr))`}}>
                    <div /> 
                    {Array.from({ length: numCols }).map((_, i) => <div key={i} className="text-center font-bold text-slate-500 text-sm">טור {i + 1}</div>)}
                    
                    {Array.from({ length: maxRows }).map((_, rowIndex) => (
                        <React.Fragment key={rowIndex}>
                            <div className="text-center font-bold text-slate-500 text-sm flex items-center justify-center min-w-[4rem]">שורה {teacherDeskPosition === 'bottom' ? maxRows - rowIndex : rowIndex + 1}</div>
                            {Array.from({ length: numCols }).map((_, colIndex) => {
                                const physicalRow = rowIndex + 1;
                                const deskCol = colIndex + 1;
                                const rowsInThisCol = columnConfiguration[colIndex];

                                // Calculate relative row (1 = closest to teacher)
                                let deskRelativeRow;
                                if (teacherDeskPosition === 'top') {
                                    deskRelativeRow = physicalRow;
                                } else { // teacher is at the bottom
                                    deskRelativeRow = maxRows + 1 - physicalRow;
                                }

                                // Only render desk if it's within the configured rows for this column
                                const shouldRenderDesk = deskRelativeRow <= rowsInThisCol;

                                if (!shouldRenderDesk) {
                                    return <div key={colIndex} className="w-[120px] h-[70px]" aria-hidden="true"></div>;
                                }

                                const desk = desks.find(d => d.row === deskRelativeRow && d.col === deskCol);
                                const student1 = desk?.students.find(s => s.seat === 1);
                                const student2 = desk?.students.find(s => s.seat === 2);
                                return (
                                    <div key={colIndex} className="bg-white rounded-md border-2 border-slate-300 overflow-hidden w-[120px] h-[70px] flex">
                                        <div className="w-1/2 border-l border-slate-300 flex flex-col items-center justify-center p-1">
                                             {student1 && <span className="text-slate-700 text-xs font-medium text-center break-words">{student1.name}</span>}
                                        </div>
                                        <div className="w-1/2 flex flex-col items-center justify-center p-1">
                                            {student2 && <span className="text-slate-700 text-xs font-medium text-center break-words">{student2.name}</span>}
                                        </div>
                                    </div>
                                );
                            })}
                        </React.Fragment>
                    ))}
                </div>
                
                {teacherDeskPosition === 'bottom' && <div className="mt-6 w-full flex justify-center">{sideItems}</div>}
            </div>
             {generatedLayout?.unplacedStudents && generatedLayout.unplacedStudents.length > 0 && (
                <div className="mt-4 pt-4 border-t-2 border-dashed">
                    <h3 className="text-sm font-bold text-rose-500 mb-2 text-center">תלמידים עם העדפות שלא שובצו בתצוגה:</h3>
                    <ul className="list-disc list-inside text-right max-w-md mx-auto space-y-1 text-xs">
                        {generatedLayout.unplacedStudents.map(s => (
                            <li key={s.name} className="text-slate-600">
                                <strong className="font-semibold text-slate-700">{s.name}:</strong> {s.reason}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default ClassroomPreview;