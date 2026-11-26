import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  canPublishVirtualOfficeAnnouncement,
  validateVirtualOfficeAnnouncementInput,
} from "./virtualOfficeAuthorization.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-samrabhaka-token, x-admin-token",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function normalizeMobile(m: string): string {
  return (m || "").replace(/\D+/g, "");
}

async function signToken(payload: Record<string, unknown>, secret: string): Promise<string> {
  const data = JSON.stringify(payload);
  const sig = await sha256Hex(data + secret);
  return btoa(data) + "." + sig;
}

async function verifyToken(token: string, secret: string): Promise<Record<string, any> | null> {
  try {
    const [b64, sig] = token.split(".");
    if (!b64 || !sig) return null;
    const data = atob(b64);
    // accept current secret, and legacy tokens signed with the service role key
    const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const candidates = [secret, legacy].filter(Boolean);
    let ok = false;
    for (const c of candidates) {
      if ((await sha256Hex(data + c)) === sig) { ok = true; break; }
    }
    if (!ok) return null;
    const payload = JSON.parse(data);
    if (payload.exp && payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function getIndiaClock(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value || "00";
  const hour = Number(value("hour"));
  const minute = Number(value("minute"));
  const second = Number(value("second"));
  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    minuteOfDay: hour * 60 + minute,
    second,
  };
}

function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isValidDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const secret = Deno.env.get("SAMRABHAKA_TOKEN_SECRET") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const body = await req.json().catch(() => ({}));
    const action: string = body.action;

    // ---- public_projects (no auth) ----
    if (action === "public_projects") {
      const { data: projects, error } = await supabase
        .from("agent_projects")
        .select("id, project_name, plan_description, logo_url, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) return json({ error: error.message }, 500);
      const ids = (projects || []).map((p: any) => p.id);
      let notesByProject: Record<string, any[]> = {};
      if (ids.length) {
        const { data: notes } = await supabase
          .from("agent_project_notes")
          .select("id, project_id, title, body, created_at")
          .in("project_id", ids)
          .order("created_at", { ascending: false });
        for (const n of notes || []) {
          (notesByProject[n.project_id] ||= []).push(n);
        }
      }
      return json({
        success: true,
        projects: (projects || []).map((p: any) => ({
          ...p,
          updates: (notesByProject[p.id] || []).slice(0, 5),
        })),
      });
    }

    // ---- check_mobile ----
    if (action === "check_mobile") {
      const mobile = normalizeMobile(body.mobile || "");
      if (mobile.length < 8) return json({ error: "Invalid mobile number" }, 400);

      const { data: agent } = await supabase
        .from("pennyekart_agents")
        .select("id, name, role, is_active")
        .eq("mobile", mobile)
        .maybeSingle();

      if (!agent) return json({ exists: false });
      if (!agent.is_active) return json({ error: "Your agent account is inactive. Contact admin." }, 403);

      const { data: auth } = await supabase
        .from("agent_auth")
        .select("id")
        .eq("agent_id", agent.id)
        .maybeSingle();

      return json({
        exists: true,
        has_password: !!auth,
        name: agent.name,
        role: agent.role,
      });
    }

    // ---- register ----
    if (action === "register") {
      const mobile = normalizeMobile(body.mobile || "");
      const password: string = body.password || "";
      if (mobile.length < 8) return json({ error: "Invalid mobile number" }, 400);
      if (password.length < 6) return json({ error: "Password must be at least 6 characters" }, 400);

      const { data: agent } = await supabase
        .from("pennyekart_agents")
        .select("id, name, role, is_active")
        .eq("mobile", mobile)
        .maybeSingle();

      if (!agent) return json({ error: "Mobile number not found in agent hierarchy" }, 404);
      if (!agent.is_active) return json({ error: "Your agent account is inactive" }, 403);

      const { data: existing } = await supabase
        .from("agent_auth")
        .select("id")
        .eq("agent_id", agent.id)
        .maybeSingle();

      if (existing) return json({ error: "Account already exists. Please login." }, 409);

      const password_hash = await sha256Hex(password + ":" + secret.slice(0, 16));

      const { error: insErr } = await supabase.from("agent_auth").insert({
        agent_id: agent.id,
        mobile,
        password_hash,
        last_login_at: new Date().toISOString(),
      });
      if (insErr) return json({ error: insErr.message }, 500);

      const token = await signToken(
        { agent_id: agent.id, mobile, exp: Date.now() + 30 * 24 * 60 * 60 * 1000 },
        secret,
      );
      return json({ success: true, token, agent: { id: agent.id, name: agent.name, role: agent.role, mobile } });
    }

    // ---- login ----
    if (action === "login") {
      const mobile = normalizeMobile(body.mobile || "");
      const password: string = body.password || "";
      if (!mobile || !password) return json({ error: "Mobile and password are required" }, 400);

      const { data: auth } = await supabase
        .from("agent_auth")
        .select("id, agent_id, password_hash")
        .eq("mobile", mobile)
        .maybeSingle();

      if (!auth) return json({ error: "Invalid mobile or password" }, 401);

      const legacySecret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
      const password_hash = await sha256Hex(password + ":" + secret.slice(0, 16));
      let ok = password_hash === auth.password_hash;
      if (!ok && legacySecret && legacySecret !== secret) {
        const legacyHash = await sha256Hex(password + ":" + legacySecret.slice(0, 16));
        if (legacyHash === auth.password_hash) {
          ok = true;
          // migrate to the stable secret
          await supabase.from("agent_auth").update({ password_hash }).eq("id", auth.id);
        }
      }
      if (!ok) {
        return json({ error: "Invalid mobile or password" }, 401);
      }


      const { data: agent } = await supabase
        .from("pennyekart_agents")
        .select("id, name, role, is_active, mobile")
        .eq("id", auth.agent_id)
        .maybeSingle();

      if (!agent || !agent.is_active) return json({ error: "Your account is inactive" }, 403);

      await supabase.from("agent_auth").update({ last_login_at: new Date().toISOString() }).eq("id", auth.id);

      const token = await signToken(
        { agent_id: agent.id, mobile: agent.mobile, exp: Date.now() + 30 * 24 * 60 * 60 * 1000 },
        secret,
      );
      return json({ success: true, token, agent: { id: agent.id, name: agent.name, role: agent.role, mobile: agent.mobile } });
    }

    // ---- me ----
    if (action === "me") {
      const token = req.headers.get("x-samrabhaka-token") || body.token;
      if (!token) return json({ error: "Unauthorized" }, 401);
      const payload = await verifyToken(token, secret);
      if (!payload) return json({ error: "Invalid or expired token" }, 401);

      const { data: agent } = await supabase
        .from("pennyekart_agents")
        .select("id, name, mobile, role, ward, is_active, panchayath_id, panchayaths(name, district)")
        .eq("id", payload.agent_id)
        .maybeSingle();

      if (!agent || !agent.is_active) return json({ error: "Account inactive" }, 403);
      return json({ success: true, agent });
    }

    // ---- change_password ----
    if (action === "change_password") {
      const token = req.headers.get("x-samrabhaka-token") || body.token;
      if (!token) return json({ error: "Unauthorized" }, 401);
      const payload = await verifyToken(token, secret);
      if (!payload) return json({ error: "Invalid or expired token" }, 401);

      const oldPw: string = body.old_password || "";
      const newPw: string = body.new_password || "";
      if (newPw.length < 6) return json({ error: "New password must be at least 6 characters" }, 400);

      const { data: auth } = await supabase
        .from("agent_auth")
        .select("id, password_hash")
        .eq("agent_id", payload.agent_id)
        .maybeSingle();
      if (!auth) return json({ error: "Not found" }, 404);

      const oldHash = await sha256Hex(oldPw + ":" + secret.slice(0, 16));
      const legacySecret2 = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
      const oldLegacyHash = legacySecret2
        ? await sha256Hex(oldPw + ":" + legacySecret2.slice(0, 16))
        : "";
      if (oldHash !== auth.password_hash && oldLegacyHash !== auth.password_hash) {
        return json({ error: "Current password is incorrect" }, 401);
      }


      const newHash = await sha256Hex(newPw + ":" + secret.slice(0, 16));
      await supabase.from("agent_auth").update({ password_hash: newHash }).eq("id", auth.id);
      return json({ success: true });
    }

    // ---- auth helper for project actions ----
    const requireAuth = async () => {
      const token = req.headers.get("x-samrabhaka-token") || body.token;
      if (!token) return { error: json({ error: "Unauthorized" }, 401) };
      const payload = await verifyToken(token, secret);
      if (!payload) return { error: json({ error: "Invalid or expired token" }, 401) };
      return { agent_id: payload.agent_id as string };
    };

    const requireAdmin = async () => {
      const adminToken = req.headers.get("x-admin-token");
      if (adminToken) {
        const payload = await verifyToken(adminToken, secret);
        if (typeof payload?.admin_id === "string") {
          const { data: admin, error } = await supabase
            .from("admins")
            .select("id, user_id, is_active, is_read_only")
            .eq("id", payload.admin_id)
            .maybeSingle();
          if (error) return { error: json({ error: "Unable to verify administrator access." }, 500) };
          if (admin?.is_active && !admin.is_read_only) {
            return { admin_id: admin.id as string, user_id: admin.user_id as string | null };
          }
          return { error: json({ error: "An active administrator account is required." }, 403) };
        }
      }

      const bearer = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      if (bearer && anonKey && supabaseUrl) {
        const authClient = createClient(supabaseUrl, anonKey, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { headers: { Authorization: `Bearer ${bearer}` } },
        });
        const { data: authData } = await authClient.auth.getUser(bearer);
        if (authData.user) {
          const { data: roles, error } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", authData.user.id);
          if (error) return { error: json({ error: "Unable to verify administrator access." }, 500) };
          if (roles?.some((item) => item.role === "admin" || item.role === "super_admin")) {
            return { admin_id: null, user_id: authData.user.id as string | null };
          }
          return { error: json({ error: "Administrator access is required." }, 403) };
        }
      }
      return { error: json({ error: "Administrator access is required." }, 403) };
    };

    if (action === "virtual_office_dashboard") {
      const auth = await requireAuth();
      if ("error" in auth) return auth.error;
      const { data: agent, error: agentError } = await supabase
        .from("pennyekart_agents")
        .select("id, name, mobile, role, ward, panchayath_id, responsible_panchayath_ids, is_active")
        .eq("id", auth.agent_id)
        .maybeSingle();
      if (agentError) return json({ error: "Unable to load your profile." }, 500);
      if (!agent || agent.is_active !== true) return json({ error: "Your agent account is inactive." }, 403);

      const panchayathIds = [...new Set([
        agent.panchayath_id,
        ...(Array.isArray(agent.responsible_panchayath_ids) ? agent.responsible_panchayath_ids : []),
      ].filter((id): id is string => typeof id === "string" && isValidUuid(id)))];

      const [panchayathResult, reportResult] = await Promise.all([
        panchayathIds.length
          ? supabase.from("panchayaths").select("id, name, district, code, is_active").in("id", panchayathIds)
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from("pennyekart_agents")
          .select("id, name, role, ward, panchayath_id, panchayaths(name, district)")
          .eq("parent_agent_id", auth.agent_id)
          .or("is_active.eq.true,is_active.is.null")
          .order("name")
          .limit(500),
      ]);
      if (panchayathResult.error || reportResult.error) return json({ error: "Unable to load your Panchayath team." }, 500);

      const allocatedPanchayaths = (panchayathResult.data || [])
        .filter((item) => item.is_active !== false)
        .map(({ id, name, district, code }) => ({ id, name, district, code }));
      const directReports = (reportResult.data || []).map((item) => {
        const location = Array.isArray(item.panchayaths) ? item.panchayaths[0] : item.panchayaths;
        return {
          id: item.id,
          name: item.name,
          role: item.role,
          ward: item.ward,
          panchayath_id: item.panchayath_id,
          panchayath_name: location?.name ?? null,
          district: location?.district ?? null,
        };
      });
      return json({
        success: true,
        agent: {
          id: agent.id,
          name: agent.name,
          mobile: agent.mobile,
          role: agent.role,
          ward: agent.ward,
          panchayath_id: agent.panchayath_id,
        },
        allocatedPanchayaths,
        directReports,
      });
    }

    if (action === "virtual_office_attendance_status" || action === "virtual_office_mark_attendance") {
      const auth = await requireAuth();
      if ("error" in auth) return auth.error;
      const { data: agent, error: agentError } = await supabase
        .from("pennyekart_agents")
        .select("id, is_active")
        .eq("id", auth.agent_id)
        .maybeSingle();
      if (agentError) return json({ error: "Unable to verify your agent account." }, 500);
      if (!agent || agent.is_active !== true) return json({ error: "Your agent account is inactive." }, 403);

      const clock = getIndiaClock();
      const canMark = clock.minuteOfDay >= 600 && clock.minuteOfDay < 720;
      if (action === "virtual_office_attendance_status") {
        const { data: attendance, error } = await supabase
          .from("panchayath_virtual_office_attendance")
          .select("id, work_date, check_in_at")
          .eq("agent_id", auth.agent_id)
          .eq("work_date", clock.date)
          .maybeSingle();
        if (error) return json({ error: "Unable to load today's attendance." }, 500);
        return json({ success: true, attendance, workDate: clock.date, canMark });
      }

      if (!canMark) return json({ error: "Attendance is available daily from 10:00 AM to 12:00 PM IST." }, 403);
      const { data: attendance, error } = await supabase
        .from("panchayath_virtual_office_attendance")
        .insert({ agent_id: auth.agent_id, work_date: clock.date, check_in_at: new Date().toISOString() })
        .select("id, work_date, check_in_at")
        .single();
      if (error?.code === "23505") {
        const { data: existing } = await supabase
          .from("panchayath_virtual_office_attendance")
          .select("id, work_date, check_in_at")
          .eq("agent_id", auth.agent_id)
          .eq("work_date", clock.date)
          .maybeSingle();
        return json({ success: true, alreadyMarked: true, attendance: existing });
      }
      if (error) return json({ error: "Attendance could not be saved." }, 500);
      return json({ success: true, alreadyMarked: false, attendance });
    }

    if (action === "virtual_office_magic_word_today") {
      const panchayathId = typeof body.panchayath_id === "string" ? body.panchayath_id.trim() : "";
      if (!isValidUuid(panchayathId)) return json({ error: "Choose a valid Panchayath." }, 400);

      let agentId: string | null = null;
      const agentToken = req.headers.get("x-samrabhaka-token") || body.token;
      if (agentToken) {
        const auth = await requireAuth();
        if ("error" in auth) return auth.error;
        agentId = auth.agent_id;
      }
      const admin = await requireAdmin();
      const isAdmin = !("error" in admin);
      if (!agentId && !isAdmin) return admin.error;

      if (agentId && !isAdmin) {
        const { data: agent, error } = await supabase
          .from("pennyekart_agents")
          .select("id, is_active, panchayath_id, responsible_panchayath_ids")
          .eq("id", agentId)
          .maybeSingle();
        if (error) return json({ error: "Unable to verify your Panchayath access." }, 500);
        if (!agent || agent.is_active !== true) return json({ error: "Your agent account is inactive." }, 403);
        const assigned = agent.panchayath_id === panchayathId ||
          (Array.isArray(agent.responsible_panchayath_ids) && agent.responsible_panchayath_ids.includes(panchayathId));
        if (!assigned) return json({ error: "This Panchayath is not assigned to your account." }, 403);
      }

      const clock = getIndiaClock();
      const { data: word, error: wordError } = await supabase
        .from("panchayath_virtual_office_magic_words")
        .select("id, panchayath_id, word_date, content_type, title, body, image_url, created_at")
        .eq("panchayath_id", panchayathId)
        .eq("word_date", clock.date)
        .maybeSingle();
      if (wordError) return json({ error: "Today's Magic Word could not be loaded." }, 500);

      if (!word) return json({ success: true, word: null, seen: false, seen_at: null, seen_count: 0 });
      const [{ data: seenRow, error: seenError }, { count, error: countError }] = await Promise.all([
        agentId
          ? supabase.from("panchayath_virtual_office_magic_word_views").select("seen_at").eq("magic_word_id", word.id).eq("agent_id", agentId).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        supabase.from("panchayath_virtual_office_magic_word_views").select("id", { count: "exact", head: true }).eq("magic_word_id", word.id),
      ]);
      if (seenError || countError) return json({ error: "Magic Word reactions could not be loaded." }, 500);
      return json({ success: true, word, seen: !!seenRow, seen_at: seenRow?.seen_at ?? null, seen_count: count || 0 });
    }

    if (action === "virtual_office_magic_word_seen") {
      const auth = await requireAuth();
      if ("error" in auth) return auth.error;
      const panchayathId = typeof body.panchayath_id === "string" ? body.panchayath_id.trim() : "";
      if (!isValidUuid(panchayathId)) return json({ error: "Choose a valid Panchayath." }, 400);
      const { data: agent, error: agentError } = await supabase
        .from("pennyekart_agents")
        .select("id, is_active, panchayath_id, responsible_panchayath_ids")
        .eq("id", auth.agent_id)
        .maybeSingle();
      if (agentError) return json({ error: "Unable to verify your Panchayath access." }, 500);
      if (!agent || agent.is_active !== true) return json({ error: "Your agent account is inactive." }, 403);
      const assigned = agent.panchayath_id === panchayathId ||
        (Array.isArray(agent.responsible_panchayath_ids) && agent.responsible_panchayath_ids.includes(panchayathId));
      if (!assigned) return json({ error: "This Panchayath is not assigned to your account." }, 403);

      const clock = getIndiaClock();
      const { data: word, error: wordError } = await supabase
        .from("panchayath_virtual_office_magic_words")
        .select("id")
        .eq("panchayath_id", panchayathId)
        .eq("word_date", clock.date)
        .maybeSingle();
      if (wordError) return json({ error: "Today's Magic Word could not be loaded." }, 500);
      if (!word) return json({ error: "There is no Magic Word to react to today." }, 404);
      const { data: reaction, error: reactionError } = await supabase
        .from("panchayath_virtual_office_magic_word_views")
        .upsert({ magic_word_id: word.id, agent_id: auth.agent_id }, { onConflict: "magic_word_id,agent_id", ignoreDuplicates: true })
        .select("seen_at")
        .maybeSingle();
      if (reactionError) return json({ error: "Your reaction could not be saved." }, 500);
      return json({ success: true, alreadySeen: !reaction, seen_at: reaction?.seen_at ?? new Date().toISOString() });
    }

    if (action === "virtual_office_magic_word_seen_by") {
      const admin = await requireAdmin();
      if ("error" in admin) return admin.error;
      const wordId = typeof body.magic_word_id === "string" ? body.magic_word_id.trim() : "";
      if (!isValidUuid(wordId)) return json({ error: "Choose a valid Magic Word." }, 400);

      const { data: word, error: wordError } = await supabase
        .from("panchayath_virtual_office_magic_words")
        .select("id, panchayath_id")
        .eq("id", wordId)
        .maybeSingle();
      if (wordError) return json({ error: "The Magic Word could not be loaded." }, 500);
      if (!word) return json({ error: "Magic Word not found." }, 404);

      const [{ data: agents, error: agentError }, { data: seenRecords, error: viewError }] = await Promise.all([
        supabase
          .from("pennyekart_agents")
          .select("id, name, role, ward, panchayath_id, panchayaths(name)")
          .eq("is_active", true)
          .or(`panchayath_id.eq.${word.panchayath_id},responsible_panchayath_ids.cs.{${word.panchayath_id}}`)
          .order("name")
          .limit(1000),
        supabase
          .from("panchayath_virtual_office_magic_word_views")
          .select("agent_id, seen_at")
          .eq("magic_word_id", wordId)
          .order("seen_at", { ascending: false })
          .limit(1000),
      ]);
      if (agentError || viewError) return json({ error: "The audience list could not be loaded." }, 500);

      const audience = (agents || []).map((agent: any) => {
        const home = Array.isArray(agent.panchayaths) ? agent.panchayaths[0] : agent.panchayaths;
        return {
          id: agent.id,
          name: agent.name,
          role: agent.role,
          ward: agent.ward,
          panchayath_name: home?.name ?? null,
        };
      });
      return json({ success: true, agents: audience, seen_records: seenRecords || [] });
    }

    if (action === "virtual_office_magic_word_list") {
      const admin = await requireAdmin();
      if ("error" in admin) return admin.error;
      const panchayathId = typeof body.panchayath_id === "string" ? body.panchayath_id.trim() : "";
      const postDate = typeof body.post_date === "string" ? body.post_date.trim() : "";
      if (panchayathId && panchayathId !== "all" && !isValidUuid(panchayathId)) {
        return json({ error: "Choose a valid Panchayath filter." }, 400);
      }
      if (postDate && !isValidDateKey(postDate)) return json({ error: "Choose a valid post date." }, 400);

      let query = supabase
        .from("panchayath_virtual_office_magic_words")
        .select("id, panchayath_id, word_date, content_type, title, body, image_url, created_at, updated_at, author_admin_id, author_user_id, author_agent_id, panchayaths(name, district)")
        .order("word_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(200);
      if (panchayathId && panchayathId !== "all") query = query.eq("panchayath_id", panchayathId);
      if (postDate) query = query.eq("word_date", postDate);
      const { data: words, error: wordsError } = await query;
      if (wordsError) return json({ error: "Magic Word history could not be loaded." }, 500);

      const rows = words || [];
      const wordIds = rows.map((word: any) => word.id);
      const agentAuthorIds = [...new Set(rows.map((word: any) => word.author_agent_id).filter((id: unknown): id is string => typeof id === "string"))];
      const adminAuthorIds = [...new Set(rows.map((word: any) => word.author_admin_id).filter((id: unknown): id is string => typeof id === "string"))];
      const userAuthorIds = [...new Set(rows.map((word: any) => word.author_user_id).filter((id: unknown): id is string => typeof id === "string"))];
      const [agentAuthors, adminAuthors, userAuthors] = await Promise.all([
        supabase.from("pennyekart_agents").select("id, name").in("id", agentAuthorIds),
        supabase.from("admins").select("id, full_name").in("id", adminAuthorIds),
        supabase.from("profiles").select("id, full_name, email").in("id", userAuthorIds),
      ]);
      if (agentAuthors.error || adminAuthors.error || userAuthors.error) {
        return json({ error: "Magic Word author details could not be loaded." }, 500);
      }
      const agentNames = new Map((agentAuthors.data || []).map((item: any) => [item.id, item.name]));
      const adminNames = new Map((adminAuthors.data || []).map((item: any) => [item.id, item.full_name]));
      const userNames = new Map((userAuthors.data || []).map((item: any) => [item.id, item.full_name || item.email]));

      const seenCounts = new Map<string, number>();
      for (let offset = 0; wordIds.length && offset < 100000; offset += 1000) {
        const { data: views, error: viewError } = await supabase
          .from("panchayath_virtual_office_magic_word_views")
          .select("magic_word_id")
          .in("magic_word_id", wordIds)
          .range(offset, offset + 999);
        if (viewError) return json({ error: "Magic Word seen counts could not be loaded." }, 500);
        for (const view of views || []) seenCounts.set(view.magic_word_id, (seenCounts.get(view.magic_word_id) || 0) + 1);
        if ((views || []).length < 1000) break;
      }

      return json({
        success: true,
        posts: rows.map((word: any) => {
          const location = Array.isArray(word.panchayaths) ? word.panchayaths[0] : word.panchayaths;
          const authorName = word.author_agent_id
            ? agentNames.get(word.author_agent_id)
            : word.author_admin_id
              ? adminNames.get(word.author_admin_id)
              : userNames.get(word.author_user_id);
          return {
            id: word.id,
            panchayath_id: word.panchayath_id,
            panchayath_name: location?.name ?? "Panchayath",
            district: location?.district ?? null,
            word_date: word.word_date,
            content_type: word.content_type,
            title: word.title,
            body: word.body,
            image_url: word.image_url,
            created_at: word.created_at,
            updated_at: word.updated_at,
            author_name: authorName || "Administrator",
            seen_count: seenCounts.get(word.id) || 0,
          };
        }),
      });
    }

    if (action === "virtual_office_magic_word_publish") {
      const admin = await requireAdmin();
      if ("error" in admin) return admin.error;
      const panchayathId = typeof body.panchayath_id === "string" ? body.panchayath_id.trim() : "";
      const wordId = typeof body.word_id === "string" ? body.word_id.trim() : "";
      const contentType = typeof body.content_type === "string" ? body.content_type : "";
      const title = typeof body.title === "string" ? body.title.trim() : "";
      const text = typeof body.body === "string" ? body.body.trim() : "";
      const imageUrl = typeof body.image_url === "string" ? body.image_url.trim() : "";
      const postDate = typeof body.post_date === "string" && body.post_date.trim()
        ? body.post_date.trim()
        : getIndiaClock().date;
      const contentTypes = ["word", "offer", "scheme", "post", "poster"];
      if ((!isValidUuid(panchayathId) && panchayathId !== "all") || (wordId && !isValidUuid(wordId))) {
        return json({ error: "Choose a valid Panchayath." }, 400);
      }
      if (wordId && panchayathId === "all") return json({ error: "Choose one Panchayath when editing a post." }, 400);
      if (!isValidDateKey(postDate)) return json({ error: "Choose a valid post date." }, 400);
      if (!contentTypes.includes(contentType)) return json({ error: "Choose a valid Magic Word type." }, 400);
      if (!title || title.length > 120) return json({ error: "Title must be between 1 and 120 characters." }, 400);
      if (!text || text.length > 3000) return json({ error: "Details must be between 1 and 3,000 characters." }, 400);
      const publicStoragePrefix = `${Deno.env.get("SUPABASE_URL") || ""}/storage/v1/object/public/`;
      if (imageUrl && (imageUrl.length > 2048 || !imageUrl.startsWith(publicStoragePrefix))) {
        return json({ error: "Poster links must come from this project's public media storage." }, 400);
      }

      const values = {
        word_date: postDate,
        content_type: contentType,
        title,
        body: text,
        image_url: imageUrl || null,
      };
      if (wordId) {
        const { data: word, error } = await supabase
          .from("panchayath_virtual_office_magic_words")
          .update({ ...values, panchayath_id: panchayathId })
          .eq("id", wordId)
          .select("id, panchayath_id, word_date, content_type, title, body, image_url, updated_at")
          .maybeSingle();
        if (error) return json({ error: "The Magic Word could not be updated." }, error.code === "23505" ? 409 : 500);
        if (!word) return json({ error: "Magic Word not found." }, 404);
        return json({ success: true, word, count: 1 });
      }

      const locationsQuery = supabase.from("panchayaths").select("id").eq("is_active", true);
      const { data: locations, error: locationError } = panchayathId === "all"
        ? await locationsQuery
        : await locationsQuery.eq("id", panchayathId).limit(1);
      if (locationError) return json({ error: "Unable to verify the selected Panchayath." }, 500);
      if (!locations?.length) return json({ error: "Choose an active Panchayath." }, 400);

      const records = locations.map((location) => ({
        ...values,
        panchayath_id: location.id,
        author_agent_id: null,
        author_admin_id: admin.admin_id,
        author_user_id: admin.user_id,
      }));
      const { data: saved, error } = await supabase
        .from("panchayath_virtual_office_magic_words")
        .upsert(records, { onConflict: "panchayath_id,word_date" })
        .select("id, panchayath_id, word_date, content_type, title, body, image_url, updated_at");
      if (error) return json({ error: "Magic Word could not be published." }, 500);
      return json({ success: true, word: saved?.[0] ?? null, posts: saved || [], count: saved?.length || 0 });
    }

    if (action === "virtual_office_magic_word_delete") {
      const admin = await requireAdmin();
      if ("error" in admin) return admin.error;
      const wordId = typeof body.magic_word_id === "string" ? body.magic_word_id.trim() : "";
      if (!isValidUuid(wordId)) return json({ error: "Choose a valid Magic Word." }, 400);
      const { data: deleted, error } = await supabase
        .from("panchayath_virtual_office_magic_words")
        .delete()
        .eq("id", wordId)
        .select("id")
        .maybeSingle();
      if (error) return json({ error: "Magic Word could not be deleted." }, 500);
      if (!deleted) return json({ error: "Magic Word not found." }, 404);
      return json({ success: true });
    }

    if (action === "virtual_office_admin_attendance") {
      const admin = await requireAdmin();
      if ("error" in admin) return admin.error;
      const panchayathId = typeof body.panchayath_id === "string" ? body.panchayath_id.trim() : "";
      const workDate = typeof body.work_date === "string" && body.work_date.trim()
        ? body.work_date.trim()
        : getIndiaClock().date;
      if (!isValidUuid(panchayathId)) return json({ error: "Choose a valid Panchayath." }, 400);
      if (!isValidDateKey(workDate)) return json({ error: "Choose a valid attendance date." }, 400);

      const [{ data: agents, error: agentError }, { data: location, error: locationError }] = await Promise.all([
        supabase
          .from("pennyekart_agents")
          .select("id, name, role, ward, panchayath_id, panchayaths(name)")
          .eq("is_active", true)
          .or(`panchayath_id.eq.${panchayathId},responsible_panchayath_ids.cs.{${panchayathId}}`)
          .order("name")
          .limit(1000),
        supabase.from("panchayaths").select("id, name").eq("id", panchayathId).maybeSingle(),
      ]);
      if (agentError || locationError) return json({ error: "Attendance could not be loaded." }, 500);
      if (!location) return json({ error: "Panchayath not found." }, 404);

      const agentIds = (agents || []).map((agent: any) => agent.id);
      const attendanceResult = agentIds.length
        ? await supabase
            .from("panchayath_virtual_office_attendance")
            .select("agent_id, check_in_at")
            .eq("work_date", workDate)
            .in("agent_id", agentIds)
            .limit(1000)
        : { data: [], error: null };
      if (attendanceResult.error) return json({ error: "Attendance records could not be loaded." }, 500);
      const checkIns = new Map((attendanceResult.data || []).map((item: any) => [item.agent_id, item.check_in_at]));
      const entries = (agents || []).map((agent: any) => {
        const home = Array.isArray(agent.panchayaths) ? agent.panchayaths[0] : agent.panchayaths;
        return {
          agent_id: agent.id,
          name: agent.name,
          role: agent.role,
          ward: agent.ward,
          panchayath_name: home?.name ?? location.name,
          check_in_at: checkIns.get(agent.id) ?? null,
        };
      });
      return json({ success: true, panchayath_id: panchayathId, panchayath_name: location.name, work_date: workDate, entries });
    }

    if (action === "virtual_office_admin_manual_check_in") {
      const admin = await requireAdmin();
      if ("error" in admin) return admin.error;
      const panchayathId = typeof body.panchayath_id === "string" ? body.panchayath_id.trim() : "";
      const agentId = typeof body.agent_id === "string" ? body.agent_id.trim() : "";
      const workDate = typeof body.work_date === "string" ? body.work_date.trim() : "";
      if (!isValidUuid(panchayathId) || !isValidUuid(agentId)) return json({ error: "Choose a valid Panchayath and agent." }, 400);
      if (!isValidDateKey(workDate)) return json({ error: "Choose a valid attendance date." }, 400);

      const { data: agent, error: agentError } = await supabase
        .from("pennyekart_agents")
        .select("id, is_active")
        .eq("id", agentId)
        .eq("is_active", true)
        .or(`panchayath_id.eq.${panchayathId},responsible_panchayath_ids.cs.{${panchayathId}}`)
        .maybeSingle();
      if (agentError) return json({ error: "Agent eligibility could not be verified." }, 500);
      if (!agent) return json({ error: "Choose an active agent assigned to this Panchayath." }, 400);

      const { data: attendance, error } = await supabase
        .from("panchayath_virtual_office_attendance")
        .upsert({ agent_id: agentId, work_date: workDate, check_in_at: new Date().toISOString() }, {
          onConflict: "agent_id,work_date",
        })
        .select("agent_id, work_date, check_in_at")
        .single();
      if (error) return json({ error: "Manual check-in could not be recorded." }, 500);
      return json({ success: true, attendance });
    }

    if (action === "can_post_virtual_office_announcement" || action === "publish_virtual_office_announcement") {
      const auth = await requireAuth();
      if ("error" in auth) return auth.error;

      const panchayathId = typeof body.panchayath_id === "string" ? body.panchayath_id.trim() : "";
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(panchayathId)) {
        return json({ error: "Choose a valid Panchayath." }, 400);
      }

      const [{ data: agent, error: agentError }, { data: office, error: officeError }] = await Promise.all([
        supabase.from("pennyekart_agents").select("id, is_active").eq("id", auth.agent_id).maybeSingle(),
        supabase
          .from("panchayath_virtual_offices")
          .select("office_manager_agent_id")
          .eq("panchayath_id", panchayathId)
          .maybeSingle(),
      ]);
      if (agentError || officeError) return json({ error: "Unable to verify office publishing access." }, 500);
      if (!agent || !canPublishVirtualOfficeAnnouncement(auth.agent_id, office?.office_manager_agent_id ?? null, agent.is_active === true)) {
        return json({ error: "Only the assigned active Office Manager can post announcements." }, 403);
      }

      if (action === "can_post_virtual_office_announcement") {
        return json({ can_post: true });
      }

      const validation = validateVirtualOfficeAnnouncementInput(body);
      if (!validation.valid) return json({ error: validation.error }, 400);
      const { data: announcement, error: insertError } = await supabase
        .from("panchayath_virtual_office_announcements")
        .insert({
          panchayath_id: validation.value.panchayathId,
          author_agent_id: auth.agent_id,
          title: validation.value.title,
          body: validation.value.body,
          is_published: true,
        })
        .select("id, title, body, created_at")
        .single();
      if (insertError) return json({ error: "Announcement could not be published." }, 500);
      return json({ success: true, announcement });
    }

    const BUDGET_SHARES: Record<string, { own: number; elife: number }> = {
      own_100: { own: 100, elife: 0 },
      "80_20": { own: 80, elife: 20 },
      "50_50": { own: 50, elife: 50 },
      "20_80": { own: 20, elife: 80 },
      samrambhini: { own: 0, elife: 0 },
    };

    // ---- list_projects ----
    if (action === "list_projects") {
      const auth = await requireAuth();
      if ("error" in auth) return auth.error;
      const { data, error } = await supabase
        .from("agent_projects")
        .select("*")
        .eq("agent_id", auth.agent_id)
        .order("created_at", { ascending: false });
      if (error) return json({ error: error.message }, 500);
      return json({ success: true, projects: data || [] });
    }

    // ---- my_todos: all tasks across owned + member projects ----
    if (action === "my_todos") {
      const auth = await requireAuth();
      if ("error" in auth) return auth.error;

      const [{ data: owned }, { data: memberships }] = await Promise.all([
        supabase.from("agent_projects").select("id, project_name").eq("agent_id", auth.agent_id),
        supabase.from("agent_project_members").select("project_id").eq("agent_id", auth.agent_id),
      ]);

      const memberIds = (memberships || []).map((m: { project_id: string }) => m.project_id);
      let memberProjects: { id: string; project_name: string }[] = [];
      if (memberIds.length) {
        const { data } = await supabase.from("agent_projects").select("id, project_name").in("id", memberIds);
        memberProjects = data || [];
      }

      const projectMap = new Map<string, string>();
      for (const p of [...(owned || []), ...memberProjects]) projectMap.set(p.id, p.project_name);
      const ids = Array.from(projectMap.keys());
      if (!ids.length) return json({ success: true, todos: [] });

      const { data: todos, error } = await supabase
        .from("agent_project_todos")
        .select("*")
        .in("project_id", ids)
        .order("created_at", { ascending: false });
      if (error) return json({ error: error.message }, 500);

      return json({
        success: true,
        todos: (todos || []).map((t: Record<string, unknown>) => ({
          ...t,
          project_name: projectMap.get(t.project_id as string) || "",
        })),
      });
    }


    // ---- create_project ----
    if (action === "create_project") {
      const auth = await requireAuth();
      if ("error" in auth) return auth.error;
      const p = body.project || {};
      if (!p.project_name || !p.model || !p.entity || !p.budget_plan) {
        return json({ error: "project_name, model, entity and budget_plan are required" }, 400);
      }
      if (!["individual", "partnership", "group"].includes(p.model)) return json({ error: "Invalid model" }, 400);
      if (!["own_company", "elife_affiliated"].includes(p.entity)) return json({ error: "Invalid entity" }, 400);
      const shares = BUDGET_SHARES[p.budget_plan];
      if (!shares) return json({ error: "Invalid budget_plan" }, 400);

      const { data, error } = await supabase
        .from("agent_projects")
        .insert({
          agent_id: auth.agent_id,
          project_name: String(p.project_name).slice(0, 200),
          plan_description: p.plan_description || null,
          model: p.model,
          entity: p.entity,
          budget_plan: p.budget_plan,
          logo_url: p.logo_url || null,
          own_share: shares.own,
          elife_share: shares.elife,
        })
        .select()
        .single();
      if (error) return json({ error: error.message }, 500);
      return json({ success: true, project: data });
    }

    // ---- update_project ----
    if (action === "update_project") {
      const auth = await requireAuth();
      if ("error" in auth) return auth.error;
      const id: string = body.id;
      const p = body.project || {};
      if (!id) return json({ error: "id required" }, 400);

      const patch: Record<string, unknown> = {};
      if (p.project_name !== undefined) patch.project_name = String(p.project_name).slice(0, 200);
      if (p.plan_description !== undefined) patch.plan_description = p.plan_description || null;
      if (p.logo_url !== undefined) patch.logo_url = p.logo_url || null;
      if (p.model !== undefined) {
        if (!["individual", "partnership", "group"].includes(p.model)) return json({ error: "Invalid model" }, 400);
        patch.model = p.model;
      }
      if (p.entity !== undefined) {
        if (!["own_company", "elife_affiliated"].includes(p.entity)) return json({ error: "Invalid entity" }, 400);
        patch.entity = p.entity;
      }
      if (p.budget_plan !== undefined) {
        const shares = BUDGET_SHARES[p.budget_plan];
        if (!shares) return json({ error: "Invalid budget_plan" }, 400);
        patch.budget_plan = p.budget_plan;
        patch.own_share = shares.own;
        patch.elife_share = shares.elife;
      }

      const { data, error } = await supabase
        .from("agent_projects")
        .update(patch)
        .eq("id", id)
        .eq("agent_id", auth.agent_id)
        .select()
        .single();
      if (error) return json({ error: error.message }, 500);
      return json({ success: true, project: data });
    }

    // ---- delete_project ----
    if (action === "delete_project") {
      const auth = await requireAuth();
      if ("error" in auth) return auth.error;
      const id: string = body.id;
      if (!id) return json({ error: "id required" }, 400);
      const { error } = await supabase
        .from("agent_projects")
        .delete()
        .eq("id", id)
        .eq("agent_id", auth.agent_id);
      if (error) return json({ error: error.message }, 500);
      return json({ success: true });
    }

    // Helper: assert caller owns the project (or is a member)
    const assertProjectAccess = async (project_id: string, agent_id: string) => {
      const { data: proj } = await supabase
        .from("agent_projects")
        .select("id, agent_id, model")
        .eq("id", project_id)
        .maybeSingle();
      if (!proj) return { error: json({ error: "Project not found" }, 404) };
      if (proj.agent_id === agent_id) return { project: proj, isOwner: true as const };
      const { data: mem } = await supabase
        .from("agent_project_members")
        .select("id")
        .eq("project_id", project_id)
        .eq("agent_id", agent_id)
        .maybeSingle();
      if (!mem) return { error: json({ error: "Forbidden" }, 403) };
      return { project: proj, isOwner: false as const };
    };

    if (action === "get_project") {
      const auth = await requireAuth();
      if ("error" in auth) return auth.error;
      const id: string = body.id;
      if (!id) return json({ error: "id required" }, 400);
      const acc = await assertProjectAccess(id, auth.agent_id);
      if ("error" in acc) return acc.error;

      const [{ data: project }, { data: todos }, { data: notes }, { data: members }] = await Promise.all([
        supabase.from("agent_projects").select("*").eq("id", id).single(),
        supabase.from("agent_project_todos").select("*").eq("project_id", id).order("created_at", { ascending: true }),
        supabase.from("agent_project_notes").select("*").eq("project_id", id).order("created_at", { ascending: false }),
        supabase
          .from("agent_project_members")
          .select("id, agent_id, created_at, pennyekart_agents(id, name, mobile, role)")
          .eq("project_id", id)
          .order("created_at", { ascending: true }),
      ]);

      return json({ success: true, project, todos: todos || [], notes: notes || [], members: members || [], isOwner: acc.isOwner });
    }

    if (action === "add_todo") {
      const auth = await requireAuth();
      if ("error" in auth) return auth.error;
      const project_id: string = body.project_id;
      const title: string = (body.title || "").toString().trim();
      if (!project_id || !title) return json({ error: "project_id and title required" }, 400);
      const acc = await assertProjectAccess(project_id, auth.agent_id);
      if ("error" in acc) return acc.error;
      const { data, error } = await supabase
        .from("agent_project_todos")
        .insert({ project_id, title: title.slice(0, 300) })
        .select()
        .single();
      if (error) return json({ error: error.message }, 500);
      return json({ success: true, todo: data });
    }

    if (action === "toggle_todo") {
      const auth = await requireAuth();
      if ("error" in auth) return auth.error;
      const id: string = body.id;
      const is_done: boolean = !!body.is_done;
      if (!id) return json({ error: "id required" }, 400);
      const { data: todo } = await supabase.from("agent_project_todos").select("project_id").eq("id", id).maybeSingle();
      if (!todo) return json({ error: "Not found" }, 404);
      const acc = await assertProjectAccess(todo.project_id, auth.agent_id);
      if ("error" in acc) return acc.error;
      const { error } = await supabase.from("agent_project_todos").update({ is_done }).eq("id", id);
      if (error) return json({ error: error.message }, 500);
      return json({ success: true });
    }

    if (action === "delete_todo") {
      const auth = await requireAuth();
      if ("error" in auth) return auth.error;
      const id: string = body.id;
      if (!id) return json({ error: "id required" }, 400);
      const { data: todo } = await supabase.from("agent_project_todos").select("project_id").eq("id", id).maybeSingle();
      if (!todo) return json({ error: "Not found" }, 404);
      const acc = await assertProjectAccess(todo.project_id, auth.agent_id);
      if ("error" in acc) return acc.error;
      const { error } = await supabase.from("agent_project_todos").delete().eq("id", id);
      if (error) return json({ error: error.message }, 500);
      return json({ success: true });
    }

    if (action === "add_note") {
      const auth = await requireAuth();
      if ("error" in auth) return auth.error;
      const project_id: string = body.project_id;
      const bodyText: string = (body.body || "").toString().trim();
      const title: string | null = body.title ? String(body.title).slice(0, 200) : null;
      if (!project_id || !bodyText) return json({ error: "project_id and body required" }, 400);
      const acc = await assertProjectAccess(project_id, auth.agent_id);
      if ("error" in acc) return acc.error;
      const { data, error } = await supabase
        .from("agent_project_notes")
        .insert({ project_id, title, body: bodyText })
        .select()
        .single();
      if (error) return json({ error: error.message }, 500);
      return json({ success: true, note: data });
    }

    if (action === "delete_note") {
      const auth = await requireAuth();
      if ("error" in auth) return auth.error;
      const id: string = body.id;
      if (!id) return json({ error: "id required" }, 400);
      const { data: n } = await supabase.from("agent_project_notes").select("project_id").eq("id", id).maybeSingle();
      if (!n) return json({ error: "Not found" }, 404);
      const acc = await assertProjectAccess(n.project_id, auth.agent_id);
      if ("error" in acc) return acc.error;
      const { error } = await supabase.from("agent_project_notes").delete().eq("id", id);
      if (error) return json({ error: error.message }, 500);
      return json({ success: true });
    }

    if (action === "search_registered_agents") {
      const auth = await requireAuth();
      if ("error" in auth) return auth.error;
      const q: string = (body.q || "").toString().trim();
      if (q.length < 2) return json({ success: true, agents: [] });

      const { data: authRows } = await supabase.from("agent_auth").select("agent_id").limit(1000);
      const registeredIds = (authRows || []).map((r) => r.agent_id);
      if (registeredIds.length === 0) return json({ success: true, agents: [] });

      const { data: agents } = await supabase
        .from("pennyekart_agents")
        .select("id, name, mobile, role")
        .in("id", registeredIds)
        .or(`name.ilike.%${q}%,mobile.ilike.%${q}%`)
        .limit(20);
      return json({ success: true, agents: (agents || []).filter((a) => a.id !== auth.agent_id) });
    }

    if (action === "add_member") {
      const auth = await requireAuth();
      if ("error" in auth) return auth.error;
      const project_id: string = body.project_id;
      const agent_id: string = body.agent_id;
      if (!project_id || !agent_id) return json({ error: "project_id and agent_id required" }, 400);

      const { data: proj } = await supabase
        .from("agent_projects")
        .select("id, agent_id, model")
        .eq("id", project_id)
        .maybeSingle();
      if (!proj) return json({ error: "Project not found" }, 404);
      if (proj.agent_id !== auth.agent_id) return json({ error: "Only the project owner can add members" }, 403);
      if (proj.model === "individual") return json({ error: "Individual projects cannot have partners" }, 400);
      if (agent_id === proj.agent_id) return json({ error: "You are already the owner" }, 400);

      const { data: authRow } = await supabase.from("agent_auth").select("id").eq("agent_id", agent_id).maybeSingle();
      if (!authRow) return json({ error: "Selected user is not a registered Samrambhaka user" }, 400);

      if (proj.model === "partnership") {
        const { count } = await supabase
          .from("agent_project_members")
          .select("id", { count: "exact", head: true })
          .eq("project_id", project_id);
        if ((count || 0) >= 3) return json({ error: "Partnership projects allow max 4 members (owner + 3 partners)" }, 400);
      }

      const { data, error } = await supabase
        .from("agent_project_members")
        .insert({ project_id, agent_id })
        .select("id, agent_id, created_at, pennyekart_agents(id, name, mobile, role)")
        .single();
      if (error) {
        if (String(error.message).toLowerCase().includes("duplicate")) return json({ error: "Already a member" }, 400);
        return json({ error: error.message }, 500);
      }
      return json({ success: true, member: data });
    }

    if (action === "remove_member") {
      const auth = await requireAuth();
      if ("error" in auth) return auth.error;
      const id: string = body.id;
      if (!id) return json({ error: "id required" }, 400);
      const { data: mem } = await supabase
        .from("agent_project_members")
        .select("id, project_id")
        .eq("id", id)
        .maybeSingle();
      if (!mem) return json({ error: "Not found" }, 404);
      const { data: proj } = await supabase.from("agent_projects").select("agent_id").eq("id", mem.project_id).maybeSingle();
      if (!proj || proj.agent_id !== auth.agent_id) return json({ error: "Only the project owner can remove members" }, 403);
      const { error } = await supabase.from("agent_project_members").delete().eq("id", id);
      if (error) return json({ error: error.message }, 500);
      return json({ success: true });
    }

    return json({ error: "Invalid action" }, 400);
  } catch (e) {
    console.error("samrabhaka-auth error:", e);
    return json({ error: e instanceof Error ? e.message : "Server error" }, 500);
  }
});