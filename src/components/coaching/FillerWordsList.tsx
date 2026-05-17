import { Badge } from "@/components/ui/badge";
import { MessageCircle } from "lucide-react";

interface FillerWord {
  word: string;
  count: number;
}

interface FillerWordsListProps {
  words: FillerWord[];
}

const FillerWordsList = ({ words }: FillerWordsListProps) => {
  if (!words || words.length === 0) return null;
  const total = words.reduce((sum, w) => sum + w.count, 0);

  return (
    <div className="space-y-2" dir="rtl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <MessageCircle className="w-4 h-4 text-amber-600" />
          كلمات الحشو
        </div>
        <span className="text-xs text-muted-foreground">المجموع: {total}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {words.map((w) => (
          <Badge
            key={w.word}
            variant="secondary"
            className="text-xs font-normal bg-amber-500/10 text-amber-900 dark:text-amber-300 border-amber-500/20"
          >
            <span className="font-semibold">{w.word}</span>
            <span className="mx-1 text-muted-foreground">×</span>
            <span>{w.count}</span>
          </Badge>
        ))}
      </div>
    </div>
  );
};

export default FillerWordsList;
