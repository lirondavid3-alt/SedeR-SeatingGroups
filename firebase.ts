import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc, 
    updateDoc, 
    collection, 
    query, 
    where, 
    getDocs, 
    arrayUnion, 
    arrayRemove,
    Timestamp,
    onSnapshot
} from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';
import { UserProfile, Chart, Notification, ShareInfo } from './types';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// User Profile Helpers
export const getUserProfile = async (email: string): Promise<UserProfile | null> => {
    const docRef = doc(db, 'users', email);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? (docSnap.data() as UserProfile) : null;
};

export const createUserProfile = async (profile: UserProfile) => {
    await setDoc(doc(db, 'users', profile.email), profile);
};

export const updateUserProfile = async (email: string, data: Partial<UserProfile>) => {
    await updateDoc(doc(db, 'users', email), data);
};

// Analytics Helpers
export const trackLogin = async (email: string) => {
    const profile = await getUserProfile(email);
    const now = new Date().toISOString();
    
    if (profile) {
        const stats = {
            ...profile.stats,
            lastLogin: now,
            loginCount: (profile.stats.loginCount || 0) + 1,
            loginHistory: [now, ...(profile.stats.loginHistory || [])].slice(0, 50)
        };
        await updateUserProfile(email, { stats });
    }
};

// Sharing Helpers
export const shareChart = async (
    ownerEmail: string, 
    classId: string, 
    chartId: string, 
    targetEmail: string,
    message?: string
) => {
    const targetProfile = await getUserProfile(targetEmail);
    if (!targetProfile) throw new Error('המשתמש לא נמצא במערכת');

    const ownerProfile = await getUserProfile(ownerEmail);
    if (!ownerProfile) throw new Error('פרופיל בעלים לא נמצא');

    const chartRef = doc(db, 'users', ownerEmail, 'classes', classId, 'charts', chartId);
    const chartSnap = await getDoc(chartRef);
    if (!chartSnap.exists()) throw new Error('המפה לא נמצאה');
    
    const chartData = chartSnap.data() as Chart;

    const shareInfo: ShareInfo = {
        email: targetEmail,
        name: `${targetProfile.firstName} ${targetProfile.lastName}`,
        schoolName: targetProfile.schoolName,
        timestamp: new Date().toISOString(),
        message
    };

    // Update chart sharedWith list
    await updateDoc(chartRef, {
        sharedWith: arrayUnion({
            email: targetEmail,
            name: `${targetProfile.firstName} ${targetProfile.lastName}`,
            schoolName: targetProfile.schoolName,
            timestamp: shareInfo.timestamp
        }),
        isShared: true
    });

    // Update owner's shareHistory
    await updateUserProfile(ownerEmail, {
        shareHistory: arrayUnion(shareInfo)
    });

    // Add notification to target user
    const notification: Notification = {
        id: Math.random().toString(36).substr(2, 9),
        type: 'share',
        fromName: `${ownerProfile.firstName} ${ownerProfile.lastName}`,
        fromEmail: ownerEmail,
        chartId: `${ownerEmail}/classes/${classId}/charts/${chartId}`,
        chartName: chartData.className,
        timestamp: new Date().toISOString(),
        read: false,
        message
    };

    await updateUserProfile(targetEmail, {
        notifications: arrayUnion(notification)
    });
};

export const revokeShare = async (
    ownerEmail: string,
    classId: string,
    chartId: string,
    targetEmail: string
) => {
    const chartRef = doc(db, 'users', ownerEmail, 'classes', classId, 'charts', chartId);
    const chartSnap = await getDoc(chartRef);
    if (!chartSnap.exists()) return;
    
    const chartData = chartSnap.data() as Chart;
    const shareToRemove = chartData.sharedWith.find(s => s.email === targetEmail);
    
    if (shareToRemove) {
        await updateDoc(chartRef, {
            sharedWith: arrayRemove(shareToRemove)
        });
    }
};

// Search Helpers
export const searchTeachers = async (searchTerm: string): Promise<UserProfile[]> => {
    if (searchTerm.length < 2) return [];
    
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '>=', searchTerm), where('email', '<=', searchTerm + '\uf8ff'));
    const querySnapshot = await getDocs(q);
    
    const results: UserProfile[] = [];
    querySnapshot.forEach((doc) => {
        results.push(doc.data() as UserProfile);
    });
    
    // Also search by name if needed (Firestore doesn't support multiple OR queries well, so we might need to filter client side or do another query)
    return results;
};
