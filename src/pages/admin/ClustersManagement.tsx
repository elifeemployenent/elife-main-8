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
import { Loader2, Plus, ArrowLeft, AlertCircle, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { SearchableSelect } from "@/components/ui/searchable-select";

interface Cluster {
  id: string;
  name: string;
  name_ml: string | null;
  panchayath_id: string;
  is_active: boolean | null;
  created_at: string | null;
  panchayath?: {
    name: string;
  };
  member_count?: number;
}

interface Panchayath {
  id: string;
  name: string;
}

export default function ClustersManagement() {
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [panchayaths, setPanchayaths] = useState<Panchayath[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const [clusterName, setClusterName] = useState("");
  const [clusterNameMl, setClusterNameMl] = useState("");
  const [selectedPanchayath, setSelectedPanchayath] = useState("");

  const { adminData, isSuperAdmin } = useAuth();
  const { toast } = useToast();

  const fetchPanchayaths = async () => {
    const { data, error } = await supabase
      .from("panchayaths")
      .select("id, name")
      .eq("is_active", true)
      .order("name");

    if (error) {
      console.error("Error fetching panchayaths:", error);
      return;
    }

    setPanchayaths(data || []);
  };

  const fetchClusters = async () => {
    let query = supabase
      .from("clusters")
      .select(`
        *,
        panchayath:panchayaths(name)
      `)
      .order("name");

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching clusters:", error);
      return;
    }

    // Get member counts for each cluster
    const clustersWithCounts = await Promise.all(
      (data || []).map(async (cluster) => {
        const { count } = await supabase
          .from("members")
          .select("*", { count: "exact", head: true })
          .eq("cluster_id", cluster.id);
        
        return { ...cluster, member_count: count || 0 };
      })
    );

    setClusters(clustersWithCounts);
  };

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchPanchayaths(), fetchClusters()]);
      setIsLoading(false);
    };
    loadData();
  }, []);

  const handleCreateCluster = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      if (!selectedPanchayath) {
        throw new Error("Please select a panchayath");
      }

      const { error: insertError } = await supabase
        .from("clusters")
        .insert({
          name: clusterName.trim(),
          name_ml: clusterNameMl.trim() || null,
          panchayath_id: selectedPanchayath,
        });

      if (insertError) throw insertError;

      toast({
        title: "Cluster created",
        description: "New cluster has been added successfully.",
      });

      setIsDialogOpen(false);
      resetForm();
      fetchClusters();
    } catch (err: any) {
      setError(err.message || "Failed to create cluster");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setClusterName("");
    setClusterNameMl("");
    setSelectedPanchayath("");
    setError("");
  };

  const toggleClusterStatus = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from("clusters")
      .update({ is_active: !currentStatus })
      .eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update cluster status",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Status updated",
      description: `Cluster has been ${!currentStatus ? "activated" : "deactivated"}.`,
    });

    fetchClusters();
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
            <h1 className="text-3xl font-bold text-foreground">Manage Clusters</h1>
            <p className="text-muted-foreground">
              Create and manage clusters within panchayaths
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Cluster
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Cluster</DialogTitle>
                <DialogDescription>
                  Add a new cluster under a panchayath
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateCluster} className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="clusterName">Name (English)</Label>
                  <Input
                    id="clusterName"
                    value={clusterName}
                    onChange={(e) => setClusterName(e.target.value)}
                    placeholder="Cluster name"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="clusterNameMl">Name (Malayalam)</Label>
                  <Input
                    id="clusterNameMl"
                    value={clusterNameMl}
                    onChange={(e) => setClusterNameMl(e.target.value)}
                    placeholder="ക്ലസ്റ്റർ പേര്"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="selectPanchayath">Panchayath</Label>
                  <SearchableSelect
                    options={panchayaths.map((p) => ({ value: p.id, label: p.name }))}
                    value={selectedPanchayath}
                    onValueChange={setSelectedPanchayath}
                    placeholder="Select a panchayath"
                    searchPlaceholder="Search panchayath..."
                  />
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
                        Creating...
                      </>
                    ) : (
                      "Create Cluster"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Name (ML)</TableHead>
                <TableHead>Panchayath</TableHead>
                <TableHead>Members</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clusters.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No clusters found. Create your first cluster to get started.
                  </TableCell>
                </TableRow>
              ) : (
                clusters.map((cluster) => (
                  <TableRow key={cluster.id}>
                    <TableCell className="font-medium">{cluster.name}</TableCell>
                    <TableCell>{cluster.name_ml || "-"}</TableCell>
                    <TableCell>{cluster.panchayath?.name || "-"}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        {cluster.member_count}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          cluster.is_active
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {cluster.is_active ? "Active" : "Inactive"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleClusterStatus(cluster.id, cluster.is_active ?? true)}
                      >
                        {cluster.is_active ? "Deactivate" : "Activate"}
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
