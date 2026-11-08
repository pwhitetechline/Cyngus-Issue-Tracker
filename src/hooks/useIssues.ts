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
import { Issue, IssueStatus, IssuePriority, IssueType, User } from '../types';
import { useAuth } from './useAuth';
import { useNotifications } from './useNotifications';
import { useState, useEffect } from 'react';
import { handleFirestoreError, OperationType } from '../lib/error-handler';
import { determineAutoAssignee, getAutomationSettings } from '../lib/automation';

export function useIssues(filters?: { status?: IssueStatus; priority?: IssuePriority; type?: IssueType }) {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const path = 'issues';
    let q = query(collection(db, path));

    if (filters?.status) q = query(q, where('status', '==', filters.status));
    if (filters?.priority) q = query(q, where('priority', '==', filters.priority));
    if (filters?.type) q = query(q, where('type', '==', filters.type));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const issuesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Issue[];

      // Sort client-side so missing/pending timestamps never cause index rejection
      issuesData.sort((a, b) => {
        const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return timeB - timeA;
      });

      setIssues(issuesData);
      setError(null);
      setLoading(false);
    }, (err) => {
      console.error('Firestore useIssues error:', err);
      const errMsg = err instanceof Error ? err.message : String(err);
      setError(errMsg);
      handleFirestoreError(err, OperationType.LIST, path, false);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, filters?.status, filters?.priority, filters?.type]);

  return { issues, loading, error };
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
      handleFirestoreError(error, OperationType.GET, path, false);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [id]);

  return { issue, loading };
}

