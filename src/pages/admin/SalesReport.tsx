import { useState, useEffect, useMemo } from "react";
import { Layout } from "@/components/layout/Layout";
import { useAuth } from "@/hooks/useAuth";
import { syncPennyekartData, loadCachedData } from "@/lib/pennyekartSync";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ChartContainer, ChartTooltip, ChartTooltipContent,
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { Link, Navigate } from "react-router-dom";
import { 
  ShoppingCart, Package, Layers, TrendingUp, ArrowLeft, Loader2, 
  IndianRupee, AlertCircle, RefreshCw, CheckCircle2
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface Product {
  id: string;
  name: string;
  price: number;
  mrp: number;
  purchase_rate: number;
  category: string;
  stock: number;
  is_active: boolean;
  source_created_at?: string;
  section: string;
  discount_rate: number;
  coming_soon: boolean;
  margin_percentage: number | null;
  wallet_points: number;
  featured_discount_type: string;
  featured_discount_value: number;
}

interface Category {
  id: string;
  name: string;
  icon: string;
  item_count: string;
  sort_order: number;
  is_active: boolean;
  category_type: string;
  image_url: string;
  margin_percentage: number;
}

interface Order {
  id: string;
  total_amount: number;
  status: string;
  source_created_at?: string;
  customer_name?: string;
  customer_phone?: string;
  items?: any;
  payment_method?: string;
  delivery_address?: string;
}

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(210, 70%, 50%)",
  "hsl(150, 60%, 45%)",
  "hsl(30, 80%, 55%)",
  "hsl(330, 65%, 50%)",
  "hsl(270, 55%, 55%)",
  "hsl(60, 70%, 45%)",
];

