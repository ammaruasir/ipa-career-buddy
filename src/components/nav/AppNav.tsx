import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  LayoutDashboard,
  GraduationCap,
  FileText,
  ChevronDown,
  LogOut,
  Settings,
  Sparkles,
  MessagesSquare,
  PenLine,
  ScanSearch,
  Menu,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NEW_BADGE_KEY = "ipa.cv_hub_seen_v1";

const AppNav = () => {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showNewBadge, setShowNewBadge] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setShowNewBadge(localStorage.getItem(NEW_BADGE_KEY) !== "1");
    }
  }, []);

  const markSeen = () => {
    localStorage.setItem(NEW_BADGE_KEY, "1");
    setShowNewBadge(false);
  };

  if (!user) return null;

  // Hide on the public landing and on the live interview screens (immersive flows)
  const hideOn = ["/", "/login", "/reset-password"];
  if (hideOn.includes(location.pathname)) return null;
  if (location.pathname.startsWith("/interview/")) return null; // immersive interview UI

  const initial =
    user.user_metadata?.full_name?.[0]?.toUpperCase() ||
    user.email?.[0]?.toUpperCase() ||
    "م";

  const handleSignOut = async () => {
    await signOut();
    navigate("/", { replace: true });
  };

  const dashHref =
    role === "hr"
      ? "/dashboard/hr"
      : role === "instructor"
      ? "/dashboard/instructor"
      : role === "admin"
      ? "/dashboard/admin"
      : "/dashboard/candidate";

  return (
    <header
      className="sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur-md"
      dir="rtl"
    >
      <div className="container mx-auto flex items-center justify-between py-2.5 px-4">
        {/* Brand */}
        <Link to={dashHref} className="flex items-center gap-2.5 group shrink-0">
          <img
            src="/ipa-logo.png"
            alt="IPA"
            className="w-9 h-9 rounded-xl object-contain shadow-sm group-hover:shadow-md transition-shadow"
          />
          <div className="hidden sm:flex flex-col leading-tight">
            <span className="text-sm font-bold text-foreground">منصّة تدريب IPA</span>
            <span className="text-[10px] text-muted-foreground">
              التدريب · السيرة · المقابلات
            </span>
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          <NavItem to={dashHref} icon={LayoutDashboard} label="لوحتي" current={location.pathname} />
          <NavItem
            to="/interview/text?practice=true"
            icon={GraduationCap}
            label="تدريب"
            current={location.pathname}
          />

          {/* CV dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                onClick={markSeen}
                className={cn(
                  "relative flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-lg transition-colors",
                  location.pathname.startsWith("/cv/")
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                )}
              >
                <FileText className="w-4 h-4" />
                السيرة الذاتية
                <ChevronDown className="w-3 h-3 opacity-60" />
                {showNewBadge && (
                  <span className="absolute -top-1 -end-1 inline-flex items-center justify-center w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuItem asChild>
                <Link to="/cv/interview" className="flex items-start gap-3 py-2.5">
                  <MessagesSquare className="w-4 h-4 mt-0.5 text-primary" />
                  <div className="flex-1">
                    <div className="font-semibold text-sm">من الصفر بالمحادثة</div>
                    <div className="text-[11px] text-muted-foreground">
                      ١٥ سؤال موجَّه، AI يبني المسوّدة
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                    جديد
                  </Badge>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/cv/builder" className="flex items-start gap-3 py-2.5">
                  <PenLine className="w-4 h-4 mt-0.5 text-primary" />
                  <div className="flex-1">
                    <div className="font-semibold text-sm">منشئ يدوي + AI</div>
                    <div className="text-[11px] text-muted-foreground">
                      Stepper ٧ خطوات مع توليد ذكي
                    </div>
                  </div>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/cv/review" className="flex items-start gap-3 py-2.5">
                  <ScanSearch className="w-4 h-4 mt-0.5 text-primary" />
                  <div className="flex-1">
                    <div className="font-semibold text-sm">تقييم وحوار</div>
                    <div className="text-[11px] text-muted-foreground">
                      تحليل + chat لشرح ما يحتاج تحسين
                    </div>
                  </div>
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {role === "instructor" && (
            <NavItem
              to="/dashboard/instructor"
              icon={Users}
              label="دفعاتي"
              current={location.pathname}
            />
          )}

          <a
            href="/#features"
            className="px-3.5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/60 transition-colors hidden lg:inline-block"
          >
            ماذا نقدّم
          </a>
        </nav>

        {/* Right side: profile + mobile menu */}
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-full border border-border p-0.5 hover:border-primary/40 transition-colors">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
                    {initial}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <div className="px-2 py-1.5 text-xs text-muted-foreground border-b border-border mb-1">
                {user.email}
              </div>
              <DropdownMenuItem asChild>
                <Link to="/settings/profile" className="flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  الإعدادات
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleSignOut}
                className="flex items-center gap-2 text-destructive focus:text-destructive"
              >
                <LogOut className="w-4 h-4" />
                تسجيل الخروج
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Mobile menu */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 pt-10" dir="rtl">
              <nav className="flex flex-col gap-1">
                <MobileLink
                  to={dashHref}
                  icon={LayoutDashboard}
                  label="لوحتي"
                  onNavigate={() => setMobileOpen(false)}
                />
                <MobileLink
                  to="/interview/text?practice=true"
                  icon={GraduationCap}
                  label="ابدأ تدريباً"
                  onNavigate={() => setMobileOpen(false)}
                />
                <div className="my-2 border-t border-border" />
                <div className="px-3 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                  السيرة الذاتية
                </div>
                <MobileLink
                  to="/cv/interview"
                  icon={MessagesSquare}
                  label="من الصفر بالمحادثة"
                  onNavigate={() => {
                    setMobileOpen(false);
                    markSeen();
                  }}
                />
                <MobileLink
                  to="/cv/builder"
                  icon={PenLine}
                  label="منشئ يدوي"
                  onNavigate={() => setMobileOpen(false)}
                />
                <MobileLink
                  to="/cv/review"
                  icon={ScanSearch}
                  label="تقييم وحوار"
                  onNavigate={() => setMobileOpen(false)}
                />
                {role === "instructor" && (
                  <>
                    <div className="my-2 border-t border-border" />
                    <MobileLink
                      to="/dashboard/instructor"
                      icon={Users}
                      label="دفعاتي"
                      onNavigate={() => setMobileOpen(false)}
                    />
                  </>
                )}
                <div className="my-2 border-t border-border" />
                <MobileLink
                  to="/settings/profile"
                  icon={Settings}
                  label="الإعدادات"
                  onNavigate={() => setMobileOpen(false)}
                />
                <button
                  onClick={() => {
                    setMobileOpen(false);
                    handleSignOut();
                  }}
                  className="flex items-center gap-3 px-3 py-2.5 text-sm text-destructive rounded-lg hover:bg-destructive/10 transition-colors text-right"
                >
                  <LogOut className="w-4 h-4" />
                  تسجيل الخروج
                </button>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
};

const NavItem = ({
  to,
  icon: Icon,
  label,
  current,
}: {
  to: string;
  icon: typeof LayoutDashboard;
  label: string;
  current: string;
}) => {
  // Compare path part (strip query) so /interview/text?practice matches /interview/text
  const toPath = to.split("?")[0];
  const active = current === toPath || current.startsWith(toPath + "/");
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-lg transition-colors",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
      )}
    >
      <Icon className="w-4 h-4" />
      {label}
    </Link>
  );
};

const MobileLink = ({
  to,
  icon: Icon,
  label,
  onNavigate,
}: {
  to: string;
  icon: typeof LayoutDashboard;
  label: string;
  onNavigate: () => void;
}) => (
  <Link
    to={to}
    onClick={onNavigate}
    className="flex items-center gap-3 px-3 py-2.5 text-sm text-foreground rounded-lg hover:bg-muted/60 transition-colors"
  >
    <Icon className="w-4 h-4 text-primary" />
    {label}
  </Link>
);

export default AppNav;
