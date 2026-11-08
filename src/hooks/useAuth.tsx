import { useState, useEffect, createContext, useContext } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider, 
  signOut, 
  User as FirebaseUser 
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { User } from '../types';
import { toast } from 'sonner';

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  isSigningIn: boolean;
  authError: string | null;
  signIn: () => Promise<void>;
  signInRedirect: () => Promise<void>;
  clearAuthError: () => void;
  logout: () => Promise<void>;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    // Check if returning from a redirect sign-in
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) {
          toast.success(`Signed in as ${result.user.email}`);
        }
      })
      .catch((error: any) => {
        console.error('Redirect sign-in error:', error);
        let msg = error.message || 'Redirect sign-in failed';
        if (error.code === 'auth/unauthorized-domain') {
          msg = `Domain not authorized. Please add "${window.location.hostname}" to Firebase Console > Authentication > Settings > Authorized domains.`;
        }
        setAuthError(msg);
      });

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
        setAuthError(null);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async () => {
    setIsSigningIn(true);
    setAuthError(null);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error('Sign in popup error:', error);
      let msg = error.message || 'Sign in failed';
      if (error.code === 'auth/unauthorized-domain') {
        msg = `Domain "${window.location.hostname}" is not authorized. Please add it to your Firebase Console > Authentication > Settings > Authorized domains.`;
      } else if (error.code === 'auth/popup-blocked') {
        msg = 'Sign-in pop-up was blocked by your browser. Please allow pop-ups for this site or open the app in a new browser tab.';
      } else if (error.code === 'auth/popup-closed-by-user') {
        msg = 'The sign-in pop-up was closed before completion. If the popup closed automatically, your browser may be blocking iframe pop-ups—try clicking "Open in Full Tab".';
      }
      setAuthError(msg);
      toast.error('Sign In Issue', {
        description: msg,
        duration: 9000,
      });
    } finally {
      setIsSigningIn(false);
    }
  };

  const signInRedirect = async () => {
    setIsSigningIn(true);
    setAuthError(null);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await signInWithRedirect(auth, provider);
    } catch (error: any) {
      console.error('Sign in redirect error:', error);
      setAuthError(error.message || 'Redirect sign-in failed');
      setIsSigningIn(false);
    }
  };

  const clearAuthError = () => {
    setAuthError(null);
  };

  const logout = async () => {
    await signOut(auth);
  };

  const isAdmin = user?.role === 'ADMIN' || firebaseUser?.email?.toLowerCase() === 'pwhite.xm@gmail.com';

  return (
    <AuthContext.Provider value={{ 
      user, 
      firebaseUser, 
      loading, 
      isSigningIn, 
      authError, 
      signIn, 
      signInRedirect, 
      clearAuthError, 
      logout, 
      isAdmin 
    }}>
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
