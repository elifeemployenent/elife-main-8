import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { Loader2, Plus, Pencil, Trash2, Search, Phone, MapPin } from "lucide-react";
import { toast } from "sonner";
import { useAgentDirectCustomers, type AgentDirectCustomer } from "@/hooks/useAgentDirectCustomers";
import { DirectCustomerFormDialog } from "./DirectCustomerFormDialog";
import type { PennyekartAgent } from "@/hooks/usePennyekartAgents";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: PennyekartAgent;
  callerMobile?: string;
}

export function AgentDirectCustomersDialog({ open, onOpenChange, agent, callerMobile }: Props) {
  const { customers, isLoading, error, create, update, remove } = useAgentDirectCustomers(open ? agent.id : null, callerMobile);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AgentDirectCustomer | null>(null);
  const [toDelete, setToDelete] = useState<AgentDirectCustomer | null>(null);
  const [search, setSearch] = useState("");

  const filtered = customers.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.mobile.includes(q) ||
      (c.ward || "").toLowerCase().includes(q)
    );
  });

  const handleDelete = async () => {
    if (!toDelete) return;
    const { error } = await remove(toDelete.id);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Customer removed");
    setToDelete(null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Direct Customers
              <Badge variant="secondary">{customers.length}</Badge>
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              {agent.name} · {agent.mobile}
            </p>
          </DialogHeader>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search name, mobile or ward"
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
              size="sm"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Add
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto -mx-1 px-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : error ? (
              <div className="text-center py-10 text-sm text-destructive">{error}</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-10 text-sm text-muted-foreground">
                {customers.length === 0 ? "No direct customers yet. Click Add to create one." : "No matches."}
              </div>
            ) : (
              <ul className="space-y-2">
                {filtered.map((c) => (
                  <li key={c.id} className="border rounded-md p-3 flex items-start justify-between gap-3 hover:bg-muted/40">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{c.name}</div>
                      <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {c.mobile}
                        </span>
                        {c.ward && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            Ward {c.ward}
                          </span>
                        )}
                      </div>
                      {c.address && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{c.address}</div>}
                      {c.notes && <div className="text-xs italic text-muted-foreground mt-1 line-clamp-2">"{c.notes}"</div>}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => {
                          setEditing(c);
                          setFormOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setToDelete(c)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <DirectCustomerFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        initialCustomer={editing}
        onSubmit={(data) => (editing ? update(editing.id, data) : create(data))}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove customer?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove {toDelete?.name} from {agent.name}'s direct customer list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}