import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Twilio sends webhook data as application/x-www-form-urlencoded
    const formData = await req.formData();
    const from = formData.get("From") as string; // e.g. "whatsapp:+919876543210"
    const body = (formData.get("Body") as string)?.trim();

    if (!from || !body) {
      console.error("Missing From or Body in webhook payload");
      return new Response(
        '<Response><Message>Missing message content.</Message></Response>',
        { status: 200, headers: { ...corsHeaders, "Content-Type": "text/xml" } }
      );
    }

    // Extract phone number from "whatsapp:+91XXXXXXXXXX"
    const phoneRaw = from.replace("whatsapp:", "").trim();
    // Normalize: remove leading +91 or +, keep last 10 digits for matching
    const last10 = phoneRaw.replace(/\D/g, "").slice(-10);

    console.log(`WhatsApp message from ${phoneRaw} (last10: ${last10}): ${body.substring(0, 100)}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find agent by mobile number (try exact match first, then last 10 digits)
    let { data: agent } = await supabase
      .from("pennyekart_agents")
      .select("id, name, mobile")
      .eq("mobile", last10)
      .eq("is_active", true)
      .maybeSingle();

    if (!agent) {
      // Try with full number
      const { data: agent2 } = await supabase
        .from("pennyekart_agents")
        .select("id, name, mobile")
        .eq("mobile", phoneRaw)
        .eq("is_active", true)
        .maybeSingle();
      agent = agent2;
    }

    if (!agent) {
      console.log(`No agent found for mobile: ${last10} or ${phoneRaw}`);
      return new Response(
        '<Response><Message>Your number is not registered as an agent. Please contact admin.</Message></Response>',
        { status: 200, headers: { ...corsHeaders, "Content-Type": "text/xml" } }
      );
    }

    console.log(`Agent found: ${agent.name} (${agent.id})`);

    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split("T")[0];

    // Check if a work log already exists for today
    const { data: existingLog } = await supabase
      .from("agent_work_logs")
      .select("id, work_details")
      .eq("agent_id", agent.id)
      .eq("work_date", today)
      .maybeSingle();

    if (existingLog) {
      // Append new message to existing log
      const updatedDetails = existingLog.work_details
        ? `${existingLog.work_details}\n${body}`
        : body;

      const { error } = await supabase
        .from("agent_work_logs")
        .update({ work_details: updatedDetails })
        .eq("id", existingLog.id);

      if (error) {
        console.error("Error updating work log:", error);
        return new Response(
          '<Response><Message>Failed to update work log. Please try again.</Message></Response>',
          { status: 200, headers: { ...corsHeaders, "Content-Type": "text/xml" } }
        );
      }

      console.log(`Updated work log for agent ${agent.name} on ${today}`);
      return new Response(
        `<Response><Message>✅ Work log updated, ${agent.name}!\n\nToday's log:\n${updatedDetails}</Message></Response>`,
        { status: 200, headers: { ...corsHeaders, "Content-Type": "text/xml" } }
      );
    } else {
      // Create new work log
      const { error } = await supabase
        .from("agent_work_logs")
        .insert({
          agent_id: agent.id,
          work_details: body,
          work_date: today,
        });

      if (error) {
        console.error("Error creating work log:", error);
        return new Response(
          '<Response><Message>Failed to save work log. Please try again.</Message></Response>',
          { status: 200, headers: { ...corsHeaders, "Content-Type": "text/xml" } }
        );
      }

      console.log(`Created new work log for agent ${agent.name} on ${today}`);
      return new Response(
        `<Response><Message>✅ Work log saved, ${agent.name}!\n\nToday's log:\n${body}</Message></Response>`,
        { status: 200, headers: { ...corsHeaders, "Content-Type": "text/xml" } }
      );
    }
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(
      '<Response><Message>Something went wrong. Please try again later.</Message></Response>',
      { status: 200, headers: { ...corsHeaders, "Content-Type": "text/xml" } }
    );
  }
});
