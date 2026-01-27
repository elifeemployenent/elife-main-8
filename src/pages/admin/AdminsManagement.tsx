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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Loader2, Plus, ArrowLeft, AlertCircle, Pencil, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

interface Admin {
  id: string;
  user_id: string | null;
  division_id: string;
  is_active: boolean;
  created_at: string;
  phone?: string;
  full_name?: string;
  division?: {
    name: string;
  };
}

interface Division {
  id: string;
  name: string;
}

export default function AdminsManagement() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [editError, setEditError] = useState("");

  // Form state for create
  const [newPassword, setNewPassword] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [selectedDivision, setSelectedDivision] = useState("");

  // Form state for edit
  const [editingAdmin, setEditingAdmin] = useState<Admin | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editDivision, setEditDivision] = useState("");

  // Delete state
  const [deletingAdmin, setDeletingAdmin] = useState<Admin | null>(null);

  const { user } = useAuth();
  const { toast } = useToast();

  const fetchAdmins = async () => {
    const { data, error } = await supabase
      .from("admins")
      .select(`
        *,
        division:divisions(name)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching admins:", error);
      return;
    }

    setAdmins(data || []);
  };

  const fetchDivisions = async () => {
    const { data, error } = await supabase
      .from("divisions")
      .select("id, name")
      .eq("is_active", true)
      .order("name");

    if (error) {
      console.error("Error fetching divisions:", error);
      return;
    }

    setDivisions(data || []);
  };

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchAdmins(), fetchDivisions()]);
      setIsLoading(false);
    };
    loadData();
  }, []);

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      // Validate phone
      if (!newPhone || newPhone.length < 10) {
        throw new Error("Please enter a valid phone number");
      }

      // Validate password
      if (!newPassword || newPassword.length < 6) {
        throw new Error("Password must be at least 6 characters");
      }

      // Check if phone already exists
      const normalizedPhone = newPhone.replace(/\s+/g, "").trim();
      const { data: existingAdmin } = await supabase
        .from("admins")
        .select("id")
        .eq("phone", normalizedPhone)
        .single();

      if (existingAdmin) {
        throw new Error("An admin with this phone number already exists");
      }

      // Hash the password for phone-based login
      const encoder = new TextEncoder();
      const data = encoder.encode(newPassword);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const passwordHash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

      // Add admin record with division assignment, phone, password hash, and full_name
      const { error: adminError } = await supabase
        .from("admins")
        .insert({
          division_id: selectedDivision,
          created_by: user?.id,
          phone: normalizedPhone,
          password_hash: passwordHash,
          full_name: newFullName,
        } as any);

      if (adminError) throw adminError;

      toast({
        title: "Admin created",
        description: "New admin has been created successfully. They can login with their phone number.",
      });

      setIsDialogOpen(false);
      resetForm();
      fetchAdmins();
    } catch (err: any) {
      setError(err.message || "Failed to create admin");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setNewPassword("");
    setNewFullName("");
    setNewPhone("");
    setSelectedDivision("");
    setError("");
  };

  const openEditDialog = (admin: Admin) => {
    setEditingAdmin(admin);
    setEditFullName(admin.full_name || "");
    setEditPhone(admin.phone || "");
    setEditPassword("");
    setEditDivision(admin.division_id);
    setEditError("");
    setIsEditDialogOpen(true);
  };

  const handleEditAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAdmin) return;
    
    setEditError("");
    setIsSubmitting(true);

    try {
      const normalizedPhone = editPhone.replace(/\s+/g, "").trim();
      
      // Check if phone already exists for another admin
      if (normalizedPhone !== editingAdmin.phone) {
        const { data: existingAdmin } = await supabase
          .from("admins")
          .select("id")
          .eq("phone", normalizedPhone)
          .neq("id", editingAdmin.id)
          .single();

        if (existingAdmin) {
          throw new Error("An admin with this phone number already exists");
        }
      }

      const updateData: any = {
        full_name: editFullName,
        phone: normalizedPhone,
        division_id: editDivision,
      };

      // Only update password if provided
      if (editPassword) {
        if (editPassword.length < 6) {
          throw new Error("Password must be at least 6 characters");
        }
        const encoder = new TextEncoder();
        const data = encoder.encode(editPassword);
        const hashBuffer = await crypto.subtle.digest("SHA-256", data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        updateData.password_hash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
      }

      const { error } = await supabase
        .from("admins")
        .update(updateData)
        .eq("id", editingAdmin.id);

      if (error) throw error;

      toast({
        title: "Admin updated",
        description: "Admin details have been updated successfully.",
      });

      setIsEditDialogOpen(false);
      setEditingAdmin(null);
      fetchAdmins();
    } catch (err: any) {
      setEditError(err.message || "Failed to update admin");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAdmin = async () => {
    if (!deletingAdmin) return;
    
    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from("admins")
        .delete()
        .eq("id", deletingAdmin.id);

      if (error) throw error;

      toast({
        title: "Admin deleted",
        description: "Admin has been permanently deleted.",
      });

      setIsDeleteDialogOpen(false);
      setDeletingAdmin(null);
      fetchAdmins();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to delete admin",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleAdminStatus = async (adminId: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from("admins")
      .update({ is_active: !currentStatus })
      .eq("id", adminId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update admin status",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Status updated",
      description: `Admin has been ${!currentStatus ? "activated" : "deactivated"}.`,
    });

    fetchAdmins();
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
            <h1 className="text-3xl font-bold text-foreground">Manage Admins</h1>
            <p className="text-muted-foreground">
              Create and manage division administrators
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Admin
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Create New Admin</DialogTitle>
                <DialogDescription>
                  Add a new administrator for a division
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateAdmin} className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input
                      id="fullName"
                      value={newFullName}
                      onChange={(e) => setNewFullName(e.target.value)}
                      placeholder="John Doe"
                      required
                    />
                  </div>


                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number (for login)</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      placeholder="+91 9876543210"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      minLength={6}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="division">Division</Label>
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
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
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
                      "Create Admin"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <Table className="min-w-[800px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Name</TableHead>
                  <TableHead className="w-[150px]">Phone</TableHead>
                  <TableHead className="w-[150px]">Division</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead className="w-[120px]">Created</TableHead>
                  <TableHead className="w-[100px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {admins.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No admins found. Create your first admin to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  admins.map((admin) => (
                    <TableRow key={admin.id}>
                      <TableCell className="font-medium whitespace-nowrap">
                        {admin.full_name || "N/A"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{admin.phone || "N/A"}</TableCell>
                      <TableCell className="whitespace-nowrap">{admin.division?.name || "N/A"}</TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-medium rounded-full whitespace-nowrap ${
                            admin.is_active
                              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                              : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                          }`}
                        >
                          {admin.is_active ? "Active" : "Inactive"}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {new Date(admin.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(admin)}
                            title="Edit admin"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setDeletingAdmin(admin);
                              setIsDeleteDialogOpen(true);
                            }}
                            title="Delete admin"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleAdminStatus(admin.id, admin.is_active ?? true)}
                          >
                            {admin.is_active ? "Deactivate" : "Activate"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Edit Admin Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) {
            setEditingAdmin(null);
            setEditError("");
          }
        }}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Edit Admin</DialogTitle>
              <DialogDescription>
                Update administrator details
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleEditAdmin} className="space-y-4">
              {editError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{editError}</AlertDescription>
                </Alert>
              )}

              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="editFullName">Full Name</Label>
                  <Input
                    id="editFullName"
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                    placeholder="John Doe"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="editPhone">Phone Number</Label>
                  <Input
                    id="editPhone"
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="+91 9876543210"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="editPassword">New Password (leave blank to keep current)</Label>
                  <Input
                    id="editPassword"
                    type="password"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="editDivision">Division</Label>
                  <Select
                    value={editDivision}
                    onValueChange={setEditDivision}
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
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Admin</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {deletingAdmin?.full_name || "this admin"}? 
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeletingAdmin(null)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteAdmin}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}
