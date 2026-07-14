import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { FriendCard } from "@/components/friend-card";
import { DrinkIcon } from "@/components/drink-icon";
import { FRIENDS, MY_BAR, calcTotalWithFees } from "@/lib/mock-data";
import { ChevronLeft, ChevronRight, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ayni · Explora" },
      { name: "description", content: "Descubre amigos disponibles para conocerse en Lima. Invita un trago y empieza la conversación." },
    ],
  }),
  component: DiscoverPage,
});

function DiscoverPage() {
  const [idx, setIdx] = useState(0);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [selectedDrink, setSelectedDrink] = useState(MY_BAR[0].drink.id);
  const navigate = useNavigate();
  const friend = FRIENDS[idx];

  const prev = () => setIdx((i) => (i - 1 + FRIENDS.length) % FRIENDS.length);
  const next = () => setIdx((i) => (i + 1) % FRIENDS.length);

  const suggestedDrink = MY_BAR.find((b) => b.drink.id === selectedDrink)?.drink ?? MY_BAR[0].drink;

  const sendInvite = () => {
    setInviteOpen(false);
    toast.success("Invitación enviada", {
      description: `${friend.name.split(" ")[0]} recibió tu ${suggestedDrink.name}.`,
    });
    setTimeout(() => navigate({ to: "/chats" }), 800);
  };

  return (
    <AppShell>
      <section className="fade-up px-5 pt-6">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Perfil {idx + 1} de {FRIENDS.length}
          </p>
          <Link to="/global" className="text-[11px] text-primary underline decoration-primary/30 underline-offset-4">
            Invitaciones abiertas
          </Link>
        </div>

        <Link to="/profile/$id" params={{ id: friend.id }} className="block">
          <FriendCard friend={friend} />
        </Link>

        {/* Nav arrows */}
        <div className="mt-4 flex items-center justify-between">
          <button
            onClick={prev}
            className="flex size-11 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Anterior"
          >
            <ChevronLeft size={20} />
          </button>
          <p className="text-center font-serif text-xs italic text-muted-foreground">
            desliza y descubre a quién invitar hoy
          </p>
          <button
            onClick={next}
            className="flex size-11 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Siguiente"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </section>

      {/* CTA */}
      <section className="fade-up px-5 py-6 [animation-delay:120ms]">
        <button
          onClick={() => setInviteOpen(true)}
          className="flex w-full flex-col items-center justify-center gap-0.5 rounded-2xl bg-primary py-5 font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition-transform active:scale-[0.98]"
        >
          <span className="text-[11px] font-bold uppercase tracking-[0.2em]">Invitar una bebida</span>
          <span className="text-[13px] font-normal italic opacity-80">
            Sugerido: S/ {suggestedDrink.price.toFixed(2)}
          </span>
        </button>
      </section>

      {/* Mi Bar preview */}
      <section className="fade-up space-y-4 py-2 [animation-delay:200ms]">
        <div className="flex items-end justify-between px-5">
          <h3 className="font-mono text-sm uppercase tracking-widest text-muted-foreground">Mi Bar</h3>
          <Link to="/bar" className="text-[11px] text-primary underline decoration-primary/30 underline-offset-4">
            Ver todo
          </Link>
        </div>
        <div className="no-scrollbar flex gap-3 overflow-x-auto px-5 pb-2">
          {MY_BAR.map(({ drink, stock }) => (
            <button
              key={drink.id}
              onClick={() => { setSelectedDrink(drink.id); setInviteOpen(true); }}
              className="flex min-w-[110px] flex-shrink-0 flex-col items-center rounded-2xl border border-border/60 bg-surface p-4 text-left transition-all hover:border-primary/40"
            >
              <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <DrinkIcon type={drink.icon} size={22} />
              </div>
              <span className="text-center text-[11px] font-medium text-foreground">{drink.name}</span>
              <span className="mt-1 font-mono text-[9px] tracking-tight text-muted-foreground">
                {stock} {stock === 1 ? "unidad" : "unidades"}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Store teaser */}
      <section className="fade-up px-5 py-8 [animation-delay:280ms]">
        <Link
          to="/store"
          className="flex items-center gap-4 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-transparent p-5 transition-transform active:scale-[0.98]"
        >
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/20">
            <Sparkles className="text-primary" size={24} strokeWidth={1.5} />
          </div>
          <div className="flex-1">
            <p className="font-mono text-[10px] uppercase tracking-widest text-primary">La Cava</p>
            <h4 className="font-serif text-lg italic text-foreground">Cocteles de autor esta noche</h4>
            <p className="text-[11px] text-muted-foreground">Coca Sour Élite, Amazonía Salvaje y más</p>
          </div>
          <ChevronRight className="text-muted-foreground" size={20} />
        </Link>
      </section>

      {/* Invite drawer */}
      {inviteOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-sm"
          onClick={() => setInviteOpen(false)}
        >
          <div
            className="mx-auto w-full max-w-md rounded-t-3xl border border-border/60 bg-surface p-6 animate-in slide-in-from-bottom duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-primary">Invitar a</p>
                <h3 className="font-serif text-2xl italic text-foreground">{friend.name.split(" ")[0]}</h3>
              </div>
              <button onClick={() => setInviteOpen(false)} className="text-muted-foreground">
                <X size={22} />
              </button>
            </div>

            <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Desde mi bar
            </p>
            <div className="mb-5 space-y-2">
              {MY_BAR.map(({ drink, stock }) => {
                const active = selectedDrink === drink.id;
                return (
                  <button
                    key={drink.id}
                    onClick={() => setSelectedDrink(drink.id)}
                    className={`flex w-full items-center gap-4 rounded-2xl border p-3 text-left transition-all ${
                      active
                        ? "border-primary bg-primary/10"
                        : "border-border/60 bg-background hover:border-primary/40"
                    }`}
                  >
                    <div
                      className={`flex size-12 items-center justify-center rounded-xl ${
                        active ? "bg-primary/20 text-primary" : "bg-surface text-muted-foreground"
                      }`}
                    >
                      <DrinkIcon type={drink.icon} size={22} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{drink.name}</p>
                      <p className="text-[11px] text-muted-foreground">{drink.categoryLabel}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-sm text-foreground">S/ {drink.price}</p>
                      <p className="text-[9px] text-muted-foreground">{stock} stock</p>
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              onClick={sendInvite}
              className="w-full rounded-2xl bg-primary py-4 text-sm font-bold uppercase tracking-widest text-primary-foreground shadow-[var(--shadow-glow)]"
            >
              Enviar invitación
            </button>
            <p className="mt-3 text-center text-[10px] text-muted-foreground">
              {friend.name.split(" ")[0]} recibirá S/{" "}
              {calcTotalWithFees(suggestedDrink.price).drink.toFixed(2)} si acepta.
            </p>
          </div>
        </div>
      )}
    </AppShell>
  );
}
