## Goal
On `/panchayaths`, make each panchayath card clickable to open a detail dialog showing all agents of that panchayath (fetched from `pennyekart_agents`). Allow adding/editing agents — restricted to Team Leaders and Super Admin / Business Partners of that panchayath.

## Identity
Use the existing MobileGate session (`elife_gate_status` / saved mobile in localStorage). On open, look up `pennyekart_agents` by that mobile:
- If role is `super_admin_partner` OR `team_leader` AND the agent's `panchayath_id` matches (or the panchayath id is in `responsible_panchayath_ids`) → show Add / Edit buttons.
- Otherwise → details are read-only.
- If no mobile is saved → trigger the existing mobile gate prompt before opening edit actions.

## UI changes — `src/pages/Panchayaths.tsx`
- Wrap each panchayath card with an `onClick` that opens a new `PanchayathAgentsDialog`.
- Keep existing leader / partner badges visible on the card.

## New component — `src/components/panchayath/PanchayathAgentsDialog.tsx`
- Props: `panchayath` (id + name).
- Fetches all agents for the panchayath via direct Supabase select (RLS allows authenticated read; for public visitors, use the existing public read pattern already used by the page).
- Lists agents grouped by role (Super Admin/Partner → Team Leader → Coordinator → Group Leader → PRO) with name, mobile (click-to-call), ward, parent.
- Header shows access state:
  - "View only" badge for non-privileged viewers.
  - "Add Agent" + per-row "Edit" buttons for privileged viewers (TL / Super Admin of that panchayath).
- Reuses existing `AgentFormDialog` from `src/components/pennyekart/` for add/edit; pre-fills `panchayath_id` and locks it.

## Permission logic — new helper `src/lib/panchayathAccess.ts`
```
canManagePanchayath(mobile, panchayathId) → Promise<boolean>
```
Queries `pennyekart_agents` where `mobile = ?` AND `role IN ('super_admin_partner','team_leader')` AND (`panchayath_id = ?` OR `panchayathId = ANY(responsible_panchayath_ids)`).

## Mutations
Reuse `useAgentMutations` (`pennyekart-agents` edge function). Authentication:
- Privileged public users don't have an admin token. Update `supabase/functions/pennyekart-agents/index.ts` to accept a `caller_mobile` field on create/update and verify server-side that the caller is a Team Leader or Super Admin/Business Partner with scope over the target panchayath. Reject otherwise.
- No DB schema changes required.

## Technical notes
- Reuse `SearchableSelect`, `Dialog`, `Card`, `Badge` primitives.
- Filter the agents query by `panchayath_id` directly (no need to fetch all).
- Show parent agent's name by joining `parent_agent:pennyekart_agents!parent_agent_id(name,role)`.
- Click-to-call: `tel:` links on mobile numbers.
- Keep existing public read access on `pennyekart_agents` (already in place since `/panchayaths` page already shows leaders/partners).

## Files touched
- `src/pages/Panchayaths.tsx` (make cards clickable, mount dialog)
- `src/components/panchayath/PanchayathAgentsDialog.tsx` (new)
- `src/lib/panchayathAccess.ts` (new)
- `supabase/functions/pennyekart-agents/index.ts` (accept + verify `caller_mobile` for add/edit when no admin token)
