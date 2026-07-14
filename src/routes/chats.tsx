import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { LevelBadge } from "@/components/level-badge";
import { CHATS } from "@/lib/mock-data";
import { CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/chats")({
  head: () => ({
    meta: [
      { title: "Chats · Ayni" },
      { name: "description", content: "Conversaciones activas con amigos invitados." },
    ],
  }),
  component: ChatsPage,
});

function ChatsPage() {
  return (
    <AppShell>
      <section className="fade-up px-5 pt-6">
        <p className="font-mono text-[10px] uppercase tracking-widest text-primary">Conversaciones</p>
        <h1 className="font-serif text-4xl italic text-foreground">Tus chats</h1>
      </section>

      <section className="fade-up space-y-2 px-5 py-6 [animation-delay:100ms]">
        {CHATS.map((c) => (
          <Link
            key={c.id}
            to="/chats/$id"
            params={{ id: c.id }}
            className="flex items-center gap-3 rounded-2xl border border-border/60 bg-surface p-3 transition-colors hover:border-primary/40"
          >
            <div
              className="size-14 flex-shrink-0 rounded-full ring-1 ring-white/10"
              style={{ background: c.otherPhoto }}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate font-serif text-base italic text-foreground">{c.otherName}</p>
                <LevelBadge level={c.otherLevel} />
              </div>
              <p className="truncate text-[12px] text-muted-foreground">{c.lastMessage}</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="rounded-sm bg-primary/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-tighter text-primary">
                  {c.drinkName}
                </span>
                {c.confirmed && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-[color:var(--success)]">
                    <CheckCircle2 size={10} /> Cita confirmada
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="font-mono text-[10px] text-muted-foreground">{c.time}</span>
              {c.unread > 0 && (
                <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {c.unread}
                </span>
              )}
            </div>
          </Link>
        ))}
      </section>
    </AppShell>
  );
}
