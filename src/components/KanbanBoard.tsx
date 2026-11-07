import React, { useState } from 'react';
import { Issue, IssueStatus, User } from '../types';
import { useIssueActions } from '../hooks/useIssues';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  HelpCircle, 
  Paperclip, 
  User as UserIcon,
  ChevronRight,
  ChevronLeft,
  MoreVertical,
  Flame,
  ArrowUpRight,
  MoveRight
} from 'lucide-react';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from './ui/dropdown-menu';
import { Button } from './ui/button';
import { toast } from 'sonner';

interface KanbanBoardProps {
  issues: Issue[];
  users: User[];
  onIssueClick: (issue: Issue) => void;
}

interface ColumnConfig {
  status: IssueStatus;
  title: string;
  description: string;
  color: string;
  badgeBg: string;
  headerBorder: string;
  dropBorder: string;
}

const COLUMNS: ColumnConfig[] = [
  {
    status: 'OPEN',
    title: 'Open',
    description: 'New & untriaged',
    color: 'text-blue-500',
    badgeBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    headerBorder: 'border-t-blue-500',
    dropBorder: 'border-blue-500 bg-blue-500/5',
  },
  {
    status: 'IN_PROGRESS',
    title: 'In Progress',
    description: 'Actively being resolved',
    color: 'text-amber-500',
    badgeBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    headerBorder: 'border-t-amber-500',
    dropBorder: 'border-amber-500 bg-amber-500/5',
  },
  {
    status: 'IN_REVIEW',
    title: 'In Review',
    description: 'Awaiting testing or sign-off',
    color: 'text-purple-500',
    badgeBg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    headerBorder: 'border-t-purple-500',
    dropBorder: 'border-purple-500 bg-purple-500/5',
  },
  {
    status: 'RESOLVED',
    title: 'Resolved',
    description: 'Fix verified & applied',
    color: 'text-emerald-500',
    badgeBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    headerBorder: 'border-t-emerald-500',
    dropBorder: 'border-emerald-500 bg-emerald-500/5',
  },
  {
    status: 'CLOSED',
    title: 'Closed',
    description: 'Archived and completed',
    color: 'text-slate-500',
    badgeBg: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
    headerBorder: 'border-t-slate-500',
    dropBorder: 'border-slate-500 bg-slate-500/5',
  },
];

const STATUS_ORDER: IssueStatus[] = ['OPEN', 'IN_PROGRESS', 'IN_REVIEW', 'RESOLVED', 'CLOSED'];

