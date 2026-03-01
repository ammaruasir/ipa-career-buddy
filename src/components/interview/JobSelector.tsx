import { Button } from "@/components/ui/button";
import { GraduationCap, ArrowRight } from "lucide-react";

const JOBS = [
  "محلل أعمال",
  "أخصائي موارد بشرية",
  "مدير مشاريع",
  "محاسب",
  "مطور برمجيات",
  "أخصائي تسويق",
];

interface JobSelectorProps {
  title: string;
  onSelect: (job: string) => void;
  onBack: () => void;
}

const JobSelector = ({ title, onSelect, onBack }: JobSelectorProps) => (
  <div className="min-h-screen bg-background">
    <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto flex items-center gap-3 py-4 px-4">
        <Button variant="ghost" size="icon" className="rounded-xl" onClick={onBack}>
          <ArrowRight className="w-5 h-5" />
        </Button>
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
          <GraduationCap className="w-6 h-6 text-primary-foreground" />
        </div>
        <h2 className="text-lg font-bold">{title}</h2>
      </div>
    </header>
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-2xl mx-auto text-center space-y-8">
        <h2 className="text-2xl font-bold text-foreground">اختر الوظيفة المستهدفة</h2>
        <p className="text-muted-foreground">سيتم توليد أسئلة مخصصة بناءً على الوظيفة التي تختارها</p>
        <div className="grid grid-cols-2 gap-4">
          {JOBS.map((job) => (
            <Button
              key={job}
              variant="outline"
              className="rounded-2xl py-6 text-lg shadow-lg hover:shadow-xl hover:border-primary/30 transition-all"
              onClick={() => onSelect(job)}
            >
              {job}
            </Button>
          ))}
        </div>
      </div>
    </div>
  </div>
);

export default JobSelector;
