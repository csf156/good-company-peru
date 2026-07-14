import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { ArrowLeft, Copy, Gift, Users } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/referrals")({
  head: () => ({ meta: [{ title: "Invita y gana · Ayni" }] }),
  component: ReferralsPage,
});

function ReferralsPage() {
  const code = "AYNI-TUVIDE-1F4X";

  const copy = () => {
    navigator.clipboard?.writeText(code);
    toast.success("Código copiado");
  };

  return (
    <AppShell hideNav header={
      <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-border/60 bg-background/85 px-4 backdrop-blur-md">
        <Link to="/profile" className="text-muted-foreground"><ArrowLeft size={22} /></Link>
        <p className="font-serif text-base italic text-foreground">Invita y gana</p>
      </header>
    }>
      <section className="fade-up px-5 pt-8 text-center">
        <div className="mx-auto flex size-20 items-center justify-center rounded-3xl bg-primary/20 text-primary">
          <Gift size={36} strokeWidth={1.5} />
        </div>
        <h1 className="mt-4 font-serif text-3xl italic text-foreground">Invita amigos, gana crédito</h1>
        <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">
          Recibe S/ 15 de crédito en tu Bar por cada una de las 5 primeras compras (mín. S/ 50) de tu invitado.
        </p>
      </section>

      <section className="fade-up px-5 py-8 [animation-delay:100ms]">
        <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-transparent p-5">
          <p className="font-mono text-[10px] uppercase tracking-widest text-primary">Tu código</p>
          <div className="mt-2 flex items-center gap-3">
            <p className="flex-1 font-mono text-xl tracking-wide text-foreground">{code}</p>
            <button onClick={copy} className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Copy size={16} />
            </button>
          </div>
        </div>
        <button onClick={() => toast("Compartido")} className="mt-3 w-full rounded-2xl bg-primary py-4 text-sm font-bold uppercase tracking-widest text-primary-foreground">
          Compartir invitación
        </button>
      </section>

      <section className="fade-up px-5 pb-6 [animation-delay:200ms]">
        <div className="mb-3 flex items-center gap-2">
          <Users className="text-muted-foreground" size={16} />
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Tu progreso</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Invitados" value="2" />
          <Stat label="Compras" value="3/10" />
          <Stat label="Ganado" value="S/45" accent />
        </div>

        <div className="mt-6 space-y-3 rounded-2xl border border-border/60 bg-surface p-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Cómo funciona</p>
          <Step n="1" text="Comparte tu código con un amigo." />
          <Step n="2" text="Se registra e ingresa tu código al crear su cuenta." />
          <Step n="3" text="Cada compra en la Tienda (mín. S/ 50) suma S/ 15 a tu balance." />
          <Step n="4" text="Aplica a las 5 primeras compras de tu invitado — hasta S/ 75 por amigo." />
        </div>

        <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/5 p-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-primary">Bonus amigo en renta</p>
          <p className="mt-1 text-[12px] text-foreground/85">
            Si refieres a un amigo en renta, ganas <span className="text-primary font-medium">10% de su recaudación</span> en las 5 primeras citas que reciba.
          </p>
        </div>
      </section>
    </AppShell>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-border/60 bg-surface p-3 text-center">
      <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`mt-1 font-serif text-xl italic ${accent ? "text-primary" : "text-foreground"}`}>{value}</p>
    </div>
  );
}

function Step({ n, text }: { n: string; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex size-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/20 font-mono text-[10px] text-primary">
        {n}
      </div>
      <p className="text-[12px] text-foreground/85">{text}</p>
    </div>
  );
}
