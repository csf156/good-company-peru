import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { DrinkIcon } from "@/components/drink-icon";
import { INVITATIONS } from "@/lib/mock-data";
import { ArrowLeft, Check, Clock, X as XIcon } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/invitations")({
  head: () => ({ meta: [{ title: "Invitaciones · Ayni" }] }),
  component: InvitationsPage,
});

function InvitationsPage() {
  const [tab, setTab] = useState<"received" | "sent">("received");
  const list = INVITATIONS.filter((i) => i.direction === (tab === "received" ? "received" : "sent"));

  return (
    <AppShell hideNav header={
      <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-border/60 bg-background/85 px-4 backdrop-blur-md">
        <Link to="/profile" className="text-muted-foreground"><ArrowLeft size={22} /></Link>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-primary">Actividad</p>
          <p className="font-serif text-base italic text-foreground">Invitaciones</p>
        </div>
      </header>
    }>
      <div className="sticky top-16 z-30 border-b border-border/60 bg-background/95 px-5 py-3 backdrop-blur">
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-surface p-1">
          {(["received", "sent"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg py-2 text-xs font-medium transition-all ${
                tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {t === "received" ? "Recibidas" : "Enviadas"}
            </button>
          ))}
        </div>
      </div>

      <section className="space-y-3 px-5 py-6">
        {list.map((inv) => (
          <div key={inv.id} className="rounded-2xl border border-border/60 bg-surface p-4">
            <div className="flex items-center gap-3">
              <div className="size-11 flex-shrink-0 rounded-full ring-1 ring-white/10" style={{ background: inv.fromPhoto }} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {tab === "received" ? `${inv.fromName} te invita` : `Para ${inv.toName}`}
                </p>
                <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Clock size={10} /> {inv.createdAt} · {inv.estimatedMinutes} min
                </p>
              </div>
              <StatusPill status={inv.status} />
            </div>

            <div className="mt-3 flex items-center gap-3 rounded-xl border border-border/60 bg-background p-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <DrinkIcon type={inv.drink.icon} size={20} />
              </div>
              <div className="flex-1">
                <p className="font-mono text-[9px] uppercase tracking-tighter text-primary">{inv.drink.categoryLabel}</p>
                <p className="text-sm font-medium text-foreground">{inv.drink.name}</p>
              </div>
              <p className="font-mono text-sm text-foreground">S/ {inv.drink.price}</p>
            </div>

            {inv.message && (
              <p className="mt-3 rounded-xl bg-background/60 p-3 text-[12px] italic text-foreground/80">
                "{inv.message}"
              </p>
            )}

            {inv.status === "confirmada" && inv.location && (
              <div className="mt-3 rounded-xl bg-primary/10 p-3 text-[11px] text-foreground">
                📍 {inv.location} · {inv.meetingTime}
              </div>
            )}

            {inv.status === "pendiente" && tab === "received" && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button onClick={() => toast("Invitación rechazada")} className="flex items-center justify-center gap-1 rounded-xl border border-border py-2.5 text-xs text-muted-foreground">
                  <XIcon size={14} /> Rechazar
                </button>
                <button onClick={() => toast.success("Invitación aceptada")} className="flex items-center justify-center gap-1 rounded-xl bg-primary py-2.5 text-xs font-bold text-primary-foreground">
                  <Check size={14} /> Aceptar
                </button>
              </div>
            )}
          </div>
        ))}
        {list.length === 0 && (
          <p className="py-16 text-center text-sm text-muted-foreground">Sin invitaciones {tab === "received" ? "recibidas" : "enviadas"}.</p>
        )}
      </section>
    </AppShell>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    pendiente: { label: "Pendiente", className: "bg-primary/10 text-primary" },
    aceptada: { label: "Aceptada", className: "bg-[color:var(--success)]/10 text-[color:var(--success)]" },
    confirmada: { label: "Confirmada", className: "bg-[color:var(--success)]/10 text-[color:var(--success)]" },
    rechazada: { label: "Rechazada", className: "bg-destructive/10 text-destructive" },
    en_curso: { label: "En curso", className: "bg-primary/10 text-primary" },
    finalizada: { label: "Finalizada", className: "bg-muted/40 text-muted-foreground" },
  };
  const m = map[status] ?? map.pendiente;
  return (
    <span className={`rounded-sm px-2 py-0.5 font-mono text-[9px] uppercase tracking-tighter ${m.className}`}>
      {m.label}
    </span>
  );
}
