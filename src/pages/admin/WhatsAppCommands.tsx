import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  MessageSquare,
  Plus,
  Pencil,
  Trash2,
  ArrowLeft,
  Loader2,
  Info,
} from "lucide-react";

interface BotCommand {
  id: string;
  keyword: string;
  alt_keyword: string | null;
  label: string;
  response_text: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface CommandFormData {
  keyword: string;
  alt_keyword: string;
  label: string;
  response_text: string;
  sort_order: number;
  is_active: boolean;
}

const CORE_COMMANDS = [
  { keyword: "1", label: "Submit daily work log", description: "1 <work details>" },
  { keyword: "2", label: "View reporting person details", description: "2 or status" },
  { keyword: "3", label: "Show help message", description: "3, help, hi, hello" },
  { keyword: "4", label: "Check wallet balance", description: "4 or balance" },
  { keyword: "5", label: "Work log absence report (all agents)", description: "5" },
  { keyword: "6", label: "Coordinator absence report", description: "6 → select panchayath → report" },
  { keyword: "7", label: "Group Leader absence report", description: "7 → select panchayath → report" },
];

const emptyForm: CommandFormData = {
  keyword: "",
  alt_keyword: "",
  label: "",
  response_text: "",
  sort_order: 0,
  is_active: true,
};

export default function WhatsAppCommands() {
  const { isSuperAdmin } = useAuth();
  const { toast } = useToast();
  const [commands, setCommands] = useState<BotCommand[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState<CommandFormData>(emptyForm);
  const [saving, setSaving] = useState(false);

  if (!isSuperAdmin) return <Navigate to="/unauthorized" replace />;

  const fetchCommands = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("whatsapp_bot_commands")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setCommands((data as any[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchCommands(); }, []);

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...emptyForm, sort_order: commands.length + 5 });
    setDialogOpen(true);
  };

  const openEdit = (cmd: BotCommand) => {
    setEditingId(cmd.id);
    setForm({
      keyword: cmd.keyword,
      alt_keyword: cmd.alt_keyword || "",
      label: cmd.label,
      response_text: cmd.response_text,
      sort_order: cmd.sort_order,
      is_active: cmd.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.keyword.trim() || !form.label.trim() || !form.response_text.trim()) {
      toast({ title: "Required", description: "Keyword, Label, and Response Text are required.", variant: "destructive" });
      return;
    }
    // Block core keywords
    const reserved = ["1", "2", "3", "4", "5", "6", "7", "help", "hi", "hello", "status", "balance"];
    if (!editingId && reserved.includes(form.keyword.trim().toLowerCase())) {
      toast({ title: "Reserved", description: "This keyword is reserved for core commands.", variant: "destructive" });
      return;
    }

    setSaving(true);
    const payload = {
      keyword: form.keyword.trim(),
      alt_keyword: form.alt_keyword.trim() || null,
      label: form.label.trim(),
      response_text: form.response_text.trim(),
      sort_order: form.sort_order,
      is_active: form.is_active,
    };

    let error;
    if (editingId) {
      ({ error } = await supabase.from("whatsapp_bot_commands").update(payload).eq("id", editingId));
    } else {
      ({ error } = await supabase.from("whatsapp_bot_commands").insert(payload));
    }

    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: editingId ? "Updated" : "Created", description: `Command "${payload.keyword}" saved.` });
      setDialogOpen(false);
      fetchCommands();
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    const { error } = await supabase.from("whatsapp_bot_commands").delete().eq("id", deletingId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Deleted", description: "Command removed." });
      fetchCommands();
    }
    setDeleteDialogOpen(false);
    setDeletingId(null);
  };

  return (
    <Layout>
      <div className="container py-6 sm:py-8 max-w-4xl">
        <div className="flex items-center gap-2 mb-6">
          <Button asChild variant="ghost" size="sm">
            <Link to="/super-admin"><ArrowLeft className="h-4 w-4 mr-1" />Back</Link>
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <MessageSquare className="h-6 w-6 text-primary" />
              WhatsApp Bot Commands
            </h1>
            <p className="text-sm text-muted-foreground">Manage dynamic WhatsApp bot responses</p>
          </div>
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4 mr-1.5" />Add Command
          </Button>
        </div>

        {/* Core Commands Info */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Info className="h-4 w-4 text-muted-foreground" />
              Core Commands (Read-only)
            </CardTitle>
            <CardDescription className="text-xs">These are built-in and cannot be changed</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2">
              {CORE_COMMANDS.map((c) => (
                <div key={c.keyword} className="flex items-center gap-3 p-2 rounded border bg-muted/30">
                  <Badge variant="secondary" className="font-mono">{c.keyword}</Badge>
                  <div>
                    <p className="text-sm font-medium">{c.label}</p>
                    <p className="text-xs text-muted-foreground">{c.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Custom Commands */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Custom Commands</CardTitle>
            <CardDescription className="text-xs">Add keywords that agents can use via WhatsApp</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : commands.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No custom commands yet. Click "Add Command" to create one.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Keyword</TableHead>
                      <TableHead className="text-xs">Alt</TableHead>
                      <TableHead className="text-xs">Label</TableHead>
                      <TableHead className="text-xs hidden sm:table-cell">Response</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {commands.map((cmd) => (
                      <TableRow key={cmd.id}>
                        <TableCell className="font-mono text-sm font-medium">{cmd.keyword}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{cmd.alt_keyword || "—"}</TableCell>
                        <TableCell className="text-sm">{cmd.label}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate hidden sm:table-cell">
                          {cmd.response_text}
                        </TableCell>
                        <TableCell>
                          <Badge variant={cmd.is_active ? "default" : "secondary"} className="text-xs">
                            {cmd.is_active ? "Active" : "Off"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(cmd)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => { setDeletingId(cmd.id); setDeleteDialogOpen(true); }}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Command" : "Add Command"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Keyword *</Label>
                <Input placeholder="5" value={form.keyword} onChange={(e) => setForm({ ...form, keyword: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Alt Keyword</Label>
                <Input placeholder="offers" value={form.alt_keyword} onChange={(e) => setForm({ ...form, alt_keyword: e.target.value })} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Label *</Label>
              <Input placeholder="View Current Offers" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Response Text *</Label>
              <Textarea
                placeholder="🎉 *Current Offers*&#10;&#10;• 10% off on all groceries..."
                value={form.response_text}
                onChange={(e) => setForm({ ...form, response_text: e.target.value })}
                rows={5}
              />
              <p className="text-[10px] text-muted-foreground mt-1">Supports WhatsApp formatting: *bold*, _italic_</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Sort Order</Label>
                <Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="flex items-center gap-2 pt-5">
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                <Label className="text-xs">Active</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              {editingId ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Command?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
