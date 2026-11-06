# Export Individual Issues to JSON

Enable users to export individual issues into a structured, human-readable `.json` file containing full issue details, resolved user information, comments, attachments, and audit history, while ensuring zero modification to the live database.

## User Review & Critical Decisions

> [!IMPORTANT]
> The site is live and actively used. The export functionality is strictly read-only: it fetches and aggregates data in memory on the client and triggers a browser file download without executing any database mutations, deletions, or schema changes. All current issues are 100% preserved.

- **Confirmed Decision 1 (Action Placement)**: Export action will be accessible in both locations:
  1. Inside the **Issue Detail** view (Quick Actions panel in sidebar and header dropdown).
  2. Directly on each **Issue Card** in the Issue Explorer grid and list views (via a dedicated download button that does not inadvertently trigger card navigation).
- **Confirmed Decision 2 (Data Scope)**: Comprehensive issue export including:
  - Core issue attributes: ID, title, description, type, status, priority, labels, attachments, due date.
  - Discussion thread: All comments with author details and timestamps.
  - Audit trail: Complete history log of status, priority, and field revisions.
- **Confirmed Decision 3 (Format & Identity)**: Enriched JSON structure:
  - All timestamps converted to standard ISO 8601 strings (`YYYY-MM-DDTHH:mm:ss.sssZ`).
  - Reporter, assignee, and comment authors resolved to clean user objects (`displayName`, `email`, `uid`).
  - Formatted JSON with 2-space indentation and clean metadata headers (`exportedAt`, `schemaVersion`, `system`).

---

## 1. Overview & Core Concept

- **What It Does**: Adds an intuitive "Export JSON" action across the issue tracking interface. Clicking the action compiles the issue's complete lifecycle into an indented, standardized `.json` file and triggers a browser download named `issue-[ID]-[slug].json`.
- **Target Audience**: Developers, QA engineers, project managers, and auditors who need to archive, migrate, analyze, or attach issue reports to external tickets or customer correspondence.
- **Key Value**: Instant offline backup and portability of individual issues with full contextual history (comments, attachments, and audit trails) with zero overhead and zero impact on live data.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Export from Issue Detail Page**:
   - The user opens an issue detail page.
   - In the sidebar's **Quick Actions** card, a new **"Export to JSON"** button appears with a `Download` icon.
   - Clicking triggers a brief loading state (`Loader2` spinner with "Exporting...").
   - The service fetches the issue's subcollection comments and audit history (if not already cached), aggregates them with resolved user profiles, and creates an in-memory `Blob`.
   - The file automatically downloads to the user's computer, accompanied by a toast notification: *"Issue #WDB-... exported to JSON"*.

2. **Quick Export from Issue Cards (Explorer)**:
   - On the Issue Explorer page (grid or list view), each card displays an unobtrusive download icon button in the header or footer.
   - Clicking the download button uses `e.stopPropagation()` so that the card does not open navigation unexpectedly.
   - The issue card shows a transient download feedback icon, fetches comments and audit logs for that specific issue, and initiates the file download seamlessly.

### Visual Identity & Styling

- **Consistent SaaS Aesthetics**: Matches the current dark/light slate palette, 1px border lines, and clean typographic hierarchy.
- **Quiet Micro-Interactions**: The download buttons use ghost/outline variants with smooth hover transitions, clear accessible tooltips (`title="Export to JSON"`), and active spin feedback during data aggregation.
- **Accessible & Non-Intrusive**: No modals or unnecessary confirmation steps are required for a safe read-only export operation.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Client-Side Blob Generation vs Server Endpoint**
  - *Chosen Approach*: Client-side compilation using standard browser `Blob` and `URL.createObjectURL`.
  - *Why*: The client already has an active authenticated Firestore session, permission rules, and real-time listeners. A client-side utility avoids server round-trips, incurs zero cloud server costs, requires no new server routes, and preserves maximum user privacy.
  - *Alternatives Considered*: Express backend proxy endpoint `/api/issues/:id/export`. Passed over because client-side direct fetch and export is faster, offline-capable, and avoids passing auth tokens through backend boilerplate.

- **Decision 2: Comprehensive On-Demand Data Assembly**
  - *Chosen Approach*: When exporting from the detail view, existing in-memory comments and audit logs are utilized immediately. When exporting directly from an issue card on the explorer, a lightweight on-demand query fetches that issue's comments and audit logs before triggering the download.
  - *Why*: Avoids eagerly loading comments and audit logs for every card on the explorer (which would multiply Firestore reads), while still providing the complete data package requested by the user.

- **Decision 3: Zero-Mutation Data Integrity**
  - *Chosen Approach*: The export module contains purely pure functions (`exportIssueToJson`) with zero Firestore write or delete commands.
  - *Why*: Fully satisfies the user's requirement that current live issues and database states must be preserved without any risk of corruption.

