import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { LevelBadge } from "@/components/level-badge";
import { CURRENT_USER, INVITATIONS, nextLevelProgress, LEVEL_META } from "@/lib/mock-data";
import {
  Award, ChevronRight, Gift, Globe2, Inbox, Lock, Settings, Sparkles, Wallet,
} from "lucide-react";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [{ title: "Mi perfil · Ayni" }, { name: "description", content: "Balance, nivel, invitaciones y ajustes." }],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const prog = nextLevelProgress(CURRENT_USER.spent);
  const meta = LEVEL_META[prog.current];
  const pending = INVITATIONS.filter((i) => i.status === "pendiente");

  return (
    <AppShell>
      <section className="fade-up px-5 pt-6">
        <div className="flex items-center gap-4">
          <div
            className="size-20 flex-shrink-0 rounded-full ring-2 ring-primary/40"
            style={{ background: "linear-gradient(135deg, hsl(38 85% 55%), hsl(24 60% 40%))" }}
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="font-serif text-2xl italic text-foreground">@{CURRENT_USER.alias}</h1>
              <LevelBadge level={CURRENT_USER.level} />
            </div>
            <p className="text-sm text-muted-foreground">Rentador · Miraflores, Lima</p>
            {!CURRENT_USER.premium && (
              <Link to="/premium" className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-primary">
                <Sparkles size={11} /> Activar Premium
              </Link>
            )}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-border/60 bg-surface p-4">
            <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Balance</p>
            <p className="mt-1 font-serif text-2xl italic text-primary">S/ {CURRENT_USER.balance}</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-surface p-4">
            <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Gastado</p>
            <p className="mt-1 font-serif text-2xl italic text-foreground">S/ {CURRENT_USER.spent}</p>
          </div>
        </div>
      </section>

      {/* Level progress */}
      <section className="fade-up px-5 py-6 [animation-delay:100ms]">
        <Link to="/levels" className="block rounded-2xl border border-border/60 bg-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="text-primary" size={18} />
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Progreso de nivel</p>
            </div>
            <ChevronRight className="text-muted-foreground" size={16} />
          </div>
          <div className="flex items-end justify-between">
            <p className="font-serif text-xl italic text-foreground">{meta.label}</p>
            {prog.next && (
              <p className="font-mono text-[10px] text-muted-foreground">
                S/ {prog.toNext} → {LEVEL_META[prog.next].label}
              </p>
            )}
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background">
            <div className="h-full rounded-full bg-primary" style={{ width: `${prog.percent}%` }} />
          </div>
        </Link>
      </section>

      {/* Menu */}
      <section className="fade-up space-y-2 px-5 pb-2 [animation-delay:180ms]">
        <MenuItem to="/invitations" icon={<Inbox size={18} />} label="Invitaciones" badge={pending.length} />
        <MenuItem to="/global" icon={<Globe2 size={18} />} label="Invitaciones abiertas" />
        <MenuItem to="/wallet" icon={<Wallet size={18} />} label="Cobros y liquidación" />
        <MenuItem to="/referrals" icon={<Gift size={18} />} label="Invita y gana" />
        <MenuItem to="/premium" icon={<Sparkles size={18} />} label={CURRENT_USER.premium ? "Ayni Premium ✓" : "Activar Premium"} accent={!CURRENT_USER.premium} />
        <MenuItem to="/privacy" icon={<Lock size={18} />} label="Perfil privado" />
        <MenuItem to="/settings" icon={<Settings size={18} />} label="Ajustes y seguridad" />
      </section>
    </AppShell>
  );
}

function MenuItem({ to, icon, label, badge, accent }: { to: string; icon: React.ReactNode; label: string; badge?: number; accent?: boolean }) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-4 rounded-2xl border p-4 transition-colors ${
        accent
          ? "border-primary/40 bg-gradient-to-br from-primary/10 to-transparent"
          : "border-border/60 bg-surface hover:border-primary/30"
      }`}
    >
      <div className={`flex size-10 items-center justify-center rounded-xl ${accent ? "bg-primary/20 text-primary" : "bg-background text-muted-foreground"}`}>
        {icon}
      </div>
      <span className={`flex-1 text-sm ${accent ? "font-medium text-foreground" : "text-foreground"}`}>{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="flex size-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
          {badge}
        </span>
      )}
      <ChevronRight className="text-muted-foreground" size={16} />
    </Link>
  );
}
