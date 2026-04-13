import { useState } from 'react';
import { useIssueActions } from '../hooks/useIssues';
import { Issue, IssueType, IssuePriority } from '../types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from './ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Badge } from './ui/badge';
import { X, Plus, Send, Loader2, Image as ImageIcon, Paperclip } from 'lucide-react';
import { toast } from 'sonner';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../lib/firebase';

interface IssueFormProps {
  onSuccess: () => void;
}

export function IssueForm({ onSuccess }: IssueFormProps) {
  const { createIssue } = useIssueActions();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [labels, setLabels] = useState<string[]>([]);
  const [labelInput, setLabelInput] = useState('');
  const [attachments, setAttachments] = useState<{ name: string; url: string }[]>([]);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'BUG' as IssueType,
    priority: 'MEDIUM' as IssuePriority,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.description) return;

    setLoading(true);
    try {
      await createIssue({
        ...formData,
        labels,
        attachments,
      });
      toast.success('Issue created successfully');
      onSuccess();
    } catch (error) {
      console.error(error);
      toast.error('Failed to create issue');
    } finally {
      setLoading(false);
    }
  };

  const addLabel = () => {
    if (labelInput && !labels.includes(labelInput)) {
      setLabels([...labels, labelInput]);
      setLabelInput('');
    }
  };

  const removeLabel = (label: string) => {
    setLabels(labels.filter(l => l !== label));
  };

  const uploadFiles = async (files: FileList | File[]) => {
    if (uploading) return;
    setUploading(true);

    try {
      const uploadedAttachments: { name: string; url: string }[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const storageRef = ref(storage, `issues/attachments/${Date.now()}-${file.name}`);
        const snapshot = await uploadBytes(storageRef, file);
        const url = await getDownloadURL(snapshot.ref);
        uploadedAttachments.push({ name: file.name, url });
      }
      
      setAttachments(prev => [...prev, ...uploadedAttachments]);
      toast.success('Files uploaded successfully');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload files. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await uploadFiles(files);
    // Reset input so the same file can be uploaded again if needed
    e.target.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  return (
    <div className="max-w-3xl mx-auto">
      <Card className="border-border shadow-lg">
        <CardHeader className="border-b border-border/50 pb-6">
          <CardTitle className="text-2xl font-bold text-foreground">Report New Issue</CardTitle>
          <CardDescription>
            Provide as much detail as possible to help the team resolve this quickly.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title" className="text-sm font-semibold text-foreground">Issue Title</Label>
              <Input 
                id="title"
                placeholder="e.g., Login button not responding on mobile"
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                className="h-12 border-border focus:ring-primary"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="type" className="text-sm font-semibold text-foreground">Issue Type</Label>
                <Select 
                  value={formData.type} 
                  onValueChange={v => setFormData({ ...formData, type: v as IssueType })}
                >
                  <SelectTrigger className="h-12 border-border">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BUG">Bug Report</SelectItem>
                    <SelectItem value="FEATURE">Feature Request</SelectItem>
                    <SelectItem value="SUGGESTION">Suggestion</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority" className="text-sm font-semibold text-foreground">Priority Level</Label>
                <Select 
                  value={formData.priority} 
                  onValueChange={v => setFormData({ ...formData, priority: v as IssuePriority })}
                >
                  <SelectTrigger className="h-12 border-border">
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="CRITICAL">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-semibold text-foreground">Detailed Description</Label>
              <Textarea 
                id="description"
                placeholder="Describe the issue, steps to reproduce, and expected behavior..."
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                className="min-h-[200px] border-border focus:ring-primary resize-none"
                required
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground">Labels & Tags</Label>
              <div className="flex gap-2">
                <Input 
                  placeholder="Add a label..."
                  value={labelInput}
                  onChange={e => setLabelInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addLabel())}
                  className="h-10 border-border"
                />
                <Button type="button" variant="outline" onClick={addLabel} className="h-10">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {labels.map(label => (
                  <Badge key={label} variant="secondary" className="pl-2 pr-1 py-1 gap-1 bg-primary/10 text-primary border-primary/20">
                    {label}
                    <button type="button" onClick={() => removeLabel(label)} className="hover:text-destructive transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground">Screenshots & Attachments</Label>
              <div 
                className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/50 transition-colors cursor-pointer bg-muted/50 group"
                onClick={() => document.getElementById('file-upload')?.click()}
              >
                <input 
                  id="file-upload"
                  type="file" 
                  multiple 
                  className="hidden" 
                  onChange={handleFileUpload}
                  accept="image/*,.pdf,.doc,.docx"
                />
                <div className="flex flex-col items-center gap-2">
                  <div className="p-3 bg-card rounded-full shadow-sm group-hover:scale-110 transition-transform">
                    <ImageIcon className="w-6 h-6 text-muted-foreground group-hover:text-primary" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {uploading ? 'Uploading...' : 'Click or drag to upload screenshots'}
                  </p>
                  <p className="text-xs text-muted-foreground">PNG, JPG, PDF up to 10MB</p>
                </div>
              </div>

              {attachments.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                  {attachments.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-card border border-border rounded-lg shadow-sm">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <Paperclip className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm text-muted-foreground truncate">{file.name}</span>
                      </div>
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeAttachment(index);
                        }}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-6 border-t border-border/50 flex justify-end gap-4">
              <Button type="button" variant="ghost" onClick={onSuccess}>Cancel</Button>
              <Button type="submit" disabled={loading} className="px-8 h-12">
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                Submit Issue
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
