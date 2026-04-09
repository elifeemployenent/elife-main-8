import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const HELP_TEXT = `📋 *PennyeKart Agent Commands*

📝 *report* <your work details>
  Submit your daily work log.
  Example: _report Visited 5 shops in Ward 3, collected 2 orders_

📊 *status*
  View today's work log summary.

❓ *help*
  Show this help message.

💡 *Tips:*
• Send _report_ followed by your work to log it.
• You can send multiple reports in a day — they will be appended.
• Your work logs are tracked daily by your team leader.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const from = formData.get("From") as string;
    const body = (formData.get("Body") as string)?.trim();

    if (!from || !body) {
      return new Response(
        '<Response><Message>Missing message content.</Message></Response>',
        { status: 200, headers: { ...corsHeaders, "Content-Type": "text/xml" } }
      );
    }

    const phoneRaw = from.replace("whatsapp:", "").trim();
    const last10 = phoneRaw.replace(/\D/g, "").slice(-10);
    const command = body.toLowerCase();

    console.log(`WhatsApp from ${phoneRaw}: ${body.substring(0, 100)}`);

    // Handle help before agent lookup
    if (command === "help" || command === "hi" || command === "hello") {
      return new Response(
        `<Response><Message>${HELP_TEXT}</Message></Response>`,
        { status: 200, headers: { ...corsHeaders, "Content-Type": "text/xml" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
      return new Response(
        `<Response><Message>❌ Your number is not registered as an agent. Please contact your team leader.\n\nType *help* for available commands.</Message></Response>`,
        { status: 200, headers: { ...corsHeaders, "Content-Type": "text/xml" } }
      );
    }

    const today = new Date().toISOString().split("T")[0];

    // --- COMMAND: status ---
    if (command === "status") {
      const { data: todayLog } = await supabase
        .from("agent_work_logs")
        .select("work_details, created_at, updated_at")
        .eq("agent_id", agent.id)
        .eq("work_date", today)
        .maybeSingle();

      if (todayLog) {
        return new Response(
          `<Response><Message>📊 *Today's Work Log*\n👤 ${agent.name}\n📅 ${today}\n\n${todayLog.work_details}\n\n_Last updated: ${new Date(todayLog.updated_at).toLocaleTimeString("en-IN")}_</Message></Response>`,
          { status: 200, headers: { ...corsHeaders, "Content-Type": "text/xml" } }
        );
      } else {
        return new Response(
          `<Response><Message>📊 No work log submitted yet today, ${agent.name}.\n\nUse *report* <details> to submit your work.</Message></Response>`,
          { status: 200, headers: { ...corsHeaders, "Content-Type": "text/xml" } }
        );
      }
    }

    // --- COMMAND: report ---
    const reportMatch = body.match(/^report\s+(.+)/is);
    if (reportMatch) {
      const workDetails = reportMatch[1].trim();

      if (!workDetails) {
        return new Response(
          `<Response><Message>⚠️ Please include your work details after *report*.\n\nExample: _report Visited 5 shops, collected 3 orders_</Message></Response>`,
          { status: 200, headers: { ...corsHeaders, "Content-Type": "text/xml" } }
        );
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
          return new Response(
            '<Response><Message>❌ Failed to update work log. Please try again.</Message></Response>',
            { status: 200, headers: { ...corsHeaders, "Content-Type": "text/xml" } }
          );
        }

        return new Response(
          `<Response><Message>✅ Work log updated, ${agent.name}!\n\n📅 ${today}\n📝 Today's full log:\n${updatedDetails}</Message></Response>`,
          { status: 200, headers: { ...corsHeaders, "Content-Type": "text/xml" } }
        );
      } else {
        const { error } = await supabase
          .from("agent_work_logs")
          .insert({
            agent_id: agent.id,
            work_details: workDetails,
            work_date: today,
          });

        if (error) {
          return new Response(
            '<Response><Message>❌ Failed to save work log. Please try again.</Message></Response>',
            { status: 200, headers: { ...corsHeaders, "Content-Type": "text/xml" } }
          );
        }

        return new Response(
          `<Response><Message>✅ Work log saved, ${agent.name}!\n\n📅 ${today}\n📝 ${workDetails}</Message></Response>`,
          { status: 200, headers: { ...corsHeaders, "Content-Type": "text/xml" } }
        );
      }
    }

    // --- UNRECOGNIZED COMMAND ---
    return new Response(
      `<Response><Message>🤔 Sorry ${agent.name}, I didn't understand that.\n\n*Available commands:*\n📝 *report* <work details> — Submit work log\n📊 *status* — View today's log\n❓ *help* — Show all commands\n\nExample: _report Visited 5 shops today_</Message></Response>`,
      { status: 200, headers: { ...corsHeaders, "Content-Type": "text/xml" } }
    );
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(
      '<Response><Message>Something went wrong. Please try again later.\n\nType *help* for available commands.</Message></Response>',
      { status: 200, headers: { ...corsHeaders, "Content-Type": "text/xml" } }
    );
  }
});
