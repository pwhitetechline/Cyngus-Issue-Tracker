import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  Timestamp 
} from 'firebase/firestore';
import { db } from './firebase';
import { Issue, IssuePriority, IssueStatus, IssueType, User } from '../types';
import { handleFirestoreError, OperationType } from './error-handler';

export interface ParsedImportIssue {
  originalIndex: number;
  title: string;
  description: string;
  type: IssueType;
  status: IssueStatus;
  priority: IssuePriority;
  labels: string[];
  attachments: { name: string; url: string }[];
  dueDate?: Date | null;
  assigneeId?: string | null;
  assigneeName?: string | null;
  assigneeEmail?: string | null;
  comments?: { content: string; authorName?: string; createdAt?: string }[];
  rawSourceId?: string | null;
  validationErrors: string[];
  isValid: boolean;
}

export interface ParseResult {
  success: boolean;
  totalParsed: number;
  validCount: number;
  issues: ParsedImportIssue[];
  errorMessage?: string;
}

export interface ImportExecutionResult {
  totalProcessed: number;
  successCount: number;
  failedCount: number;
  createdIssueIds: string[];
  errors: { index: number; title: string; error: string }[];
}

/**
 * Normalizes status strings from various issue tracker conventions
 */
export function normalizeStatus(rawStatus?: any): IssueStatus {
  if (!rawStatus || typeof rawStatus !== 'string') return 'OPEN';
  const clean = rawStatus.trim().toLowerCase().replace(/[\s-_]+/g, '');
  if (['open', 'todo', 'new', 'backlog', 'unresolved', 'opened'].includes(clean)) return 'OPEN';
  if (['inprogress', 'active', 'doing', 'working', 'started'].includes(clean)) return 'IN_PROGRESS';
  if (['inreview', 'review', 'code_review', 'testing', 'qa', 'pendingreview'].includes(clean)) return 'IN_REVIEW';
  if (['resolved', 'done', 'fixed', 'completed', 'verified'].includes(clean)) return 'RESOLVED';
  if (['closed', 'wontfix', 'duplicate', 'cancelled', 'archived'].includes(clean)) return 'CLOSED';
  return 'OPEN';
}

/**
 * Normalizes priority strings
 */
export function normalizePriority(rawPriority?: any): IssuePriority {
  if (!rawPriority || typeof rawPriority !== 'string') return 'MEDIUM';
  const clean = rawPriority.trim().toLowerCase().replace(/[\s-_]+/g, '');
  if (['critical', 'p0', 'blocker', 'urgent', 'highest', 'severe'].includes(clean)) return 'CRITICAL';
  if (['high', 'p1', 'major', 'important'].includes(clean)) return 'HIGH';
  if (['medium', 'p2', 'normal', 'moderate', 'default'].includes(clean)) return 'MEDIUM';
  if (['low', 'p3', 'minor', 'trivial', 'lowest'].includes(clean)) return 'LOW';
  return 'MEDIUM';
}

/**
 * Normalizes type strings
 */
export function normalizeType(rawType?: any): IssueType {
  if (!rawType || typeof rawType !== 'string') return 'BUG';
  const clean = rawType.trim().toLowerCase().replace(/[\s-_]+/g, '');
  if (['bug', 'defect', 'incident', 'error', 'fault', 'problem'].includes(clean)) return 'BUG';
  if (['feature', 'story', 'feat', 'enhancement', 'epic', 'request', 'newfeature'].includes(clean)) return 'FEATURE';
  if (['suggestion', 'improvement', 'task', 'subtask', 'chore', 'idea'].includes(clean)) return 'SUGGESTION';
  return 'BUG';
}

/**
 * Parses raw JSON string or object into a list of normalized candidate issues
 */
