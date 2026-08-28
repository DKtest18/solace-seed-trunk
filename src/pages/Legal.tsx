import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { HourglassLoader } from '@/components/HourglassLoader';

const PAGE_TYPES: Record<string, string> = {
  terms: "Terms of Service",
  privacy: "Privacy Policy",
  cookies: "Cookie Policy",
  refund: "Refund Policy",
  seller: "Seller Terms & Obligations",
  imprint: "Legal Notice / Imprint",
};

export default function Legal() {
  const { type } = useParams<{ type: string }>();
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchContent = async () => {
      if (!type) return;
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("legal_pages")
          .select("*")
          .eq("page_type", type)
          .single();

        if (error) throw error;
        setTitle(data.title);
        setContent(data.content);
      } catch (error) {
        console.error("Error loading legal page:", error);
        setTitle(PAGE_TYPES[type] || "Legal Page");
        setContent("Content not available. Please contact support.");
      } finally {
        setLoading(false);
      }
    };

    fetchContent();
  }, [type]);

  return (
    <AppLayout>
      <div className="container mx-auto max-w-4xl py-8 px-4">
        <Button variant="ghost" asChild className="mb-4">
          <Link to="/"><ArrowLeft className="w-4 h-4 mr-2" />Back</Link>
        </Button>

        {loading ? (
          <div className="flex justify-center py-12"><HourglassLoader size={128} /></div>
        ) : (
          <>
            <h1 className="text-4xl font-bold mb-6">{title}</h1>
            <div className="prose prose-slate dark:prose-invert max-w-none">
              <div className="whitespace-pre-wrap">{content}</div>
            </div>
            <div className="mt-8 pt-6 border-t">
              <p className="text-sm text-muted-foreground">
                Last updated: {new Date().toLocaleDateString()}
              </p>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
