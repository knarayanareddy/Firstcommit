import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function usePendingInvites(packId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: invites = [], isLoading } = useQuery({
    queryKey: ["pending_invites", packId],
    queryFn: async () => {
      if (!packId) return [];
      const { data, error } = await supabase
        .from("pending_invites")
        .select("*")
        .eq("pack_id", packId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!packId,
  });

  const sendInvite = useMutation({
    mutationFn: async ({ email, accessLevel }: { email: string; accessLevel: string }) => {
      if (!packId || !user) throw new Error("Missing pack or user");

      // Check if the email matches an existing user
      // We'll use the profiles table — display_name is set to email on signup
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .ilike("display_name", email.trim());

      if (profiles && profiles.length > 0) {
        // User exists — check if already a member
        const { data: existing } = await supabase
          .from("pack_members")
          .select("id")
          .eq("pack_id", packId)
          .eq("user_id", profiles[0].user_id)
          .maybeSingle();

        if (existing) throw new Error("User is already a member of this pack.");

        const { error } = await supabase.from("pack_members").insert({
          pack_id: packId,
          user_id: profiles[0].user_id,
          access_level: accessLevel,
        });
        if (error) throw error;
        return { status: "added" as const };
      } else {
        // Store pending invite
        const { error } = await supabase.from("pending_invites").upsert({
          pack_id: packId,
          email: email.trim().toLowerCase(),
          access_level: accessLevel,
          invited_by: user.id,
        }, { onConflict: "pack_id,email" });
        if (error) throw error;

        // Send invitation email via Edge Function
        try {
          // Fetch pack title for the email content
          const { data: pack } = await supabase
            .from("packs")
            .select("title")
            .eq("id", packId)
            .single();

          const packTitle = pack?.title || "a new Pack";
          const onboardingUrl = `${window.location.origin}/auth?email=${encodeURIComponent(email.trim())}`;

          await supabase.functions.invoke("send-email", {
            body: {
              to: email.trim(),
              subject: `You've been invited to join ${packTitle} on RocketBoard`,
              html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
                  <h1 style="color: #0f172a; margin-bottom: 16px;">Welcome to RocketBoard!</h1>
                  <p style="color: #475569; font-size: 16px; line-height: 1.5;">
                    You've been invited to collaborate on <strong>${packTitle}</strong>.
                  </p>
                  <p style="color: #475569; font-size: 16px; line-height: 1.5; margin-bottom: 24px;">
                    RocketBoard helps teams transform codebases and documentation into interactive learning experiences.
                  </p>
                  <a href="${onboardingUrl}" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 16px;">
                    Get Started
                  </a>
                  <p style="color: #94a3b8; font-size: 14px; margin-top: 32px; border-top: 1px solid #f1f5f9; padding-top: 16px;">
                    If you didn't expect this invitation, you can safely ignore this email.
                  </p>
                </div>
              `,
              type: "invite"
            }
          });
        } catch (emailErr) {
          console.error("Failed to send invite email:", emailErr);
          // We don't throw here so the UI still shows the invite as pending in the DB
        }

        return { status: "pending" as const };
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending_invites", packId] });
      queryClient.invalidateQueries({ queryKey: ["pack_members_list", packId] });
    },
  });

  const deleteInvite = useMutation({
    mutationFn: async (inviteId: string) => {
      const { error } = await supabase.from("pending_invites").delete().eq("id", inviteId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending_invites", packId] });
    },
  });

  return { invites, isLoading, sendInvite, deleteInvite };
}
