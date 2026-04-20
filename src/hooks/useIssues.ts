import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp,
  getDocs,
  getDoc
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Issue, IssueStatus, IssuePriority, IssueType } from '../types';
import { useAuth } from './useAuth';
import { useEffect, useState } from 'react';
import { handleFirestoreError, OperationType } from '../lib/error-handler';

export function useIssues(filters?: { status?: IssueStatus; priority?: IssuePriority; type?: IssueType }) {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const path = 'issues';
    let q = query(collection(db, path), orderBy('createdAt', 'desc'));

    if (filters?.status) q = query(q, where('status', '==', filters.status));
    if (filters?.priority) q = query(q, where('priority', '==', filters.priority));
    if (filters?.type) q = query(q, where('type', '==', filters.type));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const issuesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Issue[];
      setIssues(issuesData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });

    return () => unsubscribe();
  }, [user, filters?.status, filters?.priority, filters?.type]);

  return { issues, loading };
}

export function useIssue(id: string) {
  const [issue, setIssue] = useState<Issue | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const path = `issues/${id}`;
    const unsubscribe = onSnapshot(doc(db, 'issues', id), (doc) => {
      if (doc.exists()) {
        setIssue({ id: doc.id, ...doc.data() } as Issue);
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });

    return () => unsubscribe();
  }, [id]);

  return { issue, loading };
}

export function useIssueActions() {
  const { user } = useAuth();

  const createIssue = async (data: Partial<Issue>) => {
    if (!user) throw new Error('Must be logged in');
    
    const newIssue = {
      ...data,
      reporterId: user.uid,
      status: 'OPEN',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const path = 'issues';
    try {
      const docRef = await addDoc(collection(db, path), newIssue);
      
      // Attempt to add audit log in background
      addDoc(collection(db, 'auditLogs'), {
        issueId: docRef.id,
        userId: user.uid,
        action: 'CREATE',
        newValue: newIssue,
        timestamp: serverTimestamp(),
      }).catch(err => console.error('Failed to create audit log:', err));

      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  const updateIssue = async (id: string, data: Partial<Issue>) => {
    if (!user) throw new Error('Must be logged in');

    const path = `issues/${id}`;
    const issueRef = doc(db, 'issues', id);
    try {
      const oldDoc = await getDoc(issueRef);
      const oldData = oldDoc.data();

      // Perform the update first
      await updateDoc(issueRef, {
        ...data,
        updatedAt: serverTimestamp(),
      });

      // Attempt to add audit log in the background
      addDoc(collection(db, 'auditLogs'), {
        issueId: id,
        userId: user.uid,
        action: 'UPDATE',
        oldValue: oldData || {},
        newValue: data,
        timestamp: serverTimestamp(),
      }).catch(err => {
        console.error('Failed to create audit log:', err);
      });
      
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const deleteIssue = async (id: string) => {
    if (!user) throw new Error('Must be logged in');
    const path = `issues/${id}`;
    try {
      const { deleteDoc } = await import('firebase/firestore');
      await deleteDoc(doc(db, 'issues', id));
      
      // Attempt to add audit log in background
      addDoc(collection(db, 'auditLogs'), {
        issueId: id,
        userId: user.uid,
        action: 'DELETE',
        timestamp: serverTimestamp(),
      }).catch(err => console.error('Failed to delete audit log:', err));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  return { createIssue, updateIssue, deleteIssue };
}
