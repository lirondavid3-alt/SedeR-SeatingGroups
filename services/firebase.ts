import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, arrayUnion, arrayRemove, Timestamp } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";
import firebaseConfig from "../firebase-applet-config.json";
import { UserProfile, Chart, ShareInfo, Notification } from "../types";

console.log("--- [DEBUG] SedeR SeatingGroups - Initializing with New Database ---");

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
// CRITICAL: Must use the firestoreDatabaseId from the config to connect to the correct database
const dbId = (firebaseConfig as any).firestoreDatabaseId;
console.log("Connecting to Firestore Database ID:", dbId);
const db = getFirestore(app, dbId);
const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export { auth, db, analytics, googleProvider };

// --- Helper Functions ---

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
    try {
        const userRef = doc(db, "users", uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            return userSnap.data() as UserProfile;
        }
        return null;
    } catch (error) {
        console.error("Error getting user profile:", error);
        return null;
    }
};

export const createUserProfile = async (profile: UserProfile) => {
    try {
        const userRef = doc(db, "users", profile.uid);
        await setDoc(userRef, profile);
        return true;
    } catch (error) {
        console.error("Error creating user profile:", error);
        throw error;
    }
};

export const updateUserProfile = async (uid: string, data: Partial<UserProfile>) => {
    try {
        const userRef = doc(db, "users", uid);
        await updateDoc(userRef, data);
        return true;
    } catch (error) {
        console.error("Error updating user profile:", error);
        throw error;
    }
};

export const trackLogin = async (uid: string) => {
    try {
        const userRef = doc(db, "users", uid);
        const userSnap = await getDoc(userRef);
        const now = new Date().toISOString();

        if (userSnap.exists()) {
            const data = userSnap.data();
            const stats = data.stats || { firstLogin: now, lastLogin: now, loginCount: 0, loginHistory: [] };
            
            await updateDoc(userRef, {
                "stats.lastLogin": now,
                "stats.loginCount": (stats.loginCount || 0) + 1,
                "stats.loginHistory": arrayUnion(now)
            });
        }
    } catch (error) {
        console.error("Error tracking login:", error);
    }
};

export const searchTeachers = async (searchTerm: string): Promise<UserProfile[]> => {
    try {
        const usersRef = collection(db, "users");
        const results: UserProfile[] = [];
        const seenUids = new Set<string>();
        
        const term = searchTerm.trim();
        const termLower = term.toLowerCase();
        const termCapitalized = term.charAt(0).toUpperCase() + term.slice(1).toLowerCase();
        const words = term.split(/\s+/).filter(w => w.length >= 2);
        
        const queries = [
            getDocs(query(usersRef, where("email", "==", termLower))),
            getDocs(query(usersRef, where("email", ">=", termLower), where("email", "<=", termLower + "\uf8ff"))),
            getDocs(query(usersRef, where("email", "==", term))),
            getDocs(query(usersRef, where("firstName", ">=", term), where("firstName", "<=", term + "\uf8ff"))),
            getDocs(query(usersRef, where("firstName", ">=", termLower), where("firstName", "<=", termLower + "\uf8ff"))),
            getDocs(query(usersRef, where("firstName", ">=", termCapitalized), where("firstName", "<=", termCapitalized + "\uf8ff"))),
            getDocs(query(usersRef, where("lastName", ">=", term), where("lastName", "<=", term + "\uf8ff"))),
            getDocs(query(usersRef, where("lastName", ">=", termLower), where("lastName", "<=", termLower + "\uf8ff"))),
            getDocs(query(usersRef, where("lastName", ">=", termCapitalized), where("lastName", "<=", termCapitalized + "\uf8ff"))),
            getDocs(query(usersRef, where("schoolName", ">=", term), where("schoolName", "<=", term + "\uf8ff"))),
            getDocs(query(usersRef, where("schoolName", ">=", termLower), where("schoolName", "<=", termLower + "\uf8ff")))
        ];

        // If multi-word, search for first word as firstName and second as lastName, and vice versa
        if (words.length >= 2) {
            const first = words[0];
            const last = words[1];
            const firstCap = first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
            const lastCap = last.charAt(0).toUpperCase() + last.slice(1).toLowerCase();

            // First Last
            queries.push(getDocs(query(usersRef, where("firstName", "==", first), where("lastName", ">=", last), where("lastName", "<=", last + "\uf8ff"))));
            queries.push(getDocs(query(usersRef, where("firstName", "==", firstCap), where("lastName", ">=", lastCap), where("lastName", "<=", lastCap + "\uf8ff"))));
            
            // Last First
            queries.push(getDocs(query(usersRef, where("lastName", "==", first), where("firstName", ">=", last), where("firstName", "<=", last + "\uf8ff"))));
            queries.push(getDocs(query(usersRef, where("lastName", "==", firstCap), where("firstName", ">=", lastCap), where("firstName", "<=", lastCap + "\uf8ff"))));

            // Exact full name match
            queries.push(getDocs(query(usersRef, where("firstName", "==", firstCap), where("lastName", "==", lastCap))));
            queries.push(getDocs(query(usersRef, where("firstName", "==", first), where("lastName", "==", last))));
            queries.push(getDocs(query(usersRef, where("firstName", "==", lastCap), where("lastName", "==", firstCap))));
            queries.push(getDocs(query(usersRef, where("firstName", "==", last), where("lastName", "==", first))));
        }

        // Also search for the first word individually as a prefix (very useful if searching "First Last")
        if (words.length > 0) {
            const firstWord = words[0];
            const firstWordCap = firstWord.charAt(0).toUpperCase() + firstWord.slice(1).toLowerCase();
            
            queries.push(getDocs(query(usersRef, where("firstName", ">=", firstWord), where("firstName", "<=", firstWord + "\uf8ff"))));
            queries.push(getDocs(query(usersRef, where("firstName", ">=", firstWordCap), where("firstName", "<=", firstWordCap + "\uf8ff"))));
            queries.push(getDocs(query(usersRef, where("lastName", ">=", firstWord), where("lastName", "<=", firstWord + "\uf8ff"))));
            queries.push(getDocs(query(usersRef, where("lastName", ">=", firstWordCap), where("lastName", "<=", firstWordCap + "\uf8ff"))));
        }

        const snapshots = await Promise.all(queries.map(async (q) => {
            try {
                return await q;
            } catch (err) {
                return { size: 0, forEach: () => {} } as any;
            }
        }));

        snapshots.forEach((snap) => {
            if (snap && typeof snap.forEach === 'function') {
                snap.forEach((doc: any) => {
                    const data = doc.data() as UserProfile;
                    if (!seenUids.has(data.uid)) {
                        results.push(data);
                        seenUids.add(data.uid);
                    }
                });
            }
        });
        
        return results;
    } catch (error) {
        console.error("Error searching teachers:", error);
        return [];
    }
};

