// Visual template picker — replaces the plain Select with 3 mini-previews.
// Each card renders an HTML/CSS thumbnail that mirrors the actual PDF layout
// produced by supabase/functions/render-cv-pdf/index.ts.

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type TemplateKey = "modern" | "conservative" | "executive";

interface Props {
  value: TemplateKey;
  onChange: (v: TemplateKey) => void;
}

const TEMPLATES: { key: TemplateKey; label: string; desc: string }[] = [
  { key: "modern", label: "حديث", desc: "شريط علوي ملوّن، عمود واحد" },
  { key: "conservative", label: "محافظ", desc: "كلاسيكي متمركز، خطوط رفيعة" },
  { key: "executive", label: "تنفيذي", desc: "عمودان وشريط جانبي داكن" },
];

// ----- Thumbnails (pure CSS, no real text) -----

const Line = ({ w = "100%", h = 4, c = "#cbd5e1", mt = 4 }: any) => (
  <div style={{ width: w, height: h, background: c, borderRadius: 2, marginTop: mt }} />
);

const ModernThumb = () => (
  <div className="w-full h-full bg-white overflow-hidden flex flex-col" style={{ direction: "rtl" }}>
    <div style={{ height: 10, background: "#1e40af" }} />
    <div className="flex-1" style={{ padding: "10px 12px" }}>
      <Line w="55%" h={7} c="#0f172a" mt={2} />
      <Line w="80%" h={3} c="#94a3b8" mt={3} />
      <div style={{ borderBottom: "1px solid #e5e7eb", marginTop: 6 }} />
      <Line w="35%" h={5} c="#1e40af" mt={8} />
      <div style={{ height: 2, background: "#1e40af", marginTop: 2 }} />
      <Line w="95%" mt={4} />
      <Line w="85%" />
      <Line w="90%" />
      <Line w="30%" h={5} c="#1e40af" mt={8} />
      <div style={{ height: 2, background: "#1e40af", marginTop: 2 }} />
      <Line w="92%" mt={4} />
      <Line w="78%" />
    </div>
  </div>
);

const ConservativeThumb = () => (
  <div className="w-full h-full bg-white overflow-hidden" style={{ padding: "14px 16px", direction: "rtl" }}>
    <div style={{ borderTop: "1px solid #9ca3af", borderBottom: "1px solid #9ca3af", padding: "6px 0", textAlign: "center" }}>
      <Line w="50%" h={6} c="#111" mt={0} />
      <div style={{ display: "flex", justifyContent: "center", marginTop: 4 }}>
        <Line w="60%" h={3} c="#94a3b8" mt={0} />
      </div>
    </div>
    <Line w="30%" h={4} c="#374151" mt={12} />
    <div style={{ height: 1, background: "#d1d5db", marginTop: 2 }} />
    <Line w="95%" mt={4} />
    <Line w="88%" />
    <Line w="92%" />
    <Line w="25%" h={4} c="#374151" mt={10} />
    <div style={{ height: 1, background: "#d1d5db", marginTop: 2 }} />
    <Line w="90%" mt={4} />
    <Line w="82%" />
  </div>
);

const ExecutiveThumb = () => (
  <div className="w-full h-full bg-white overflow-hidden flex" style={{ direction: "rtl" }}>
    <div style={{ width: "38%", background: "#0f172a", padding: "12px 8px" }}>
      <Line w="80%" h={6} c="#ffffff" mt={2} />
      <div style={{ height: 2, background: "#1e3a8a", marginTop: 4 }} />
      <Line w="70%" h={2} c="#94a3b8" mt={6} />
      <Line w="85%" h={2} c="#94a3b8" />
      <Line w="60%" h={2} c="#94a3b8" />
      <Line w="50%" h={4} c="#93c5fd" mt={12} />
      <Line w="90%" h={2} c="#cbd5e1" mt={4} />
      <Line w="78%" h={2} c="#cbd5e1" />
      <Line w="85%" h={2} c="#cbd5e1" />
      <Line w="55%" h={4} c="#93c5fd" mt={10} />
      <Line w="70%" h={2} c="#cbd5e1" mt={4} />
    </div>
    <div style={{ flex: 1, padding: "12px 10px" }}>
      <Line w="40%" h={5} c="#1e3a8a" mt={0} />
      <div style={{ height: 2, background: "#1e3a8a", marginTop: 2 }} />
      <Line w="95%" mt={4} />
      <Line w="88%" />
      <Line w="92%" />
      <Line w="35%" h={5} c="#1e3a8a" mt={10} />
      <div style={{ height: 2, background: "#1e3a8a", marginTop: 2 }} />
      <Line w="90%" mt={4} />
      <Line w="82%" />
      <Line w="86%" />
    </div>
  </div>
);

const THUMBS: Record<TemplateKey, () => JSX.Element> = {
  modern: ModernThumb,
  conservative: ConservativeThumb,
  executive: ExecutiveThumb,
};

export default function TemplateGallery({ value, onChange }: Props) {
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {TEMPLATES.map((tpl) => {
        const Thumb = THUMBS[tpl.key];
        const active = value === tpl.key;
        return (
          <button
            key={tpl.key}
            type="button"
            onClick={() => onChange(tpl.key)}
            className={cn(
              "group relative rounded-xl border-2 overflow-hidden text-right transition-all bg-card",
              active
                ? "border-primary ring-2 ring-primary/20 shadow-md"
                : "border-border hover:border-primary/50",
            )}
          >
            {active && (
              <div className="absolute top-1.5 left-1.5 z-10 w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow">
                <Check className="w-3 h-3" strokeWidth={3} />
              </div>
            )}
            <div
              className="w-full bg-muted/30 border-b"
              style={{ aspectRatio: "210 / 297" }}
            >
              <Thumb />
            </div>
            <div className="px-2 py-1.5">
              <div className="text-xs font-semibold text-foreground">{tpl.label}</div>
              <div className="text-[10px] text-muted-foreground leading-tight mt-0.5 line-clamp-1">
                {tpl.desc}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
