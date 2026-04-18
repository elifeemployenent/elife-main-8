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

const ROLE_OPTIONS = [
  { value: "pro", label: "PRO" },
  { value: "group_leader", label: "Group Leader" },
  { value: "coordinator", label: "Coordinator" },
  { value: "team_leader", label: "Team Leader" },
] as const;

const schema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(100),
  mobile: z.string().trim().regex(/^\d{10}$/, "Enter 10-digit mobile"),
  panchayath_id: z.string().uuid("Select panchayath"),
  ward: z.string().trim().min(1, "Ward required").max(20),
  role: z.enum(["pro", "group_leader", "coordinator", "team_leader"]),
});

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaultMobile?: string;
}

export function PublicAgentRegisterDialog({ open, onOpenChange, defaultMobile = "" }: Props) {
  const [panchayaths, setPanchayaths] = useState<{ id: string; name: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    mobile: defaultMobile,
    panchayath_id: "",
    ward: "",
    role: "pro" as (typeof ROLE_OPTIONS)[number]["value"],
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

  const panchayathOptions = useMemo(
    () => panchayaths.map((p) => ({ value: p.id, label: p.name })),
    [panchayaths]
  );

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
      // Duplicate mobile check
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
      <DialogContent className="sm:max-w-md">
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
            <Label>Panchayath</Label>
            <SearchableSelect
              options={panchayathOptions}
              value={form.panchayath_id}
              onValueChange={(v) => setForm({ ...form, panchayath_id: v })}
              placeholder="Select panchayath"
            />
          </div>

          <div>
            <Label htmlFor="reg-ward">Ward</Label>
            <Input
              id="reg-ward"
              value={form.ward}
              onChange={(e) => setForm({ ...form, ward: e.target.value })}
              placeholder="Ward number / name"
            />
          </div>

          <div>
            <Label>Preferred Role</Label>
            <Select
              value={form.role}
              onValueChange={(v) => setForm({ ...form, role: v as typeof form.role })}
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
