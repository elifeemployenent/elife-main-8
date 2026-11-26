import { supabase } from "@/integrations/supabase/client";

export interface VirtualOfficePanchayath {
  id: string;
  name: string;
  district: string | null;
  code: string | null;
}

export interface VirtualOfficeTeamMember {
  id: string;
  name: string;
  role: string;
  ward: string | null;
  panchayath_id: string;
  panchayath_name: string | null;
  district: string | null;
}

export interface VirtualOfficeProfile {
  id: string;
  name: string;
  mobile: string;
  role: string;
  ward: string | null;
  panchayath_id: string;
}

export interface VirtualOfficeDashboardResponse {
  agent: VirtualOfficeProfile;
  allocatedPanchayaths: VirtualOfficePanchayath[];
  directReports: VirtualOfficeTeamMember[];
}

export interface MagicWordRecord {
  id: string;
  panchayath_id: string;
  word_date: string;
  content_type: "word" | "offer" | "scheme" | "post" | "poster";
  title: string;
  body: string;
  seen: boolean;
  seen_at: string | null;
  seen_count: number;
}

export interface MagicWordViewer {
  name: string;
  role: string;
  ward: string | null;
  seen_at: string;
}

export async function invokeVirtualOfficeAction<T>(
  action: string,
  payload: Record<string, unknown> = {},
  credentials: { agentToken?: string | null; adminToken?: string | null } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (credentials.agentToken) headers["x-samrabhaka-token"] = credentials.agentToken;
  if (credentials.adminToken) headers["x-admin-token"] = credentials.adminToken;

  const { data, error } = await supabase.functions.invoke("samrabhaka-auth", {
    body: { action, ...payload },
    headers,
  });
  if (error || data?.error) {
    throw new Error(data?.error || error?.message || "The Virtual Office request failed.");
  }
  return data as T;
}