export default function SalesReport() {
  const { roles, isLoading: authLoading } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [lastSynced, setLastSynced] = useState<string | null>(null);

  // Load cached data from local DB on mount
  const loadCached = async () => {
    setLoading(true);
    setError(null);
    try {
      const cached = await loadCachedData();
      setProducts(cached.products);
      setCategories(cached.categories);
      setOrders(cached.orders);
      if (cached.products.length > 0) {
        const syncTime = (cached.products[0] as any).synced_at;
        if (syncTime) setLastSynced(new Date(syncTime).toLocaleString("en-IN"));
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Sync: fetch from pennyekart, upsert to local DB, then reload
  const handleSync = async () => {
    setSyncing(true);
    setError(null);
    try {
      const result = await syncPennyekartData();
      if (result.error) {
        toast.error("Sync partially failed: " + result.error);
      } else {
        toast.success(`Synced ${result.products.length} products, ${result.categories.length} categories, ${result.orders.length} orders`);
      }
      // Reload from local DB to show updated data
      await loadCached();
    } catch (err: any) {
      setError(err.message || "Failed to sync data from pennyekart.com");
      toast.error("Sync failed: " + (err.message || "Unknown error"));
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    // Load cached first, then auto-sync
    loadCached().then(() => {
      handleSync();
    });
  }, []);

  const stats = useMemo(() => {
    const totalProducts = products.length;
    const activeProducts = products.filter(p => p.is_active).length;
    const totalCategories = categories.length;
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const totalStock = products.reduce((sum, p) => sum + (p.stock || 0), 0);
    const outOfStock = products.filter(p => p.stock === 0 && p.is_active).length;
    const avgPrice = totalProducts > 0 ? products.reduce((sum, p) => sum + p.price, 0) / totalProducts : 0;
    const totalInventoryValue = products.reduce((sum, p) => sum + (p.purchase_rate * p.stock), 0);

    return { totalProducts, activeProducts, totalCategories, totalOrders, totalRevenue, totalStock, outOfStock, avgPrice, totalInventoryValue };
  }, [products, categories, orders]);

  const categoryChartData = useMemo(() => {
    const grouped: Record<string, number> = {};
    products.forEach(p => {
      grouped[p.category] = (grouped[p.category] || 0) + 1;
    });
    return Object.entries(grouped).map(([name, count]) => ({ name, count }));
  }, [products]);

  const priceDistribution = useMemo(() => {
    const ranges = [
      { label: "₹0-50", min: 0, max: 50 },
      { label: "₹50-200", min: 50, max: 200 },
      { label: "₹200-500", min: 200, max: 500 },
      { label: "₹500-2000", min: 500, max: 2000 },
      { label: "₹2000+", min: 2000, max: Infinity },
    ];
    return ranges.map(r => ({
      name: r.label,
      count: products.filter(p => p.price >= r.min && p.price < r.max).length,
    }));
  }, [products]);

  const marginAnalysis = useMemo(() => {
    return products
      .filter(p => p.purchase_rate > 0)
      .map(p => ({
        name: p.name.length > 15 ? p.name.substring(0, 15) + "..." : p.name,
        margin: Math.round(((p.price - p.purchase_rate) / p.purchase_rate) * 100),
        profit: p.price - p.purchase_rate,
      }))
      .sort((a, b) => b.margin - a.margin)
      .slice(0, 10);
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (!searchTerm) return products;
    const term = searchTerm.toLowerCase();
    return products.filter(p =>
      p.name.toLowerCase().includes(term) || p.category.toLowerCase().includes(term)
    );
  }, [products, searchTerm]);

  const categoryChartConfig = useMemo(() => {
    const config: Record<string, { label: string; color: string }> = {};
    categoryChartData.forEach((item, index) => {
      config[item.name] = {
        label: item.name,
        color: CHART_COLORS[index % CHART_COLORS.length],
      };
    });
    return config;
  }, [categoryChartData]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!roles.includes("super_admin")) {
    return <Navigate to="/unauthorized" replace />;
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link to="/super-admin">
              <Button variant="outline" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Pennyekart Sales Report
              </h1>
              <p className="text-sm text-muted-foreground">
                Data synced from pennyekart.com → stored in database
                {lastSynced && (
                  <span className="ml-2 text-xs">
                    <CheckCircle2 className="inline h-3 w-3 text-green-500 mr-1" />
                    Last synced: {lastSynced}
                  </span>
                )}
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={handleSync} disabled={syncing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing..." : "Sync & Refresh"}
          </Button>
        </div>

        {error && (
          <Card className="border-destructive">
            <CardContent className="flex items-center gap-3 py-4">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <p className="text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}

        {loading && products.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatsCard title="Total Products" value={stats.totalProducts} icon={Package} description={`${stats.activeProducts} active`} />
              <StatsCard title="Categories" value={stats.totalCategories} icon={Layers} />
              <StatsCard title="Total Orders" value={stats.totalOrders} icon={ShoppingCart} description={stats.totalOrders === 0 ? "No orders yet" : undefined} />
              <StatsCard title="Total Revenue" value={`₹${stats.totalRevenue.toLocaleString("en-IN")}`} icon={IndianRupee} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatsCard title="Total Stock" value={stats.totalStock} icon={Package} description={`${stats.outOfStock} out of stock`} />
              <StatsCard title="Avg. Price" value={`₹${Math.round(stats.avgPrice).toLocaleString("en-IN")}`} icon={TrendingUp} />
              <StatsCard title="Inventory Value" value={`₹${stats.totalInventoryValue.toLocaleString("en-IN")}`} icon={IndianRupee} description="At purchase rate" />
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full justify-start overflow-x-auto">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="products">Products ({stats.totalProducts})</TabsTrigger>
                <TabsTrigger value="orders">Orders ({stats.totalOrders})</TabsTrigger>
                <TabsTrigger value="categories">Categories</TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Products by Category</CardTitle>
                      <CardDescription>Distribution of products across categories</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {categoryChartData.length > 0 ? (
                        <ChartContainer config={categoryChartConfig} className="h-[300px] w-full">
                          <BarChart data={categoryChartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} fontSize={11} />
                            <YAxis />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ChartContainer>
                      ) : (
                        <p className="text-muted-foreground text-center py-10">No data available</p>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Price Distribution</CardTitle>
                      <CardDescription>Products grouped by price range</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ChartContainer config={{ count: { label: "Products", color: "hsl(var(--primary))" } }} className="h-[300px] w-full">
                        <BarChart data={priceDistribution}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" fontSize={12} />
                          <YAxis />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Bar dataKey="count" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ChartContainer>
                    </CardContent>
                  </Card>

                  <Card className="lg:col-span-2">
                    <CardHeader>
                      <CardTitle className="text-lg">Top 10 Products by Margin %</CardTitle>
                      <CardDescription>Profit margin analysis based on purchase rate vs selling price</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {marginAnalysis.length > 0 ? (
                        <ChartContainer config={{ margin: { label: "Margin %", color: "hsl(var(--primary))" } }} className="h-[300px] w-full">
                          <BarChart data={marginAnalysis} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" unit="%" />
                            <YAxis dataKey="name" type="category" width={120} fontSize={11} />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Bar dataKey="margin" fill="hsl(150, 60%, 45%)" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ChartContainer>
                      ) : (
                        <p className="text-muted-foreground text-center py-10">No margin data available</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Products Tab */}
              <TabsContent value="products" className="space-y-4">
                <div className="flex items-center gap-4">
                  <Input
                    placeholder="Search products by name or category..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="max-w-sm"
                  />
                  <Badge variant="outline">{filteredProducts.length} products</Badge>
                </div>
                <Card>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead className="text-right">Purchase</TableHead>
                            <TableHead className="text-right">Price</TableHead>
                            <TableHead className="text-right">MRP</TableHead>
                            <TableHead className="text-right">Margin</TableHead>
                            <TableHead className="text-right">Stock</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredProducts.map((product) => {
                            const margin = product.purchase_rate > 0
                              ? Math.round(((product.price - product.purchase_rate) / product.purchase_rate) * 100)
                              : 0;
                            return (
                              <TableRow key={product.id}>
                                <TableCell className="font-medium max-w-[200px] truncate">{product.name}</TableCell>
                                <TableCell>
                                  <Badge variant="secondary">{product.category}</Badge>
                                </TableCell>
                                <TableCell className="text-right">₹{product.purchase_rate}</TableCell>
                                <TableCell className="text-right">₹{product.price}</TableCell>
                                <TableCell className="text-right">₹{product.mrp}</TableCell>
                                <TableCell className="text-right">
                                  <span className={margin > 0 ? "text-green-600" : "text-red-600"}>
                                    {margin}%
                                  </span>
                                </TableCell>
                                <TableCell className="text-right">
                                  {product.stock === 0 ? (
                                    <Badge variant="destructive">0</Badge>
                                  ) : product.stock}
                                </TableCell>
                                <TableCell>
                                  {product.coming_soon ? (
                                    <Badge variant="outline">Coming Soon</Badge>
                                  ) : product.is_active ? (
                                    <Badge className="bg-green-600">Active</Badge>
                                  ) : (
                                    <Badge variant="secondary">Inactive</Badge>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                          {filteredProducts.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                                No products found
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Orders Tab */}
              <TabsContent value="orders" className="space-y-4">
                {orders.length === 0 ? (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                      <ShoppingCart className="h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold text-foreground mb-2">No Orders Yet</h3>
                      <p className="text-muted-foreground max-w-md">
                        When customers place orders on pennyekart.com, they will appear here with full details and analytics.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Order ID</TableHead>
                            <TableHead>Customer</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead>Date</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {orders.map((order) => (
                            <TableRow key={order.id}>
                              <TableCell className="font-mono text-xs">{order.id.substring(0, 8)}...</TableCell>
                              <TableCell>{order.customer_name || "—"}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{order.status}</Badge>
                              </TableCell>
                              <TableCell className="text-right">₹{order.total_amount?.toLocaleString("en-IN")}</TableCell>
                              <TableCell>{order.source_created_at ? new Date(order.source_created_at).toLocaleDateString("en-IN") : "—"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Categories Tab */}
              <TabsContent value="categories" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {categories.map((cat) => {
                    const productCount = products.filter(p => p.category === cat.name).length;
                    return (
                      <Card key={cat.id}>
                        <CardContent className="flex items-center gap-4 p-4">
                          {cat.image_url && (
                            <img src={cat.image_url} alt={cat.name} className="h-12 w-12 rounded-lg object-cover" />
                          )}
                          <div className="flex-1">
                            <h3 className="font-semibold text-foreground">{cat.name}</h3>
                            <p className="text-sm text-muted-foreground">{cat.category_type}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="secondary">{productCount} products</Badge>
                              {cat.margin_percentage > 0 && (
                                <Badge variant="outline">{cat.margin_percentage}% margin</Badge>
                              )}
                            </div>
                          </div>
                          <Badge variant={cat.is_active ? "default" : "secondary"}>
                            {cat.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </CardContent>
                      </Card>
                    );
                  })}
                  {categories.length === 0 && (
                    <Card className="col-span-full">
                      <CardContent className="text-center text-muted-foreground py-8">
                        No categories found
                      </CardContent>
                    </Card>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </Layout>
  );
}