export function parseIssuesFromJson(jsonContent: string | any, existingUsers: User[] = []): ParseResult {
  let parsedData: any;

  if (typeof jsonContent === 'string') {
    try {
      parsedData = JSON.parse(jsonContent);
    } catch (err: any) {
      return {
        success: false,
        totalParsed: 0,
        validCount: 0,
        issues: [],
        errorMessage: `Invalid JSON syntax: ${err.message || 'Check commas, brackets, and quotes'}`
      };
    }
  } else {
    parsedData = jsonContent;
  }

  if (!parsedData) {
    return {
      success: false,
      totalParsed: 0,
      validCount: 0,
      issues: [],
      errorMessage: 'The provided JSON data is empty.'
    };
  }

  // Find candidate array
  let rawList: any[] = [];

  if (Array.isArray(parsedData)) {
    rawList = parsedData;
  } else if (typeof parsedData === 'object') {
    // Check if it's the Cygnus export format: { issue: { ... }, comments: [...] }
    if (parsedData.issue && typeof parsedData.issue === 'object') {
      const single = {
        ...parsedData.issue,
        comments: Array.isArray(parsedData.comments) ? parsedData.comments : []
      };
      rawList = [single];
    } else if (Array.isArray(parsedData.issues)) {
      rawList = parsedData.issues;
    } else if (Array.isArray(parsedData.tickets)) {
      rawList = parsedData.tickets;
    } else if (Array.isArray(parsedData.items)) {
      rawList = parsedData.items;
    } else if (Array.isArray(parsedData.data)) {
      rawList = parsedData.data;
    } else if (parsedData.title || parsedData.summary || parsedData.description) {
      // Single naked issue object
      rawList = [parsedData];
    } else {
      return {
        success: false,
        totalParsed: 0,
        validCount: 0,
        issues: [],
        errorMessage: 'Could not find an array of issues or single issue object in the JSON.'
      };
    }
  }

  if (rawList.length === 0) {
    return {
      success: false,
      totalParsed: 0,
      validCount: 0,
      issues: [],
      errorMessage: 'No issues found in the JSON payload.'
    };
  }

  // Pre-index existing users by email and uid for fast assignee matching
  const emailToUser = new Map<string, User>();
  const idToUser = new Map<string, User>();
  existingUsers.forEach(u => {
    if (u.email) emailToUser.set(u.email.toLowerCase(), u);
    if (u.uid) idToUser.set(u.uid, u);
  });

  const parsedIssues: ParsedImportIssue[] = [];

  rawList.forEach((item, index) => {
    if (!item || typeof item !== 'object') return;

    const validationErrors: string[] = [];

    // Title resolution (checks Jira 'summary', GitHub 'title', standard 'title')
    let rawTitle = item.title || item.summary || item.name || (item.fields && item.fields.summary) || '';
    rawTitle = String(rawTitle).trim();
    if (!rawTitle) {
      validationErrors.push('Missing issue title');
    }

    // Ensure title fits within length boundaries (5..100)
    let cleanTitle = rawTitle || 'Untitled Imported Issue';
    if (cleanTitle.length < 5) {
      cleanTitle = `[Import] ${cleanTitle}`;
    }
    if (cleanTitle.length > 100) {
      cleanTitle = cleanTitle.slice(0, 97) + '...';
    }

    // Description resolution (checks Jira 'description', GitHub 'body', standard 'description')
    let rawDesc = item.description || item.desc || item.body || item.details || (item.fields && item.fields.description) || '';
    rawDesc = typeof rawDesc === 'string' ? rawDesc.trim() : JSON.stringify(rawDesc);
    if (!rawDesc) {
      rawDesc = 'No detailed description provided with this imported issue.';
    }
    if (rawDesc.length < 10) {
      rawDesc = `${rawDesc} (Imported via JSON)`;
    }

    // Status, Priority, Type
    const status = normalizeStatus(item.status || (item.fields && item.fields.status?.name));
    const priority = normalizePriority(item.priority || (item.fields && item.fields.priority?.name));
    const type = normalizeType(item.type || item.issueType || (item.fields && item.fields.issuetype?.name));

    // Labels / Tags
    let labels: string[] = [];
    if (Array.isArray(item.labels)) {
      labels = item.labels.map((l: any) => String(l).trim()).filter(Boolean);
    } else if (Array.isArray(item.tags)) {
      labels = item.tags.map((l: any) => String(l).trim()).filter(Boolean);
    } else if (typeof item.labels === 'string') {
      labels = item.labels.split(/[,;]/).map((l: string) => l.trim()).filter(Boolean);
    }
    labels = Array.from(new Set(labels)).slice(0, 15);

    // Attachments
    const attachments: { name: string; url: string }[] = [];
    if (Array.isArray(item.attachments)) {
      for (const att of item.attachments) {
        if (att && att.url && typeof att.url === 'string') {
          attachments.push({
            name: String(att.name || 'attachment'),
            url: att.url
          });
        }
      }
    }

    // Assignee matching
    let assigneeId: string | null = null;
    let assigneeName: string | null = null;
    let assigneeEmail: string | null = null;

    const rawAssignee = item.assignee || (item.fields && item.fields.assignee);
    if (typeof rawAssignee === 'string') {
      // Check if it's an email or uid
      if (emailToUser.has(rawAssignee.toLowerCase())) {
        const u = emailToUser.get(rawAssignee.toLowerCase())!;
        assigneeId = u.uid;
        assigneeName = u.displayName;
        assigneeEmail = u.email;
      } else if (idToUser.has(rawAssignee)) {
        const u = idToUser.get(rawAssignee)!
        assigneeId = u.uid;
        assigneeName = u.displayName;
        assigneeEmail = u.email;
      }
    } else if (rawAssignee && typeof rawAssignee === 'object') {
      const email = rawAssignee.email || rawAssignee.emailAddress;
      const uid = rawAssignee.uid || rawAssignee.id;
      if (email && emailToUser.has(email.toLowerCase())) {
        const u = emailToUser.get(email.toLowerCase())!;
        assigneeId = u.uid;
        assigneeName = u.displayName;
        assigneeEmail = u.email;
      } else if (uid && idToUser.has(uid)) {
        const u = idToUser.get(uid)!;
        assigneeId = u.uid;
        assigneeName = u.displayName;
        assigneeEmail = u.email;
      } else {
        assigneeName = rawAssignee.displayName || rawAssignee.name || null;
        assigneeEmail = email || null;
      }
    } else if (item.assigneeId && idToUser.has(item.assigneeId)) {
      const u = idToUser.get(item.assigneeId)!;
      assigneeId = u.uid;
      assigneeName = u.displayName;
      assigneeEmail = u.email;
    }

    // Due Date
    let dueDate: Date | null = null;
    if (item.dueDate) {
      try {
        const d = new Date(item.dueDate);
        if (!isNaN(d.getTime())) dueDate = d;
      } catch {}
    }

    // Comments
    const comments: { content: string; authorName?: string; createdAt?: string }[] = [];
    if (Array.isArray(item.comments)) {
      for (const c of item.comments) {
        if (c && c.content) {
          comments.push({
            content: String(c.content),
            authorName: c.author?.displayName || c.authorName,
            createdAt: c.createdAt
          });
        }
      }
    }

    const rawSourceId = item.id || item.ticketNumber || item.key || null;

    parsedIssues.push({
      originalIndex: index + 1,
      title: cleanTitle,
      description: rawDesc,
      type,
      status,
      priority,
      labels,
      attachments,
      dueDate,
      assigneeId,
      assigneeName,
      assigneeEmail,
      comments: comments.length > 0 ? comments : undefined,
      rawSourceId,
      validationErrors,
      isValid: validationErrors.length === 0
    });
  });

  return {
    success: true,
    totalParsed: parsedIssues.length,
    validCount: parsedIssues.filter(i => i.isValid).length,
    issues: parsedIssues
  };
}

