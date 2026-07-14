import { Link, useRouterState } from "@tanstack/react-router";
import { Compass, Wine, Store, MessageCircle, User } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { CURRENT_USER } from "@/lib/mock-data";

interface Props {
  children: ReactNode;
  hideNav?: boolean;
  headerRight?: ReactNode;
  header?: ReactNode;
}

const TABS = [
  { to: "/", label: "Explora", icon: Compass },
  { to: "/bar", label: "Bar", icon: Wine },
  { to: "/store", label: "Tienda", icon: Store },
  { to: "/chats", label: "Chats", icon: MessageCircle },
  { to: "/profile", label: "Perfil", icon: User },
] as const;

export function AppShell({ children, hideNav, header }: Props) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background text-foreground">
      {header ?? <DefaultHeader />}
      <main className={cn("flex-1", !hideNav && "pb-28")}>{children}</main>
      {!hideNav && <BottomNav />}
    </div>
  );
}

function DefaultHeader() {
  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border/60 bg-background/85 px-5 backdrop-blur-md">
      <Link to="/" className="flex flex-col leading-none">
        <span className="font-mono text-[10px] uppercase tracking-widest text-primary">Ritual</span>
        <span className="font-serif text-xl italic font-bold text-foreground">Ayni</span>
      </Link>
      <Link
        to="/profile"
        className="flex items-center gap-2 rounded-full border border-border/60 bg-surface px-3 py-1.5"
      >
        <span className="size-1.5 rounded-full bg-primary shadow-[var(--shadow-glow-sm)]" />
        <span className="font-mono text-[11px] tracking-tight text-foreground">
          S/ {CURRENT_USER.balance.toFixed(2)}
        </span>
      </Link>
    </header>
  );
}

function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-3xl border border-border/60 bg-surface/95 p-2 shadow-2xl backdrop-blur-xl">
      <div className="flex items-center justify-between">
        {TABS.map((t) => {
          const active =
            t.to === "/" ? pathname === "/" : pathname === t.to || pathname.startsWith(`${t.to}/`);
          const Icon = t.icon;
          return (
            <Link
              key={t.to}
              to={t.to}
              className={cn(
                "flex h-12 min-w-12 flex-1 flex-col items-center justify-center rounded-2xl transition-all",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon size={18} strokeWidth={active ? 2.2 : 1.6} />
              <span className={cn("mt-0.5 text-[8px] font-bold uppercase tracking-wider")}>
                {t.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
