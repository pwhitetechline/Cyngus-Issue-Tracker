import { useState, useEffect } from 'react';
import { useIssue, useIssueActions } from '../hooks/useIssues';
import { useUsers } from '../hooks/useUsers';
import { Issue, IssueStatus, IssuePriority, Comment } from '../types';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from './ui/dropdown-menu';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription,
  CardFooter
} from './ui/card';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from './ui/select';
import { 
  Clock, 
  User, 
  MessageSquare, 
  ArrowLeft, 
  Send, 
  MoreVertical,
  History,
  Paperclip,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Image as ImageIcon
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '../hooks/useAuth';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import ReactMarkdown from 'react-markdown';
import { Textarea } from './ui/textarea';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Skeleton } from './ui/skeleton';

interface IssueDetailProps {
  issueId: string;
  onBack: () => void;
}

export function IssueDetail({ issueId, onBack }: IssueDetailProps) {
  const { issue, loading: issueLoading } = useIssue(issueId);
  const { users } = useUsers();
  const { updateIssue, deleteIssue } = useIssueActions();
  const { user, isAdmin } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!issueId) return;
    const q = query(
      collection(db, 'issues', issueId, 'comments'),
      orderBy('createdAt', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setComments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Comment)));
    });
    return () => unsubscribe();
  }, [issueId]);

  const handleStatusChange = async (status: IssueStatus) => {
    try {
      await updateIssue(issueId, { status });
      toast.success(`Status updated to ${status.replace('_', ' ')}`);
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handlePriorityChange = async (priority: IssuePriority) => {
    try {
      await updateIssue(issueId, { priority });
      toast.success(`Priority updated to ${priority}`);
    } catch (error) {
      toast.error('Failed to update priority');
    }
  };

  const handleAssigneeChange = async (assigneeId: string | null) => {
    try {
      await updateIssue(issueId, { assigneeId });
      toast.success(assigneeId ? 'Assignee updated' : 'Issue unassigned');
    } catch (error) {
      toast.error('Failed to update assignee');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this issue? This action cannot be undone.')) return;
    
    setDeleting(true);
    try {
      await deleteIssue(issueId);
      toast.success('Issue deleted successfully');
      onBack();
    } catch (error) {
      toast.error('Failed to delete issue');
      setDeleting(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !user) return;

    setSubmittingComment(true);
    try {
      await addDoc(collection(db, 'issues', issueId, 'comments'), {
        issueId,
        userId: user.uid,
        content: newComment,
        mentions: [],
        createdAt: serverTimestamp(),
      });
      setNewComment('');
      toast.success('Comment added');
    } catch (error) {
      toast.error('Failed to add comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  if (issueLoading) {
    return (
      <div className="space-y-8 max-w-5xl mx-auto">
        <Skeleton className="h-10 w-32" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Skeleton className="h-[600px] lg:col-span-2" />
          <Skeleton className="h-[400px]" />
        </div>
      </div>
    );
  }

  if (!issue) return <div>Issue not found</div>;

  const createdAt = issue.createdAt?.toDate ? issue.createdAt.toDate() : new Date();
  const assignee = users.find(u => u.uid === issue.assigneeId);

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-20">
      <Button variant="ghost" onClick={onBack} className="mb-4 hover:bg-white">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Explorer
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-8">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100 p-8">
              <div className="flex items-center gap-3 mb-4">
                <Badge className="bg-primary/10 text-primary border-primary/20">{issue.type}</Badge>
                <span className="text-sm text-slate-400 font-mono">#CYG-{issue.id?.slice(0, 8).toUpperCase()}</span>
              </div>
              <CardTitle className="text-3xl font-bold text-slate-900 tracking-tight leading-tight">
                {issue.title}
              </CardTitle>
              <div className="flex items-center gap-6 mt-6">
                <div className="flex items-center gap-2">
                  <Avatar className="w-6 h-6">
                    <AvatarFallback>{issue.reporterId.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm text-slate-600">Reporter ID: {issue.reporterId.slice(0, 6)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Clock className="w-4 h-4" />
                  <span>{formatDistanceToNow(createdAt)} ago</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-8 prose prose-slate max-w-none">
              <div className="markdown-body">
                <ReactMarkdown>{issue.description}</ReactMarkdown>
              </div>

              {issue.attachments && issue.attachments.length > 0 && (
                <div className="mt-8 pt-8 border-t border-slate-100">
                  <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Paperclip className="w-4 h-4 text-primary" />
                    Attachments ({issue.attachments.length})
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {issue.attachments.map((file, index) => {
                      const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(file.name);
                      return (
                        <div key={index} className="group relative bg-slate-50 rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition-all">
                          {isImage ? (
                            <div className="aspect-video w-full overflow-hidden bg-slate-200">
                              <img 
                                src={file.url} 
                                alt={file.name} 
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          ) : (
                            <div className="aspect-video w-full flex items-center justify-center bg-slate-100">
                              <Paperclip className="w-8 h-8 text-slate-300" />
                            </div>
                          )}
                          <div className="p-3 flex items-center justify-between bg-white">
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-medium text-slate-700 truncate">{file.name}</span>
                            </div>
                            <a 
                              href={file.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="p-1.5 bg-slate-100 rounded-md text-slate-500 hover:bg-primary hover:text-white transition-colors"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
            {issue.labels.length > 0 && (
              <CardFooter className="px-8 pb-8 pt-0 flex flex-wrap gap-2">
                {issue.labels.map(label => (
                  <Badge key={label} variant="secondary" className="bg-slate-100 text-slate-600">
                    {label}
                  </Badge>
                ))}
              </CardFooter>
            )}
          </Card>

          {/* Comments Section */}
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary" />
              Discussion ({comments.length})
            </h3>

            <div className="space-y-4">
              {comments.map(comment => (
                <div key={comment.id} className="flex gap-4">
                  <Avatar className="w-10 h-10 border border-slate-200 flex-shrink-0">
                    <AvatarFallback>{comment.userId.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <Card className="flex-1 border-slate-200 shadow-sm">
                    <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-800">User {comment.userId.slice(0, 6)}</span>
                        <span className="text-xs text-slate-400">
                          {comment.createdAt?.toDate ? formatDistanceToNow(comment.createdAt.toDate()) : 'just now'} ago
                        </span>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 text-sm text-slate-600 leading-relaxed">
                      {comment.content}
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>

            {/* New Comment Form */}
            <div className="flex gap-4 pt-4">
              <Avatar className="w-10 h-10 border border-slate-200 flex-shrink-0">
                <AvatarImage src={user?.photoURL} />
                <AvatarFallback>{user?.displayName?.charAt(0)}</AvatarFallback>
              </Avatar>
              <form onSubmit={handleAddComment} className="flex-1 space-y-3">
                <Textarea 
                  placeholder="Leave a comment... (Markdown supported)" 
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  className="min-h-[120px] border-slate-200 focus:ring-primary resize-none shadow-sm"
                />
                <div className="flex justify-end">
                  <Button type="submit" disabled={submittingComment || !newComment.trim()}>
                    {submittingComment ? 'Posting...' : 'Post Comment'}
                    <Send className="ml-2 w-4 h-4" />
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* Sidebar Controls */}
        <div className="space-y-6">
          <Card className="border-slate-200 shadow-sm sticky top-8">
            <CardHeader className="border-b border-slate-100 pb-4">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-400">Management</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Status</label>
                <Select value={issue.status} onValueChange={handleStatusChange}>
                  <SelectTrigger className="w-full border-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OPEN">Open</SelectItem>
                    <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                    <SelectItem value="IN_REVIEW">In Review</SelectItem>
                    <SelectItem value="RESOLVED">Resolved</SelectItem>
                    <SelectItem value="CLOSED">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Priority</label>
                <Select value={issue.priority} onValueChange={handlePriorityChange}>
                  <SelectTrigger className="w-full border-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="CRITICAL">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Assignee</label>
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden">
                    {assignee ? (
                      <Avatar className="w-full h-full">
                        <AvatarImage src={assignee.photoURL} />
                        <AvatarFallback>{assignee.displayName.charAt(0)}</AvatarFallback>
                      </Avatar>
                    ) : (
                      <User className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className={`text-sm ${assignee ? 'text-slate-900 font-medium' : 'text-slate-500 italic'}`}>
                      {assignee ? assignee.displayName : 'Unassigned'}
                    </span>
                    {assignee && <span className="text-[10px] text-slate-400 font-mono">{assignee.role}</span>}
                  </div>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger>
                      <Button variant="ghost" size="sm" className="ml-auto text-primary text-xs font-bold">
                        {assignee ? 'Change' : 'Assign'}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuItem onClick={() => handleAssigneeChange(null)} className="text-slate-500">
                        Unassign
                      </DropdownMenuItem>
                      <div className="h-px bg-slate-100 my-1" />
                      {users.filter(u => u.role !== 'VIEWER').map(u => (
                        <DropdownMenuItem key={u.uid} onClick={() => handleAssigneeChange(u.uid)}>
                          <div className="flex items-center gap-2">
                            <Avatar className="w-5 h-5">
                              <AvatarImage src={u.photoURL} />
                              <AvatarFallback>{u.displayName.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                              <span className="text-sm">{u.displayName}</span>
                              <span className="text-[10px] text-slate-400">{u.role}</span>
                            </div>
                          </div>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 space-y-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 flex items-center gap-1">
                    <History className="w-3 h-3" />
                    Last updated
                  </span>
                  <span className="text-slate-600 font-medium">
                    {issue.updatedAt?.toDate ? formatDistanceToNow(issue.updatedAt.toDate()) : 'just now'} ago
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Paperclip className="w-3 h-3" />
                    Attachments
                  </span>
                  <span className="text-slate-600 font-medium">{issue.attachments.length} files</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm bg-primary/5 border-primary/10">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-3">
                <CheckCircle2 className="w-5 h-5 text-primary" />
                <h4 className="font-bold text-slate-900">Quick Actions</h4>
              </div>
              <div className="space-y-2">
                <Button variant="outline" className="w-full justify-start bg-white border-slate-200 text-slate-700 hover:bg-slate-50">
                  <History className="w-4 h-4 mr-2" />
                  View Audit Trail
                </Button>
                <Button variant="outline" className="w-full justify-start bg-white border-slate-200 text-slate-700 hover:bg-slate-50">
                  <AlertCircle className="w-4 h-4 mr-2" />
                  Mark as Duplicate
                </Button>
                {isAdmin && (
                  <Button 
                    variant="outline" 
                    onClick={handleDelete}
                    disabled={deleting}
                    className="w-full justify-start bg-white border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                  >
                    <AlertCircle className="w-4 h-4 mr-2" />
                    {deleting ? 'Deleting...' : 'Delete Issue'}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
