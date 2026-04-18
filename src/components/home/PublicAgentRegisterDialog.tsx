import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { getParentRole } from "@/hooks/usePennyekartAgents";

const ROLE_OPTIONS = [
  { value: "pro", label: "PRO" },
  { value: "group_leader", label: "Group Leader" },
  { value: "coordinator", label: "Coordinator" },
  { value: "team_leader", label: "Team Leader" },
] as const;

const ROLE_LABELS: Record<string, string> = {
  team_leader: "Team Leader",
  coordinator: "Coordinator",
  group_leader: "Group Leader",
  pro: "PRO",
};

const schema = z
  .object({
    name: z.string().trim().min(2, "Name is too short").max(100),
    mobile: z.string().trim().regex(/^\d{10}$/, "Enter 10-digit mobile"),
    panchayath_id: z.string().uuid("Select panchayath"),
    ward: z.string().trim().min(1, "Ward required").max(20),
    role: z.enum(["pro", "group_leader", "coordinator", "team_leader"]),
    parent_agent_id: z.string().uuid().nullable().optional(),
  })
  .refine(
    (d) => d.role === "team_leader" || !!d.parent_agent_id,
    {
      message: "Please select a parent (Reports To)",
      path: ["parent_agent_id"],
    }
  );

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaultMobile?: string;
}

interface ParentAgent {
  id: string;
  name: string;
  role: string;
  ward: string;
  responsible_wards: string[] | null;
}

export function PublicAgentRegisterDialog({ open, onOpenChange, defaultMobile = "" }: Props) {
  const [panchayaths, setPanchayaths] = useState<{ id: string; name: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [parents, setParents] = useState<ParentAgent[]>([]);
  const [loadingParents, setLoadingParents] = useState(false);
  const [form, setForm] = useState({
    name: "",
    mobile: defaultMobile,
    panchayath_id: "",
    ward: "",
    role: "pro" as (typeof ROLE_OPTIONS)[number]["value"],
    parent_agent_id: "" as string,
  });

  useEffect(() => {
    if (open) {
      setForm((f) => ({ ...f, mobile: defaultMobile }));
      supabase
        .from("panchayaths")
        .select("id, name")
        .eq("is_active", true)
        .order("name")
        .then(({ data }) => setPanchayaths(data || []));
    }
  }, [open, defaultMobile]);

  // Auto-fetch potential parent agents based on role + panchayath + ward
  useEffect(() => {
    const parentRole = getParentRole(form.role);
    if (!parentRole || !form.panchayath_id) {
      setParents([]);
      setForm((f) => ({ ...f, parent_agent_id: "" }));
      return;
    }

    setLoadingParents(true);
    supabase
      .from("pennyekart_agents")
      .select("id, name, role, ward, responsible_wards")
      .eq("panchayath_id", form.panchayath_id)
      .eq("role", parentRole)
      .eq("is_active", true)
      .order("name")
      .then(({ data }) => {
        const all = (data as ParentAgent[]) || [];
        // Filter by ward when applicable:
        // - parent group_leader / team_leader: match exact ward
        // - parent coordinator: ward must be in responsible_wards
        let filtered = all;
        if (form.ward) {
          if (parentRole === "coordinator") {
            filtered = all.filter((a) =>
              (a.responsible_wards || []).includes(form.ward)
            );
          } else {
            filtered = all.filter((a) => a.ward === form.ward);
          }
        }
        setParents(filtered);
        // Auto-select if only one match
        setForm((f) => ({
          ...f,
          parent_agent_id: filtered.length === 1 ? filtered[0].id : "",
        }));
        setLoadingParents(false);
      });
  }, [form.role, form.panchayath_id, form.ward]);

  const panchayathOptions = useMemo(
    () => panchayaths.map((p) => ({ value: p.id, label: p.name })),
    [panchayaths]
  );

  const parentRole = getParentRole(form.role);

  const handleSubmit = async () => {
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast({
        title: "Invalid details",
        description: parsed.error.issues[0].message,
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const { data: dup } = await supabase
        .from("pennyekart_agents")
        .select("id")
        .eq("mobile", parsed.data.mobile)
        .limit(1);
      if (dup && dup.length > 0) {
        toast({
          title: "Already registered",
          description: "This mobile number is already in our system.",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase.from("pennyekart_agents").insert({
        name: parsed.data.name,
        mobile: parsed.data.mobile,
        panchayath_id: parsed.data.panchayath_id,
        ward: parsed.data.ward,
        role: parsed.data.role,
        parent_agent_id: parsed.data.parent_agent_id || null,
        is_active: false,
      });

      if (error) throw error;

      toast({
        title: "Registration submitted",
        description: "Your application is pending admin approval.",
      });
      onOpenChange(false);
    } catch (err: any) {
      toast({
        title: "Failed to register",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Become an Agent</DialogTitle>
          <DialogDescription>
            No record was found. Register here — your application will be reviewed by an admin.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="reg-name">Full Name</Label>
            <Input
              id="reg-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Your full name"
            />
          </div>

          <div>
            <Label htmlFor="reg-mobile">Mobile</Label>
            <Input
              id="reg-mobile"
              type="tel"
              value={form.mobile}
              onChange={(e) =>
                setForm({ ...form, mobile: e.target.value.replace(/\D/g, "").slice(0, 10) })
              }
              placeholder="10-digit mobile"
            />
          </div>

          <div>
            <Label>Preferred Role</Label>
            <Select
              value={form.role}
              onValueChange={(v) =>
                setForm({ ...form, role: v as typeof form.role, parent_agent_id: "" })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Panchayath</Label>
            <SearchableSelect
              options={panchayathOptions}
              value={form.panchayath_id}
              onValueChange={(v) =>
                setForm({ ...form, panchayath_id: v, parent_agent_id: "" })
              }
              placeholder="Select panchayath"
            />
          </div>

          <div>
            <Label htmlFor="reg-ward">Ward</Label>
            <Input
              id="reg-ward"
              value={form.ward}
              onChange={(e) =>
                setForm({ ...form, ward: e.target.value, parent_agent_id: "" })
              }
              placeholder="Ward number / name"
            />
          </div>

          {parentRole && (
            <div>
              <Label>Reports To ({ROLE_LABELS[parentRole]})</Label>
              <Select
                value={form.parent_agent_id}
                onValueChange={(v) => setForm({ ...form, parent_agent_id: v })}
                disabled={!form.panchayath_id || loadingParents}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      !form.panchayath_id
                        ? "Select panchayath first"
                        : loadingParents
                          ? "Loading..."
                          : parents.length === 0
                            ? `No ${ROLE_LABELS[parentRole]} found for this ward`
                            : `Select ${ROLE_LABELS[parentRole]}`
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {parents.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} — Ward {p.ward}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.panchayath_id && form.ward && !loadingParents && parents.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  No active {ROLE_LABELS[parentRole]} is assigned to this panchayath/ward yet.
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
