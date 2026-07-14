import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { ArrowLeft, Check, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/premium")({
  head: () => ({ meta: [{ title: "Ayni Premium" }] }),
  component: PremiumPage,
});

const RENTER_PERKS = [
  "Invitaciones globales ilimitadas",
  "Perfil privado — preselecciona quién te contacta",
  "5% descuento en toda La Cava",
  "Filtros avanzados por distrito, hobby, horario",
  "1 Súper Invitación destacada por semana",
  "Historial extendido + amigos favoritos",
  "Ver quién visitó tu perfil",
];

const FRIEND_PERKS = [
  "Comisión 15% (en vez de 30%) por bebida",
  "Preferencias de salida detalladas",
  "Perfil privado — preselecciona quién puede invitarte",
  "Liquidación on-demand cualquier día",
  "Ver quién visitó tu perfil",
  "Destacado 2× por semana en Explora",
  "Estadísticas de perfil",
];

function PremiumPage() {
  return (
    <AppShell hideNav header={
      <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-border/60 bg-background/85 px-4 backdrop-blur-md">
        <Link to="/profile" className="text-muted-foreground"><ArrowLeft size={22} /></Link>
        <p className="font-serif text-base italic text-foreground">Ayni Premium</p>
      </header>
    }>
      <section className="fade-up px-5 pt-6 text-center">
        <div className="mx-auto flex size-20 items-center justify-center rounded-3xl bg-primary/20 text-primary shadow-[var(--shadow-glow)]">
          <Sparkles size={36} strokeWidth={1.5} />
        </div>
        <p className="mt-4 font-mono text-[10px] uppercase tracking-widest text-primary">Membresía</p>
        <h1 className="font-serif text-4xl italic text-foreground">Ayni Premium</h1>
        <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">
          Elige el plan que va con tu rol. Cancela cuando quieras.
        </p>
      </section>

      <section className="fade-up px-5 py-8 [animation-delay:120ms]">
        <div className="mb-4 rounded-3xl border border-primary/40 bg-gradient-to-br from-primary/10 to-transparent p-6">
          <div className="mb-4 flex items-baseline justify-between">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-primary">Rentador Premium</p>
              <h3 className="font-serif text-2xl italic text-foreground">Anfitrión</h3>
            </div>
            <p className="font-serif text-3xl italic text-primary">
              S/39<span className="text-sm text-muted-foreground">.90/mes</span>
            </p>
          </div>
          <ul className="space-y-2">
            {RENTER_PERKS.map((p) => (
              <li key={p} className="flex items-start gap-2 text-[13px] text-foreground/90">
                <Check className="mt-0.5 flex-shrink-0 text-primary" size={14} />
                {p}
              </li>
            ))}
          </ul>
          <button onClick={() => toast.success("Suscripción activada · MVP")} className="mt-5 w-full rounded-2xl bg-primary py-3.5 text-xs font-bold uppercase tracking-widest text-primary-foreground shadow-[var(--shadow-glow)]">
            Activar Premium
          </button>
        </div>

        <div className="rounded-3xl border border-border/60 bg-surface p-6">
          <div className="mb-4 flex items-baseline justify-between">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Amigo en Renta Premium</p>
              <h3 className="font-serif text-2xl italic text-foreground">Anfitrión invitado</h3>
            </div>
            <p className="font-serif text-3xl italic text-foreground">
              S/29<span className="text-sm text-muted-foreground">.90/mes</span>
            </p>
          </div>
          <ul className="space-y-2">
            {FRIEND_PERKS.map((p) => (
              <li key={p} className="flex items-start gap-2 text-[13px] text-foreground/90">
                <Check className="mt-0.5 flex-shrink-0 text-primary" size={14} />
                {p}
              </li>
            ))}
          </ul>
          <button onClick={() => toast.success("Suscripción activada · MVP")} className="mt-5 w-full rounded-2xl border border-primary bg-transparent py-3.5 text-xs font-bold uppercase tracking-widest text-primary">
            Activar Premium
          </button>
        </div>
      </section>
    </AppShell>
  );
}
