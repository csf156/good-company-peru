import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { CURRENT_USER } from "@/lib/mock-data";
import { ArrowDownToLine, ArrowLeft, Calendar, Info } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/wallet")({
  head: () => ({ meta: [{ title: "Cobros · Ayni" }] }),
  component: WalletPage,
});

const HISTORY = [
  { id: "t1", date: "Lun 8 Jul", label: "Liquidación semanal", amount: 340, kind: "in" },
  { id: "t2", date: "Sáb 6 Jul", label: "Pisco Sour · Alessandra V.", amount: 32, kind: "in" },
  { id: "t3", date: "Vie 5 Jul", label: "Compra bebida · Malbec", amount: -78, kind: "out" },
  { id: "t4", date: "Jue 4 Jul", label: "Coca Sour Élite · Sebastián R.", amount: 95, kind: "in" },
];

function WalletPage() {
  return (
    <AppShell hideNav header={
      <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-border/60 bg-background/85 px-4 backdrop-blur-md">
        <Link to="/profile" className="text-muted-foreground"><ArrowLeft size={22} /></Link>
        <p className="font-serif text-base italic text-foreground">Cobros y liquidación</p>
      </header>
    }>
      <section className="fade-up px-5 pt-6">
        <div className="rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/10 to-transparent p-6">
          <p className="font-mono text-[10px] uppercase tracking-widest text-primary">Balance disponible</p>
          <p className="mt-2 font-serif text-5xl italic text-primary">S/ {CURRENT_USER.balance}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Próxima liquidación gratuita: <span className="text-foreground">lunes 22 Jul</span></p>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <button onClick={() => toast("Liquidación programada", { description: "El lunes recibirás el balance completo, sin comisión." })} className="flex flex-col items-center gap-1 rounded-xl bg-primary py-3 text-primary-foreground">
              <Calendar size={16} />
              <span className="text-[10px] font-bold uppercase tracking-widest">Esperar lunes</span>
              <span className="text-[9px] opacity-80">Gratis</span>
            </button>
            <button onClick={() => toast.success("Solicitud enviada", { description: "Fee S/ 8. Solo Premium usa on-demand gratis." })} className="flex flex-col items-center gap-1 rounded-xl border border-primary/40 py-3 text-primary">
              <ArrowDownToLine size={16} />
              <span className="text-[10px] font-bold uppercase tracking-widest">On-demand</span>
              <span className="text-[9px] opacity-80">S/ 8 fee</span>
            </button>
          </div>
        </div>
      </section>

      <section className="fade-up px-5 py-6 [animation-delay:120ms]">
        <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-surface p-3">
          <Info size={14} className="flex-shrink-0 text-primary" />
          <p className="text-[11px] text-muted-foreground">
            Liquidación gratuita todos los <strong className="text-foreground">lunes</strong>. On-demand cualquier día con S/ 8 de fee — <Link to="/premium" className="text-primary underline">gratis con Premium</Link>.
          </p>
        </div>
      </section>

      <section className="fade-up px-5 pb-6 [animation-delay:200ms]">
        <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Historial</p>
        <div className="space-y-2">
          {HISTORY.map((h) => (
            <div key={h.id} className="flex items-center justify-between rounded-xl border border-border/60 bg-surface p-3">
              <div>
                <p className="text-[13px] font-medium text-foreground">{h.label}</p>
                <p className="font-mono text-[10px] text-muted-foreground">{h.date}</p>
              </div>
              <span className={`font-mono text-sm ${h.kind === "in" ? "text-[color:var(--success)]" : "text-muted-foreground"}`}>
                {h.kind === "in" ? "+" : ""}S/ {Math.abs(h.amount)}
              </span>
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
