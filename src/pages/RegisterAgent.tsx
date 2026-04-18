import { useState } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PublicAgentRegisterDialog } from "@/components/home/PublicAgentRegisterDialog";
import { UserPlus, ArrowLeft } from "lucide-react";

export default function RegisterAgent() {
  const [open, setOpen] = useState(true);

  return (
    <Layout>
      <section className="py-12 lg:py-20 min-h-[60vh] flex items-center">
        <div className="container mx-auto px-4 max-w-xl">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                <UserPlus className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-2xl">Become an e-Life Agent</CardTitle>
              <p className="text-sm text-muted-foreground mt-2">
                Register here to join the e-Life agent network. Your application will be
                reviewed and approved by an admin.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full" size="lg" onClick={() => setOpen(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Open Registration Form
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link to="/">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Home
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      <PublicAgentRegisterDialog open={open} onOpenChange={setOpen} />
    </Layout>
  );
}
