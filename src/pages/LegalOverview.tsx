import { Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FileText, Shield, Cookie, ReceiptText, Building, Video, Users } from "lucide-react";

const legalPages = [
  { type: "terms", title: "Terms of Service", description: "Allgemeine Geschäftsbedingungen — Nutzungsbedingungen der Plattform", icon: FileText },
  { type: "privacy", title: "Privacy Policy", description: "Datenschutzerklärung — Wie wir Ihre Daten verarbeiten (DSGVO/nDSG)", icon: Shield },
  { type: "cookies", title: "Cookie Policy", description: "Informationen über die von uns verwendeten Cookies", icon: Cookie },
  { type: "refund", title: "Refund & Return Policy", description: "Widerrufsbelehrung & Rückgaberecht gemäss EU-Richtlinie 2011/83/EU", icon: ReceiptText },
  { type: "imprint", title: "Legal Notice / Impressum", description: "Angaben gemäss Impressumspflicht — Betreiberinformationen", icon: Building },
  { type: "meetings", title: "Meeting Guidelines", description: "Meeting-Richtlinien — Regeln für Video-Meetings (18+, nur geschäftlich)", icon: Video },
  { type: "community", title: "Community Guidelines", description: "Community-Richtlinien — Verhaltensregeln für die Community", icon: Users },
];

export default function LegalOverview() {
  return (
    <AppLayout>
      <div className="container mx-auto max-w-4xl py-8 px-4">
        <h1 className="text-4xl font-bold mb-2">Legal</h1>
        <p className="text-muted-foreground mb-8">
          Alle rechtlichen Dokumente und Richtlinien von DK AI Marketplace.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          {legalPages.map(({ type, title, description, icon: Icon }) => (
            <Link key={type} to={`/legal/${type}`} className="group">
              <Card className="h-full transition-colors group-hover:border-primary/50 group-hover:bg-accent/30">
                <CardHeader className="flex flex-row items-start gap-4">
                  <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{title}</CardTitle>
                    <CardDescription>{description}</CardDescription>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
