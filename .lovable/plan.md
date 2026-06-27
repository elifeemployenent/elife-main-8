## Add "Super Admin / Business Partner" role

Introduce a new top-tier role above Team Leader with multi-panchayath allocation. When a Super Admin/Business Partner (SABP) is allocated to one or more panchayaths, they appear at the top of each of those panchayaths' hierarchy trees.

### 1. Database (migration)
- Extend the `pennyekart_agents.role` check / enum to allow `super_admin_partner`.
- Reuse the existing `responsible_panchayath_ids uuid[]` column for panchayath allocation (already used for Team Leaders) — no schema change needed beyond the role value.
- `panchayath_id` will store their primary/home panchayath; `responsible_panchayath_ids` stores all allocated panchayaths (must include the primary).

### 2. Types & constants (`src/hooks/usePennyekartAgents.ts`)
- Add `"super_admin_partner"` to `AgentRole` union.
- Update `ROLE_LABELS`: `super_admin_partner: "Super Admin / Business Partner"`.
- Update `ROLE_HIERARCHY` to `["super_admin_partner", "team_leader", "coordinator", "group_leader", "pro"]` so Team Leader's parent becomes SABP.
- `getParentRole("team_leader")` will now return `"super_admin_partner"` (Team Leaders can optionally be assigned a SABP parent, but it stays optional — existing TLs without parents continue to work).

### 3. Agent form (`src/components/pennyekart/AgentFormDialog.tsx`)
- Add the new role to the role selector (visible only to authorized admins).
- When role = `super_admin_partner`:
  - Hide "Parent agent" selector (top-level role).
  - Show a multi-select "Allocated Panchayaths" list (checkbox list of all panchayaths), backed by `responsible_panchayath_ids`.
  - Primary `panchayath_id` defaults to the first selected allocation.
  - Hide Ward field (not relevant at this level).

### 4. Hierarchy tree (`src/components/pennyekart/AgentHierarchyTree.tsx` + `PennyekartAgentHierarchy.tsx`)
- For each panchayath group in the tree view, prepend a "Super Admin / Business Partner" section listing every SABP whose `responsible_panchayath_ids` contains that panchayath's id (so the same person appears on each allocated panchayath).
- Give SABP nodes a distinct color/badge (e.g., deep purple) to stand out from Team Leaders.
- Team Leaders remain rendered as the next tier below; no forced parent reassignment.

### 5. Filters & lists
- Add `super_admin_partner` to role filter dropdowns and to `ROLE_LABELS`-driven UI (profile card, ranks, exports, complaints tab) so it renders cleanly everywhere.
- Update `exportAgents.ts` / `BulkAgentFormDialog.tsx` to recognize the new role.

### 6. Edge function (`supabase/functions/pennyekart-agents/index.ts`)
- Accept the new role value in create/update validation.
- For SABP, require `responsible_panchayath_ids` to be non-empty and ensure `panchayath_id` is included in that array.

### Open question
- Should existing Team Leaders be auto-linked as children of a SABP when that SABP is allocated to their panchayath, or stay independent (recommended: stay independent — SABP is shown as a peer/header on the panchayath, not a forced parent)? I'll go with **independent** unless you say otherwise.
