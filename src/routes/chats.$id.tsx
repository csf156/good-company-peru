import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { LevelBadge } from "@/components/level-badge";
import { CHATS } from "@/lib/mock-data";
import { ArrowLeft, CalendarCheck, MapPin, Send, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/chats/$id")({
  head: ({ params }) => {
    const chat = CHATS.find((c) => c.id === params.id);
    return {
      meta: [
        { title: `${chat?.otherName ?? "Chat"} · Ayni` },
        { name: "robots", content: "noindex" },
      ],
    };
  },
  notFoundComponent: () => (
    <AppShell hideNav>
      <div className="px-6 pt-20 text-center">
        <p className="text-muted-foreground">Chat no encontrado.</p>
      </div>
    </AppShell>
  ),
  component: ChatDetailPage,
});

function ChatDetailPage() {
  const { id } = Route.useParams();
  const chat = CHATS.find((c) => c.id === id);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [confirmed, setConfirmed] = useState(chat?.confirmed ?? false);
  const [location, setLocation] = useState("Ayahuasca Bar · Barranco");
  const [when, setWhen] = useState("Viernes 9:30 PM");
  const [extraNote, setExtraNote] = useState("Nos vemos en la barra");
  const navigate = useNavigate();

  if (!chat) return null;

  const doConfirm = () => {
    setConfirmed(true);
    setConfirmOpen(false);
    toast.success("Cita confirmada", { description: `${location} · ${when}` });
  };

  const send = () => {
    if (!msg.trim()) return;
    toast("Mensaje enviado");
    setMsg("");
  };

  return (
    <AppShell hideNav header={
      <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-border/60 bg-background/85 px-4 backdrop-blur-md">
        <Link to="/chats" className="text-muted-foreground">
          <ArrowLeft size={22} />
        </Link>
        <div
          className="size-9 flex-shrink-0 rounded-full ring-1 ring-white/10"
          style={{ background: chat.otherPhoto }}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-serif text-base italic text-foreground">{chat.otherName}</p>
          <div className="flex items-center gap-1.5">
            <LevelBadge level={chat.otherLevel} />
            <span className="text-[10px] text-muted-foreground">· {chat.drinkName}</span>
          </div>
        </div>
      </header>
    }>
      {/* Confirmation banner */}
      {confirmed && (
        <div className="mx-4 mt-4 rounded-2xl border border-primary/40 bg-primary/10 p-4">
          <div className="mb-2 flex items-center gap-2">
            <CalendarCheck className="text-primary" size={18} />
            <p className="font-mono text-[11px] uppercase tracking-widest text-primary">Cita confirmada</p>
          </div>
          <p className="font-serif text-lg italic text-foreground">{location}</p>
          <p className="text-sm text-muted-foreground">{when}</p>
          <p className="mt-2 text-[12px] text-foreground/80">"{extraNote}"</p>
          <button
            onClick={() => navigate({ to: "/date/$id", params: { id: chat.id } })}
            className="mt-4 w-full rounded-xl bg-primary py-3 text-[11px] font-bold uppercase tracking-widest text-primary-foreground"
          >
            Ir a la cita activa
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="space-y-3 px-4 py-6">
        {chat.messages.map((m) => (
          <div key={m.id} className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-[13px] ${
                m.from === "me"
                  ? "rounded-br-sm bg-primary text-primary-foreground"
                  : "rounded-bl-sm border border-border/60 bg-surface text-foreground"
              }`}
            >
              <p>{m.text}</p>
              <p className={`mt-1 font-mono text-[9px] ${m.from === "me" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                {m.time}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom action + composer */}
      <div className="sticky bottom-0 border-t border-border/60 bg-background/95 backdrop-blur">
        {!confirmed && (
          <div className="px-4 pt-3">
            <button
              onClick={() => setConfirmOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-primary/40 bg-primary/10 py-3 text-[11px] font-bold uppercase tracking-widest text-primary"
            >
              <CalendarCheck size={16} /> Confirmar cita
            </button>
          </div>
        )}
        <div className="flex items-center gap-2 p-4">
          <input
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Escribe un mensaje..."
            className="flex-1 rounded-full border border-border bg-surface px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
          <button
            onClick={send}
            className="flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground"
          >
            <Send size={18} />
          </button>
        </div>
      </div>

      {/* Confirm modal */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-sm" onClick={() => setConfirmOpen(false)}>
          <div
            className="mx-auto w-full max-w-md rounded-t-3xl border border-border/60 bg-surface p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-primary">Confirmar cita</p>
                <h3 className="font-serif text-2xl italic text-foreground">Detalles del encuentro</h3>
              </div>
              <button onClick={() => setConfirmOpen(false)} className="text-muted-foreground">
                <X size={22} />
              </button>
            </div>

            <div className="space-y-4">
              <Field label="Zona de encuentro" icon={<MapPin size={14} />}>
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full bg-transparent text-sm text-foreground focus:outline-none"
                />
              </Field>
              <Field label="Día y hora" icon={<CalendarCheck size={14} />}>
                <input
                  value={when}
                  onChange={(e) => setWhen(e.target.value)}
                  className="w-full bg-transparent text-sm text-foreground focus:outline-none"
                />
              </Field>
              <Field label="Mensaje adicional">
                <textarea
                  value={extraNote}
                  onChange={(e) => setExtraNote(e.target.value)}
                  rows={2}
                  className="w-full resize-none bg-transparent text-sm text-foreground focus:outline-none"
                />
              </Field>

              <div className="flex items-center gap-2 rounded-xl bg-primary/10 p-3">
                <ShieldCheck className="flex-shrink-0 text-primary" size={16} />
                <p className="text-[11px] text-muted-foreground">
                  Al llegar, ambos deben escanear el QR para iniciar el conteo. Es obligatorio para cobrar.
                </p>
              </div>
            </div>

            <button
              onClick={doConfirm}
              className="mt-5 w-full rounded-2xl bg-primary py-4 text-sm font-bold uppercase tracking-widest text-primary-foreground shadow-[var(--shadow-glow)]"
            >
              Confirmar cita
            </button>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function Field({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background p-3">
      <p className="mb-1 flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
        {icon} {label}
      </p>
      {children}
    </div>
  );
}