---

## 4. Technical Architecture & Data Strategy

### Architecture & Component Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                        User Interface                        │
│                                                              │
│  ┌─────────────────────────┐    ┌──────────────────────────┐ │
│  │   IssueCard (Explorer)  │    │  IssueDetail (Full View) │ │
│  │   [ ⤓ Export JSON Btn ] │    │   [ ⤓ Export to JSON ]   │ │
│  └───────────┬─────────────┘    └────────────┬─────────────┘ │
└──────────────┼───────────────────────────────┼───────────────┘
               │                               │
               ▼                               ▼
┌──────────────────────────────────────────────────────────────┐
│                    Issue Export Utility                      │
│                 (`src/lib/issueExport.ts`)                   │
│                                                              │
│  1. Resolve reporter & assignee from users list              │
│  2. Fetch subcollection comments (`issues/{id}/comments`)    │
│  3. Fetch issue audit trail (`auditLogs` where issueId == id) │
│  4. Normalize Firestore Timestamps to ISO strings            │
│  5. Formatted JSON serialization & Blob download trigger     │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                      Firestore Database                      │
│                    (STRICTLY READ-ONLY)                      │
│                                                              │
│  • `/issues/{issueId}`                                       │
│  • `/issues/{issueId}/comments/{commentId}`                  │
│  • `/auditLogs` (filtered by issueId)                        │
│  • `/users` (user directory cache)                           │
└──────────────────────────────────────────────────────────────┘
```

### JSON Data Schema Example

```json
{
  "$schema": "https://cygnus-software.internal/schemas/issue-export-v1.json",
  "exportMetadata": {
    "system": "Cygnus Software Issue Tracker",
    "exportedAt": "2026-11-06T22:50:00.000Z",
    "version": "1.0"
  },
  "issue": {
    "id": "abc123xyz",
    "ticketNumber": "WDB-ABC123XY",
    "title": "Fix responsive table overflow on mobile viewports",
    "description": "Full markdown description text...",
    "type": "BUG",
    "status": "IN_PROGRESS",
    "priority": "HIGH",
    "labels": ["ui", "mobile", "frontend"],
    "createdAt": "2026-11-01T10:15:30.000Z",
    "updatedAt": "2026-11-05T14:20:00.000Z",
    "dueDate": "2026-11-12T00:00:00.000Z",
    "reporter": {
      "uid": "user_111",
      "displayName": "Alex Morgan",
      "email": "alex@example.com"
    },
    "assignee": {
      "uid": "user_222",
      "displayName": "Sarah Chen",
      "email": "sarah@example.com"
    },
    "attachments": [
      {
        "name": "screenshot_error.png",
        "url": "https://storage.googleapis.com/..."
      }
    ]
  },
  "comments": [
    {
      "id": "comment_999",
      "content": "Root cause identified in CSS flex-basis.",
      "createdAt": "2026-11-02T08:30:00.000Z",
      "author": {
        "uid": "user_222",
        "displayName": "Sarah Chen",
        "email": "sarah@example.com"
      }
    }
  ],
  "auditHistory": [
    {
      "id": "log_001",
      "action": "UPDATE",
      "timestamp": "2026-11-05T14:20:00.000Z",
      "performer": {
        "uid": "user_222",
        "displayName": "Sarah Chen",
        "email": "sarah@example.com"
      },
      "changes": {
        "status": {
          "old": "OPEN",
          "new": "IN_PROGRESS"
        }
      }
    }
  ]
}
```

### Implementation Steps

1. **Create `src/lib/issueExport.ts`**:
   - Provide `buildIssueExportPayload(issue, users, comments?, auditLogs?)` to normalize timestamps (handling Firestore `Timestamp`, `Date`, string, or null) and attach user identity objects.
   - Provide `downloadIssueAsJson(issue, users, comments?, auditLogs?)` to handle the asynchronous on-demand query if comments/auditLogs are not supplied, trigger the formatted Blob download, and report status via `sonner` toast.
2. **Update `src/components/IssueDetail.tsx`**:
   - Import `downloadIssueAsJson`.
   - Add an **"Export to JSON"** button to the Quick Actions card and/or header action menu.
   - Wire the click handler with loading feedback.
3. **Update `src/components/IssueCard.tsx`**:
   - Import `downloadIssueAsJson`.
   - Add a compact, styled download action button (`Download` or `FileJson` icon) to the card header/footer with `onClick={(e) => { e.stopPropagation(); ... }}`.
4. **Verification**:
   - Run compilation and lint check.
   - Verify that all database records and Firestore security rules remain unchanged and safe.
