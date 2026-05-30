import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trophy, ExternalLink, CheckCircle2, ArrowRight } from "lucide-react";
import { useTickets, assignTicket, Ticket } from "@/hooks/useTickets";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export function GraduationModal({ 
  isOpen, 
  onClose, 
  packTitle, 
  packId 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  packTitle: string;
  packId: string;
}) {
  const { data: tickets, isLoading } = useTickets(packId);
  const [assignedId, setAssignedId] = useState<string | null>(null);

  const handleAssign = async (ticket: Ticket) => {
    const result = await assignTicket(ticket.id);
    if (result.success) {
      setAssignedId(ticket.id);
      toast.success("Ticket assigned! Happy contributing.");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[550px] overflow-hidden">
        <AnimatePresence>
          {isOpen && !assignedId && (
            <motion.div 
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1.2, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="absolute inset-0 pointer-events-none z-50 flex items-center justify-center"
            >
              <div className="w-full h-full bg-primary/5 rounded-full blur-3xl" />
            </motion.div>
          )}
        </AnimatePresence>
        
        <DialogHeader className="text-center pt-6">
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4"
          >
            <Trophy className="w-8 h-8 text-primary" />
          </motion.div>
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <DialogTitle className="text-2xl font-bold">Pack Completed!</DialogTitle>
            <DialogDescription className="text-base">
              Congratulations! You've mastered all modules in <span className="font-semibold text-foreground">{packTitle}</span>.
            </DialogDescription>
          </motion.div>
        </DialogHeader>

        <div className="py-6">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            🚀 Next Step: Your First Contribution
          </h3>
          <p className="text-xs text-muted-foreground mb-4">
            Ready to apply your knowledge? Here are some "Good First Issues" from this project:
          </p>

          <div className="space-y-3">
            {isLoading ? (
              <div className="text-center py-4 text-xs text-muted-foreground">Loading issues...</div>
            ) : (
              tickets?.map((ticket) => (
                <div 
                  key={ticket.id} 
                  className={`p-4 rounded-xl border transition-all ${
                    assignedId === ticket.id ? "bg-primary/5 border-primary/30" : "bg-card hover:border-primary/20"
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <Badge variant="outline" className="text-[10px] uppercase font-mono tracking-tighter">
                      {ticket.provider} • {ticket.id}
                    </Badge>
                    <a href={ticket.url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                  <h4 className="text-sm font-medium mb-3">{ticket.title}</h4>
                  
                  <Button 
                    size="sm" 
                    className="w-full gap-2 text-xs" 
                    disabled={!!assignedId}
                    onClick={() => handleAssign(ticket)}
                    variant={assignedId === ticket.id ? "secondary" : "default"}
                  >
                    {assignedId === ticket.id ? (
                      <><CheckCircle2 className="w-3.5 h-3.5" /> Assigned</>
                    ) : (
                      <>Assign to Me <ArrowRight className="w-3.5 h-3.5" /></>
                    )}
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>

        <DialogFooter className="sm:justify-center border-t pt-4">
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
