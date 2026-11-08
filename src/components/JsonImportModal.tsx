import { useState, useRef } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { 
  UploadCloud, 
  FileJson, 
  CheckCircle2, 
  AlertTriangle, 
  Download, 
  Copy, 
  Check, 
  Loader2, 
  FileText,
  AlertCircle,
  Users
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../hooks/useAuth';
import { User, IssuePriority, IssueStatus } from '../types';
import { 
  parseIssuesFromJson, 
  executeIssueImport, 
  getSampleIssueJson, 
  ParsedImportIssue, 
  ImportExecutionResult 
} from '../lib/issueImport';

interface JsonImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  onImportComplete?: () => void;
}

export function JsonImportModal({ isOpen, onClose, users, onImportComplete }: JsonImportModalProps) {
  const { user: currentUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('upload');
  const [jsonText, setJsonText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Parsing & Selection State
  const [parsedIssues, setParsedIssues] = useState<ParsedImportIssue[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [copiedSample, setCopiedSample] = useState(false);

  // Optional Global Overrides
  const [globalAssigneeId, setGlobalAssigneeId] = useState<string>('preserve');

  // Execution State
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);
  const [importResult, setImportResult] = useState<ImportExecutionResult | null>(null);

  // Reset modal state
  const handleReset = () => {
    setJsonText('');
    setFileName(null);
    setParsedIssues([]);
    setParseError(null);
    setSelectedIndices(new Set());
    setIsImporting(false);
    setImportProgress(null);
    setImportResult(null);
    setGlobalAssigneeId('preserve');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    if (isImporting) return;
    handleReset();
    onClose();
  };

  // Parse text or file contents
  const processJsonString = (rawJson: string, name?: string) => {
    setParseError(null);
    setImportResult(null);
    const result = parseIssuesFromJson(rawJson, users);

    if (!result.success) {
      setParseError(result.errorMessage || 'Failed to parse JSON');
      setParsedIssues([]);
      setSelectedIndices(new Set());
      return;
    }

    if (result.issues.length === 0) {
      setParseError('No issues were found in the provided JSON data.');
      setParsedIssues([]);
      setSelectedIndices(new Set());
      return;
    }

    setParsedIssues(result.issues);
    if (name) setFileName(name);

    // Select all valid issues by default
    const validIdxs = new Set<number>();
    result.issues.forEach(issue => {
      if (issue.isValid) validIdxs.add(issue.originalIndex);
    });
    setSelectedIndices(validIdxs);
    toast.success(`Successfully parsed ${result.issues.length} issue(s) from JSON.`);
  };

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json') && file.type !== 'application/json' && file.type !== '') {
      toast.error('Please upload a valid .json file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setJsonText(content);
      processJsonString(content, file.name);
    };
    reader.onerror = () => {
      toast.error('Failed to read the file.');
    };
    reader.readAsText(file);
  };

  // Handle Drag & Drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setJsonText(content);
      processJsonString(content, file.name);
    };
    reader.readAsText(file);
  };

  // Handle manual paste parse
  const handleParseText = () => {
    if (!jsonText.trim()) {
      setParseError('Please paste some JSON data first.');
      return;
    }
    processJsonString(jsonText, 'pasted-data.json');
  };

  // Load sample template into textarea
  const handleLoadSample = () => {
    const sample = getSampleIssueJson();
    setJsonText(sample);
    processJsonString(sample, 'sample-template.json');
  };

  // Download sample template file
  const handleDownloadSample = () => {
    const sample = getSampleIssueJson();
    const blob = new Blob([sample], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'wdb-issues-sample-template.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Downloaded sample JSON template');
  };

  // Copy sample to clipboard
  const handleCopySample = () => {
    const sample = getSampleIssueJson();
    navigator.clipboard.writeText(sample);
    setCopiedSample(true);
    toast.success('Sample JSON copied to clipboard');
    setTimeout(() => setCopiedSample(false), 2000);
  };

  // Toggle selection
  const toggleIssueSelection = (idx: number) => {
    setSelectedIndices(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIndices.size === parsedIssues.length) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(parsedIssues.map(i => i.originalIndex)));
    }
  };

  // Run Import
  const handleStartImport = async () => {
    if (!currentUser) {
      toast.error('You must be signed in to import issues.');
      return;
    }

    const issuesToRun = parsedIssues
      .filter(i => selectedIndices.has(i.originalIndex))
      .map(issue => {
        // Apply global assignee override if selected
        if (globalAssigneeId !== 'preserve') {
          return {
            ...issue,
            assigneeId: globalAssigneeId === 'unassigned' ? null : globalAssigneeId
          };
        }
        return issue;
      });

    if (issuesToRun.length === 0) {
      toast.error('No issues selected for import.');
      return;
    }

    setIsImporting(true);
    setImportProgress({ current: 0, total: issuesToRun.length });

    try {
      const res = await executeIssueImport(
        issuesToRun, 
        currentUser,
        (current, total) => {
          setImportProgress({ current, total });
        }
      );

      setImportResult(res);

      if (res.successCount > 0) {
        toast.success(`Successfully imported ${res.successCount} issue(s)!`);
        if (onImportComplete) onImportComplete();
      }

      if (res.failedCount > 0) {
        toast.error(`${res.failedCount} issue(s) encountered an error during import.`);
      }
    } catch (err: any) {
      console.error('Fatal import error:', err);
      toast.error(`Import failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsImporting(false);
    }
  };

  const selectedCount = selectedIndices.size;

  const priorityColors: Record<IssuePriority, string> = {
    LOW: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    MEDIUM: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    HIGH: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    CRITICAL: 'bg-red-500/10 text-red-400 border-red-500/20',
  };

  const statusColors: Record<IssueStatus, string> = {
    OPEN: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    IN_PROGRESS: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    IN_REVIEW: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    RESOLVED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    CLOSED: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-card border-border">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b border-border/50 bg-muted/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <FileJson className="w-5 h-5 text-primary" />
                Import Issues from JSON
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-1">
                Batch import bug reports, feature requests, or suggestions into your workspace.
              </DialogDescription>
            </div>

            {/* Quick Template Actions */}
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleCopySample}
                className="h-8 text-xs gap-1.5 border-border"
                title="Copy sample JSON structure"
              >
                {copiedSample ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedSample ? 'Copied' : 'Copy Sample'}
              </Button>

              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleDownloadSample}
                className="h-8 text-xs gap-1.5 border-border"
                title="Download sample JSON template file"
              >
                <Download className="w-3.5 h-3.5" />
                Template
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Phase 1: Upload or Paste JSON (only if not yet parsed or completed) */}
          {parsedIssues.length === 0 && !importResult && (
            <div className="space-y-4">
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
                <TabsList className="grid grid-cols-2 max-w-xs mb-4">
                  <TabsTrigger value="upload" className="text-xs">Upload File</TabsTrigger>
                  <TabsTrigger value="paste" className="text-xs">Paste JSON Text</TabsTrigger>
                </TabsList>

                {/* Tab 1: File Dropzone */}
                <TabsContent value="upload" className="mt-0">
                  <div 
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center gap-3 ${
                      isDragging 
                        ? 'border-primary bg-primary/5 scale-[0.99]' 
                        : 'border-border hover:border-primary/50 hover:bg-muted/30'
                    }`}
                  >
                    <input 
                      ref={fileInputRef} 
                      type="file" 
                      accept=".json,application/json" 
                      className="hidden" 
                      onChange={handleFileChange}
                    />
                    <div className="p-4 bg-primary/10 text-primary rounded-full">
                      <UploadCloud className="w-8 h-8" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-foreground">
                        Click to upload or drag & drop JSON file
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Supports arrays of issues, Jira/GitHub exports, or exported Cygnus tickets (.json)
                      </p>
                    </div>
                  </div>
                </TabsContent>

                {/* Tab 2: Raw JSON Textarea */}
                <TabsContent value="paste" className="mt-0 space-y-3">
                  <div className="relative">
                    <textarea
                      value={jsonText}
                      onChange={(e) => setJsonText(e.target.value)}
                      placeholder='Paste JSON array here, e.g. [{"title": "Checkout error", "description": "Details here...", "priority": "HIGH"}]'
                      rows={10}
                      className="w-full p-3 font-mono text-xs rounded-xl bg-muted/40 border border-border focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none resize-y"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={handleLoadSample}
                      className="text-xs text-muted-foreground hover:text-foreground h-8"
                    >
                      <FileText className="w-3.5 h-3.5 mr-1.5" />
                      Load Demo Sample JSON
                    </Button>

                    <Button 
                      onClick={handleParseText}
                      size="sm"
                      className="h-8 gap-1.5 font-medium"
                      disabled={!jsonText.trim()}
                    >
                      Parse JSON Data
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>

              {parseError && (
                <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <p className="font-semibold">JSON Parsing Error</p>
                    <p className="opacity-90">{parseError}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Phase 2: Parsed Issues Preview Table */}
          {parsedIssues.length > 0 && !importResult && (
            <div className="space-y-5">
              {/* Stats Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-muted/40 rounded-xl border border-border/60">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs py-1 px-2.5">
                    {parsedIssues.length} issue(s) detected
                  </Badge>
                  {fileName && (
                    <span className="text-xs text-muted-foreground font-mono truncate max-w-xs">
                      File: {fileName}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {/* Optional Global Assignee Selector */}
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Assign To:</span>
                    <select
                      value={globalAssigneeId}
                      onChange={(e) => setGlobalAssigneeId(e.target.value)}
                      className="h-8 text-xs bg-card border border-border rounded-md px-2 py-1 text-foreground focus:outline-none focus:border-primary"
                    >
                      <option value="preserve">Keep Matched Assignees</option>
                      <option value="unassigned">Leave Unassigned</option>
                      {users.map(u => (
                        <option key={u.uid} value={u.uid}>
                          {u.displayName || u.email}
                        </option>
                      ))}
                    </select>
                  </div>

                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleReset}
                    className="h-8 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Change JSON
                  </Button>
                </div>
              </div>

              {/* Table of Parsed Issues */}
              <div className="border border-border rounded-xl overflow-hidden shadow-xs">
                <div className="max-h-[380px] overflow-y-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/70 text-muted-foreground border-b border-border sticky top-0 z-10">
                      <tr>
                        <th className="p-3 w-10 text-center">
                          <input 
                            type="checkbox"
                            checked={selectedCount === parsedIssues.length && parsedIssues.length > 0}
                            onChange={toggleSelectAll}
                            className="rounded border-border"
                          />
                        </th>
                        <th className="p-3 font-semibold">Title</th>
                        <th className="p-3 font-semibold">Type</th>
                        <th className="p-3 font-semibold">Status</th>
                        <th className="p-3 font-semibold">Priority</th>
                        <th className="p-3 font-semibold">Assignee</th>
                        <th className="p-3 font-semibold text-right">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 bg-card">
                      {parsedIssues.map((issue) => {
                        const isSelected = selectedIndices.has(issue.originalIndex);
                        const assignedUser = issue.assigneeId ? users.find(u => u.uid === issue.assigneeId) : null;

                        return (
                          <tr 
                            key={issue.originalIndex}
                            onClick={() => toggleIssueSelection(issue.originalIndex)}
                            className={`cursor-pointer transition-colors ${
                              isSelected ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-muted/30 opacity-60'
                            }`}
                          >
                            <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                              <input 
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleIssueSelection(issue.originalIndex)}
                                className="rounded border-border"
                              />
                            </td>

                            <td className="p-3 font-medium text-foreground max-w-xs">
                              <div className="space-y-0.5">
                                <p className="line-clamp-1 font-semibold">{issue.title}</p>
                                <p className="text-[11px] text-muted-foreground line-clamp-1">
                                  {issue.description}
                                </p>
                              </div>
                            </td>

                            <td className="p-3">
                              <Badge variant="outline" className="text-[10px] font-mono uppercase border-border/80 text-muted-foreground">
                                {issue.type}
                              </Badge>
                            </td>

                            <td className="p-3">
                              <Badge variant="outline" className={`text-[10px] uppercase font-bold ${statusColors[issue.status]}`}>
                                {issue.status.replace('_', ' ')}
                              </Badge>
                            </td>

                            <td className="p-3">
                              <Badge variant="outline" className={`text-[10px] font-semibold ${priorityColors[issue.priority]}`}>
                                {issue.priority}
                              </Badge>
                            </td>

                            <td className="p-3 text-muted-foreground text-[11px]">
                              {globalAssigneeId !== 'preserve' ? (
                                globalAssigneeId === 'unassigned' ? (
                                  <span className="italic text-muted-foreground/60">Unassigned</span>
                                ) : (
                                  <span>{users.find(u => u.uid === globalAssigneeId)?.displayName || 'Assigned'}</span>
                                )
                              ) : assignedUser ? (
                                <span>{assignedUser.displayName || assignedUser.email}</span>
                              ) : issue.assigneeName ? (
                                <span title={issue.assigneeEmail || ''}>{issue.assigneeName}</span>
                              ) : (
                                <span className="italic text-muted-foreground/60">Unassigned</span>
                              )}
                            </td>

                            <td className="p-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {issue.labels.length > 0 && (
                                  <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                                    {issue.labels.length} tags
                                  </span>
                                )}
                                {issue.comments && issue.comments.length > 0 && (
                                  <span className="text-[10px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded">
                                    {issue.comments.length} comments
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Progress Bar (during import execution) */}
              {isImporting && importProgress && (
                <div className="space-y-2 p-4 bg-muted/40 rounded-xl border border-border">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-2 font-medium text-foreground">
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      Importing issues into database...
                    </span>
                    <span className="font-mono">
                      {importProgress.current} / {importProgress.total}
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-primary h-full transition-all duration-300"
                      style={{ width: `${Math.round((importProgress.current / Math.max(importProgress.total, 1)) * 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Phase 3: Completion Result Summary */}
          {importResult && (
            <div className="space-y-6 py-4">
              <div className="p-6 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-center space-y-3">
                <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-foreground">
                  Import Process Completed
                </h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Successfully imported <span className="font-bold text-emerald-400">{importResult.successCount}</span> issue(s) into your Cygnus workspace.
                </p>
              </div>

              {/* If any failures occurred */}
              {importResult.failedCount > 0 && (
                <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-destructive font-semibold text-xs">
                    <AlertTriangle className="w-4 h-4" />
                    {importResult.failedCount} issue(s) failed to save:
                  </div>
                  <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-5">
                    {importResult.errors.map(err => (
                      <li key={err.index}>
                        <span className="font-semibold text-foreground">#{err.index} "{err.title}":</span> {err.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <DialogFooter className="p-4 border-t border-border/50 bg-muted/20 flex flex-row items-center justify-between sm:justify-between gap-3">
          <Button 
            variant="ghost" 
            onClick={handleClose}
            disabled={isImporting}
            className="text-xs"
          >
            {importResult ? 'Close' : 'Cancel'}
          </Button>

          {parsedIssues.length > 0 && !importResult && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                <span className="font-bold text-foreground">{selectedCount}</span> of {parsedIssues.length} selected
              </span>

              <Button
                onClick={handleStartImport}
                disabled={isImporting || selectedCount === 0}
                className="gap-2 font-medium text-xs"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-3.5 h-3.5" />
                    Import {selectedCount} Issue{selectedCount === 1 ? '' : 's'}
                  </>
                )}
              </Button>
            </div>
          )}

          {importResult && (
            <Button onClick={handleClose} className="text-xs font-medium">
              View Issues in Workspace
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
