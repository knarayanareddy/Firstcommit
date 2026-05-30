import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Package, ArrowLeft, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

export default function CreatePackPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [langMode, setLangMode] = useState("english");
  const [loading, setLoading] = useState(false);

  // Get user's org
  const { data: orgMembership } = useQuery({
    queryKey: ["user_org_membership", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("org_members")
        .select("org_id, role")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const handleCreate = async () => {
    if (!user || !orgMembership || !title.trim()) return;
    setLoading(true);
    try {
      const newPackId = crypto.randomUUID();
      const { error } = await supabase
        .from("packs")
        .insert({
          id: newPackId,
          title: title.trim(),
          description: description.trim() || null,
          org_id: orgMembership.org_id,
          language_mode: langMode,
          created_by: user.id,
        });
      if (error) throw error;

      await supabase.from("pack_members").insert({
        pack_id: newPackId,
        user_id: user.id,
        access_level: "owner",
      });

      localStorage.setItem("rocketboard_current_pack", newPackId);
      toast.success("Pack created!");
      navigate(`/packs/${newPackId}/sources`);
    } catch (err: any) {
      toast.error(err.message || "Failed to create pack");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-lg mx-auto">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <button
            onClick={() => navigate("/packs")}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Packs
          </button>

          <div className="flex items-center gap-3 mb-6">
            <Package className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Create New Pack</h1>
          </div>

          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground block mb-1">Pack Title</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Backend Services Onboarding"
                maxLength={120}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground block mb-1">Description (optional)</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Everything a new backend engineer needs to know..."
                rows={3}
                maxLength={500}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground block mb-1">Language Mode</label>
              <Select value={langMode} onValueChange={setLangMode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="english">English Only</SelectItem>
                  <SelectItem value="multilingual">Multilingual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleCreate}
              disabled={!title.trim() || loading || !orgMembership}
              className="w-full gradient-primary text-primary-foreground border-0 gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Pack"}
            </Button>
          </div>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
