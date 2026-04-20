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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
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
  Image as ImageIcon,
  X
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '../hooks/useAuth';
import { useNotifications } from '../hooks/useNotifications';
import { 
  collection, 
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query, 
  where,
  orderBy, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import ReactMarkdown from 'react-markdown';
import { Textarea } from './ui/textarea';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Skeleton } from './ui/skeleton';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../lib/firebase';
import { Loader2, Plus, Pencil, Save, History, Paperclip, CheckCircle2, AlertCircle, ExternalLink, Image as ImageIcon, X } from 'lucide-react';

interface IssueDetailProps {
  issueId: string;
  onBack: () => void;
}

export function IssueDetail({ issueId, onBack }: IssueDetailProps) {
  const { issue, loading: issueLoading } = useIssue(issueId);
  const { users } = useUsers();
  const { updateIssue, deleteIssue } = useIssueActions();
  const { user, isAdmin } = useAuth();
  const { createNotification } = useNotifications();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [updatingComment, setUpdatingComment] = useState(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [showAuditTrail, setShowAuditTrail] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isEditingIssue, setIsEditingIssue] = useState(false);
  const [editIssueData, setEditIssueData] = useState({ title: '', description: '' });
  const [isUrlDialogOpen, setIsUrlDialogOpen] = useState(false);
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [attachmentName, setAttachmentName] = useState('');
  const [addingUrl, setAddingUrl] = useState(false);

  const handleAddUrlAttachment = async () => {
    if (!attachmentUrl.trim() || !attachmentName.trim() || !issue) return;
    
    setAddingUrl(true);
    try {
      const newAttachments = [...(issue.attachments || [])];
      newAttachments.push({ name: attachmentName, url: attachmentUrl });
      await updateIssue(issueId, { attachments: newAttachments });
      toast.success('URL attachment added');
      setIsUrlDialogOpen(false);
      setAttachmentUrl('');
      setAttachmentName('');
    } catch (error) {
      toast.error('Failed to add URL');
    } finally {
      setAddingUrl(false);
    }
  };

  useEffect(() => {
    if (!issueId) return;
    const q = query(
      collection(db, 'auditLogs'),
      where('issueId', '==', issueId),
      orderBy('timestamp', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAuditLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error('Audit log fetch error:', error);
    });
    return () => unsubscribe();
  }, [issueId]);

  useEffect(() => {
    if (!issueId) return;
    const q = query(
      collection(db, 'issues', issueId, 'comments'),
      orderBy('createdAt', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setComments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Comment)));
    }, (error) => {
      console.error('Comments fetch error:', error);
    });
    return () => unsubscribe();
  }, [issueId]);

  const handleStatusChange = async (status: IssueStatus) => {
    try {
      await updateIssue(issueId, { status });
      toast.success(`Status updated to ${status.replace('_', ' ')}`);

      if (issue) {
        // Notify reporter if status changed by someone else
        if (issue.reporterId !== user?.uid) {
          await createNotification({
            userId: issue.reporterId,
            title: 'Issue Status Updated',
            message: `The status of your issue "${issue.title}" has been changed to ${status.replace('_', ' ')}.`,
            link: `/issues/${issueId}`,
            type: 'STATUS_CHANGED'
          });
        }
        
        // Notify assignee if status changed by someone else
        if (issue.assigneeId && issue.assigneeId !== user?.uid && issue.assigneeId !== issue.reporterId) {
          await createNotification({
            userId: issue.assigneeId,
            title: 'Issue Status Updated',
            message: `The status of the issue "${issue.title}" assigned to you has been changed to ${status.replace('_', ' ')}.`,
            link: `/issues/${issueId}`,
            type: 'STATUS_CHANGED'
          });
        }
      }
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

      if (issue && assigneeId && assigneeId !== user?.uid) {
        await createNotification({
          userId: assigneeId,
          title: 'New Issue Assigned',
          message: `You have been assigned to the issue: "${issue.title}"`,
          link: `/issues/${issueId}`,
          type: 'ISSUE_ASSIGNED'
        });
      }
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

      if (issue) {
        // Notify reporter
        if (issue.reporterId !== user?.uid) {
          await createNotification({
            userId: issue.reporterId,
            title: 'New Comment',
            message: `${user?.displayName} commented on your issue: "${issue.title}"`,
            link: `/issues/${issueId}`,
            type: 'COMMENT_ADDED'
          });
        }
        
        // Notify assignee
        if (issue.assigneeId && issue.assigneeId !== user?.uid && issue.assigneeId !== issue.reporterId) {
          await createNotification({
            userId: issue.assigneeId,
            title: 'New Comment',
            message: `${user?.displayName} commented on an issue assigned to you: "${issue.title}"`,
            link: `/issues/${issueId}`,
            type: 'COMMENT_ADDED'
          });
        }
      }
    } catch (error) {
      toast.error('Failed to add comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!window.confirm('Are you sure you want to delete this comment?')) return;
    
    try {
      await deleteDoc(doc(db, 'issues', issueId, 'comments', commentId));
      toast.success('Comment deleted');
    } catch (error) {
      toast.error('Failed to delete comment');
    }
  };

  const handleStartEdit = (comment: Comment) => {
    setEditingCommentId(comment.id);
    setEditContent(comment.content);
  };

  const handleCancelEdit = () => {
    setEditingCommentId(null);
    setEditContent('');
  };

  const handleUpdateComment = async (commentId: string) => {
    if (!editContent.trim()) return;

    setUpdatingComment(true);
    try {
      await updateDoc(doc(db, 'issues', issueId, 'comments', commentId), {
        content: editContent,
        updatedAt: serverTimestamp(),
      });
      setEditingCommentId(null);
      setEditContent('');
      toast.success('Comment updated');
    } catch (error) {
      toast.error('Failed to update comment');
    } finally {
      setUpdatingComment(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !issue) return;

    const fileList = Array.from(files);
    console.log(`[Upload] Starting for ${fileList.length} files`);
    
    setUploading(true);
    const uploadToastId = toast.loading('Initializing upload...');
    
    try {
      const newAttachments = [...(issue.attachments || [])];
      
      for (const file of fileList) {
        if (file.size > 20 * 1024 * 1024) {
          throw new Error(`File ${file.name} is too large (max 20MB)`);
        }

        console.log(`[Upload] Processing: ${file.name} (${file.size} bytes)`);
        toast.message(`Uploading ${file.name}...`, { id: uploadToastId });
        
        const cleanName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
        const storagePath = `issues/${issueId}/attachments/${Date.now()}_${cleanName}`;
        const storageRef = ref(storage, storagePath);
        
        // Use simple uploadBytes with a 120 second timeout
        console.log(`[Upload] Starting uploadBytes for ${file.name} to ${storageRef.fullPath}`);
        const uploadResult = await Promise.race([
          uploadBytes(storageRef, file, {
            contentType: file.type,
            customMetadata: {
              originalName: file.name,
              uploadedBy: user?.uid || 'unknown'
            }
          }),
          new Promise<never>((_, reject) => 
            setTimeout(() => {
              console.error(`[Upload] Timeout reached for ${file.name}`);
              reject(new Error(`Upload of ${file.name} timed out after 120s. This might be a network issue or missing CORS configuration on the bucket.`));
            }, 120000)
          )
        ]);

        const url = await getDownloadURL(uploadResult.ref);
        console.log(`[Upload] Finished: ${file.name} -> ${url}`);
        newAttachments.push({ name: file.name, url });
      }

      console.log('[Upload] Finalizing Firestore update');
      toast.message('Finalizing issue update...', { id: uploadToastId });
      await updateIssue(issueId, { attachments: newAttachments });
      toast.success('Files uploaded successfully', { id: uploadToastId });
    } catch (error) {
      console.error('[Upload] Detailed failure:', error);
      const isTimeout = error instanceof Error && error.message.includes('timeout');
      
      if (isTimeout) {
        toast.error('Upload Timed Out', {
          id: uploadToastId,
          description: 'This is likely a CORS issue in your Firebase bucket. Please check the Console for instructions.',
          duration: 10000
        });
        
        console.group('%c 🛠️ Firebase Storage Troubleshooting', 'color: white; background: #e11d48; font-size: 14px; padding: 4px; border-radius: 4px;');
        console.log('If you see a CORS error above, you need to configure your bucket to allow the app origin.');
        console.log('Run this command using gsutil or check the Firebase console:');
        console.log(`gsutil cors set cors-json.json gs://${firebaseConfig.storageBucket}`);
        console.log('Content of cors-json.json:');
        console.log(JSON.stringify([{
          "origin": [window.location.origin],
          "method": ["GET", "PUT", "POST", "DELETE", "HEAD"],
          "maxAgeSeconds": 3600
        }], null, 2));
        console.groupEnd();
      } else {
        toast.error(error instanceof Error ? `Upload failed: ${error.message}` : 'Failed to upload files', { id: uploadToastId });
      }
    } finally {
      console.log('[Upload] Process complete');
      setUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleRemoveAttachment = async (index: number) => {
    if (!issue || !window.confirm('Are you sure you want to remove this attachment?')) return;

    const newAttachments = [...(issue.attachments || [])];
    newAttachments.splice(index, 1);

    try {
      await updateIssue(issueId, { attachments: newAttachments });
      toast.success('Attachment removed');
    } catch (error) {
      toast.error('Failed to remove attachment');
    }
  };

  const startEditingIssue = () => {
    if (!issue) return;
    setEditIssueData({ title: issue.title, description: issue.description });
    setIsEditingIssue(true);
  };

  const cancelEditingIssue = () => {
    setIsEditingIssue(false);
  };

  const handleSaveIssue = async () => {
    if (!editIssueData.title.trim() || !editIssueData.description.trim()) return;
    
    setSavingIssue(true);
    try {
      await updateIssue(issueId, editIssueData);
      setIsEditingIssue(false);
      toast.success('Issue updated successfully');
    } catch (error) {
      toast.error('Failed to update issue');
    } finally {
      setSavingIssue(false);
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
  const reporter = users.find(u => u.uid === issue.reporterId);

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-20">
      <Button variant="ghost" onClick={onBack} className="mb-4 hover:bg-accent transition-colors">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Explorer
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-8">
          <Card className="border-border shadow-sm">
            <CardHeader className="border-b border-border/50 p-8">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <Badge className="bg-primary/10 text-primary border-primary/20">{issue.type}</Badge>
                  <span className="text-sm text-muted-foreground font-mono">#CYG-{issue.id?.slice(0, 8).toUpperCase()}</span>
                </div>
                {(isAdmin || user?.uid === issue.reporterId) && !isEditingIssue && (
                  <Button variant="ghost" size="sm" onClick={startEditingIssue} className="text-muted-foreground hover:text-primary">
                    <Pencil className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                )}
                {isEditingIssue && (
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={cancelEditingIssue} disabled={savingIssue}>
                      <CloseIcon className="w-4 h-4 mr-2" />
                      Cancel
                    </Button>
                    <Button size="sm" onClick={handleSaveIssue} disabled={savingIssue}>
                      {savingIssue ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                      Save
                    </Button>
                  </div>
                )}
              </div>
              {isEditingIssue ? (
                <Input 
                  value={editIssueData.title}
                  onChange={e => setEditIssueData({ ...editIssueData, title: e.target.value })}
                  className="text-2xl font-bold h-12"
                  placeholder="Issue title"
                />
              ) : (
                <CardTitle className="text-3xl font-bold text-foreground tracking-tight leading-tight">
                  {issue.title}
                </CardTitle>
              )}
              <div className="flex items-center gap-6 mt-6">
                <div className="flex items-center gap-2">
                  <Avatar className="w-6 h-6 border border-border">
                    <AvatarImage src={reporter?.photoURL} />
                    <AvatarFallback>{(reporter?.displayName || issue.reporterId).charAt(0)}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm text-muted-foreground">Reporter: {reporter?.displayName || `User ${issue.reporterId.slice(0, 6)}`}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  <span>{formatDistanceToNow(createdAt)} ago</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-8 prose prose-slate dark:prose-invert max-w-none">
              {isEditingIssue ? (
                <div className="space-y-6">
                  <Textarea 
                    value={editIssueData.description}
                    onChange={e => setEditIssueData({ ...editIssueData, description: e.target.value })}
                    className="min-h-[300px] text-base"
                    placeholder="Describe the issue..."
                  />
                  <div className="space-y-4 not-prose">
                    <Label className="text-sm font-semibold text-foreground">Add Attachments</Label>
                    <div 
                      className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/50 transition-colors cursor-pointer bg-muted/50 group"
                      onClick={() => document.getElementById('edit-file-upload')?.click()}
                    >
                      <input 
                        id="edit-file-upload"
                        type="file" 
                        multiple 
                        className="hidden" 
                        onChange={handleFileUpload}
                        accept="image/*,.pdf,.doc,.docx"
                      />
                      <div className="flex flex-col items-center gap-2">
                        <div className="p-2 bg-card rounded-full shadow-sm group-hover:scale-110 transition-transform">
                          {uploading ? <Loader2 className="w-5 h-5 animate-spin text-primary" /> : <ImageIcon className="w-5 h-5 text-muted-foreground group-hover:text-primary" />}
                        </div>
                        <p className="text-sm font-medium text-muted-foreground">
                          {uploading ? 'Uploading...' : 'Click to add more screenshots or documents'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="markdown-body">
                  <ReactMarkdown>{issue.description}</ReactMarkdown>
                </div>
              )}

              {issue.attachments && issue.attachments.length > 0 && (
                <div className="mt-8 pt-8 border-t border-border/50">
                  <h4 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Paperclip className="w-4 h-4 text-primary" />
                    Attachments ({(issue.attachments?.length || 0)})
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {issue.attachments.map((file, index) => {
                      const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(file.name);
                      return (
                        <div key={index} className="group relative bg-muted/50 rounded-xl border border-border overflow-hidden hover:shadow-md transition-all">
                          {isImage ? (
                            <div className="aspect-video w-full overflow-hidden bg-muted">
                              <img 
                                src={file.url} 
                                alt={file.name} 
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          ) : (
                            <div className="aspect-video w-full flex items-center justify-center bg-muted">
                              <Paperclip className="w-8 h-8 text-muted-foreground/50" />
                            </div>
                          )}
                          <div className="p-3 flex items-center justify-between bg-card">
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-medium text-foreground truncate">{file.name}</span>
                            </div>
                            <a 
                              href={file.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="p-1.5 bg-muted rounded-md text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                            {(isAdmin || user?.uid === issue.reporterId) && (
                              <button 
                                onClick={() => handleRemoveAttachment(index)}
                                className="p-1.5 bg-muted rounded-md text-muted-foreground hover:bg-destructive hover:text-white transition-colors"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
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
                  <Badge key={label} variant="secondary" className="bg-muted text-muted-foreground">
                    {label}
                  </Badge>
                ))}
              </CardFooter>
            )}
          </Card>

          {/* Comments Section */}
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary" />
              Discussion ({comments.length})
            </h3>

            <div className="space-y-4">
              {comments.map(comment => {
                const commentUser = users.find(u => u.uid === comment.userId);
                return (
                  <div key={comment.id} className="flex gap-4">
                    <Avatar className="w-10 h-10 border border-border flex-shrink-0">
                      <AvatarImage src={commentUser?.photoURL} />
                      <AvatarFallback>{(commentUser?.displayName || comment.userId).charAt(0)}</AvatarFallback>
                    </Avatar>
                    <Card className="flex-1 border-border shadow-sm">
                      <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-foreground">
                            {commentUser?.displayName || `User ${comment.userId.slice(0, 6)}`}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {comment.createdAt?.toDate ? formatDistanceToNow(comment.createdAt.toDate()) : 'just now'} ago
                          </span>
                        </div>
                        {(isAdmin || user?.uid === comment.userId) && (
                          <DropdownMenu>
                            <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" />}>
                              <MoreVertical className="w-4 h-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleStartEdit(comment)}>
                                Edit Comment
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleDeleteComment(comment.id)}
                                className="text-red-600 focus:text-red-600"
                              >
                                Delete Comment
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </CardHeader>
                      <CardContent className="p-4 pt-0 text-sm text-muted-foreground leading-relaxed">
                        {editingCommentId === comment.id ? (
                          <div className="space-y-3">
                            <Textarea 
                              value={editContent}
                              onChange={e => setEditContent(e.target.value)}
                              className="min-h-[100px] border-border focus:ring-primary resize-none shadow-sm"
                            />
                            <div className="flex justify-end gap-2">
                              <Button variant="ghost" size="sm" onClick={handleCancelEdit} disabled={updatingComment}>
                                Cancel
                              </Button>
                              <Button size="sm" onClick={() => handleUpdateComment(comment.id)} disabled={updatingComment || !editContent.trim()}>
                                {updatingComment ? 'Saving...' : 'Save Changes'}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          comment.content
                        )}
                      </CardContent>
                    </Card>
                  </div>
                );
              })}
            </div>

            {/* New Comment Form */}
            <div className="flex gap-4 pt-4">
              <Avatar className="w-10 h-10 border border-border flex-shrink-0">
                <AvatarImage src={user?.photoURL} />
                <AvatarFallback>{user?.displayName?.charAt(0)}</AvatarFallback>
              </Avatar>
              <form onSubmit={handleAddComment} className="flex-1 space-y-3">
                <Textarea 
                  placeholder="Leave a comment... (Markdown supported)" 
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  className="min-h-[120px] border-border focus:ring-primary resize-none shadow-sm"
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
          <Card className="border-border shadow-sm sticky top-8">
            <CardHeader className="border-b border-border/50 pb-4">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Management</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase">Status</label>
                <Select value={issue.status} onValueChange={handleStatusChange}>
                  <SelectTrigger className="w-full border-border">
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
                <label className="text-xs font-bold text-muted-foreground uppercase">Priority</label>
                <Select value={issue.priority} onValueChange={handlePriorityChange}>
                  <SelectTrigger className="w-full border-border">
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
                <label className="text-xs font-bold text-muted-foreground uppercase">Assignee</label>
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border border-border/50">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                    {assignee ? (
                      <Avatar className="w-full h-full">
                        <AvatarImage src={assignee.photoURL} />
                        <AvatarFallback>{assignee.displayName.charAt(0)}</AvatarFallback>
                      </Avatar>
                    ) : (
                      <User className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className={`text-sm ${assignee ? 'text-foreground font-medium' : 'text-muted-foreground italic'}`}>
                      {assignee ? assignee.displayName : 'Unassigned'}
                    </span>
                    {assignee && <span className="text-[10px] text-muted-foreground font-mono">{assignee.role}</span>}
                  </div>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="ghost" size="sm" className="ml-auto text-primary text-xs font-bold" />}>
                      {assignee ? 'Change' : 'Assign'}
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuItem onClick={() => handleAssigneeChange(null)} className="text-muted-foreground">
                        Unassign
                      </DropdownMenuItem>
                      <div className="h-px bg-border/50 my-1" />
                      {users.filter(u => u.role !== 'VIEWER').map(u => (
                        <DropdownMenuItem key={u.uid} onClick={() => handleAssigneeChange(u.uid)}>
                          <div className="flex items-center gap-2">
                            <Avatar className="w-5 h-5 border border-border">
                              <AvatarImage src={u.photoURL} />
                              <AvatarFallback>{u.displayName.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                              <span className="text-sm">{u.displayName}</span>
                              <span className="text-[10px] text-muted-foreground">{u.role}</span>
                            </div>
                          </div>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <div className="pt-4 border-t border-border/50 space-y-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <History className="w-3 h-3" />
                    Last updated
                  </span>
                  <span className="text-foreground font-medium">
                    {issue.updatedAt?.toDate ? formatDistanceToNow(issue.updatedAt.toDate()) : 'just now'} ago
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Paperclip className="w-3 h-3" />
                    Attachments
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-foreground font-medium">{(issue.attachments?.length || 0)} files</span>
                    <input 
                      id="sidebar-file-upload"
                      type="file" 
                      multiple 
                      className="hidden" 
                      onChange={handleFileUpload}
                      accept="image/*,.pdf,.doc,.docx"
                    />
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-5 w-5 text-primary hover:bg-primary/10"
                      disabled={uploading}
                      onClick={() => document.getElementById('sidebar-file-upload')?.click()}
                    >
                      {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                    </Button>
                    
                    <Dialog open={isUrlDialogOpen} onOpenChange={setIsUrlDialogOpen}>
                      <DialogTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-5 w-5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                          title="Add file via URL"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add Attachment via URL</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="url-name">File Name</Label>
                            <Input 
                              id="url-name" 
                              placeholder="e.g. Design Spec PDF" 
                              value={attachmentName}
                              onChange={(e) => setAttachmentName(e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="url-value">URL</Label>
                            <Input 
                              id="url-value" 
                              placeholder="https://example.com/file.pdf" 
                              value={attachmentUrl}
                              onChange={(e) => setAttachmentUrl(e.target.value)}
                            />
                          </div>
                          <Button 
                            className="w-full" 
                            onClick={handleAddUrlAttachment}
                            disabled={addingUrl || !attachmentUrl || !attachmentName}
                          >
                            {addingUrl ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : 'Add Attachment'}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm bg-primary/5 border-primary/10">
            <CardContent className="p-6">
              <div className="space-y-2">
                <CheckCircle2 className="w-5 h-5 text-primary" />
                <h4 className="font-bold text-foreground">Quick Actions</h4>
              </div>
              <div className="space-y-2">
                <Dialog open={showAuditTrail} onOpenChange={setShowAuditTrail}>
                  <DialogTrigger render={
                    <Button variant="outline" className="w-full justify-start bg-card border-border text-foreground hover:bg-accent">
                      <History className="w-4 h-4 mr-2" />
                      View Audit Trail
                    </Button>
                  } />
                  <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Audit Trail - #CYG-{issue.id?.slice(0, 8).toUpperCase()}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6 mt-4">
                      {auditLogs.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground italic">No history found for this issue.</div>
                      ) : (
                        auditLogs.map((log) => {
                          const logUser = users.find(u => u.uid === log.userId);
                          return (
                            <div key={log.id} className="flex gap-4 relative pb-6 last:pb-0">
                              {/* Vertical line connector */}
                              <div className="absolute left-4 top-8 bottom-0 w-px bg-border/50 last:hidden" />
                              
                              <Avatar className="w-8 h-8 border border-border z-10 bg-card">
                                <AvatarImage src={logUser?.photoURL} />
                                <AvatarFallback>{(logUser?.displayName || log.userId).charAt(0)}</AvatarFallback>
                              </Avatar>
                              
                              <div className="flex-1 space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-bold text-foreground">
                                    {logUser?.displayName || `User ${log.userId.slice(0, 6)}`}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {log.timestamp?.toDate ? formatDistanceToNow(log.timestamp.toDate()) : 'just now'} ago
                                  </span>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  <span className="font-medium text-primary uppercase text-[10px] tracking-wider mr-2 px-1.5 py-0.5 bg-primary/5 rounded">
                                    {log.action}
                                  </span>
                                  {log.action === 'CREATE' && 'created the issue'}
                                  {log.action === 'UPDATE' && (
                                    <span>
                                      updated {Object.keys(log.newValue).join(', ')}
                                    </span>
                                  )}
                                  {log.action === 'DELETE' && 'deleted the issue'}
                                </p>
                                {log.action === 'UPDATE' && (
                                  <div className="mt-2 p-3 bg-muted/50 rounded-lg border border-border/50 text-xs space-y-1">
                                    {Object.entries(log.newValue).map(([key, val]: [string, any]) => (
                                      <div key={key} className="flex items-start gap-2">
                                        <span className="font-bold text-muted-foreground w-16 shrink-0">{key}:</span>
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="text-muted-foreground/60 line-through">
                                            {String(log.oldValue?.[key] || 'none')}
                                          </span>
                                          <span className="text-muted-foreground/40">→</span>
                                          <span className="text-foreground font-medium">{String(val)}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
                <Button variant="outline" className="w-full justify-start bg-card border-border text-foreground hover:bg-accent">
                  <AlertCircle className="w-4 h-4 mr-2" />
                  Mark as Duplicate
                </Button>
                {isAdmin && (
                  <Button 
                    variant="outline" 
                    onClick={handleDelete}
                    disabled={deleting}
                    className="w-full justify-start bg-card border-destructive/20 text-destructive hover:bg-destructive/10"
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
