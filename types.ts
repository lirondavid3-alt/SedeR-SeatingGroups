

export interface UserPreferences {
    theme: 'light' | 'dark';
    language: 'he' | 'en';
    defaultLayoutType: 'rows' | 'groups';
}

export interface LoginStats {
    firstLogin: string;
    lastLogin: string;
    loginCount: number;
    loginHistory: string[];
    activityLog?: {
        timestamp: string;
        action: string;
        details: string;
    }[];
}

export interface ShareInfo {
    uid: string;
    email: string;
    name: string;
    schoolName: string;
    timestamp: string;
    message?: string;
    role: 'viewer' | 'editor';
}

export interface Notification {
    id: string;
    type: 'share' | 'system';
    title: string;
    message: string;
    fromUserId?: string;
    fromUserName?: string;
    fromEmail?: string;
    chartId?: string;
    chartName?: string;
    timestamp: string;
    read: boolean;
}

export interface UserProfile {
    uid: string;
    email: string;
    firstName: string;
    lastName: string;
    schoolName: string;
    location: string;
    subjects: string[];
    classes: string[];
    role: 'admin' | 'user';
    isFrozen?: boolean;
    subscriptionPlan?: 'free' | 'pro' | 'enterprise';
    subscriptionExpiry?: string;
    preferences?: UserPreferences;
    stats: LoginStats;
    shareHistory: ShareInfo[];
    notifications: Notification[];
}

export interface User {
    uid: string;
    email: string;
    name: string;
    picture: string | null;
    role: 'admin' | 'user';
    isFrozen?: boolean;
    subscriptionPlan?: 'free' | 'pro' | 'enterprise';
    subscriptionExpiry?: string;
    preferences?: UserPreferences;
}

export interface SocialConstraint {
    student1: string;
    student2: string;
    type: 'together' | 'separate';
}

export interface Class {
    id: string;
    name: string;
    creationDate: string;
    socialConstraints: SocialConstraint[];
    lastUpdated: string;
}

export interface Constraints {
    allowedRows: number[] | null;
    allowedCols: number[] | null;
    allowedSeats: number[] | null; // Can contain 1 or 2
    sitAlone: boolean;
    sitWith: string[];
    dontSitWith: string[];
}

export interface Student {
    id: string;
    name: string;
    picture?: string;
    gender: 'זכר' | 'נקבה' | '';
    ratings: { [subject: string]: number };
    academicLevel?: number; // 1-5
    behaviorLevel?: number; // 1-5
    constraints: Constraints;
}

export interface LevelConsiderationOptions {
    balanced: boolean;
    strong_weak_neighbor: boolean;
    challenge_at_edges: boolean;
}

export interface RowsLayoutDetails {
    columnConfiguration: number[];
    // Old properties - kept optional for migration
    rows?: number;
    cols?: number;
    
    teacherDeskPosition: 'top' | 'bottom';
    windowPosition: 'left' | 'right';
    doorPosition: 'left' | 'right';
    genderArrangement?: 'gender_random' | 'gender_mixed' | 'gender_same';
    levelConsideration?: LevelConsiderationOptions;
}

export interface GroupsLayoutDetails {
    groups: number;
}

export type LayoutDetails = RowsLayoutDetails | GroupsLayoutDetails;

export interface Desk {
    row: number;
    col: number;
    students: { name: string; seat: number; id: string }[];
}

export interface Group {
    groupNumber: number;
    students: string[];
    level?: number;
}

export interface UnplacedStudentInfo {
    name: string;
    id: string;
    reason: string;
}

export interface GeneratedRowsLayout {
    desks: Desk[];
    unplacedStudents: UnplacedStudentInfo[];
}

export interface GeneratedGroupsLayout {
    groups: Group[];
    unplacedStudents: UnplacedStudentInfo[];
}

export type GeneratedLayout = GeneratedRowsLayout | GeneratedGroupsLayout;

export interface Chart {
    id: string;
    className: string;
    creationDate: string;
    layoutType: 'rows' | 'groups';
    layoutDetails: LayoutDetails;
    students: Student[];
    generatedLayout: GeneratedLayout | null;
    constraints?: SocialConstraint[];
    // Add these for version history during editing session
    layoutHistory?: GeneratedLayout[];
    activeLayoutIndex?: number;
    webhookUrl?: string;
    name?: string;
    
    // Sharing fields
    ownerId: string;
    ownerName: string;
    ownerSchool: string;
    sharedWith: ShareInfo[];
    sharedWithEmails: string[];
    isShared?: boolean;
    isOriginal?: boolean;
    sharedMessage?: string;
    isCopy?: boolean;
    isReadOnly?: boolean;
    order?: number;
}

export type Screen = 'login' | 'main' | 'editor' | 'result' | 'loading' | 'admin' | 'classes' | 'students' | 'onboarding';

export interface Violation {
    studentName: string;
    message: string;
}
