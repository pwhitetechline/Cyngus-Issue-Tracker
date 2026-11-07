import { Issue, User } from '../types';

export interface AutomationSettings {
  autoAssignEnabled: boolean;
  criticalEscalateToAdmin: boolean;
  autoAdvanceOnAssign: boolean;
}

const STORAGE_KEY = 'cygnus_wdb_automation_settings';

export const DEFAULT_AUTOMATION_SETTINGS: AutomationSettings = {
  autoAssignEnabled: true,
  criticalEscalateToAdmin: true,
  autoAdvanceOnAssign: true,
};

export function getAutomationSettings(): AutomationSettings {
  if (typeof window === 'undefined') return DEFAULT_AUTOMATION_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_AUTOMATION_SETTINGS;
    return { ...DEFAULT_AUTOMATION_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_AUTOMATION_SETTINGS;
  }
}

export function saveAutomationSettings(settings: AutomationSettings): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error('Failed to save automation settings:', err);
  }
}

/**
 * Determines the best assignee for a new or unassigned issue based on
 * severity escalation and team member workload.
 */
export function determineAutoAssignee(
  issue: Partial<Issue>,
  users: User[],
  activeIssues: Issue[] = [],
  settings: AutomationSettings = getAutomationSettings()
): User | null {
  if (!users || users.length === 0) return null;

  // 1. Critical Escalation to Admin
  if (settings.criticalEscalateToAdmin && issue.priority === 'CRITICAL') {
    const admin = users.find(
      u => u.role === 'ADMIN' || u.email?.toLowerCase() === 'pwhite.xm@gmail.com'
    );
    if (admin) return admin;
  }

  // 2. Workload-based auto assignment
  if (settings.autoAssignEnabled) {
    // Eligible assignees are users with ASSIGNEE or ADMIN role
    const candidates = users.filter(u => u.role === 'ASSIGNEE' || u.role === 'ADMIN');
    if (candidates.length === 0) return null;

    // Calculate active workloads (OPEN, IN_PROGRESS, IN_REVIEW)
    const workloadMap = new Map<string, number>();
    candidates.forEach(c => workloadMap.set(c.uid, 0));

    for (const openIssue of activeIssues) {
      if (
        openIssue.assigneeId &&
        ['OPEN', 'IN_PROGRESS', 'IN_REVIEW'].includes(openIssue.status) &&
        workloadMap.has(openIssue.assigneeId)
      ) {
        workloadMap.set(openIssue.assigneeId, (workloadMap.get(openIssue.assigneeId) || 0) + 1);
      }
    }

    // Sort by lowest workload count
    const sorted = [...candidates].sort((a, b) => {
      const loadA = workloadMap.get(a.uid) ?? 0;
      const loadB = workloadMap.get(b.uid) ?? 0;
      return loadA - loadB;
    });

    return sorted[0] || null;
  }

  return null;
}
