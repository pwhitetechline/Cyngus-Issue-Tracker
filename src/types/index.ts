import { z } from 'zod';

export const UserRoleSchema = z.enum(['ADMIN', 'REPORTER', 'ASSIGNEE', 'VIEWER']);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const IssueTypeSchema = z.enum(['BUG', 'FEATURE', 'SUGGESTION']);
export type IssueType = z.infer<typeof IssueTypeSchema>;

export const IssueStatusSchema = z.enum(['OPEN', 'IN_PROGRESS', 'IN_REVIEW', 'RESOLVED', 'CLOSED']);
export type IssueStatus = z.infer<typeof IssueStatusSchema>;

export const IssuePrioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
export type IssuePriority = z.infer<typeof IssuePrioritySchema>;

export const UserSchema = z.object({
  uid: z.string(),
  email: z.string().email(),
  displayName: z.string(),
  photoURL: z.string().url().optional(),
  role: UserRoleSchema.default('REPORTER'),
  createdAt: z.any(), // Firestore Timestamp
});

export type User = z.infer<typeof UserSchema>;

export const AttachmentSchema = z.object({
  name: z.string(),
  url: z.string().url(),
});

export const IssueSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(5).max(100),
  description: z.string().min(10),
  type: IssueTypeSchema,
  status: IssueStatusSchema.default('OPEN'),
  priority: IssuePrioritySchema.default('MEDIUM'),
  reporterId: z.string(),
  assigneeId: z.string().nullable().optional(),
  labels: z.array(z.string()).default([]),
  attachments: z.array(AttachmentSchema).default([]),
  dueDate: z.any().nullable().optional(), // Firestore Timestamp
  createdAt: z.any().optional(),
  updatedAt: z.any().optional(),
});

export type Issue = z.infer<typeof IssueSchema>;

export const CommentSchema = z.object({
  id: z.string().optional(),
  issueId: z.string(),
  userId: z.string(),
  content: z.string().min(1),
  mentions: z.array(z.string()).default([]),
  createdAt: z.any().optional(),
});

export type Comment = z.infer<typeof CommentSchema>;

export const AuditLogSchema = z.object({
  id: z.string().optional(),
  issueId: z.string(),
  userId: z.string(),
  action: z.string(),
  oldValue: z.any().optional(),
  newValue: z.any().optional(),
  timestamp: z.any().optional(),
});

export type AuditLog = z.infer<typeof AuditLogSchema>;

export const NotificationSchema = z.object({
  id: z.string().optional(),
  userId: z.string(),
  title: z.string(),
  message: z.string(),
  link: z.string().optional(),
  read: z.boolean().default(false),
  type: z.enum(['ISSUE_ASSIGNED', 'COMMENT_ADDED', 'STATUS_CHANGED', 'MENTION']).optional(),
  createdAt: z.any().optional(),
});

export type Notification = z.infer<typeof NotificationSchema>;