export function useIssueActions() {
  const { user } = useAuth();
  const { createNotification } = useNotifications();

  const createIssue = async (data: Partial<Issue>) => {
    if (!user) throw new Error('Must be logged in');

    const settings = getAutomationSettings();
    let assignedUserId = data.assigneeId;
    let initialStatus: IssueStatus = data.status || 'OPEN';

    // Query users & active issues to calculate automated assignment
    let allUsers: User[] = [];
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      allUsers = usersSnap.docs.map(d => ({ uid: d.id, ...d.data() } as User));

      if (!assignedUserId) {
        const issuesSnap = await getDocs(collection(db, 'issues'));
        const activeIssues = issuesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Issue));
        const autoUser = determineAutoAssignee(data, allUsers, activeIssues, settings);
        if (autoUser) {
          assignedUserId = autoUser.uid;
        }
      }

      if (assignedUserId && settings.autoAdvanceOnAssign && initialStatus === 'OPEN') {
        initialStatus = 'IN_PROGRESS';
      }
    } catch (autoErr) {
      console.warn('Automation calculation fallback:', autoErr);
    }
    
    const newIssue: any = {
      ...data,
      reporterId: user.uid,
      status: initialStatus,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (assignedUserId) {
      newIssue.assigneeId = assignedUserId;
    }

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

      // Notify admins and assignee of new issue creation (in-app alert + email)
      try {
        const admins = allUsers.filter(u => 
          u.role === 'ADMIN' || u.email?.toLowerCase() === 'pwhite.xm@gmail.com'
        );

        const ticketNum = `#WDB-${docRef.id.slice(0, 8).toUpperCase()}`;
        const issueTitle = data.title || 'Untitled Issue';
        const priorityLabel = (data.priority || 'MEDIUM').toLowerCase();
        const typeLabel = (data.type || 'BUG').toLowerCase();
        const reporterName = user.displayName || user.email || 'A team member';

        const notifiedUids = new Set<string>();

        for (const admin of admins) {
          if (!admin.uid || notifiedUids.has(admin.uid)) continue;
          notifiedUids.add(admin.uid);

          await createNotification({
            userId: admin.uid,
            title: `New Issue Created: ${issueTitle}`,
            message: `${reporterName} created ${ticketNum} (${priorityLabel} priority ${typeLabel}): "${issueTitle}".`,
            link: `/issues/${docRef.id}`,
            type: 'ISSUE_CREATED'
          }, admin.email);
        }

        // Notify assigned user if different from reporter and not already notified as admin
        if (assignedUserId && !notifiedUids.has(assignedUserId)) {
          const assigneeUser = allUsers.find(u => u.uid === assignedUserId);
          if (assigneeUser) {
            notifiedUids.add(assignedUserId);
            await createNotification({
              userId: assignedUserId,
              title: `Assigned: ${issueTitle}`,
              message: `You were assigned ${ticketNum} (${priorityLabel} priority): "${issueTitle}".`,
              link: `/issues/${docRef.id}`,
              type: 'ISSUE_ASSIGNED'
            }, assigneeUser.email);
          }
        }

        // Safety fallback: if no admin document in collection, ensure pwhite.xm@gmail.com gets notified
        if (notifiedUids.size === 0) {
          await createNotification({
            userId: user.uid,
            title: `New Issue Created: ${issueTitle}`,
            message: `${reporterName} created ${ticketNum} (${priorityLabel} priority ${typeLabel}): "${issueTitle}".`,
            link: `/issues/${docRef.id}`,
            type: 'ISSUE_CREATED'
          }, 'pwhite.xm@gmail.com');
        }
      } catch (notifErr) {
        console.error('Failed to notify admins of issue creation:', notifErr);
      }

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

  const seedSampleIssues = async () => {
    if (!user) throw new Error('Must be logged in to restore issues');

    const sampleTickets = [
      {
        title: 'Checkout Gateway Timeout during peak hours',
        description: 'Payment requests taking longer than 15s to respond during flash sales, causing dropped conversions and duplicate card authorization attempts.',
        type: 'BUG' as IssueType,
        status: 'OPEN' as IssueStatus,
        priority: 'CRITICAL' as IssuePriority,
        labels: ['checkout', 'payment', 'backend'],
        reporterId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      {
        title: 'Mobile navigation drawer overlapping sticky header',
        description: 'On iOS Safari viewports under 400px, the category dropdown drawer renders underneath the top navigation banner and blocks touch taps.',
        type: 'BUG' as IssueType,
        status: 'IN_PROGRESS' as IssueStatus,
        priority: 'HIGH' as IssuePriority,
        labels: ['mobile', 'css', 'ui'],
        reporterId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      {
        title: 'Automated order confirmation email delivery delay',
        description: 'Customer notification receipts taking up to 45 minutes to dispatch after transactional payment capture in the order queue.',
        type: 'BUG' as IssueType,
        status: 'IN_REVIEW' as IssueStatus,
        priority: 'MEDIUM' as IssuePriority,
        labels: ['email', 'automation', 'notifications'],
        reporterId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      {
        title: 'Add multi-currency support to product catalog',
        description: 'Allow customers in Canada, UK, and EU to view real-time pricing and checkout in localized currencies (CAD, GBP, EUR).',
        type: 'FEATURE' as IssueType,
        status: 'OPEN' as IssueStatus,
        priority: 'HIGH' as IssuePriority,
        labels: ['billing', 'localization', 'international'],
        reporterId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      {
        title: 'Inventory sync lag with third-party logistics API',
        description: 'Warehouse inventory counts are cached for 6 hours instead of 15 minutes, causing occasional backorders on low-stock SKUs.',
        type: 'BUG' as IssueType,
        status: 'IN_PROGRESS' as IssueStatus,
        priority: 'HIGH' as IssuePriority,
        labels: ['inventory', 'sync', 'logistics'],
        reporterId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      {
        title: 'Optimize product catalog image compression pipeline',
        description: 'Switch product hero images from PNG/JPEG to WebP/AVIF format with automated responsive srcset scaling for faster page speeds.',
        type: 'SUGGESTION' as IssueType,
        status: 'RESOLVED' as IssueStatus,
        priority: 'LOW' as IssuePriority,
        labels: ['performance', 'media', 'seo'],
        reporterId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
    ];

    for (const ticket of sampleTickets) {
      await addDoc(collection(db, 'issues'), ticket);
    }
  };

  const purgeSampleIssues = async () => {
    if (!user) throw new Error('Must be logged in to remove sample issues');
    const { deleteDoc, getDocs } = await import('firebase/firestore');
    const snap = await getDocs(collection(db, 'issues'));
    const sampleTitles = new Set([
      'Checkout Gateway Timeout during peak hours',
      'Mobile navigation drawer overlapping sticky header',
      'Automated order confirmation email delivery delay',
      'Add multi-currency support to product catalog',
      'Inventory sync lag with third-party logistics API',
      'Optimize product catalog image compression pipeline'
    ]);
    let deletedCount = 0;
    for (const d of snap.docs) {
      const data = d.data();
      if (sampleTitles.has(data.title)) {
        await deleteDoc(doc(db, 'issues', d.id));
        deletedCount++;
      }
    }
    return deletedCount;
  };

  return { createIssue, updateIssue, deleteIssue, seedSampleIssues, purgeSampleIssues };
}
