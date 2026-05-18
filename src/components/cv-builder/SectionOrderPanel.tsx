// SectionOrderPanel — drag-and-drop section reordering using @dnd-kit.
// Sections are: summary, experience, education, skills, certifications,
// volunteer, projects, awards, languages_structured (only those with content
// are shown).
//
// Storage: an array of section keys, persisted as cv_drafts.section_order.
// Renderers (PreviewStep + render-cv-pdf) iterate this order; unknown keys
// or sections with no content are skipped.

import { useMemo } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { Card } from "@/components/ui/card";

export const SECTION_KEYS = [
  "summary",
  "experience",
  "education",
  "skills",
  "certifications",
  "volunteer",
  "projects",
  "awards",
  "languages_structured",
] as const;

export type SectionKey = (typeof SECTION_KEYS)[number];

const LABELS_AR: Record<SectionKey, string> = {
  summary: "الملخّص",
  experience: "الخبرة العمليّة",
  education: "التعليم",
  skills: "المهارات",
  certifications: "الشهادات",
  volunteer: "العمل التطوّعي",
  projects: "المشاريع",
  awards: "الجوائز",
  languages_structured: "اللغات (CEFR)",
};

interface SectionOrderPanelProps {
  /** Current order array. If null/empty, defaults to SECTION_KEYS. */
  order: string[] | null | undefined;
  onChange: (order: string[]) => void;
  /** Which sections currently have content — others are dimmed/hidden. */
  hasContent: Partial<Record<SectionKey, boolean>>;
}

// Resolve the effective order (fill any missing keys at the end so users
// see new sections even after they've customized order earlier).
export function resolveSectionOrder(stored: string[] | null | undefined): SectionKey[] {
  const base = (stored ?? []).filter((k): k is SectionKey =>
    (SECTION_KEYS as readonly string[]).includes(k),
  );
  const missing = SECTION_KEYS.filter((k) => !base.includes(k));
  return [...base, ...missing];
}

const SortableSection = ({
  id,
  label,
  hasContent,
}: {
  id: SectionKey;
  label: string;
  hasContent: boolean;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/40 cursor-grab active:cursor-grabbing ${
        hasContent ? "border-border" : "border-dashed border-muted-foreground/30 opacity-60"
      }`}
    >
      <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
      <span className="text-sm font-medium text-foreground flex-1">{label}</span>
      {!hasContent && (
        <span className="text-[10px] text-muted-foreground">(فارغ — لن يظهر)</span>
      )}
    </div>
  );
};

const SectionOrderPanel = ({ order, onChange, hasContent }: SectionOrderPanelProps) => {
  const items = useMemo(() => resolveSectionOrder(order), [order]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.indexOf(active.id as SectionKey);
    const newIndex = items.indexOf(over.id as SectionKey);
    if (oldIndex === -1 || newIndex === -1) return;
    onChange(arrayMove(items, oldIndex, newIndex));
  };

  return (
    <Card className="rounded-2xl border-border">
      <div className="p-4 space-y-3">
        <div className="space-y-1">
          <h3 className="font-semibold text-foreground text-sm">ترتيب أقسام السيرة</h3>
          <p className="text-xs text-muted-foreground">
            اسحب الأقسام لتغيير ترتيب ظهورها في الـ PDF والمعاينة. الأقسام الفارغة لن تظهر.
          </p>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items} strategy={verticalListSortingStrategy}>
            <div className="space-y-1.5">
              {items.map((id) => (
                <SortableSection
                  key={id}
                  id={id}
                  label={LABELS_AR[id]}
                  hasContent={!!hasContent[id]}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </Card>
  );
};

export default SectionOrderPanel;
