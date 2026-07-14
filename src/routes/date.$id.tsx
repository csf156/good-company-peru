import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { CHATS, DRINKS, calcTotalWithFees } from "@/lib/mock-data";
import { AlertTriangle, ArrowLeft, Bell, Plus, QrCode, Share2, ShieldCheck, Timer, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/date/$id")({
  head: () => ({ meta: [{ title: "Cita activa · Ayni" }, { name: "robots", content: "noindex" }] }),
  component: DatePage,
});

type Phase = "pre_scan" | "in_progress" | "finished";

function DatePage() {
  const { id } = Route.useParams();
  const chat = CHATS.find((c) => c.id === id) ?? CHATS[0];
  const durationMinutes = 90;

  const [phase, setPhase] = useState<Phase>("pre_scan");
  const [remaining, setRemaining] = useState(durationMinutes * 60); // seconds
  const [extendOpen, setExtendOpen] = useState(false);
  const [panicOpen, setPanicOpen] = useState(false);

  useEffect(() => {
    if (phase !== "in_progress") return;
    const t = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) { clearInterval(t); setPhase("finished"); return 0; }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [phase]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const totalSecs = durationMinutes * 60;
  const percent = phase === "finished" ? 100 : ((totalSecs - remaining) / totalSecs) * 100;

  const startDate = () => {
    setPhase("in_progress");
    toast.success("Cita iniciada", { description: "El conteo empezó. ¡Disfruta!" });
  };

  const triggerPanic = () => {
    setPanicOpen(false);
    toast.error("Alerta enviada", {
      description: "Contactos de emergencia y soporte notificados. Comparte tu ubicación en vivo.",
    });
  };

  return (
    <AppShell hideNav header={
      <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-border/60 bg-background/85 px-4 backdrop-blur-md">
        <Link to="/chats/$id" params={{ id: chat.id }} className="text-muted-foreground">
          <ArrowLeft size={22} />
        </Link>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-primary">Cita en curso</p>
          <p className="font-serif text-base italic text-foreground">con {chat.otherName}</p>
        </div>
      </header>
    }>
      {phase === "pre_scan" && (
        <section className="px-5 py-8 text-center">
          <div className="mx-auto mb-6 flex size-64 items-center justify-center rounded-3xl border-2 border-primary/40 bg-surface">
            <QRPlaceholder />
          </div>
          <h2 className="font-serif text-2xl italic text-foreground">Escanea el QR del otro</h2>
          <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">
            Ambos deben escanearse mutuamente para iniciar el conteo de tiempo. Es obligatorio para cobrar.
          </p>

          <div className="mx-auto mt-6 flex max-w-xs items-center gap-2 rounded-xl bg-primary/10 p-3 text-left">
            <ShieldCheck className="flex-shrink-0 text-primary" size={18} />
            <p className="text-[11px] text-muted-foreground">
              Tu QR es único por cita y expira en 20 minutos. Nadie más puede escanearlo.
            </p>
          </div>

          <button
            onClick={startDate}
            className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-primary px-8 py-4 text-sm font-bold uppercase tracking-widest text-primary-foreground shadow-[var(--shadow-glow)]"
          >
            <QrCode size={18} /> Simular escaneo
          </button>
        </section>
      )}

      {phase !== "pre_scan" && (
        <>
          <section className="px-5 pt-8 text-center">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {phase === "finished" ? "Cita finalizada" : "Tiempo restante"}
            </p>
            <div className="my-4 font-serif text-7xl italic text-primary tabular-nums">
              {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
            </div>
            <div className="mx-auto h-1.5 max-w-xs overflow-hidden rounded-full bg-surface">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${percent}%` }}
              />
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">
              {chat.drinkName} · {durationMinutes} min acordados
            </p>
          </section>

          {phase === "in_progress" && (
            <>
              <section className="grid grid-cols-2 gap-3 px-5 py-6">
                <button
                  onClick={() => setExtendOpen(true)}
                  className="rounded-2xl border border-primary/40 bg-primary/10 p-4 text-left"
                >
                  <Plus className="mb-2 text-primary" size={20} />
                  <p className="text-sm font-medium text-foreground">Invitar otra bebida</p>
                  <p className="text-[10px] text-muted-foreground">Extiende la cita</p>
                </button>
                <button className="rounded-2xl border border-border/60 bg-surface p-4 text-left">
                  <Share2 className="mb-2 text-muted-foreground" size={20} />
                  <p className="text-sm font-medium text-foreground">Compartir ubicación</p>
                  <p className="text-[10px] text-muted-foreground">Con contactos</p>
                </button>
              </section>

              <section className="px-5">
                <div className="rounded-2xl border border-border/60 bg-surface p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Bell className="text-primary" size={16} />
                    <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      Recordatorios activos
                    </p>
                  </div>
                  <div className="space-y-2">
                    <ReminderItem time="15 min antes del final" active />
                    <ReminderItem time="Al finalizar la cita" active />
                    <ReminderItem time="Check-in a mitad de cita" active />
                  </div>
                </div>
              </section>
            </>
          )}

          {phase === "finished" && (
            <section className="px-5 py-6">
              <div className="rounded-2xl border border-[color:var(--success)]/40 bg-[color:var(--success)]/10 p-5 text-center">
                <h3 className="font-serif text-xl italic text-foreground">Cita completada</h3>
                <p className="mt-1 text-sm text-muted-foreground">S/ {chat.drinkName === "Amazonía Salvaje" ? "95" : "32"} disponibles para cobro los días lunes.</p>
                <Link to="/profile" className="mt-4 inline-block rounded-xl bg-primary px-6 py-3 text-[11px] font-bold uppercase tracking-widest text-primary-foreground">
                  Ver mi balance
                </Link>
              </div>
              <button className="mt-4 w-full rounded-2xl border border-border/60 bg-surface py-4 text-sm text-foreground">
                Dejar reseña
              </button>
            </section>
          )}
        </>
      )}

      {/* Panic button - always visible during date */}
      {phase === "in_progress" && (
        <button
          onClick={() => setPanicOpen(true)}
          className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full border border-destructive/50 bg-destructive/20 px-5 py-3 text-xs font-bold uppercase tracking-widest text-destructive backdrop-blur"
        >
          <AlertTriangle size={16} /> Botón de pánico
        </button>
      )}

      {extendOpen && <ExtendModal onClose={() => setExtendOpen(false)} onConfirm={() => { setExtendOpen(false); setRemaining((r) => r + 30 * 60); toast.success("Cita extendida", { description: "+30 min agregados" }); }} />}
      {panicOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6" onClick={() => setPanicOpen(false)}>
          <div className="w-full max-w-sm rounded-3xl border border-destructive/50 bg-surface p-6" onClick={(e) => e.stopPropagation()}>
            <AlertTriangle className="mb-3 text-destructive" size={32} />
            <h3 className="font-serif text-xl italic text-foreground">¿Enviar alerta?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Se notificará a tus 3 contactos de emergencia y al equipo de soporte con tu ubicación en vivo.
            </p>
            <div className="mt-5 flex gap-3">
              <button onClick={() => setPanicOpen(false)} className="flex-1 rounded-xl border border-border py-3 text-sm text-muted-foreground">
                Cancelar
              </button>
              <button onClick={triggerPanic} className="flex-1 rounded-xl bg-destructive py-3 text-sm font-bold text-destructive-foreground">
                Enviar alerta
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function ReminderItem({ time, active }: { time: string; active: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`size-1.5 rounded-full ${active ? "bg-primary" : "bg-muted"}`} />
      <span className="text-[12px] text-foreground/90">{time}</span>
    </div>
  );
}

function ExtendModal({ onClose, onConfirm }: { onClose: () => void; onConfirm: () => void }) {
  const drink = DRINKS[8];
  const fees = calcTotalWithFees(drink.price);
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="mx-auto w-full max-w-md rounded-t-3xl border border-border/60 bg-surface p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-primary">Extender cita</p>
            <h3 className="font-serif text-2xl italic text-foreground">Una bebida más</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground"><X size={22} /></button>
        </div>
        <div className="rounded-2xl border border-primary/40 bg-primary/5 p-4">
          <p className="font-serif text-lg italic text-foreground">{drink.name}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">{drink.description}</p>
          <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3">
            <span className="text-xs text-muted-foreground">+30 min a la cita</span>
            <span className="font-mono text-lg text-primary">S/ {fees.total.toFixed(2)}</span>
          </div>
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <Timer size={11} /> La otra persona debe aceptar la nueva bebida para extender.
        </p>
        <button onClick={onConfirm} className="mt-5 w-full rounded-2xl bg-primary py-4 text-sm font-bold uppercase tracking-widest text-primary-foreground">
          Enviar propuesta
        </button>
      </div>
    </div>
  );
}

function QRPlaceholder() {
  // Simple SVG QR-like pattern
  const cells = Array.from({ length: 400 }, (_, i) => Math.random() > 0.5 && i);
  return (
    <div className="relative size-48">
      <div className="grid size-full grid-cols-20 gap-[1px]">
        {Array.from({ length: 400 }).map((_, i) => (
          <div
            key={i}
            className={cells[i] ? "bg-foreground" : "bg-transparent"}
            style={{ aspectRatio: "1" }}
          />
        ))}
      </div>
      {[["top-0 left-0"], ["top-0 right-0"], ["bottom-0 left-0"]].map(([pos], i) => (
        <div key={i} className={`absolute size-10 border-4 border-primary ${pos}`}>
          <div className="m-1 size-6 bg-primary" />
        </div>
      ))}
    </div>
  );
}
