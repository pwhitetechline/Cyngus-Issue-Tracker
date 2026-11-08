import { Issue, User } from '../types';
import { toast } from 'sonner';

/**
 * Escapes a single CSV cell according to RFC-4180 rules.
 */
function escapeCsvCell(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Converts dates/timestamps to a readable YYYY-MM-DD HH:mm string.
 */
function formatCsvDate(val: any): string {
  if (!val) return '';
  try {
    const d = val.toDate ? val.toDate() : new Date(val);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().replace('T', ' ').slice(0, 19);
  } catch {
    return '';
  }
}

/**
 * Compiles a list of issues into an RFC-4180 compliant CSV spreadsheet and triggers a browser download.
 */
export function exportIssuesToCsv(issues: Issue[], users: User[] = []): boolean {
  if (!issues || issues.length === 0) {
    toast.error('No issues available to export');
    return false;
  }

  const headers = [
    'Ticket Number',
    'Title',
    'Type',
    'Status',
    'Priority',
    'Reporter Name',
    'Reporter Email',
    'Assignee Name',
    'Assignee Email',
    'Labels',
    'Attachments Count',
    'Due Date',
    'Created At',
    'Updated At',
    'Description'
  ];

  const userMap = new Map<string, User>();
  users.forEach(u => userMap.set(u.uid, u));

  const rows: string[] = [headers.map(escapeCsvCell).join(',')];

  for (const issue of issues) {
    const reporter = userMap.get(issue.reporterId);
    const assignee = issue.assigneeId ? userMap.get(issue.assigneeId) : null;
    const ticketNum = issue.id ? `#WDB-${issue.id.slice(0, 8).toUpperCase()}` : '#WDB-NEW';

    const row = [
      ticketNum,
      issue.title || '',
      issue.type || 'BUG',
      issue.status || 'OPEN',
      issue.priority || 'MEDIUM',
      reporter ? (reporter.displayName || reporter.email || `User ${(reporter.uid || '').slice(0, 6)}`) : (issue.reporterId ? `User ${issue.reporterId.slice(0, 6)}` : 'Unknown'),
      reporter ? (reporter.email || '') : '',
      assignee ? (assignee.displayName || assignee.email || 'Assigned') : 'Unassigned',
      assignee ? (assignee.email || '') : '',
      (Array.isArray(issue.labels) ? issue.labels : []).join('; '),
      String(Array.isArray(issue.attachments) ? issue.attachments.length : 0),
      formatCsvDate(issue.dueDate),
      formatCsvDate(issue.createdAt),
      formatCsvDate(issue.updatedAt),
      (issue.description || '').replace(/\s+/g, ' ').slice(0, 500)
    ];

    rows.push(row.map(escapeCsvCell).join(','));
  }

  // Prepend UTF-8 Byte Order Mark (BOM) so Microsoft Excel opens special characters correctly
  const csvContent = '\uFEFF' + rows.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const timestamp = new Date().toISOString().slice(0, 10);
  const filename = `issues-export-${timestamp}.csv`;

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  toast.success(`Exported ${issues.length} issues to ${filename}`);
  return true;
}
