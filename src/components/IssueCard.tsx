import { Issue, IssueStatus, IssuePriority, IssueType, User as UserType } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { 
  AlertCircle, 
  Clock, 
  CheckCircle2, 
  User, 
  MessageSquare, 
  Paperclip,
  ArrowUpCircle,
  ArrowDownCircle,
  MinusCircle
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '../lib/utils';

interface IssueCardProps {
  issue: Issue;
  users?: UserType[];
  onClick: (issue: Issue) => void;
}

const statusColors: Record<IssueStatus, string> = {
  OPEN: 'bg-blue-100 text-blue-700 border-blue-200',
  IN_PROGRESS: 'bg-amber-100 text-amber-700 border-amber-200',
  IN_REVIEW: 'bg-purple-100 text-purple-700 border-purple-200',
  RESOLVED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  CLOSED: 'bg-slate-100 text-slate-700 border-slate-200',
};

const priorityIcons: Record<IssuePriority, React.ReactNode> = {
  LOW: <ArrowDownCircle className="w-4 h-4 text-slate-400" />,
  MEDIUM: <MinusCircle className="w-4 h-4 text-blue-400" />,
  HIGH: <ArrowUpCircle className="w-4 h-4 text-amber-500" />,
  CRITICAL: <AlertCircle className="w-4 h-4 text-red-500" />,
};

const typeIcons: Record<IssueType, React.ReactNode> = {
  BUG: <BugIcon className="w-4 h-4 text-red-500" />,
  FEATURE: <PlusCircleIcon className="w-4 h-4 text-emerald-500" />,
  SUGGESTION: <LightbulbIcon className="w-4 h-4 text-amber-500" />,
};

function BugIcon({ className }: { className?: string }) {
  return <AlertCircle className={className} />;
}

function PlusCircleIcon({ className }: { className?: string }) {
  return <CheckCircle2 className={className} />;
}

function LightbulbIcon({ className }: { className?: string }) {
  return <Clock className={className} />;
}

export function IssueCard({ issue, users = [], onClick }: IssueCardProps) {
  const createdAt = issue.createdAt?.toDate ? issue.createdAt.toDate() : new Date();
  const reporter = users.find(u => u.uid === issue.reporterId);
  const assignee = users.find(u => u.uid === issue.assigneeId);

  return (
    <Card 
      className="group hover:shadow-md transition-all duration-200 cursor-pointer border-slate-200 hover:border-primary/30"
      onClick={() => onClick(issue)}
    >
      <CardHeader className="p-4 pb-2">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={cn("text-[10px] uppercase font-bold tracking-wider px-2 py-0", statusColors[issue.status])}>
                {issue.status.replace('_', ' ')}
              </Badge>
              <span className="text-xs text-slate-400 font-mono">#CYG-{issue.id?.slice(0, 4).toUpperCase()}</span>
            </div>
            <CardTitle className="text-base font-semibold group-hover:text-primary transition-colors line-clamp-2">
              {issue.title}
            </CardTitle>
          </div>
          <div className="flex-shrink-0">
            {priorityIcons[issue.priority]}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <p className="text-sm text-slate-500 line-clamp-2 mb-4">
          {issue.description}
        </p>
        
        <div className="flex flex-wrap gap-2 mb-4">
          {issue.labels.map(label => (
            <Badge key={label} variant="secondary" className="text-[10px] bg-slate-100 text-slate-600 hover:bg-slate-200">
              {label}
            </Badge>
          ))}
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-xs text-slate-400">
              <Clock className="w-3 h-3" />
              <span>{formatDistanceToNow(createdAt)} ago</span>
            </div>
            {issue.attachments.length > 0 && (
              <div className="flex items-center gap-1 text-xs text-slate-400">
                <Paperclip className="w-3 h-3" />
                <span>{issue.attachments.length}</span>
              </div>
            )}
          </div>
          
          <div className="flex -space-x-2">
            <div className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center overflow-hidden bg-slate-100" title={`Reporter: ${reporter?.displayName || issue.reporterId}`}>
              {reporter ? (
                <Avatar className="w-full h-full">
                  <AvatarImage src={reporter.photoURL} />
                  <AvatarFallback className="text-[8px]">{reporter.displayName.charAt(0)}</AvatarFallback>
                </Avatar>
              ) : (
                <User className="w-3 h-3 text-slate-400" />
              )}
            </div>
            {issue.assigneeId && (
              <div className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center overflow-hidden bg-primary/10" title={`Assignee: ${assignee?.displayName || issue.assigneeId}`}>
                {assignee ? (
                  <Avatar className="w-full h-full">
                    <AvatarImage src={assignee.photoURL} />
                    <AvatarFallback className="text-[8px]">{assignee.displayName.charAt(0)}</AvatarFallback>
                  </Avatar>
                ) : (
                  <User className="w-3 h-3 text-primary" />
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
