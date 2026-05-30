import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Settings2, 
  UserPlus, 
  GripVertical, 
  Trash2, 
  ChevronRight, 
  Layers,
  Calendar,
  Filter
} from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { RoadmapPhase, RoadmapItemType } from "@/hooks/useRoadmap";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { usePack } from "@/hooks/usePack";
import { Map, AlertCircle } from "lucide-react";

export default function RoadmapBuilder() {
  const { packId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selectedPhase, setSelectedPhase] = useState<RoadmapPhase | 'all'>('all');

  // 1. Fetch Playlists
  const { data: playlists = [], isLoading: playlistsLoading } = useQuery({
    queryKey: ["builder_playlists", packId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("playlists")
        .select(`*, items:playlist_items(*)`)
        .eq("pack_id", packId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!packId,
  });

  // 2. Fetch Members (Learners)
  const { data: members = [] } = useQuery({
    queryKey: ["pack_members_for_assignment", packId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pack_members")
        .select("user_id, access_level")
        .eq("pack_id", packId)
        .eq("access_level", "learner");
      if (error) throw error;
      
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", data.map(m => m.user_id));
        
      return data.map(m => ({
        ...m,
        display_name: profiles?.find(p => p.user_id === m.user_id)?.display_name || 'Unknown'
      }));
    },
    enabled: !!packId,
  });

  const { currentPack } = usePack();

  if (!currentPack?.roadmap_enabled && !playlistsLoading) {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto py-20 text-center">
           <div className="bg-amber-500/10 border border-amber-500/20 p-8 rounded-3xl inline-block mb-6">
              <AlertCircle className="w-12 h-12 text-amber-500 mx-auto" />
           </div>
           <h1 className="text-3xl font-bold mb-4">Roadmap Builder is Locked</h1>
           <p className="text-muted-foreground mb-8 max-w-sm mx-auto">
             The Roadmap feature flag is currently disabled for this pack. 
             Enable it in Pack Settings to start building structured programs.
           </p>
           <Button variant="outline" onClick={() => navigate(`/packs/${packId}`)}>
              Back to Dashboard
           </Button>
        </div>
      </DashboardLayout>
    );
  }

  const createPlaylist = useMutation({
    mutationFn: async ({ title, phase }: { title: string, phase: RoadmapPhase }) => {
      const { data, error } = await (supabase as any)
        .from("playlists")
        .insert({
          pack_id: packId,
          title,
          phase,
          created_by: user!.id,
          owner_user_id: user!.id,
          owner_display_name: 'Lead' // Should get from profile
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["builder_playlists"] });
      toast.success("Playlist created");
    }
  });

  const assignPlaylist = useMutation({
    mutationFn: async ({ playlistId, learnerId }: { playlistId: string, learnerId: string }) => {
       const { error } = await (supabase as any)
        .from("playlist_assignments")
        .insert({
          pack_id: packId,
          playlist_id: playlistId,
          learner_user_id: learnerId,
          assigned_by: user!.id
        });
        if (error) throw error;
    },
    onSuccess: () => {
       toast.success("Assigned successfully");
    },
    onError: (err: any) => toast.error(err.message || "Already assigned")
  });

  const addItem = useMutation({
    mutationFn: async (item: any) => {
      const { error } = await (supabase as any)
        .from("playlist_items")
        .insert(item);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["builder_playlists"] });
      toast.success("Item added");
    }
  });

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto pb-20">
        <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4" data-tour="builder-header">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Roadmap Builder</h1>
            <p className="text-muted-foreground mt-1">Design structured onboarding journeys and assign them to your team.</p>
          </div>
          <div className="flex items-center gap-3">
             <AssignDialog 
              members={members} 
              playlists={playlists} 
              onAssign={(playlistId: any, learnerId: any) => assignPlaylist.mutate({ playlistId, learnerId })} 
              data-tour="assign-user"
            />
             <CreatePlaylistDialog onSave={(t, p) => createPlaylist.mutate({ title: t, phase: p })} data-tour="create-playlist" />
          </div>
        </div>

        <div className="flex items-center gap-4 mb-8 overflow-x-auto pb-2">
           <Button 
            variant={selectedPhase === 'all' ? 'default' : 'outline'} 
            size="sm" 
            onClick={() => setSelectedPhase('all')}
            className="rounded-full px-4"
           >
             All Phases
           </Button>
           <Button 
            variant={selectedPhase === 'day_1_30' ? 'default' : 'outline'} 
            size="sm" 
            onClick={() => setSelectedPhase('day_1_30')}
            className="rounded-full px-4"
           >
             Day 1–30
           </Button>
           <Button 
            variant={selectedPhase === 'day_31_60' ? 'default' : 'outline'} 
            size="sm" 
            onClick={() => setSelectedPhase('day_31_60')}
            className="rounded-full px-4"
           >
             Day 31–60
           </Button>
           <Button 
            variant={selectedPhase === 'day_61_90' ? 'default' : 'outline'} 
            size="sm" 
            onClick={() => setSelectedPhase('day_61_90')}
            className="rounded-full px-4"
           >
             Day 61–90
           </Button>
        </div>

        <div className="grid grid-cols-1 gap-6">
           {playlists.filter(p => selectedPhase === 'all' || p.phase === selectedPhase).map(playlist => (
             <div key={playlist.id} className="bg-card border border-border rounded-2xl overflow-hidden group">
                <div className="p-6 flex items-center justify-between border-b border-border bg-muted/20">
                   <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                         <Layers className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                         <div className="flex items-center gap-2 mb-0.5">
                            <h3 className="font-bold text-lg">{playlist.title}</h3>
                            <Badge variant="outline" className="text-[10px] uppercase">{playlist.phase.replace(/_/g, ' ')}</Badge>
                         </div>
                         <p className="text-xs text-muted-foreground">{playlist.items?.length || 0} items configured</p>
                      </div>
                   </div>
                   <div className="flex items-center gap-2">
                      <AssignDialog members={members} onAssign={(uid) => assignPlaylist.mutate({ playlistId: playlist.id, learnerId: uid })} />
                      <AddItemDialog 
                        playlistId={playlist.id} 
                        packId={packId!} 
                        onSave={(item) => addItem.mutate(item)} 
                      />
                      <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-destructive">
                         <Trash2 className="w-4 h-4" />
                      </Button>
                   </div>
                </div>
                
                <div className="p-6">
                   <div className="space-y-3">
                      {playlist.items?.length > 0 ? (
                        playlist.items.map((item: any) => (
                          <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card/50 hover:border-primary/30 transition-colors">
                             <div className="flex items-center gap-3">
                                <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
                                <div>
                                   <p className="text-sm font-medium">{item.title}</p>
                                   <p className="text-[10px] text-muted-foreground uppercase">{item.item_type}</p>
                                </div>
                             </div>
                             <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Settings2 className="w-3.5 h-3.5" />
                             </Button>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-6 text-muted-foreground text-xs italic">
                           No items added yet. Click "+" to add content.
                        </div>
                      )}
                   </div>
                </div>
             </div>
           ))}
           
           {playlists.length === 0 && !playlistsLoading && (
             <div className="bg-card border border-dashed border-border rounded-3xl p-20 text-center">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
                   <Layers className="w-8 h-8 text-muted-foreground/30" />
                </div>
                <h2 className="text-xl font-bold mb-2">Build Your First Program</h2>
                <p className="text-muted-foreground max-w-sm mx-auto mb-8">
                   Create structured playlists grouped by phase and assign them to your new hires.
                </p>
                <CreatePlaylistDialog onSave={(t, p) => createPlaylist.mutate({ title: t, phase: p })} />
             </div>
           )}
        </div>
      </div>
    </DashboardLayout>
  );
}