export function KanbanBoard({ issues, users, onIssueClick }: KanbanBoardProps) {
  const { updateIssue } = useIssueActions();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<IssueStatus | null>(null);

  const userMap = new Map<string, User>();
  users.forEach(u => userMap.set(u.uid, u));

  const handleStatusChange = async (issueId: string, newStatus: IssueStatus) => {
    const targetIssue = issues.find(i => i.id === issueId);
    if (!targetIssue || targetIssue.status === newStatus) return;

    try {
      await updateIssue(issueId, { status: newStatus });
      toast.success(`Updated #${issueId.slice(0, 8).toUpperCase()} to ${newStatus.replace('_', ' ')}`);
    } catch (err: any) {
      console.error(err);
      toast.error(`Failed to update status: ${err.message || 'Unknown error'}`);
    }
  };

  const handleDragStart = (e: React.DragEvent, issueId: string) => {
    e.dataTransfer.setData('text/plain', issueId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingId(issueId);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverCol(null);
  };

  const handleDragOver = (e: React.DragEvent, status: IssueStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverCol !== status) {
      setDragOverCol(status);
    }
  };

  const handleDragLeave = (e: React.DragEvent, status: IssueStatus) => {
    // Only reset if leaving the column element itself
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    if (dragOverCol === status) {
      setDragOverCol(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetStatus: IssueStatus) => {
    e.preventDefault();
    setDragOverCol(null);
    const issueId = e.dataTransfer.getData('text/plain') || draggingId;
    if (issueId) {
      handleStatusChange(issueId, targetStatus);
    }
    setDraggingId(null);
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
            <Flame className="w-3 h-3 text-red-500" />
            Critical
          </span>
        );
      case 'HIGH':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-orange-600 bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20">
            <ArrowUpRight className="w-3 h-3 text-orange-500" />
            High
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
            Medium
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
            Low
          </span>
        );
    }
  };

  return (
    <div className="w-full overflow-x-auto pb-6">
      <div className="flex gap-4 min-w-[1200px] items-start">
        {COLUMNS.map((col) => {
          const colIssues = issues.filter(i => i.status === col.status);
          const isOver = dragOverCol === col.status;

          return (
            <div
              key={col.status}
              onDragOver={(e) => handleDragOver(e, col.status)}
              onDragLeave={(e) => handleDragLeave(e, col.status)}
              onDrop={(e) => handleDrop(e, col.status)}
              className={`flex-1 flex flex-col min-w-[240px] max-w-[320px] rounded-xl border bg-card/60 backdrop-blur-xs transition-colors duration-200 border-t-4 ${col.headerBorder} ${
                isOver ? `${col.dropBorder} shadow-lg ring-2 ring-primary/20` : 'border-border'
              }`}
            >
              {/* Column Header */}
              <div className="p-3.5 border-b border-border/80 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-foreground">{col.title}</span>
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${col.badgeBg}`}>
                      {colIssues.length}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{col.description}</p>
                </div>
              </div>

              {/* Column Card Body */}
              <div className="p-2.5 flex flex-col gap-2.5 min-h-[500px]">
                {colIssues.length === 0 ? (
                  <div className={`h-32 border-2 border-dashed rounded-lg flex items-center justify-center text-xs text-muted-foreground transition-colors ${
                    isOver ? 'border-primary bg-primary/5' : 'border-border/60'
                  }`}>
                    {isOver ? 'Drop ticket here' : 'No tickets in this column'}
                  </div>
                ) : (
                  colIssues.map((issue) => {
                    const assignee = issue.assigneeId ? userMap.get(issue.assigneeId) : null;
                    const ticketNum = `#WDB-${issue.id.slice(0, 8).toUpperCase()}`;
                    const currentIndex = STATUS_ORDER.indexOf(issue.status);
                    const prevStatus = currentIndex > 0 ? STATUS_ORDER[currentIndex - 1] : null;
                    const nextStatus = currentIndex < STATUS_ORDER.length - 1 ? STATUS_ORDER[currentIndex + 1] : null;

                    return (
                      <Card
                        key={issue.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, issue.id)}
                        onDragEnd={handleDragEnd}
                        onClick={() => onIssueClick(issue)}
                        className={`p-3.5 bg-card hover:bg-muted/40 cursor-grab active:cursor-grabbing border-border shadow-xs hover:shadow-md transition-all rounded-lg space-y-2.5 group relative ${
                          draggingId === issue.id ? 'opacity-40 scale-[0.98]' : 'opacity-100'
                        }`}
                      >
                        {/* Top row: Ticket ID & Quick Move Dropdown */}
                        <div className="flex items-center justify-between gap-2" onClick={(e) => e.stopPropagation()}>
                          <span className="font-mono text-xs font-bold text-muted-foreground group-hover:text-primary transition-colors">
                            {ticketNum}
                          </span>

                          <div className="flex items-center gap-1">
                            {prevStatus && (
                              <Button
                                variant="ghost"
                                size="sm"
                                title={`Move back to ${prevStatus.replace('_', ' ')}`}
                                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                                onClick={() => handleStatusChange(issue.id, prevStatus)}
                              >
                                <ChevronLeft className="w-3.5 h-3.5" />
                              </Button>
                            )}

                            {nextStatus && (
                              <Button
                                variant="ghost"
                                size="sm"
                                title={`Advance to ${nextStatus.replace('_', ' ')}`}
                                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                                onClick={() => handleStatusChange(issue.id, nextStatus)}
                              >
                                <ChevronRight className="w-3.5 h-3.5" />
                              </Button>
                            )}

                            <DropdownMenu>
                              <DropdownMenuTrigger render={
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                                >
                                  <MoreVertical className="w-3.5 h-3.5" />
                                </Button>
                              } />
                              <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuLabel className="text-xs">Move to status</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {COLUMNS.map(target => (
                                  <DropdownMenuItem
                                    key={target.status}
                                    disabled={target.status === issue.status}
                                    onClick={() => handleStatusChange(issue.id, target.status)}
                                    className="text-xs flex items-center justify-between"
                                  >
                                    <span>{target.title}</span>
                                    {target.status === issue.status && (
                                      <span className="text-[10px] text-muted-foreground font-medium">Current</span>
                                    )}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>

                        {/* Title */}
                        <h4 className="text-sm font-semibold text-foreground leading-snug line-clamp-2">
                          {issue.title}
                        </h4>

                        {/* Badges & Meta */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {getPriorityBadge(issue.priority)}
                          <Badge variant="outline" className="text-[10px] font-mono uppercase border-border/80 text-muted-foreground">
                            {issue.type}
                          </Badge>
                          {issue.attachments && issue.attachments.length > 0 && (
                            <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground ml-auto" title={`${issue.attachments.length} attachments`}>
                              <Paperclip className="w-3 h-3" />
                              {issue.attachments.length}
                            </span>
                          )}
                        </div>

                        {/* Assignee Footer */}
                        <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {assignee?.photoURL ? (
                              <img
                                src={assignee.photoURL}
                                alt={assignee.displayName}
                                className="w-5 h-5 rounded-full object-cover shrink-0"
                              />
                            ) : (
                              <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                <UserIcon className="w-3 h-3" />
                              </div>
                            )}
                            <span className="text-muted-foreground truncate text-[11px]">
                              {assignee ? assignee.displayName : 'Unassigned'}
                            </span>
                          </div>

                          <span className="text-[10px] text-muted-foreground font-mono">
                            {issue.updatedAt?.toDate
                              ? issue.updatedAt.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                              : 'Recent'}
                          </span>
                        </div>
                      </Card>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
