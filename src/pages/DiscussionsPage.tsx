import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DiscussionList } from "@/components/DiscussionList";
import { ThreadDetail } from "@/components/ThreadDetail";
import { DiscussionThread } from "@/hooks/useDiscussions";
import { MessageCircle } from "lucide-react";

export default function DiscussionsPage() {
  const [selectedThread, setSelectedThread] = useState<DiscussionThread | null>(null);

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        {selectedThread ? (
          <ThreadDetail thread={selectedThread} onBack={() => setSelectedThread(null)} />
        ) : (
          <>
            <div className="flex items-center gap-3 mb-6" data-tour="discussions-header">
              <MessageCircle className="w-6 h-6 text-primary" />
              <h1 className="text-2xl font-bold text-foreground">Discussions</h1>
            </div>
            <div data-tour="discussion-list">
              <DiscussionList onSelectThread={setSelectedThread} />
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