/**
 * Executes the database import for validated issues
 */
export async function executeIssueImport(
  issuesToImport: ParsedImportIssue[],
  currentUser: User,
  onProgress?: (processed: number, total: number) => void
): Promise<ImportExecutionResult> {
  const result: ImportExecutionResult = {
    totalProcessed: 0,
    successCount: 0,
    failedCount: 0,
    createdIssueIds: [],
    errors: []
  };

  const total = issuesToImport.length;

  for (let i = 0; i < total; i++) {
    const candidate = issuesToImport[i];

    try {
      const issuePayload: any = {
        title: candidate.title,
        description: candidate.description,
        type: candidate.type,
        status: candidate.status,
        priority: candidate.priority,
        labels: candidate.labels || [],
        attachments: candidate.attachments || [],
        reporterId: currentUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      if (candidate.assigneeId) {
        issuePayload.assigneeId = candidate.assigneeId;
      }

      if (candidate.dueDate) {
        issuePayload.dueDate = Timestamp.fromDate(candidate.dueDate);
      }

      // 1. Create Issue document
      const docRef = await addDoc(collection(db, 'issues'), issuePayload);
      const newIssueId = docRef.id;
      result.createdIssueIds.push(newIssueId);

      // 2. Add audit log
      addDoc(collection(db, 'auditLogs'), {
        issueId: newIssueId,
        userId: currentUser.uid,
        action: 'CREATE',
        newValue: {
          ...issuePayload,
          source: 'JSON_IMPORT',
          originalSourceId: candidate.rawSourceId || null
        },
        timestamp: serverTimestamp()
      }).catch(err => console.warn('Failed to write import audit log:', err));

      // 3. Import comments if present
      if (candidate.comments && candidate.comments.length > 0) {
        for (const comm of candidate.comments) {
          try {
            const commentPrefix = comm.authorName ? `[Imported from ${comm.authorName}]: ` : '[Imported comment]: ';
            await addDoc(collection(db, 'issues', newIssueId, 'comments'), {
              issueId: newIssueId,
              userId: currentUser.uid,
              content: `${commentPrefix}${comm.content}`,
              mentions: [],
              createdAt: serverTimestamp()
            });
          } catch (commErr) {
            console.warn('Failed to import comment for issue:', newIssueId, commErr);
          }
        }
      }

      result.successCount++;
    } catch (err: any) {
      console.error(`Error importing issue #${candidate.originalIndex}:`, err);
      result.failedCount++;
      result.errors.push({
        index: candidate.originalIndex,
        title: candidate.title,
        error: err?.message || 'Database write failed'
      });
      handleFirestoreError(err, OperationType.CREATE, 'issues', false);
    }

    result.totalProcessed++;
    if (onProgress) {
      onProgress(result.totalProcessed, total);
    }
  }

  return result;
}

/**
 * Returns a well-formatted starter JSON sample for users to copy or download
 */
export function getSampleIssueJson(): string {
  const sample = {
    issues: [
      {
        title: "Checkout payment processing timeout on Safari iOS",
        description: "Payment gateway requests taking longer than 15s to respond during flash sales, causing dropped conversions and duplicate card authorization attempts.",
        type: "BUG",
        status: "OPEN",
        priority: "CRITICAL",
        labels: ["checkout", "payment", "ios"],
        dueDate: new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10),
        comments: [
          {
            authorName: "QA Team",
            content: "Reproduced consistently on iOS 17 Safari when 3D Secure modal opens."
          }
        ]
      },
      {
        title: "Implement multi-currency support for European accounts",
        description: "Allow international customers to view catalog prices and complete transactions in EUR and GBP with automated daily exchange rate synchronization.",
        type: "FEATURE",
        status: "IN_PROGRESS",
        priority: "HIGH",
        labels: ["billing", "international", "currency"],
        dueDate: new Date(Date.now() + 86400000 * 14).toISOString().slice(0, 10)
      },
      {
        title: "Compress product catalog images using modern WebP format",
        description: "Update asset pipeline to transcode high-resolution hero graphics to WebP and AVIF to improve Largest Contentful Paint (LCP) by 45%.",
        type: "SUGGESTION",
        status: "RESOLVED",
        priority: "MEDIUM",
        labels: ["performance", "media", "seo"]
      }
    ]
  };

  return JSON.stringify(sample, null, 2);
}
