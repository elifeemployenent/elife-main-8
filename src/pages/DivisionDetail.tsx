import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowLeft, Calendar, MapPin, Megaphone, ArrowRight } from "lucide-react";
import { format } from "date-fns";

// Import division logos
import farmelifeLogo from "@/assets/divisions/farmelife.png";
import organelifeLogo from "@/assets/divisions/organelife.png";
import foodelifeLogo from "@/assets/divisions/foodelife.png";
import entrelifeLogo from "@/assets/divisions/entrelife.png";
import embryoLogo from "@/assets/divisions/embryo.png";
import avalLogo from "@/assets/divisions/aval.jpg";
import pennyekartLogo from "@/assets/divisions/pennyekart.png";

// Division data mapping
const divisionsData: Record<string, {
  nameMl: string;
  tagline: string;
  description: string;
  features: string[];
  logo: string;
  bgGradient: string;
}> = {
  farmelife: {
    nameMl: "ഫാർമെലൈഫ്",
    tagline: "Agricultural Empowerment",
    description: "Supporting women in agriculture through training, resources, and market access. From backyard farming to commercial cultivation, we help women become successful farmers.",
    features: [
      "Agricultural training programs",
      "Seed and sapling distribution",
      "Market linkage support",
      "Organic farming guidance"
    ],
    logo: farmelifeLogo,
    bgGradient: "from-division-farmelife/10 to-transparent",
  },
  organelife: {
    nameMl: "ഓർഗനെലൈഫ്",
    tagline: "Organic & Sustainable Living",
    description: "Promoting organic farming practices and sustainable agriculture. We help women adopt chemical-free farming methods for healthier produce and better income.",
    features: [
      "Organic certification support",
      "Composting workshops",
      "Natural pest management",
      "Organic product marketing"
    ],
    logo: organelifeLogo,
    bgGradient: "from-division-organelife/10 to-transparent",
  },
  foodelife: {
    nameMl: "ഫുഡെലൈഫ്",
    tagline: "Culinary Entrepreneurship",
    description: "Empowering women in food processing, catering, and culinary arts. Transform your cooking skills into a thriving business with our support.",
    features: [
      "Food processing training",
      "FSSAI licensing support",
      "Packaging & branding help",
      "Catering business setup"
    ],
    logo: foodelifeLogo,
    bgGradient: "from-division-foodelife/10 to-transparent",
  },
  entrelife: {
    nameMl: "എന്ററലൈഫ്",
    tagline: "Business & Entrepreneurship",
    description: "Comprehensive entrepreneurship development program for aspiring women business owners. From idea to execution, we guide you through every step.",
    features: [
      "Business plan development",
      "Financial literacy training",
      "Marketing & sales support",
      "Networking opportunities"
    ],
    logo: entrelifeLogo,
    bgGradient: "from-division-entrelife/10 to-transparent",
  },
  embryo: {
    nameMl: "എംബ്രിയോ",
    tagline: "Child Care & Development",
    description: "Supporting mothers and childcare providers with quality early childhood development programs. Building a strong foundation for the next generation.",
    features: [
      "Childcare training",
      "Parenting workshops",
      "Daycare setup support",
      "Child nutrition programs"
    ],
    logo: embryoLogo,
    bgGradient: "from-division-embryo/10 to-transparent",
  },
  aval: {
    nameMl: "അവൾ",
    tagline: "Welfare & Support",
    description: "The welfare wing of e-Life Society, providing support to women facing challenges. Aval (meaning 'She' in Malayalam) stands for every woman in need.",
    features: [
      "Crisis support services",
      "Counseling programs",
      "Emergency assistance",
      "Rehabilitation support"
    ],
    logo: avalLogo,
    bgGradient: "from-division-aval/10 to-transparent",
  },
  pennyekart: {
    nameMl: "പെന്നിക്കാർട്ട്",
    tagline: "E-Commerce Platform",
    description: "Our digital marketplace connecting women entrepreneurs with customers. Sell your products online and reach a wider audience.",
    features: [
      "Online store setup",
      "Product photography",
      "Digital marketing",
      "Order management"
    ],
    logo: pennyekartLogo,
    bgGradient: "from-division-pennyekart/10 to-transparent",
  },
};

interface Division {
  id: string;
  name: string;
  color: string | null;
  description: string | null;
}

interface Program {
  id: string;
  name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  all_panchayaths: boolean;
  is_active: boolean;
  panchayath: { name: string } | null;
  modules: { module_type: string; is_published: boolean }[];
  announcements: {
    id: string;
    title: string;
    description: string | null;
    poster_url: string | null;
    is_published: boolean;
    created_at: string;
  }[];
}

