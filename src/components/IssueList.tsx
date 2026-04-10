import { useState } from 'react';
import { useIssues } from '../hooks/useIssues';
import { Issue, IssueStatus, IssuePriority, IssueType } from '../types';
import { IssueCard } from './IssueCard';
import { Input } from './ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from './ui/select';
import { Button } from './ui/button';
import { Search, Filter, SlidersHorizontal, LayoutGrid, List as ListIcon } from 'lucide-react';
import { Skeleton } from './ui/skeleton';
import { cn } from '../lib/utils';

interface IssueListProps {
  onIssueClick: (issue: Issue) => void;
}

export function IssueList({ onIssueClick }: IssueListProps) {
  const [filters, setFilters] = useState<{ status?: IssueStatus; priority?: IssuePriority; type?: IssueType }>({});
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const { issues, loading } = useIssues(filters);

  const filteredIssues = issues.filter(issue => 
    issue.title.toLowerCase().includes(search.toLowerCase()) ||
    issue.description.toLowerCase().includes(search.toLowerCase()) ||
    issue.labels.some(l => l.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Issue Explorer</h1>
          <p className="text-slate-500">Search, filter, and manage all reported issues across the organization.</p>
        </div>
        
        <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
          <Button 
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'} 
            size="sm" 
            onClick={() => setViewMode('grid')}
            className="h-8 w-8 p-0"
          >
            <LayoutGrid className="w-4 h-4" />
          </Button>
          <Button 
            variant={viewMode === 'list' ? 'secondary' : 'ghost'} 
            size="sm" 
            onClick={() => setViewMode('list')}
            className="h-8 w-8 p-0"
          >
            <ListIcon className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Search by title, description, or tags..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 h-11 border-slate-200 focus:ring-primary"
            />
          </div>
          
          <div className="flex gap-2">
            <Select value={filters.status || 'all'} onValueChange={v => setFilters({ ...filters, status: v === 'all' ? undefined : v as IssueStatus })}>
              <SelectTrigger className="w-[140px] h-11 border-slate-200">
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
              <SelectTrigger className="w-[140px] h-11 border-slate-200">
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

            <Button variant="outline" className="h-11 border-slate-200" onClick={() => setFilters({})}>
              <SlidersHorizontal className="w-4 h-4 mr-2" />
              Reset
            </Button>
          </div>
        </div>
      </div>

      {/* Issues Grid/List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-64 rounded-xl" />)}
        </div>
      ) : (
        <>
          {filteredIssues.length > 0 ? (
            <div className={cn(
              viewMode === 'grid' 
                ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" 
                : "flex flex-col gap-4"
            )}>
              {filteredIssues.map(issue => (
                <IssueCard key={issue.id} issue={issue} onClick={onIssueClick} />
              ))}
            </div>
          ) : (
            <div className="bg-white py-24 text-center rounded-xl border border-slate-200 border-dashed">
              <div className="flex flex-col items-center gap-4">
                <div className="p-4 bg-slate-50 rounded-full">
                  <Filter className="w-8 h-8 text-slate-300" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold text-slate-900">No issues found</h3>
                  <p className="text-slate-500">Try adjusting your search or filters to find what you're looking for.</p>
                </div>
                <Button variant="outline" onClick={() => { setSearch(''); setFilters({}); }}>
                  Clear all filters
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
