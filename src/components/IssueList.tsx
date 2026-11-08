import { useState } from 'react';
import { useIssues, useIssueActions } from '../hooks/useIssues';
import { useUsers } from '../hooks/useUsers';
import { Issue, IssueStatus, IssuePriority, IssueType } from '../types';
import { IssueCard } from './IssueCard';
import { KanbanBoard } from './KanbanBoard';
import { PrintableReportModal } from './PrintableReportModal';
import { exportIssuesToCsv } from '../lib/reportExport';
import { Input } from './ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from './ui/select';
import { Button } from './ui/button';
import { 
  Search, 
  Filter, 
  SlidersHorizontal, 
  LayoutGrid, 
  List as ListIcon, 
  Columns3, 
  Download,
  PlusCircle,
  RefreshCw,
  AlertTriangle,
  Sparkles
} from 'lucide-react';
import { Skeleton } from './ui/skeleton';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

interface IssueListProps {
  onIssueClick: (issue: Issue) => void;
  onNavigateToCreate?: () => void;
}

export function IssueList({ onIssueClick, onNavigateToCreate }: IssueListProps) {
  const [filters, setFilters] = useState<{ status?: IssueStatus; priority?: IssuePriority; type?: IssueType }>({});
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'kanban'>('grid');
  const [isSeeding, setIsSeeding] = useState(false);

  const { issues, loading: issuesLoading, error: issuesError } = useIssues(filters);
  const { users, loading: usersLoading } = useUsers();
  const { seedSampleIssues } = useIssueActions();

  const loading = issuesLoading || usersLoading;

  const handleSeed = async () => {
    setIsSeeding(true);
    try {
      await seedSampleIssues();
      toast.success('Restored 6 starter issues successfully!');
    } catch (err: any) {
      console.error('Seed error:', err);
      toast.error(`Failed to restore issues: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSeeding(false);
    }
  };

  const filteredIssues = issues.filter(issue => {
    const s = search.toLowerCase();
    const titleMatch = (issue.title || '').toLowerCase().includes(s);
    const descMatch = (issue.description || '').toLowerCase().includes(s);
    const labelMatch = Array.isArray(issue.labels) && issue.labels.some(l => (l || '').toLowerCase().includes(s));
    return titleMatch || descMatch || labelMatch;
  });

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Issue Explorer</h1>
          <p className="text-muted-foreground">Search, filter, track pipeline status, and generate organizational reports.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* New Issue Button */}
          {onNavigateToCreate && (
            <Button 
              onClick={onNavigateToCreate}
              size="sm"
              className="h-9 gap-1.5 font-medium"
            >
              <PlusCircle className="w-4 h-4" />
              New Issue
            </Button>
          )}

          {/* Executive & CSV Reports */}
          <PrintableReportModal issues={filteredIssues} users={users} />
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => exportIssuesToCsv(filteredIssues, users)}
            className="h-9 gap-1.5 border-border"
          >
            <Download className="w-4 h-4 text-primary" />
            Export CSV
          </Button>

          {/* View Mode Switcher */}
          <div className="flex items-center gap-1 bg-card p-1 rounded-lg border border-border shadow-xs">
            <Button 
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'} 
              size="sm" 
              onClick={() => setViewMode('grid')}
              title="Grid View"
              className="h-8 w-8 p-0"
            >
              <LayoutGrid className="w-4 h-4" />
            </Button>
            <Button 
              variant={viewMode === 'list' ? 'secondary' : 'ghost'} 
              size="sm" 
              onClick={() => setViewMode('list')}
              title="List View"
              className="h-8 w-8 p-0"
            >
              <ListIcon className="w-4 h-4" />
            </Button>
            <Button 
              variant={viewMode === 'kanban' ? 'secondary' : 'ghost'} 
              size="sm" 
              onClick={() => setViewMode('kanban')}
              title="Kanban Board View"
              className="h-8 w-8 p-0"
            >
              <Columns3 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Firestore Connection Error Alert */}
      {issuesError && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-sm text-red-900 dark:text-red-200">Database Connection Issue</h4>
              <p className="text-xs text-red-800 dark:text-red-300 mt-1">{issuesError}</p>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => window.location.reload()}
            className="text-xs shrink-0 border-red-300 dark:border-red-800"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Retry
          </Button>
        </div>
      )}

      {/* Filters Bar */}
      <div className="bg-card p-6 rounded-xl border border-border shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search by title, description, or tags..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 h-11 border-border focus:ring-primary"
            />
          </div>
          
          <div className="flex gap-2">
            <Select value={filters.status || 'all'} onValueChange={v => setFilters({ ...filters, status: v === 'all' ? undefined : v as IssueStatus })}>
              <SelectTrigger className="w-[140px] h-11 border-border">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="OPEN">Open</SelectItem>
                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                <SelectItem value="IN_REVIEW">In Review</SelectItem>
                <SelectItem value="RESOLVED">Resolved</SelectItem>
                <SelectItem value="CLOSED">Closed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.priority || 'all'} onValueChange={v => setFilters({ ...filters, priority: v === 'all' ? undefined : v as IssuePriority })}>
              <SelectTrigger className="w-[140px] h-11 border-border">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="LOW">Low</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="CRITICAL">Critical</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" className="h-11 border-border" onClick={() => setFilters({})}>
              <SlidersHorizontal className="w-4 h-4 mr-2" />
              Reset
            </Button>
          </div>
        </div>
      </div>

      {/* Issues Content (Grid / List / Kanban) */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-64 rounded-xl" />)}
        </div>
      ) : (
        <>
          {viewMode === 'kanban' ? (
            <KanbanBoard issues={filteredIssues} users={users} onIssueClick={onIssueClick} />
          ) : filteredIssues.length > 0 ? (
            <div className={cn(
              viewMode === 'grid' 
                ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" 
                : "flex flex-col gap-4"
            )}>
              {filteredIssues.map(issue => (
                <IssueCard key={issue.id} issue={issue} users={users} onClick={onIssueClick} />
              ))}
            </div>
          ) : (
            <div className="bg-card py-20 text-center rounded-xl border border-border border-dashed">
              <div className="flex flex-col items-center gap-4 max-w-md mx-auto px-4">
                <div className="p-4 bg-muted/50 rounded-full">
                  <Filter className="w-8 h-8 text-muted-foreground/50" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold text-foreground">
                    {issues.length === 0 ? "No issues in this database yet" : "No matching issues found"}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {issues.length === 0 
                      ? "Your database is active and connected. You can create a new issue or restore the starter issues with one click."
                      : "Try adjusting your search criteria or resetting the status/priority filters."
                    }
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  {issues.length === 0 ? (
                    <>
                      <Button 
                        onClick={handleSeed} 
                        disabled={isSeeding}
                        className="gap-2 font-medium"
                      >
                        <Sparkles className="w-4 h-4 text-amber-300" />
                        {isSeeding ? "Restoring Issues..." : "Restore Starter Issues"}
                      </Button>
                      
                      {onNavigateToCreate && (
                        <Button 
                          variant="outline"
                          onClick={onNavigateToCreate}
                          className="gap-1.5"
                        >
                          <PlusCircle className="w-4 h-4" />
                          Create Custom Issue
                        </Button>
                      )}
                    </>
                  ) : (
                    <Button variant="outline" onClick={() => { setSearch(''); setFilters({}); }}>
                      Clear all filters
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
