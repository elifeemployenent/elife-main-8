import { useState, useRef } from "react";
import { Layout } from "@/components/layout/Layout";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Upload, FileSpreadsheet, Loader2, Trash2, CheckCircle2, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import * as XLSX from "xlsx";

interface ParsedRow {
  [key: string]: string | number | null;
}

interface ColumnMapping {
  name: string;
  mobile: string;
  category: string;
  fee_paid: string;
  approved_by: string;
  approved_date: string;
}

const REQUIRED_FIELDS = ["name", "mobile"] as const;
const OPTIONAL_FIELDS = ["category", "fee_paid", "approved_by", "approved_date"] as const;
const FIELD_LABELS: Record<string, string> = {
  name: "Name",
  mobile: "Mobile Number",
  category: "Category",
  fee_paid: "Fee Paid",
  approved_by: "Approved By",
  approved_date: "Approved Date",
};

export default function OldPaymentsUpload() {
  const { isSuperAdmin } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({
    name: "", mobile: "", category: "", fee_paid: "", approved_by: "", approved_date: "",
  });
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedCount, setUploadedCount] = useState<number | null>(null);
  const [existingBatches, setExistingBatches] = useState<{ batch_id: string; count: number; created_at: string }[]>([]);
  const [isLoadingBatches, setIsLoadingBatches] = useState(false);

  if (!isSuperAdmin) return <Navigate to="/unauthorized" replace />;

  const loadBatches = async () => {
    setIsLoadingBatches(true);
    const { data } = await supabase
      .from("old_payments")
      .select("batch_id, created_at")
      .order("created_at", { ascending: false });

    if (data) {
      const batchMap = new Map<string, { count: number; created_at: string }>();
      data.forEach((r: any) => {
        const key = r.batch_id;
        if (!batchMap.has(key)) batchMap.set(key, { count: 0, created_at: r.created_at });
        batchMap.get(key)!.count++;
      });
      setExistingBatches(Array.from(batchMap.entries()).map(([batch_id, v]) => ({ batch_id, ...v })));
    }
    setIsLoadingBatches(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = evt.target?.result;
      const wb = XLSX.read(data, { type: "binary" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<ParsedRow>(ws, { defval: "" });

      if (json.length === 0) {
        toast({ title: "Empty file", description: "No data rows found", variant: "destructive" });
        return;
      }

      const cols = Object.keys(json[0]);
      setHeaders(cols);
      setRows(json);
      setUploadedCount(null);

      // Auto-map by common names
      const autoMap: ColumnMapping = { name: "", mobile: "", category: "", fee_paid: "", approved_by: "", approved_date: "" };
      cols.forEach((col) => {
        const lower = col.toLowerCase().replace(/[^a-z]/g, "");
        if (lower.includes("name") && !autoMap.name) autoMap.name = col;
        if ((lower.includes("mobile") || lower.includes("phone")) && !autoMap.mobile) autoMap.mobile = col;
        if ((lower.includes("category") || lower.includes("division")) && !autoMap.category) autoMap.category = col;
        if ((lower.includes("fee") || lower.includes("amount") || lower.includes("paid")) && !autoMap.fee_paid) autoMap.fee_paid = col;
        if (lower.includes("approved") && lower.includes("by") && !autoMap.approved_by) autoMap.approved_by = col;
        if (lower.includes("approved") && lower.includes("date") && !autoMap.approved_date) autoMap.approved_date = col;
      });
      setMapping(autoMap);
      loadBatches();
    };
    reader.readAsBinaryString(file);
  };

  const handleUpload = async () => {
    if (!mapping.name || !mapping.mobile) {
      toast({ title: "Missing mapping", description: "Name and Mobile Number columns are required", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    const batchId = crypto.randomUUID();

    try {
      const records = rows.map((row) => ({
        name: String(row[mapping.name] || "").trim(),
        mobile: String(row[mapping.mobile] || "").replace(/\D/g, "").slice(-10),
        category: mapping.category ? String(row[mapping.category] || "").trim() : "",
        fee_paid: mapping.fee_paid ? Number(row[mapping.fee_paid]) || 0 : 0,
        approved_by: mapping.approved_by ? String(row[mapping.approved_by] || "").trim() : "",
        approved_date: mapping.approved_date ? String(row[mapping.approved_date] || "").trim() : "",
        raw_data: row,
        batch_id: batchId,
      })).filter((r) => r.name && r.mobile.length >= 10);

      // Insert in chunks of 500
      const chunkSize = 500;
      let inserted = 0;
      for (let i = 0; i < records.length; i += chunkSize) {
        const chunk = records.slice(i, i + chunkSize);
        const { error } = await supabase.from("old_payments").insert(chunk);
        if (error) throw error;
        inserted += chunk.length;
      }

      setUploadedCount(inserted);
      setRows([]);
      setHeaders([]);
      toast({ title: "Upload complete", description: `${inserted} records imported successfully` });
      loadBatches();
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const deleteBatch = async (batchId: string) => {
    const { error } = await supabase.from("old_payments").delete().eq("batch_id", batchId);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Batch deleted" });
      loadBatches();
    }
  };

  const allFields = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS];

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center gap-3 mb-6">
          <Link to="/super-admin">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Upload Old Payment Records</h1>
            <p className="text-sm text-muted-foreground">Import Excel files with historical payment data</p>
          </div>
        </div>

        {/* File Upload */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" /> Select Excel File
            </CardTitle>
            <CardDescription>Upload .xlsx or .xls file with payment records</CardDescription>
          </CardHeader>
          <CardContent>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" /> Choose File
            </Button>
            {rows.length > 0 && (
              <Badge className="ml-3" variant="secondary">{rows.length} rows found</Badge>
            )}
          </CardContent>
        </Card>

        {/* Column Mapping */}
        {headers.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base">Map Columns</CardTitle>
              <CardDescription>Match Excel columns to payment fields. Name and Mobile are required.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {allFields.map((field) => (
                  <div key={field}>
                    <label className="text-sm font-medium mb-1 block">
                      {FIELD_LABELS[field]}
                      {REQUIRED_FIELDS.includes(field as any) && <span className="text-destructive ml-1">*</span>}
                    </label>
                    <Select value={mapping[field]} onValueChange={(v) => setMapping((m) => ({ ...m, [field]: v }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select column..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">— None —</SelectItem>
                        {headers.map((h) => (
                          <SelectItem key={h} value={h}>{h}</SelectItem>
                        ))
                        }
                      </SelectContent>
                    </Select>
                  </div>
                ))
                }
              </div>

              {/* Preview */}
              {rows.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-sm font-medium mb-2">Preview (first 5 rows)</h4>
                  <div className="overflow-x-auto rounded border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {allFields.filter((f) => mapping[f] && mapping[f] !== "__none").map((f) => (
                            <TableHead key={f}>{FIELD_LABELS[f]}</TableHead>
                          ))
                          }
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.slice(0, 5).map((row, i) => (
                          <TableRow key={i}>
                            {allFields.filter((f) => mapping[f] && mapping[f] !== "__none").map((f) => (
                              <TableCell key={f} className="text-xs">
                                {f === "mobile"
                                  ? String(row[mapping[f]] || "").replace(/\D/g, "").slice(-10)
                                  : String(row[mapping[f]] || "")}
                              </TableCell>
                            ))
                            }
                          </TableRow>
                        ))
                        }
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              <Button className="mt-4" onClick={handleUpload} disabled={isUploading || !mapping.name || !mapping.mobile}>
                {isUploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                Import {rows.length} Records
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Upload Success */}
        {uploadedCount !== null && (
          <Card className="mb-6 border-green-200 bg-green-50 dark:bg-green-950/20">
            <CardContent className="py-4 flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <span className="font-medium">{uploadedCount} records imported successfully!</span>
            </CardContent>
          </Card>
        )}

        {/* Existing Batches */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Uploaded Batches</CardTitle>
            <CardDescription>Manage previously uploaded Excel data</CardDescription>
          </CardHeader>
          <CardContent>
            {!existingBatches.length && !isLoadingBatches ? (
              <Button variant="outline" size="sm" onClick={loadBatches}>
                Load Batches
              </Button>
            ) : isLoadingBatches ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <div className="space-y-2">
                {existingBatches.map((b) => (
                  <div key={b.batch_id} className="flex items-center justify-between p-3 rounded border">
                    <div>
                      <span className="text-sm font-medium">{b.count} records</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        Uploaded {new Date(b.created_at).toLocaleDateString("en-IN")}
                      </span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => deleteBatch(b.batch_id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))
                }
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
