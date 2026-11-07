import { useState, useEffect, createContext, useContext } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  User as FirebaseUser 
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { User, UserRole } from '../types';
import { toast } from 'sonner';

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  signIn: () => Promise<void>;
  logout: () => Promise<void>;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fUser) => {
      setFirebaseUser(fUser);
      
      if (fUser) {
        const isAdminEmail = fUser.email?.toLowerCase() === 'pwhite.xm@gmail.com';
        let resolvedUser: User = {
          uid: fUser.uid,
          email: fUser.email || '',
          displayName: fUser.displayName || 'Anonymous',
          photoURL: fUser.photoURL || undefined,
          role: isAdminEmail ? 'ADMIN' : 'REPORTER',
          createdAt: null as any,
        };

        try {
          const userDoc = await getDoc(doc(db, 'users', fUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data() as User;
            if (isAdminEmail && userData.role !== 'ADMIN') {
              setDoc(doc(db, 'users', fUser.uid), { role: 'ADMIN' }, { merge: true }).catch(console.error);
              resolvedUser = { ...userData, role: 'ADMIN' };
            } else {
              resolvedUser = userData;
            }
          } else {
            // Create user document if it does not exist yet
            setDoc(doc(db, 'users', fUser.uid), {
              ...resolvedUser,
              createdAt: serverTimestamp(),
            }).catch(console.error);
          }
        } catch (err) {
          console.warn('Could not read user profile from Firestore (using session profile):', err);
        }

        setUser(resolvedUser);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error('Sign in error:', error);
      // Check for unauthorized domain error
      if (error.code === 'auth/unauthorized-domain') {
        toast.error('Domain not authorized', {
          description: `Please add "${window.location.hostname}" to your Firebase Console > Authentication > Settings > Authorized domains.`,
          duration: 10000,
        });
      } else {
        toast.error('Sign in failed', {
          description: error.message || 'Please check your console for details.',
        });
      }
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  const isAdmin = user?.role === 'ADMIN' || firebaseUser?.email?.toLowerCase() === 'pwhite.xm@gmail.com';

  return (
    <AuthContext.Provider value={{ user, firebaseUser, loading, signIn, logout, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
