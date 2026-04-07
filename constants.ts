
import { RowsLayoutDetails, GroupsLayoutDetails, Constraints } from './types';

export const DEFAULT_ROWS_LAYOUT: RowsLayoutDetails = { 
    columnConfiguration: [5, 5, 5, 5],
    teacherDeskPosition: 'top', 
    windowPosition: 'left', 
    doorPosition: 'right',
    genderArrangement: 'gender_random',
    levelConsideration: {
        balanced: false,
        strong_weak_neighbor: false,
        challenge_at_edges: false,
    }
};

export const DEFAULT_GROUPS_LAYOUT: GroupsLayoutDetails = { 
    groups: 4 
};

export const DEFAULT_STUDENT_CONSTRAINTS: Constraints = { 
    allowedRows: null,
    allowedCols: null,
    allowedSeats: null,
    sitAlone: false, 
    sitWith: [], 
    dontSitWith: [], 
};

export const SUBJECTS: string[] = [
    'מתמטיקה',
    'אנגלית', 
    'מדעים',
    'עברית',
    'תנ"ך',
    'הסטוריה',
    'ספרות',
    'ערבית',
    'חנ"ג',
    'של"ח',
    'אחר'
];