function AddItemDialog({ playlistId, packId, onSave }: { 
  playlistId: string, 
  packId: string, 
  onSave: (item: any) => void 
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<RoadmapItemType>("module");
  const [moduleId, setModuleId] = useState("");
  const [docSlug, setDocSlug] = useState("");

  const { data: genModules = [] } = useQuery({
    queryKey: ["gen_modules_list", packId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("generated_modules")
        .select("id, title")
        .eq("pack_id", packId);
      if (error) throw error;
      return data;
    },
    enabled: !!packId,
  });

  const { data: platformDocs = [] } = useQuery({
    queryKey: ["pack-docs-list", packId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pack_docs")
        .select("id, slug, title")
        .eq("pack_id", packId)
        .eq("status", "published");
      if (error) throw error;
      return data;
    },
    enabled: !!packId,
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" className="h-9 w-9">
          <Plus className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Item to Playlist</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Item Type</label>
            <Select value={type} onValueChange={(v) => setType(v as RoadmapItemType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="module">AI Module</SelectItem>
                <SelectItem value="doc">Platform Doc</SelectItem>
                <SelectItem value="task">Custom Task</SelectItem>
                <SelectItem value="link">External Link</SelectItem>
                <SelectItem value="quiz">Quiz</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Title</label>
            <Input 
              placeholder="e.g. Complete Environment Setup" 
              value={title} 
              onChange={(e) => setTitle(e.target.value)} 
            />
          </div>

          {type === 'module' && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Linked Module</label>
              <Select value={moduleId} onValueChange={setModuleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a module..." />
                </SelectTrigger>
                <SelectContent>
                  {genModules.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.title}</SelectItem>
                  ))}
                  {genModules.length === 0 && <p className="p-2 text-xs text-muted-foreground">No modules found.</p>}
                </SelectContent>
              </Select>
            </div>
          )}

          {type === 'doc' && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Linked Document</label>
              <Select value={docSlug} onValueChange={setDocSlug}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a document..." />
                </SelectTrigger>
                <SelectContent>
                  {platformDocs.map((d: any) => (
                    <SelectItem key={d.id} value={d.slug}>{d.title}</SelectItem>
                  ))}
                  {platformDocs.length === 0 && <p className="p-2 text-xs text-muted-foreground">No docs found.</p>}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button disabled={!title} onClick={() => { 
            const payload: any = { playlist_id: playlistId, title, item_type: type };
            if (type === 'module') payload.module_id = moduleId || null;
            if (type === 'doc') payload.url = `/packs/${packId}/docs/${docSlug}`;
            
            onSave(payload); 
            setOpen(false); 
            setTitle("");
            setModuleId("");
            setDocSlug("");
          }}>
            Add Item
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreatePlaylistDialog({ onSave }: { onSave: (title: string, phase: RoadmapPhase) => void }) {
  const [title, setTitle] = useState("");
  const [phase, setPhase] = useState<RoadmapPhase>("day_1_30");
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gradient-primary text-primary-foreground border-0 gap-2">
          <Plus className="w-4 h-4" /> New Program
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create Onboarding Program</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Program Title</label>
            <Input 
              placeholder="e.g. Backend Essentials" 
              value={title} 
              onChange={(e) => setTitle(e.target.value)} 
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Core Phase</label>
            <Select value={phase} onValueChange={(v) => setPhase(v as RoadmapPhase)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day_1_30">Day 1–30 (Fundamentals)</SelectItem>
                <SelectItem value="day_31_60">Day 31–60 (Deep Dive)</SelectItem>
                <SelectItem value="day_61_90">Day 61–90 (Mastery)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => { onSave(title, phase); setOpen(false); setTitle(""); }}>
            Create Playlist
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssignDialog({ members, playlists, onAssign }: { members: any[], playlists?: any[], onAssign: (...args: any[]) => void }) {
  const [open, setOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <UserPlus className="w-4 h-4" /> Assign
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign Program to Learner</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <Select value={selectedUser} onValueChange={setSelectedUser}>
            <SelectTrigger>
              <SelectValue placeholder="Select a learner..." />
            </SelectTrigger>
            <SelectContent>
               {members.map(m => (
                 <SelectItem key={m.user_id} value={m.user_id}>
                   {m.display_name}
                 </SelectItem>
               ))}
               {members.length === 0 && <p className="p-2 text-xs text-muted-foreground">No learners found in this pack.</p>}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button disabled={!selectedUser} onClick={() => { onAssign(selectedUser); setOpen(false); }}>
            Confirm Assignment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
