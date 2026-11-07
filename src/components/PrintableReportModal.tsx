import { useState } from 'react';
import { Issue, User } from '../types';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogTrigger 
} from './ui/dialog';
import { Button } from './ui/button';
import { Printer, Download, FileText, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { exportIssuesToCsv } from '../lib/reportExport';

interface PrintableReportModalProps {
  issues: Issue[];
  users: User[];
  trigger?: React.ReactElement;
}

export function PrintableReportModal({ issues, users, trigger }: PrintableReportModalProps) {
  const [open, setOpen] = useState(false);

  const stats = {
    total: issues.length,
    open: issues.filter(i => i.status === 'OPEN').length,
    inProgress: issues.filter(i => i.status === 'IN_PROGRESS').length,
    inReview: issues.filter(i => i.status === 'IN_REVIEW').length,
    resolved: issues.filter(i => i.status === 'RESOLVED').length,
    closed: issues.filter(i => i.status === 'CLOSED').length,
    critical: issues.filter(i => i.priority === 'CRITICAL').length,
  };

  const userMap = new Map<string, User>();
  users.forEach(u => userMap.set(u.uid, u));

  const handlePrint = () => {
    window.print();
  };

  const handleCsvExport = () => {
    exportIssuesToCsv(issues, users);
  };

  const formattedDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        trigger || (
          <Button variant="outline" size="sm" className="h-9 gap-1.5 border-border">
            <FileText className="w-4 h-4 text-primary" />
            Executive Report
          </Button>
        )
      } />
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto print:max-w-none print:max-h-none print:m-0 print:p-0 print:border-none print:shadow-none">
        <DialogHeader className="print:hidden border-b border-border pb-4">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Executive Issue Report
              </DialogTitle>
              <DialogDescription>
                Summary of {issues.length} active issues as of {formattedDate}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleCsvExport} className="gap-1.5">
                <Download className="w-4 h-4" />
                Export CSV
              </Button>
              <Button size="sm" onClick={handlePrint} className="gap-1.5">
                <Printer className="w-4 h-4" />
                Print / Save PDF
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Printable Document Body */}
        <div id="printable-report-area" className="p-4 sm:p-6 space-y-6 bg-card text-card-foreground print:bg-white print:text-black">
          {/* Print Header */}
          <div className="border-b border-border pb-6 flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground print:text-black">
                Web Direct Brands — Issue Pipeline Report
              </h1>
              <p className="text-sm text-muted-foreground print:text-neutral-600 mt-1">
                Generated on {formattedDate} · Comprehensive Status Summary
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs uppercase tracking-wider text-muted-foreground print:text-neutral-600 font-mono">
                Scope: All Current Issues
              </span>
              <div className="text-xl font-bold text-primary print:text-black mt-0.5">
                {stats.total} Total Tickets
              </div>
            </div>
          </div>

          {/* Metric KPI Summary */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            <div className="p-3 bg-muted/50 rounded-lg border border-border print:border-neutral-300 print:bg-neutral-50 text-center">
              <div className="text-xs text-muted-foreground print:text-neutral-600 font-medium">Open</div>
              <div className="text-xl font-bold text-blue-600 print:text-black mt-1">{stats.open}</div>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg border border-border print:border-neutral-300 print:bg-neutral-50 text-center">
              <div className="text-xs text-muted-foreground print:text-neutral-600 font-medium">In Progress</div>
              <div className="text-xl font-bold text-amber-600 print:text-black mt-1">{stats.inProgress}</div>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg border border-border print:border-neutral-300 print:bg-neutral-50 text-center">
              <div className="text-xs text-muted-foreground print:text-neutral-600 font-medium">In Review</div>
              <div className="text-xl font-bold text-purple-600 print:text-black mt-1">{stats.inReview}</div>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg border border-border print:border-neutral-300 print:bg-neutral-50 text-center">
              <div className="text-xs text-muted-foreground print:text-neutral-600 font-medium">Resolved</div>
              <div className="text-xl font-bold text-emerald-600 print:text-black mt-1">{stats.resolved}</div>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg border border-border print:border-neutral-300 print:bg-neutral-50 text-center">
              <div className="text-xs text-muted-foreground print:text-neutral-600 font-medium">Closed</div>
              <div className="text-xl font-bold text-slate-500 print:text-black mt-1">{stats.closed}</div>
            </div>
            <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/20 print:border-neutral-300 print:bg-neutral-50 text-center">
              <div className="text-xs text-red-600 print:text-black font-bold">Critical</div>
              <div className="text-xl font-bold text-red-600 print:text-black mt-1">{stats.critical}</div>
            </div>
          </div>

          {/* Issues Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-border print:border-black font-semibold text-muted-foreground print:text-black">
                  <th className="py-2.5 px-2">Ticket</th>
                  <th className="py-2.5 px-2">Title</th>
                  <th className="py-2.5 px-2">Type</th>
                  <th className="py-2.5 px-2">Status</th>
                  <th className="py-2.5 px-2">Priority</th>
                  <th className="py-2.5 px-2">Assignee</th>
                  <th className="py-2.5 px-2 text-right">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border print:divide-neutral-200">
                {issues.map((issue) => {
                  const assignee = issue.assigneeId ? userMap.get(issue.assigneeId) : null;
                  const ticketNum = issue.id ? `#WDB-${issue.id.slice(0, 8).toUpperCase()}` : '#WDB-NEW';
                  const updatedDate = issue.updatedAt?.toDate ? issue.updatedAt.toDate().toLocaleDateString() : 'Recent';

                  return (
                    <tr key={issue.id} className="hover:bg-muted/30">
                      <td className="py-2.5 px-2 font-mono font-bold text-foreground print:text-black">{ticketNum}</td>
                      <td className="py-2.5 px-2 font-medium max-w-xs truncate text-foreground print:text-black" title={issue.title}>
                        {issue.title}
                      </td>
                      <td className="py-2.5 px-2 font-medium">{issue.type}</td>
                      <td className="py-2.5 px-2">
                        <span className="font-semibold text-[11px] uppercase">{issue.status.replace('_', ' ')}</span>
                      </td>
                      <td className="py-2.5 px-2">
                        <span className={`font-semibold ${issue.priority === 'CRITICAL' ? 'text-red-600' : ''}`}>
                          {issue.priority}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-muted-foreground print:text-black">
                        {assignee ? assignee.displayName : 'Unassigned'}
                      </td>
                      <td className="py-2.5 px-2 text-right text-muted-foreground print:text-black font-mono">
                        {updatedDate}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Print Footer */}
          <div className="pt-6 border-t border-border print:border-black text-[11px] text-muted-foreground print:text-neutral-500 flex items-center justify-between">
            <span>Cygnus Software Issue Tracker · Confidential Internal Report</span>
            <span>Page 1 of 1</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
