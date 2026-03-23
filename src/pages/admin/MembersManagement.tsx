import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Plus, ArrowLeft, AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

interface Member {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  panchayath?: { name: string };
  cluster?: { name: string };
  division?: { name: string };
}

interface Panchayath {
  id: string;
  name: string;
}

interface Cluster {
  id: string;
  name: string;
  panchayath_id: string;
}

interface Division {
  id: string;
  name: string;
}

export default function MembersManagement() {
  const [members, setMembers] = useState<Member[]>([]);
  const [panchayaths, setPanchayaths] = useState<Panchayath[]>([]);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [filteredClusters, setFilteredClusters] = useState<Cluster[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const [newFullName, setNewFullName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [selectedPanchayath, setSelectedPanchayath] = useState("");
  const [selectedCluster, setSelectedCluster] = useState("");
  const [selectedDivision, setSelectedDivision] = useState("");

  const { user, isSuperAdmin } = useAuth();
  const { toast } = useToast();

  const fetchMembers = async () => {
    const { data, error } = await supabase
      .from("members")
      .select(`
        *,
        panchayath:panchayaths(name),
        cluster:clusters(name),
        division:divisions(name)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching members:", error);
      return;
    }

    setMembers(data || []);
  };

  const fetchLocations = async () => {
    const [panchayathRes, clusterRes, divisionRes] = await Promise.all([
      supabase.from("panchayaths").select("id, name").eq("is_active", true).order("name"),
      supabase.from("clusters").select("id, name, panchayath_id").eq("is_active", true).order("name"),
      supabase.from("divisions").select("id, name").eq("is_active", true).order("name"),
    ]);

    if (!panchayathRes.error) setPanchayaths(panchayathRes.data || []);
    if (!clusterRes.error) setClusters(clusterRes.data || []);
    if (!divisionRes.error) setDivisions(divisionRes.data || []);
  };

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchMembers(), fetchLocations()]);
      setIsLoading(false);
    };
    loadData();
  }, []);

  // Filter clusters when panchayath changes
  useEffect(() => {
    if (selectedPanchayath) {
      const filtered = clusters.filter(c => c.panchayath_id === selectedPanchayath);
      setFilteredClusters(filtered);
      setSelectedCluster("");
    } else {
      setFilteredClusters([]);
    }
  }, [selectedPanchayath, clusters]);

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const { error: insertError } = await supabase
        .from("members")
        .insert({
          full_name: newFullName,
          email: newEmail || null,
          phone: newPhone || null,
          panchayath_id: selectedPanchayath,
          cluster_id: selectedCluster,
          division_id: selectedDivision,
          added_by: user?.id,
        });

      if (insertError) throw insertError;

      toast({
        title: "Member added",
        description: "New member has been added successfully.",
      });

      setIsDialogOpen(false);
      resetForm();
      fetchMembers();
    } catch (err: any) {
      setError(err.message || "Failed to add member");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setNewFullName("");
    setNewEmail("");
    setNewPhone("");
    setSelectedPanchayath("");
    setSelectedCluster("");
    setSelectedDivision("");
    setError("");
  };

  const toggleMemberStatus = async (memberId: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from("members")
      .update({ is_active: !currentStatus })
      .eq("id", memberId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update member status",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Status updated",
      description: `Member has been ${!currentStatus ? "activated" : "deactivated"}.`,
    });

    fetchMembers();
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="container py-8 flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container py-8">
        <div className="flex items-center gap-4 mb-6">
          <Button asChild variant="ghost" size="icon">
            <Link to="/dashboard">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-foreground">Manage Members</h1>
            <p className="text-muted-foreground">
              Add and manage cluster members
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Member</DialogTitle>
                <DialogDescription>
                  Add a new member to a cluster
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateMember} className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name *</Label>
                  <Input
                    id="fullName"
                    value={newFullName}
                    onChange={(e) => setNewFullName(e.target.value)}
                    placeholder="Member name"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="member@example.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="+91 9876543210"
                  />
                </div>

                {isSuperAdmin && (
                  <div className="space-y-2">
                    <Label htmlFor="division">Division *</Label>
                    <Select
                      value={selectedDivision}
                      onValueChange={setSelectedDivision}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a division" />
                      </SelectTrigger>
                      <SelectContent>
                        {divisions.map((division) => (
                          <SelectItem key={division.id} value={division.id}>
                            {division.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="panchayath">Panchayath *</Label>
                  <SearchableSelect
                    options={panchayaths.map((p) => ({ value: p.id, label: p.name }))}
                    value={selectedPanchayath}
                    onValueChange={setSelectedPanchayath}
                    placeholder="Select a panchayath"
                    searchPlaceholder="Search panchayath..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cluster">Cluster *</Label>
                  <Select
                    value={selectedCluster}
                    onValueChange={setSelectedCluster}
                    disabled={!selectedPanchayath}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={selectedPanchayath ? "Select a cluster" : "Select panchayath first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredClusters.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      "Add Member"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="rounded-lg border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Division</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No members found. Add your first member to get started.
                  </TableCell>
                </TableRow>
              ) : (
                members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">
                      {member.full_name}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {member.email && <div>{member.email}</div>}
                        {member.phone && <div className="text-muted-foreground">{member.phone}</div>}
                        {!member.email && !member.phone && <span className="text-muted-foreground">N/A</span>}
                      </div>
                    </TableCell>
                    <TableCell>{member.division?.name || "N/A"}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{member.panchayath?.name}</div>
                        <div className="text-muted-foreground">{member.cluster?.name}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          member.is_active
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {member.is_active ? "Active" : "Inactive"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleMemberStatus(member.id, member.is_active ?? true)}
                      >
                        {member.is_active ? "Deactivate" : "Activate"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </Layout>
  );
}
