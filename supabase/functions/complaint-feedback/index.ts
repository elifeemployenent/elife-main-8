import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-token",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { complaint_id, status, admin_remarks } = await req.json();

    if (!complaint_id || !status) {
      return new Response(
        JSON.stringify({ error: "complaint_id and status required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: complaint, error: cErr } = await supabase
      .from("agent_complaints")
      .select("*, agent:pennyekart_agents(name, mobile)")
      .eq("id", complaint_id)
      .maybeSingle();

    if (cErr || !complaint || !complaint.agent?.mobile) {
      return new Response(
        JSON.stringify({ error: "Complaint or agent not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const agentMobile = complaint.agent.mobile;
    const agentName = complaint.agent.name;

    const statusEmoji = status === "resolved" ? "✅" : status === "dismissed" ? "❌" : "⏳";
    const statusLabel = status === "resolved" ? "Resolved" : status === "dismissed" ? "Dismissed" : "Pending";

    let message = `${statusEmoji} *Complaint Update*\n\nHi ${agentName},\n\nYour complaint has been updated:\n\n`;
    message += `📝 *Complaint:* ${complaint.complaint_text}\n`;
    message += `📌 *Status:* ${statusLabel}\n`;

    if (admin_remarks) {
      message += `💬 *Admin Remarks:* ${admin_remarks}\n`;
    }

    message += `\n📅 Updated: ${new Date().toLocaleDateString("en-IN")}\n`;
    message += `\nThank you for your feedback. If you have any further concerns, send *3 <your message>*.`;

    // Parse TWILIO_API_KEY in format ACCOUNT_SID:AUTH_TOKEN:FROM_NUMBER
    const twilioApiKey = Deno.env.get("TWILIO_API_KEY");
    if (!twilioApiKey) {
      console.error("TWILIO_API_KEY not set");
      return new Response(
        JSON.stringify({ error: "Twilio not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const parts = twilioApiKey.split(":");
    if (parts.length < 3) {
      console.error("Invalid TWILIO_API_KEY format. Expected ACCOUNT_SID:AUTH_TOKEN:FROM_NUMBER, got", parts.length, "parts");
      return new Response(
        JSON.stringify({ error: "Invalid Twilio config. Set TWILIO_API_KEY as ACCOUNT_SID:AUTH_TOKEN:FROM_NUMBER" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const [accountSid, authToken, ...fromParts] = parts;
    const fromNumber = fromParts.join(":");
    const toNumber = agentMobile.startsWith("+") ? agentMobile : `+91${agentMobile}`;

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

    const twilioRes = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        From: `whatsapp:${fromNumber}`,
        To: `whatsapp:${toNumber}`,
        Body: message,
      }).toString(),
    });

    const twilioData = await twilioRes.json();

    if (!twilioRes.ok) {
      console.error("Twilio error:", JSON.stringify(twilioData));
      return new Response(
        JSON.stringify({ error: "Failed to send WhatsApp message", details: twilioData }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Complaint feedback sent to ${toNumber} for complaint ${complaint_id}`);

    return new Response(
      JSON.stringify({ success: true, message_sid: twilioData.sid }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
