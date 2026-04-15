

## Add Work Log Report with Absence Analytics to Pennyekart Agents Page

**What**: A new "Work Logs" tab on `/admin/pennyekart-agents` that shows today's work log submissions, highlights agents who haven't submitted, and provides absence analytics -- all filterable by panchayath and role.

### 1. New Component: `AgentWorkLogReport.tsx`

Create `src/components/pennyekart/AgentWorkLogReport.tsx` with:

- **Date picker** defaulting to today, allowing admins to check any date
- **Panchayath filter** and **Role filter** (reusing existing panchayath list and ROLE_HIERARCHY)
- **Summary cards**: Total agents, Submitted count, Absent count, Submission rate %
- **Two sections**:
  - **Submitted**: Table of agents who logged work for the selected date, showing agent name, role, panchayath, ward, and work details
  - **Absent / Not Submitted**: Table of agents who have NO entry in `agent_work_logs` for the selected date, showing name, role, panchayath, ward, and last submission date
- Data fetched by querying `pennyekart_agents` (all active agents) and `agent_work_logs` (filtered by selected date), then computing the diff client-side
- Both tables are public SELECT, so no RLS issues

### 2. Update `PennyekartAgentHierarchy.tsx`

- Add a third tab "Work Logs" with a `FileText` icon alongside existing "Hierarchy" and "Agent Ranks" tabs
- Render the new `AgentWorkLogReport` component in this tab, passing `panchayaths` data

### No database or migration changes needed
- `agent_work_logs` table already exists with `agent_id`, `work_date`, `work_details` columns
- `pennyekart_agents` table already has role, panchayath_id, etc.
- Both have public SELECT RLS policies

### File Changes
1. **Create** `src/components/pennyekart/AgentWorkLogReport.tsx` -- new report component
2. **Edit** `src/pages/admin/PennyekartAgentHierarchy.tsx` -- add "Work Logs" tab

