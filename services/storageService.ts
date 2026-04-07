import { Chart, UserPreferences, UserProfile } from '../types';
import { db, auth } from './firebase';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, query, where, deleteDoc, writeBatch } from "firebase/firestore";

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export class FirestoreQuotaError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'FirestoreQuotaError';
    }
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  if (errorMessage.toLowerCase().includes('quota') || errorMessage.toLowerCase().includes('resource-exhausted')) {
      console.error('Firestore Quota Exceeded:', errorMessage);
      throw new FirestoreQuotaError(errorMessage);
  }

  const errInfo: FirestoreErrorInfo = {
    error: errorMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const deleteChart = async (chartId: string): Promise<void> => {
    if (!chartId || !db) return;

    const path = `charts/${chartId}`;
    try {
        await deleteDoc(doc(db, "charts", chartId));
    } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
    }
};

export const deleteChartsBatch = async (chartIds: string[]): Promise<void> => {
    if (!chartIds.length || !db) return;
    try {
        const batch = writeBatch(db);
        chartIds.forEach(id => {
            batch.delete(doc(db, "charts", id));
        });
        await batch.commit();
    } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `charts_batch_delete`);
    }
};

export const saveUserCharts = async (uid: string, charts: Chart[]): Promise<void> => {
    if (!uid || !db) return;

    try {
        const batch = writeBatch(db);
        for (const chart of charts) {
            const chartRef = doc(db, "charts", chart.id);
            batch.set(chartRef, {
                ...chart,
                ownerId: chart.ownerId || uid,
                lastUpdated: new Date().toISOString()
            }, { merge: true });
        }
        await batch.commit();
    } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `charts_batch_${uid}`);
    }
};

export const loadUserProfile = async (uid: string): Promise<UserProfile | null> => {
    if (!uid || !db) return null;

    const path = `users/${uid}`;
    try {
        const docRef = doc(db, "users", uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return docSnap.data() as UserProfile;
        }
        return null;
    } catch (error) {
        if (error instanceof FirestoreQuotaError) {
            return null;
        }
        handleFirestoreError(error, OperationType.GET, path);
        return null;
    }
};

export const loadUserCharts = async (uid: string): Promise<Chart[]> => {
    if (!uid || !db) return [];

    try {
        const q = query(collection(db, "charts"), where("ownerId", "==", uid));
        const querySnapshot = await getDocs(q);
        const charts: Chart[] = [];
        querySnapshot.forEach((doc) => {
            charts.push({ id: doc.id, ...doc.data() } as Chart);
        });
        return charts;
    } catch (error) {
        handleFirestoreError(error, OperationType.LIST, `charts_${uid}`);
        return [];
    }
};

export const updateUserAdminFields = async (
    uid: string, 
    updates: Partial<AdminUserRecord>
): Promise<void> => {
    if (!uid || !db) return;

    const path = `users/${uid}`;
    try {
        const updateData = { 
            ...updates,
            lastUpdated: new Date().toISOString()
        };

        // Use updateDoc to ensure nested fields like stats.loginHistory are correctly replaced if provided
        await updateDoc(doc(db, "users", uid), updateData);
    } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
    }
};

export const deleteUserAccount = async (uid: string): Promise<void> => {
    if (!uid || !db) return;
    
    const path = `users/${uid}`;
    try {
        // 1. Try to delete associated charts (non-blocking)
        try {
            const q = query(collection(db, "charts"), where("ownerId", "==", uid));
            const querySnapshot = await getDocs(q);
            
            if (!querySnapshot.empty) {
                const batch = writeBatch(db);
                querySnapshot.forEach((doc) => {
                    batch.delete(doc.ref);
                });
                await batch.commit();
            }
        } catch (chartError) {
            console.warn("[Storage] Non-critical error deleting charts, proceeding:", chartError);
        }
        
        // 2. Delete the user document (this is the main action)
        await deleteDoc(doc(db, "users", uid));
    } catch (error) {
        console.error(`[Storage] Critical error deleting user ${uid}:`, error);
        handleFirestoreError(error, OperationType.DELETE, path);
    }
};

export interface AdminUserRecord {
    uid: string;
    email: string;
    firstName: string;
    lastName: string;
    schoolName: string;
    schoolLocation: string;
    role: 'admin' | 'user';
    isFrozen: boolean;
    subscriptionPlan?: 'free' | 'pro' | 'enterprise';
    subscriptionExpiry?: string;
    lastUpdated: string;
    stats?: {
        firstLogin: string;
        lastLogin: string;
        loginCount: number;
        loginHistory: string[];
        activityLog?: {
            timestamp: string;
            action: string;
            details: string;
        }[];
    };
    shareHistory?: {
        chartId: string;
        chartName: string;
        targetUserId: string;
        targetUserName: string;
        sharedAt: string;
    }[];
}

export const loadChartById = async (chartId: string): Promise<Chart | null> => {
    if (!chartId || !db) return null;

    const path = `charts/${chartId}`;
    try {
        const docRef = doc(db, "charts", chartId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() } as Chart;
        }
        return null;
    } catch (error) {
        handleFirestoreError(error, OperationType.GET, path);
        return null;
    }
};

export const loadChartsSharedWithUser = async (email: string): Promise<Chart[]> => {
    if (!email || !db) return [];

    try {
        const q = query(collection(db, "charts"), where("sharedWithEmails", "array-contains", email.toLowerCase()));
        const querySnapshot = await getDocs(q);
        const charts: Chart[] = [];
        querySnapshot.forEach((doc) => {
            charts.push({ id: doc.id, ...doc.data() } as Chart);
        });
        return charts;
    } catch (error) {
        handleFirestoreError(error, OperationType.LIST, `shared_charts_${email}`);
        return [];
    }
};

export const listAllUsers = async (): Promise<AdminUserRecord[]> => {
    if (!db) return [];

    const path = 'users';
    try {
        const q = query(collection(db, "users"));
        const querySnapshot = await getDocs(q);
        const users: AdminUserRecord[] = [];
        
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            users.push({
                uid: doc.id,
                email: data.email || '',
                firstName: data.firstName || '',
                lastName: data.lastName || '',
                schoolName: data.schoolName || '',
                schoolLocation: data.location || '',
                role: data.role || 'user',
                isFrozen: !!data.isFrozen,
                subscriptionPlan: data.subscriptionPlan || 'free',
                subscriptionExpiry: data.subscriptionExpiry || '',
                lastUpdated: data.lastUpdated || '',
                stats: {
                    ...data.stats,
                    loginHistory: data.stats?.loginHistory || [],
                    activityLog: data.stats?.activityLog || []
                },
                shareHistory: data.shareHistory
            });
        });
        
        return users;
    } catch (error) {
        handleFirestoreError(error, OperationType.LIST, path);
        return [];
    }
};
