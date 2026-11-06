import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import { Issue, User, Comment } from '../types';
import { toast } from 'sonner';

/**
 * Safely converts Firestore timestamps, JS Dates, numbers, or date strings into ISO 8601 strings.
 */
export function toISODateString(val: any): string | null {
  if (!val) return null;
  if (typeof val.toDate === 'function') {
    try {
      return val.toDate().toISOString();
    } catch {
      return null;
    }
  }
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val.toISOString();
  }
  if (typeof val === 'string') {
    const parsed = new Date(val);
    return isNaN(parsed.getTime()) ? val : parsed.toISOString();
  }
  if (typeof val === 'number') {
    const parsed = new Date(val);
    return isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  return null;
}

/**
 * Resolves user IDs to human-readable user details with name and email.
 */
export function resolveUserInfo(uid?: string | null, usersList: User[] = []) {
  if (!uid) return null;
  const found = usersList.find(u => u.uid === uid);
  if (found) {
    return {
      uid: found.uid,
      displayName: found.displayName || 'Unknown User',
      email: found.email || '',
      role: found.role || 'REPORTER'
    };
  }
  return {
    uid,
    displayName: `User (${uid.slice(0, 6)})`,
    email: '',
    role: 'UNKNOWN'
  };
}

/**
 * Fetches comments and audit logs for an issue if not already loaded in client memory.
 * Purely read-only queries with zero mutations.
 */
export async function fetchIssueCommentsAndAuditLogs(
  issueId: string
): Promise<{ comments: Comment[]; auditLogs: any[] }> {
  let comments: Comment[] = [];
  let auditLogs: any[] = [];

  // Fetch comments subcollection
  try {
    const commentsQuery = query(
      collection(db, 'issues', issueId, 'comments'),
      orderBy('createdAt', 'asc')
    );
    const commentsSnap = await getDocs(commentsQuery);
    comments = commentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Comment));
  } catch (err) {
    console.warn('Failed to fetch comments with orderBy, falling back:', err);
    try {
      const commentsSnap = await getDocs(collection(db, 'issues', issueId, 'comments'));
      comments = commentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Comment));
    } catch (e2) {
      console.error('Comments fetch failed:', e2);
    }
  }

  // Fetch audit logs
  try {
    const auditQuery = query(
      collection(db, 'auditLogs'),
      where('issueId', '==', issueId),
      orderBy('timestamp', 'desc')
    );
    const auditSnap = await getDocs(auditQuery);
    auditLogs = auditSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    console.warn('Failed to fetch audit logs with orderBy, falling back:', err);
    try {
      const fallbackQuery = query(
        collection(db, 'auditLogs'),
        where('issueId', '==', issueId)
      );
      const auditSnap = await getDocs(fallbackQuery);
      auditLogs = auditSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      auditLogs.sort((a, b) => {
        const tA = a.timestamp?.toMillis ? a.timestamp.toMillis() : new Date(a.timestamp || 0).getTime();
        const tB = b.timestamp?.toMillis ? b.timestamp.toMillis() : new Date(b.timestamp || 0).getTime();
        return tB - tA;
      });
    } catch (e2) {
      console.error('Audit logs fallback failed:', e2);
    }
  }

  return { comments, auditLogs };
}

/**
 * Builds the comprehensive export JSON structure with enriched metadata and ISO timestamps.
 */
export function buildIssueExportPayload(
  issue: Issue,
  users: User[] = [],
  comments: Comment[] = [],
  auditLogs: any[] = []
) {
  const reporter = resolveUserInfo(issue.reporterId, users);
  const assignee = resolveUserInfo(issue.assigneeId, users);

  const formattedComments = comments.map(c => ({
    id: c.id,
    content: c.content,
    mentions: c.mentions || [],
    createdAt: toISODateString(c.createdAt),
    updatedAt: toISODateString((c as any).updatedAt),
    author: resolveUserInfo(c.userId, users)
  }));

  const formattedAuditLogs = auditLogs.map(log => ({
    id: log.id,
    action: log.action,
    timestamp: toISODateString(log.timestamp),
    performer: resolveUserInfo(log.userId, users),
    changes: {
      oldValue: log.oldValue !== undefined ? log.oldValue : null,
      newValue: log.newValue !== undefined ? log.newValue : null
    }
  }));

  return {
    $schema: 'https://cygnus-software.internal/schemas/issue-export-v1.json',
    exportMetadata: {
      system: 'Cygnus Software Issue Tracker',
      exportedAt: new Date().toISOString(),
      version: '1.0'
    },
    issue: {
      id: issue.id || null,
      ticketNumber: issue.id ? `#WDB-${issue.id.slice(0, 8).toUpperCase()}` : null,
      title: issue.title,
      description: issue.description,
      type: issue.type,
      status: issue.status,
      priority: issue.priority,
      labels: issue.labels || [],
      attachments: (issue.attachments || []).map(att => ({
        name: att.name,
        url: att.url
      })),
      dueDate: toISODateString(issue.dueDate),
      createdAt: toISODateString(issue.createdAt),
      updatedAt: toISODateString(issue.updatedAt),
      reporter,
      assignee
    },
    comments: formattedComments,
    auditHistory: formattedAuditLogs
  };
}

/**
 * Triggers the browser download of the issue formatted as a .JSON file.
 * Completely read-only: does not modify or delete any database records.
 */
export async function downloadIssueAsJson(
  issue: Issue,
  users: User[] = [],
  existingComments?: Comment[],
  existingAuditLogs?: any[]
): Promise<boolean> {
  try {
    let comments = existingComments;
    let auditLogs = existingAuditLogs;

    // If comments or auditLogs aren't provided in memory, fetch them on-demand
    if (!comments || !auditLogs) {
      if (!issue.id) throw new Error('Issue ID is required for export');
      const fetched = await fetchIssueCommentsAndAuditLogs(issue.id);
      if (!comments) comments = fetched.comments;
      if (!auditLogs) auditLogs = fetched.auditLogs;
    }

    const payload = buildIssueExportPayload(issue, users, comments, auditLogs);
    const jsonString = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const safeTitle = (issue.title || 'untitled')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 30);
    const issueKey = issue.id ? issue.id.slice(0, 8) : 'issue';
    const filename = `issue-${issueKey}-${safeTitle || 'export'}.json`;

    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);

    toast.success(`Exported ${filename}`);
    return true;
  } catch (err: any) {
    console.error('Failed to export issue as JSON:', err);
    toast.error(err?.message || 'Failed to export issue');
    return false;
  }
}
