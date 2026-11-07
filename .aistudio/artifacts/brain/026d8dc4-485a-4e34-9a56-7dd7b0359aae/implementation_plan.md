# Next-Level Upgrade: Interactive Kanban Board, Multi-Format Reporting & Workflow Automation

Transform the Cygnus Software Issue Tracker into an enterprise-grade engineering workspace by introducing an interactive Kanban board, CSV spreadsheet & printable executive report exports, and automated assignment routing.

## User Review & Critical Decisions

> [!IMPORTANT]
> All current database issues, audit logs, comments, and attachments remain 100% preserved. The Kanban board and multi-format reports operate directly on existing live Firestore collections without modifying database schemas.

- **Confirmed Decision 1 (Visual Workflow)**: An **Interactive Kanban Board** is added as a primary view mode in the Issue Explorer alongside the existing Grid and List views. Columns map directly to standard statuses (`OPEN`, `IN_PROGRESS`, `IN_REVIEW`, `RESOLVED`, `CLOSED`), supporting intuitive quick status transitions with instant Firestore sync.
- **Confirmed Decision 2 (Reporting & Exports)**: Added **CSV Spreadsheet Export** (RFC-4180 compliant with full issue metadata) and **Printable Executive Summary Reports** (print-optimized layout with KPI metrics and clean tabular breakdown for stakeholders).
- **Confirmed Decision 3 (Workflow Automation)**: Introduced **Automated Assignment Routing** (auto-assigning incoming unassigned issues to available assignees with critical-bug escalation to admins) and **Status Transition Rules** (auto-moving an issue to `IN_PROGRESS` when an assignee accepts or is assigned).

---

## 1. Overview & Core Concept

- **What It Delivers**: 
  1. A high-density visual board view where engineering teams can visualize their work pipeline, spot bottlenecks, and progress issues across status stages with one click or drag-and-drop.
  2. One-click CSV and printable executive reports for executive reporting, audits, sprint reviews, and offline spreadsheet analysis.
  3. Lightweight, server-safe workflow automation rules that eliminate manual triage overhead.
- **Target Audience**: Product managers, QA leads, engineering teams, and executives managing workload distribution.
- **Key Value**: Drastically accelerates triage speed, eliminates manual status updating friction, and gives management instant exportable reports.

---

## 2. Implementation Summary

### A. Interactive Kanban Board (`src/components/KanbanBoard.tsx`)
- **5 Columns**: `OPEN` (Blue), `IN_PROGRESS` (Amber), `IN_REVIEW` (Purple), `RESOLVED` (Emerald), and `CLOSED` (Slate).
- **Interactions**:
  - Drag-and-drop cards between columns with visual drop target styling.
  - Quick action buttons on each card (`<` and `>` arrows) plus a "Move to status" dropdown menu.
  - Clicking a card opens full issue details.
  - Real-time updates automatically push to Firestore with audit logging.

### B. Multi-Format Reporting
- **RFC-4180 CSV Export (`src/lib/reportExport.ts`)**:
  - Exports filtered issues with ticket number, title, type, status, priority, reporter/assignee details, labels, and timestamps.
  - Prepends UTF-8 Byte Order Mark (`\uFEFF`) for clean display in Microsoft Excel.
- **Printable Executive Report (`src/components/PrintableReportModal.tsx`)**:
  - Modal with real-time KPI metric cards (Open, In Progress, In Review, Resolved, Closed, Critical).
  - Print-optimized CSS (`@media print`) and direct "Print / Save PDF" browser trigger.

### C. Workflow Automation Engine (`src/lib/automation.ts`)
- **Workload-Aware Auto-Assignment**:
  - Automatically evaluates active workload (open issues) across eligible team members and assigns incoming unassigned tickets to the member with the lowest queue.
- **Critical Severity Escalation**:
  - Automatically routes issues marked `CRITICAL` directly to administrators (`PWhite.XM@gmail.com`).
- **Auto-Advance Status**:
  - Automatically advances an issue from `OPEN` to `IN_PROGRESS` upon member assignment.
- **Settings Card (`src/components/Settings.tsx`)**:
  - Toggles in **Settings > Preferences** for customizing automation rules on demand.
