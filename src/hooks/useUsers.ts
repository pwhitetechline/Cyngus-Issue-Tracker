import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { User } from '../types';
import { handleFirestoreError, OperationType } from '../lib/error-handler';

export function useUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const path = 'users';
    // Query without orderBy so Firestore does not filter out documents missing the displayName field
    const q = query(collection(db, path));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => {
        const data = doc.data();
        const email = data.email || '';
        const fallbackName = email ? email.split('@')[0] : 'Team Member';
        return {
          uid: doc.id,
          ...data,
          displayName: data.displayName || fallbackName,
          email: email,
          role: data.role || 'REPORTER',
        } as User;
      });

      // Sort client-side safely
      list.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
      setUsers(list);
      setLoading(false);
    }, (error) => {
      console.error('Firestore useUsers error:', error);
      handleFirestoreError(error, OperationType.LIST, path, false);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { users, loading };
}
