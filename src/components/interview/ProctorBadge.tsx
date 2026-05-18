import { Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ProctorBadgeProps {
  proctors: { role: string; name?: string }[];
  messages?: { text: string; from: string; at: string }[];
}

/**
 * Visible indicator shown on the candidate's interview UI whenever an admin,
 * HR, or instructor is presence-tracked on the proctor channel for this
 * session. Ethical disclosure + deterrent.
 */
const ProctorBadge = ({ proctors, messages }: ProctorBadgeProps) => {
  if (!proctors || proctors.length === 0) return null;

  const roleLabel = (role: string) => {
    switch (role) {
      case "admin": return "مسؤول";
      case "hr": return "موارد بشرية";
      case "instructor": return "مدرّب";
      default: return role;
    }
  };

  const latestMessage = messages && messages.length > 0 ? messages[messages.length - 1] : null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 pointer-events-none">
      <Badge variant="secondary" className="rounded-full px-3 py-1.5 gap-2 shadow-lg bg-amber-500/15 border border-amber-500/40 text-amber-900 dark:text-amber-200 pointer-events-auto">
        <Eye className="w-3.5 h-3.5" />
        <span className="text-xs font-medium">
          تتم مراقبة الجلسة من {proctors.map((p) => roleLabel(p.role)).join(" / ")}
        </span>
      </Badge>
      {latestMessage && (
        <div className="bg-card border border-border rounded-2xl shadow-lg px-4 py-2 max-w-md pointer-events-auto">
          <div className="text-xs text-muted-foreground mb-0.5">رسالة من {latestMessage.from}</div>
          <div className="text-sm">{latestMessage.text}</div>
        </div>
      )}
    </div>
  );
};

export default ProctorBadge;
