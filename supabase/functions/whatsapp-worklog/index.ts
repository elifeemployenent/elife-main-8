import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CORE_HELP = `📋 *PennyeKart Agent Commands*

1️⃣ <your work details>
  Submit your daily work log.
  Example: _1 Visited 5 shops in Ward 3, collected 2 orders_

2️⃣
  View your reporting person details.

3️⃣
  Show this help message.

4️⃣
  Check your wallet balance.`;

function buildHelpText(customCommands: Array<{ keyword: string; label: string }>) {
  let help = CORE_HELP;
  for (const cmd of customCommands) {
    help += `\n\n${cmd.keyword}️⃣\n  ${cmd.label}`;
  }
  help += `\n\n💡 *Tips:*
• Send *1* followed by your work to log it.
• You can send multiple reports in a day — they will be appended.
• Your work logs are tracked daily by your team leader.`;
  return help;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function twiml(msg: string) {
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(msg)}</Message></Response>`,
    { status: 200, headers: { ...corsHeaders, "Content-Type": "text/xml" } }
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const from = formData.get("From") as string;
    const body = (formData.get("Body") as string)?.trim();

    if (!from || !body) {
      return twiml("Missing message content.");
    }

    const phoneRaw = from.replace("whatsapp:", "").trim();
    const last10 = phoneRaw.replace(/\D/g, "").slice(-10);
    const command = body.trim();

    console.log(`WhatsApp from ${phoneRaw}: ${body.substring(0, 100)}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch custom commands for help & matching
    const { data: customCommands } = await supabase
      .from("whatsapp_bot_commands")
      .select("keyword, alt_keyword, label, response_text")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    const activeCustom = customCommands || [];

    // Handle help before agent lookup
    if (command === "3" || command.toLowerCase() === "help" || command.toLowerCase() === "hi" || command.toLowerCase() === "hello") {
      return twiml(buildHelpText(activeCustom));
    }

    // Find agent
    let { data: agent } = await supabase
      .from("pennyekart_agents")
      .select("id, name, mobile, role")
      .eq("mobile", last10)
      .eq("is_active", true)
      .maybeSingle();

    if (!agent) {
      const { data: agent2 } = await supabase
        .from("pennyekart_agents")
        .select("id, name, mobile, role")
        .eq("mobile", phoneRaw)
        .eq("is_active", true)
        .maybeSingle();
      agent = agent2;
    }

    if (!agent) {
      return twiml(`❌ Your number is not registered as an agent. Please contact your team leader.\n\nType *3* for help.`);
    }

    const today = new Date().toISOString().split("T")[0];

    // --- COMMAND: 2 = reporting person details ---
    if (command === "2" || command.toLowerCase() === "status") {
      const roleLabels: Record<string, string> = {
        team_leader: "Team Leader",
        coordinator: "Coordinator",
        group_leader: "Group Leader",
        pro: "PRO",
        scode: "S-Code",
      };

      // Walk up the parent chain to collect reporting hierarchy
      const hierarchy: Array<{ name: string; mobile: string; role: string }> = [];
      let currentParentId = agent.parent_agent_id;
      let depth = 0;

      while (currentParentId && depth < 5) {
        const { data: parent } = await supabase
          .from("pennyekart_agents")
          .select("id, name, mobile, role, parent_agent_id")
          .eq("id", currentParentId)
          .eq("is_active", true)
          .maybeSingle();

        if (!parent) break;
        hierarchy.push({ name: parent.name, mobile: parent.mobile, role: parent.role });
        currentParentId = parent.parent_agent_id;
        depth++;
      }

      if (hierarchy.length === 0) {
        return twiml(`👤 *${agent.name}* (${roleLabels[agent.role] || agent.role})\n\nNo reporting person found. You may be a top-level agent.`);
      }

      let msg = `👤 *Your Reporting Chain*\n🏷️ ${agent.name} (${roleLabels[agent.role] || agent.role})\n`;
      for (const h of hierarchy) {
        msg += `\n⬆️ *${roleLabels[h.role] || h.role}*\n   ${h.name}\n   📞 ${h.mobile}`;
      }

      return twiml(msg);
    }

    // --- COMMAND: 1 = report ---
    const reportMatch = body.match(/^1\s+(.+)/is);
    if (reportMatch) {
      const workDetails = reportMatch[1].trim();

      if (!workDetails) {
        return twiml(`⚠️ Please include your work details after *1*.\n\nExample: _1 Visited 5 shops, collected 3 orders_`);
      }

      const { data: existingLog } = await supabase
        .from("agent_work_logs")
        .select("id, work_details")
        .eq("agent_id", agent.id)
        .eq("work_date", today)
        .maybeSingle();

      if (existingLog) {
        const updatedDetails = `${existingLog.work_details}\n${workDetails}`;
        const { error } = await supabase
          .from("agent_work_logs")
          .update({ work_details: updatedDetails })
          .eq("id", existingLog.id);

        if (error) {
          return twiml("❌ Failed to update work log. Please try again.");
        }

        return twiml(`✅ Work log updated, ${agent.name}!\n\n📅 ${today}\n📝 Today's full log:\n${updatedDetails}`);
      } else {
        const { error } = await supabase
          .from("agent_work_logs")
          .insert({
            agent_id: agent.id,
            work_details: workDetails,
            work_date: today,
          });

        if (error) {
          return twiml("❌ Failed to save work log. Please try again.");
        }

        return twiml(`✅ Work log saved, ${agent.name}!\n\n📅 ${today}\n📝 ${workDetails}`);
      }
    }

    // --- COMMAND: 4 = wallet balance ---
    if (command === "4" || command.toLowerCase() === "balance") {
      const { data: transactions, error: walletError } = await supabase
        .from("agent_wallet_transactions")
        .select("amount")
        .eq("agent_id", agent.id);

      if (walletError) {
        return twiml("❌ Failed to fetch wallet balance. Please try again.");
      }

      const balance = (transactions || []).reduce((sum: number, t: { amount: number }) => sum + Number(t.amount), 0);
      const formatted = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(balance);

      return twiml(`💰 *Wallet Balance*\n👤 ${agent.name}\n💳 Available Balance: ${formatted}`);
    }

    // --- DYNAMIC CUSTOM COMMANDS ---
    const cmdLower = command.toLowerCase();
    for (const cc of activeCustom) {
      if (cmdLower === cc.keyword.toLowerCase() || (cc.alt_keyword && cmdLower === cc.alt_keyword.toLowerCase())) {
        return twiml(cc.response_text);
      }
    }

    // --- UNRECOGNIZED COMMAND ---
    let fallback = `🤔 Sorry ${agent.name}, I didn't understand that.\n\n*Commands:*\n1️⃣ *1* <work details> — Submit work log\n2️⃣ *2* — View today's log\n3️⃣ *3* — Help\n4️⃣ *4* — Wallet balance`;
    for (const cc of activeCustom) {
      fallback += `\n${cc.keyword}️⃣ *${cc.keyword}* — ${cc.label}`;
    }
    fallback += `\n\nExample: _1 Visited 5 shops today_`;

    return twiml(fallback);
  } catch (err) {
    console.error("Webhook error:", err);
    return twiml("Something went wrong. Please try again later.\n\nType *3* for help.");
  }
});
