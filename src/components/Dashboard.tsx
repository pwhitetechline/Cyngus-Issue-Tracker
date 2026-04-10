import { useIssues } from '../hooks/useIssues';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { 
  Bug, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  TrendingUp, 
  Users,
  BarChart3
} from 'lucide-react';
import { IssueCard } from './IssueCard';
import { Issue } from '../types';
import { Skeleton } from './ui/skeleton';
import { cn } from '../lib/utils';

interface DashboardProps {
  onIssueClick: (issue: Issue) => void;
}

export function Dashboard({ onIssueClick }: DashboardProps) {
  const { issues, loading } = useIssues();

  const stats = {
    total: issues.length,
    open: issues.filter(i => i.status === 'OPEN').length,
    inProgress: issues.filter(i => i.status === 'IN_PROGRESS').length,
    resolved: issues.filter(i => i.status === 'RESOLVED').length,
    critical: issues.filter(i => i.priority === 'CRITICAL').length,
  };

  const recentIssues = issues.slice(0, 5);

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Skeleton className="h-96 lg:col-span-2 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Team Overview</h1>
        <p className="text-slate-500">Real-time metrics and workload distribution for Cygnus Software Solutions.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total Issues" 
          value={stats.total} 
          icon={<Bug className="w-5 h-5 text-blue-600" />} 
          color="bg-blue-50" 
          trend="+12% from last week"
        />
        <StatCard 
          title="In Progress" 
          value={stats.inProgress} 
          icon={<Clock className="w-5 h-5 text-amber-600" />} 
          color="bg-amber-50" 
          trend="5 assigned to you"
        />
        <StatCard 
          title="Resolved" 
          value={stats.resolved} 
          icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />} 
          color="bg-emerald-50" 
          trend="85% success rate"
        />
        <StatCard 
          title="Critical" 
          value={stats.critical} 
          icon={<AlertCircle className="w-5 h-5 text-red-600" />} 
          color="bg-red-50" 
          trend="Immediate action required"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Activity */}
        <Card className="lg:col-span-2 border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-4">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Recent Activity
            </CardTitle>
            <button className="text-sm text-primary font-medium hover:underline">View All</button>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {recentIssues.map(issue => (
                <IssueCard key={issue.id} issue={issue} onClick={onIssueClick} />
              ))}
              {recentIssues.length === 0 && (
                <div className="col-span-2 py-12 text-center text-slate-400">
                  <p>No recent activity found.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Team Workload */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100 pb-4">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Team Workload
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-6">
              <WorkloadItem name="Sarah Jenkins" count={12} total={20} color="bg-blue-500" />
              <WorkloadItem name="Michael Chen" count={8} total={20} color="bg-amber-500" />
              <WorkloadItem name="Alex Rivera" count={15} total={20} color="bg-red-500" />
              <WorkloadItem name="Emma Wilson" count={4} total={20} color="bg-emerald-500" />
            </div>
            
            <div className="mt-8 p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div className="flex items-center gap-3 mb-2">
                <BarChart3 className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-medium text-slate-700">System Health</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 w-[92%]" />
                </div>
                <span className="text-xs font-bold text-emerald-600">92%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color, trend }: { title: string; value: number; icon: React.ReactNode; color: string; trend: string }) {
  return (
    <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className={cn("p-2 rounded-lg", color)}>
            {icon}
          </div>
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">{title}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-3xl font-bold text-slate-900">{value}</span>
          <span className="text-xs text-slate-500 mt-1">{trend}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function WorkloadItem({ name, count, total, color }: { name: string; count: number; total: number; color: string }) {
  const percentage = (count / total) * 100;
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium text-slate-700">{name}</span>
        <span className="text-xs font-bold text-slate-500">{count} active</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={cn("h-full transition-all duration-500", color)} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}
