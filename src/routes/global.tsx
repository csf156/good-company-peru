import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { DrinkIcon } from "@/components/drink-icon";
import { LevelBadge } from "@/components/level-badge";
import { GLOBAL_INVITATIONS } from "@/lib/mock-data";
import { ArrowLeft, Clock, MapPin, Plus, Users } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/global")({
  head: () => ({ meta: [{ title: "Invitaciones abiertas · Ayni" }] }),
  component: GlobalPage,
});

function GlobalPage() {
  const [tab, setTab] = useState<"invitation" | "request">("invitation");
  const list = GLOBAL_INVITATIONS.filter((g) => g.type === tab);

  return (
    <AppShell hideNav header={
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-3 border-b border-border/60 bg-background/85 px-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-muted-foreground"><ArrowLeft size={22} /></Link>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-primary">En vivo · Lima</p>
            <p className="font-serif text-base italic text-foreground">Invitaciones abiertas</p>
          </div>
        </div>
        <button onClick={() => toast("Función Premium — publica tu invitación global")} className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Plus size={20} />
        </button>
      </header>
    }>
      <div className="sticky top-16 z-30 border-b border-border/60 bg-background/95 px-5 py-3 backdrop-blur">
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-surface p-1">
          {([["invitation", "De rentadores"], ["request", "De amigos"]] as const).map(([k, l]) => (
            <button
              key={k}
              onClick={() => setTab(k as "invitation" | "request")}
              className={`rounded-lg py-2 text-xs font-medium transition-all ${
                tab === k ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <section className="space-y-3 px-5 py-6">
        {list.map((g) => (
          <div key={g.id} className="rounded-2xl border border-border/60 bg-surface p-4">
            <div className="mb-3 flex items-center gap-3">
              <div className="size-10 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 ring-1 ring-white/10" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground">{g.fromName}</p>
                  <LevelBadge level={g.fromLevel} />
                </div>
                <p className="text-[10px] text-muted-foreground">{g.timeAgo}</p>
              </div>
            </div>

            <div className="mb-3 flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
              <div className="flex size-11 items-center justify-center rounded-lg bg-primary/20 text-primary">
                <DrinkIcon type={g.drink.icon} size={22} />
              </div>
              <div className="flex-1">
                <p className="font-mono text-[9px] uppercase tracking-tighter text-primary">
                  {g.drink.categoryLabel}
                </p>
                <p className="text-sm font-medium text-foreground">{g.drink.name}</p>
              </div>
              <p className="font-mono text-sm text-primary">S/ {g.drink.price}</p>
            </div>

            <p className="mb-3 text-[13px] italic text-foreground/85">"{g.note}"</p>

            <div className="mb-3 flex items-center gap-4 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1"><MapPin size={11} /> {g.zone}</span>
              <span className="flex items-center gap-1"><Clock size={11} /> {g.estimatedMinutes} min</span>
              <span className="flex items-center gap-1"><Users size={11} /> {g.interested} interesados</span>
            </div>

            <button
              onClick={() => toast.success("Postulación enviada", { description: "Recibirás una respuesta pronto" })}
              className="w-full rounded-xl bg-primary py-3 text-[11px] font-bold uppercase tracking-widest text-primary-foreground"
            >
              {tab === "invitation" ? "Postularme" : "Aceptar solicitud"}
            </button>
          </div>
        ))}
      </section>
    </AppShell>
  );
}
