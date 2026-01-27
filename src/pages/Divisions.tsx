import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Import division logos
import farmelifeLogo from "@/assets/divisions/farmelife.png";
import organelifeLogo from "@/assets/divisions/organelife.png";
import foodelifeLogo from "@/assets/divisions/foodelife.png";
import entrelifeLogo from "@/assets/divisions/entrelife.png";
import embryoLogo from "@/assets/divisions/embryo.png";
import avalLogo from "@/assets/divisions/aval.jpg";
import pennyekartLogo from "@/assets/divisions/pennyekart.png";

const divisions = [
  {
    id: "farmelife",
    name: "Farmelife",
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
  {
    id: "organelife",
    name: "Organelife",
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
  {
    id: "foodelife",
    name: "Foodelife",
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
  {
    id: "entrelife",
    name: "Entrelife",
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
  {
    id: "embryo",
    name: "Embryo",
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
  {
    id: "aval",
    name: "Aval",
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
  {
    id: "pennyekart",
    name: "Pennyekart",
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
    infoOnly: true,
  },
];

const Divisions = () => {
  return (
    <Layout>
      {/* Hero Section */}
      <section className="py-16 bg-gradient-to-br from-primary/5 via-background to-accent/10">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-6">
              Our Divisions
            </h1>
            <p className="text-lg text-muted-foreground mb-2">
              Seven specialized wings for comprehensive women empowerment
            </p>
            <p className="text-muted-foreground">
              സമഗ്ര സ്ത്രീ ശാക്തീകരണത്തിനുള്ള ഏഴ് വിഭാഗങ്ങൾ
            </p>
          </div>
        </div>
      </section>

      {/* Divisions Grid */}
      <section className="py-16">
        <div className="container">
          <div className="space-y-8">
            {divisions.map((division, index) => (
              <Card 
                key={division.id}
                className={`overflow-hidden border-border/50 hover:shadow-lg transition-shadow bg-gradient-to-r ${division.bgGradient}`}
              >
                <div className="grid md:grid-cols-3 gap-6">
                  <CardHeader className="md:col-span-1 flex flex-col justify-center items-center text-center p-8 bg-gradient-to-br from-background to-transparent">
                    <div className="h-28 w-28 mb-4 flex items-center justify-center">
                      <img 
                        src={division.logo} 
                        alt={`${division.name} logo`}
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                    <CardTitle className="font-display text-2xl">{division.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{division.nameMl}</p>
                    <p className="text-sm font-medium text-primary mt-2">{division.tagline}</p>
                    {division.infoOnly && (
                      <span className="mt-3 px-3 py-1 rounded-full bg-accent/20 text-accent-foreground text-xs font-medium">
                        Information Only
                      </span>
                    )}
                  </CardHeader>
                  
                  <CardContent className="md:col-span-2 p-8">
                    <p className="text-muted-foreground mb-6 leading-relaxed">
                      {division.description}
                    </p>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {division.features.map((feature, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <div className="h-2 w-2 rounded-full bg-primary" />
                          <span className="text-foreground">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Divisions;