export default function DivisionDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [division, setDivision] = useState<Division | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const divisionInfo = slug ? divisionsData[slug.toLowerCase()] : null;

  useEffect(() => {
    const fetchDivisionData = async () => {
      if (!slug) return;

      setIsLoading(true);

      try {
        // Fetch division from database by matching color (slug)
        const { data: divisionData, error: divisionError } = await supabase
          .from("divisions")
          .select("id, name, color, description")
          .eq("color", slug.toLowerCase())
          .eq("is_active", true)
          .maybeSingle();

        if (divisionError) {
          console.error("Error fetching division:", divisionError);
          return;
        }

        setDivision(divisionData);

        if (divisionData) {
          // Fetch programs for this division
          const { data: programsData, error: programsError } = await supabase
            .from("programs")
            .select(`
              id,
              name,
              description,
              start_date,
              end_date,
              all_panchayaths,
              is_active,
              panchayath:panchayaths(name),
              modules:program_modules(module_type, is_published),
              announcements:program_announcements(id, title, description, poster_url, is_published, created_at)
            `)
            .eq("division_id", divisionData.id)
            .eq("is_active", true)
            .order("created_at", { ascending: false });

          if (programsError) {
            console.error("Error fetching programs:", programsError);
          } else {
            setPrograms(programsData || []);
          }
        }
      } catch (err) {
        console.error("Error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDivisionData();
  }, [slug]);

  // Get all published announcements from all programs
  const allAnnouncements = programs
    .flatMap((p) =>
      (p.announcements || [])
        .filter((a) => a.is_published)
        .map((a) => ({ ...a, programName: p.name, programId: p.id }))
    )
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  if (isLoading) {
    return (
      <Layout>
        <div className="container py-8 flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!division || !divisionInfo) {
    return (
      <Layout>
        <div className="container py-8">
          <div className="text-center py-16">
            <p className="text-lg text-muted-foreground">Division not found</p>
            <Button asChild className="mt-4">
              <Link to="/divisions">View All Divisions</Link>
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Hero Section */}
      <section className={`py-16 bg-gradient-to-br ${divisionInfo.bgGradient} via-background to-accent/5`}>
        <div className="container">
          <Button asChild variant="ghost" className="mb-6">
            <Link to="/divisions">
              <ArrowLeft className="h-4 w-4 mr-2" />
              All Divisions
            </Link>
          </Button>

          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="h-32 w-32 flex items-center justify-center">
              <img
                src={divisionInfo.logo}
                alt={`${division.name} logo`}
                className="max-h-full max-w-full object-contain"
              />
            </div>
            <div className="text-center md:text-left">
              <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-2">
                {division.name}
              </h1>
              <p className="text-lg text-muted-foreground mb-1">{divisionInfo.nameMl}</p>
              <p className="text-primary font-medium">{divisionInfo.tagline}</p>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="py-12 border-b">
        <div className="container">
          <div className="max-w-3xl">
            <h2 className="text-2xl font-bold mb-4">About {division.name}</h2>
            <p className="text-muted-foreground leading-relaxed mb-6">
              {divisionInfo.description}
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              {divisionInfo.features.map((feature, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  <span className="text-foreground">{feature}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Programs Section */}
      <section className="py-12">
        <div className="container">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
            Programs
            <Badge variant="secondary">{programs.length}</Badge>
          </h2>

          {programs.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">
                  No programs available at the moment.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {programs.map((program) => {
                const hasRegistration = program.modules?.some(
                  (m) => m.module_type === "registration" && m.is_published
                );

                return (
                  <Card key={program.id} className="hover:shadow-md transition-shadow">
                    <CardHeader>
                      <CardTitle className="text-lg">{program.name}</CardTitle>
                      {program.description && (
                        <CardDescription className="line-clamp-2">
                          {program.description}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {program.start_date && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="h-4 w-4" />
                            {format(new Date(program.start_date), "MMM d, yyyy")}
                            {program.end_date &&
                              ` - ${format(new Date(program.end_date), "MMM d, yyyy")}`}
                          </div>
                        )}
                        {program.panchayath?.name && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <MapPin className="h-4 w-4" />
                            {program.panchayath.name}
                          </div>
                        )}
                        {program.all_panchayaths && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <MapPin className="h-4 w-4" />
                            All Panchayaths
                          </div>
                        )}

                        <div className="pt-3">
                          <Button asChild size="sm" className="w-full">
                            <Link to={`/program/${program.id}`}>
                              {hasRegistration ? "View & Register" : "View Details"}
                              <ArrowRight className="h-4 w-4 ml-2" />
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Announcements Section */}
      {allAnnouncements.length > 0 && (
        <section className="py-12 bg-muted/30">
          <div className="container">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
              <Megaphone className="h-6 w-6" />
              Announcements
              <Badge variant="secondary">{allAnnouncements.length}</Badge>
            </h2>

            <div className="grid gap-6 md:grid-cols-2">
              {allAnnouncements.map((announcement) => (
                <Card key={announcement.id} className="overflow-hidden">
                  <div className="flex flex-col md:flex-row">
                    {announcement.poster_url && (
                      <div className="md:w-1/3">
                        <img
                          src={announcement.poster_url}
                          alt={announcement.title}
                          className="w-full h-48 md:h-full object-cover"
                        />
                      </div>
                    )}
                    <div className={`flex-1 ${announcement.poster_url ? "" : ""}`}>
                      <CardHeader>
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="text-xs">
                            {announcement.programName}
                          </Badge>
                        </div>
                        <CardTitle className="text-lg">{announcement.title}</CardTitle>
                        <CardDescription>
                          {format(new Date(announcement.created_at), "MMMM d, yyyy")}
                        </CardDescription>
                      </CardHeader>
                      {announcement.description && (
                        <CardContent>
                          <p className="text-muted-foreground text-sm line-clamp-3">
                            {announcement.description}
                          </p>
                          <Button asChild variant="link" className="px-0 mt-2">
                            <Link to={`/program/${announcement.programId}`}>
                              View Program
                              <ArrowRight className="h-4 w-4 ml-1" />
                            </Link>
                          </Button>
                        </CardContent>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}
    </Layout>
  );
}
