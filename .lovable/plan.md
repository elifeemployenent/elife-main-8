

## Configurable WhatsApp Bot Commands from Admin Panel

**What**: Allow Super Admin to manage WhatsApp bot commands (add, edit, remove) from the admin panel. Commands like "5 for offers", "6 for new programs" can be configured dynamically without code changes.

**How it works**:
- Commands are stored in a new `whatsapp_bot_commands` database table
- The edge function reads both hardcoded core commands (1-4) AND dynamic commands from the database
- Super Admin gets a new management page to add/edit/remove custom commands
- Each command has a keyword, label, response type (static text, query-based), and response content

---

### 1. New Database Table: `whatsapp_bot_commands`

```sql
CREATE TABLE public.whatsapp_bot_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword text NOT NULL UNIQUE,        -- e.g. "5", "offers"
  alt_keyword text,                     -- alternative keyword e.g. "offer"
  label text NOT NULL,                  -- e.g. "View Current Offers"
  response_text text NOT NULL,          -- the message to reply with
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_bot_commands ENABLE ROW LEVEL SECURITY;

-- Public read (edge function uses service role, but just in case)
CREATE POLICY "Anyone can view active commands" ON public.whatsapp_bot_commands
  FOR SELECT TO public USING (true);

CREATE POLICY "Super admin can manage commands" ON public.whatsapp_bot_commands
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'super_admin'));
```

### 2. Update Edge Function: `whatsapp-worklog/index.ts`

- After handling core commands (1-4, help, status, balance), query `whatsapp_bot_commands` for active commands
- Match the incoming message against `keyword` or `alt_keyword`
- If matched, reply with the stored `response_text`
- Dynamically build the help text by appending custom commands to the hardcoded help
- Update the unrecognized command fallback to list all active commands

### 3. New Admin Page: `WhatsAppCommands` management

- New page at `/admin/whatsapp-commands` accessible to Super Admin
- Table listing all commands with columns: Keyword, Alt Keyword, Label, Response Text, Active, Actions
- Add/Edit dialog with fields: keyword, alt_keyword, label, response_text, sort_order, is_active
- Delete button with confirmation
- Preview of how the help menu will look with current commands
- Core commands (1-4) shown as read-only/informational rows

### 4. Add Route and Navigation

- Add route in `App.tsx` for the new page
- Add navigation link in `SuperAdminDashboard.tsx` (e.g. "WhatsApp Bot Commands" card with a MessageSquare icon)

---

### Technical Details

- The edge function will fetch commands on every request (small table, fast query via service role)
- Help text is generated dynamically: core commands (1-4) + active custom commands sorted by `sort_order`
- Response text supports WhatsApp markdown (*bold*, _italic_)
- Core commands (1=work log, 2=status, 3=help, 4=balance) remain hardcoded for reliability
- Custom commands are keyword-matched after core commands, so they can't override core functionality

### File Changes Summary
1. **Migration**: Create `whatsapp_bot_commands` table with RLS
2. **`supabase/functions/whatsapp-worklog/index.ts`**: Add dynamic command lookup and dynamic help text
3. **`src/pages/admin/WhatsAppCommands.tsx`**: New admin management page
4. **`src/App.tsx`**: Add route
5. **`src/pages/admin/SuperAdminDashboard.tsx`**: Add navigation card

