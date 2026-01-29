import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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
    description: "Agricultural initiatives and farming support for women",
    logo: farmelifeLogo,
    color: "bg-division-farmelife",
  },
  {
    id: "organelife",
    name: "Organelife",
    nameMl: "ഓർഗനെലൈഫ്",
    description: "Organic farming and sustainable agriculture programs",
    logo: organelifeLogo,
    color: "bg-division-organelife",
  },
  {
    id: "foodelife",
    name: "Foodelife",
    nameMl: "ഫുഡെലൈഫ്",
    description: "Food processing and culinary entrepreneurship",
    logo: foodelifeLogo,
    color: "bg-division-foodelife",
  },
  {
    id: "entrelife",
    name: "Entrelife",
    nameMl: "എന്ററലൈഫ്",
    description: "Entrepreneurship development and business support",
    logo: entrelifeLogo,
    color: "bg-division-entrelife",
  },
  {
    id: "embryo",
    name: "Embryo",
    nameMl: "എംബ്രിയോ",
    description: "Child care and early development programs",
    logo: embryoLogo,
    color: "bg-division-embryo",
  },
  {
    id: "aval",
    name: "Aval",
    nameMl: "അവൾ",
    description: "Welfare support wing for women in need",
    logo: avalLogo,
    color: "bg-division-aval",
  },
  {
    id: "pennyekart",
    name: "Pennyekart",
    nameMl: "പെന്നിക്കാർട്ട്",
    description: "E-commerce platform for women entrepreneurs",
    logo: pennyekartLogo,
    color: "bg-division-pennyekart",
  },
];

export function DivisionsSection() {
  return (
    <section className="py-20 bg-secondary/30">
      <div className="container">
        <div className="text-center mb-12">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
            Our Divisions
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Seven specialized wings dedicated to different aspects of women empowerment
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            ഏഴ് പ്രത്യേക വിഭാഗങ്ങൾ
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {divisions.map((division) => (
            <Link 
              key={division.id}
              to={`/divisions/${division.id}`}
              className="block"
            >
              <Card 
                className="group h-full hover:shadow-xl transition-all duration-300 border-border/50 hover:border-primary/50 overflow-hidden cursor-pointer hover:-translate-y-1 bg-card"
              >
                <CardContent className="p-6 flex flex-col items-center text-center">
                  <div className="h-24 w-24 mb-4 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <img 
                      src={division.logo} 
                      alt={`${division.name} logo`}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                  <h3 className="font-display font-semibold text-lg text-foreground mb-1 group-hover:text-primary transition-colors">
                    {division.name}
                  </h3>
                  <p className="text-xs text-muted-foreground mb-3">{division.nameMl}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                    {division.description}
                  </p>
                  <div className="flex items-center gap-1 text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                    <span>Explore Division</span>
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <div className="text-center mt-10">
          <Button asChild variant="outline" className="gap-2">
            <Link to="/divisions">
              Explore All Divisions
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