export const getTeachersInSchool = async (schoolName: string): Promise<UserProfile[]> => {
    if (!schoolName) return [];
    try {
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("schoolName", "==", schoolName));
        const querySnapshot = await getDocs(q);
        const results: UserProfile[] = [];
        querySnapshot.forEach((doc) => {
            results.push(doc.data() as UserProfile);
        });
        return results;
    } catch (error) {
        console.error("Error getting teachers in school:", error);
        return [];
    }
};

export const shareChart = async (
    chartId: string, 
    chartName: string,
    targetUser: UserProfile, 
    ownerProfile: UserProfile, 
    message?: string, 
    role: 'viewer' | 'editor' = 'viewer'
) => {
    try {
        const chartRef = doc(db, "charts", chartId);
        const targetUserRef = doc(db, "users", targetUser.uid);

        const shareInfo: ShareInfo = {
            uid: targetUser.uid,
            name: `${targetUser.firstName} ${targetUser.lastName}`,
            email: targetUser.email,
            schoolName: targetUser.schoolName,
            timestamp: new Date().toISOString(),
            message,
            role
        };

        // Update chart
        const chartSnap = await getDoc(chartRef);
        if (!chartSnap.exists()) throw new Error("Chart not found");
        const chartData = chartSnap.data() as Chart;
        
        // Filter out existing share for this email to avoid duplicates
        const currentSharedWith = (chartData.sharedWith || []).filter(s => s.email.toLowerCase() !== targetUser.email.toLowerCase());
        const updatedSharedWith = [...currentSharedWith, shareInfo];
        
        // Also update sharedWithEmails for security rules (always lowercase for reliable matching)
        const currentEmails = (chartData.sharedWithEmails || []).map(e => e.toLowerCase());
        const targetEmailLower = targetUser.email.toLowerCase();
        const updatedEmails = Array.from(new Set([...currentEmails.filter(e => e !== targetEmailLower), targetEmailLower]));

        await updateDoc(chartRef, {
            sharedWith: updatedSharedWith,
            sharedWithEmails: updatedEmails
        });

        // Update owner's share history
        const ownerRef = doc(db, "users", ownerProfile.uid);
        await updateDoc(ownerRef, {
            shareHistory: arrayUnion({
                chartId,
                chartName,
                targetUserId: targetUser.uid,
                targetUserName: `${targetUser.firstName} ${targetUser.lastName}`,
                sharedAt: new Date().toISOString()
            } as any)
        });

        // Create notification for target user
        const notification: Notification = {
            id: Math.random().toString(36).substr(2, 9),
            type: 'share',
            title: 'מפה חדשה שותפה איתך',
            message: message || `${ownerProfile.firstName} ${ownerProfile.lastName} שיתף/ה איתך את המפה: ${chartName}`,
            fromUserId: ownerProfile.uid,
            fromUserName: `${ownerProfile.firstName} ${ownerProfile.lastName}`,
            fromEmail: ownerProfile.email,
            chartId,
            chartName,
            timestamp: new Date().toISOString(),
            read: false
        };

        await updateDoc(targetUserRef, {
            notifications: arrayUnion(notification as any)
        });

        return true;
    } catch (error) {
        console.error("Error sharing chart:", error);
        throw error;
    }
};

export const revokeShare = async (chartId: string, targetUserId: string, targetUserEmail: string) => {
    try {
        const chartRef = doc(db, "charts", chartId);
        
        const chartSnap = await getDoc(chartRef);
        if (chartSnap.exists()) {
            const data = chartSnap.data();
            const sharedWith = (data.sharedWith || []) as ShareInfo[];
            
            // Robust filtering: remove any entry that matches either UID or Email
            // Only match if the value is provided
            const updatedSharedWith = sharedWith.filter(s => {
                const matchUid = targetUserId && s.uid === targetUserId;
                const matchEmail = targetUserEmail && s.email.toLowerCase() === targetUserEmail.toLowerCase();
                return !(matchUid || matchEmail);
            });
            
            // Also update sharedWithEmails for security rules
            const currentEmails = (data.sharedWithEmails || []) as string[];
            const updatedEmails = currentEmails
                .map(e => e.toLowerCase())
                .filter(email => email !== targetUserEmail.toLowerCase());
            
            await updateDoc(chartRef, {
                sharedWith: updatedSharedWith,
                sharedWithEmails: updatedEmails
            });
        }
        return true;
    } catch (error) {
        console.error("Error revoking share:", error);
        throw error;
    }
};
