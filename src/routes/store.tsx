import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { DrinkIcon } from "@/components/drink-icon";
import { DRINKS, calcTotalWithFees, type DrinkCategory } from "@/lib/mock-data";
import { toast } from "sonner";
import { X } from "lucide-react";

export const Route = createFileRoute("/store")({
  head: () => ({
    meta: [
      { title: "La Cava · Tienda Ayni" },
      { name: "description", content: "Compra bebidas virtuales para invitar. Cervezas, vinos y cocteles de autor." },
    ],
  }),
  component: StorePage,
});

const FILTERS: Array<{ key: DrinkCategory | "todos"; label: string }> = [
  { key: "todos", label: "Todos" },
  { key: "divertida", label: "Divertidas" },
  { key: "romantica", label: "Románticas" },
  { key: "amistosa", label: "De amigos" },
  { key: "misteriosa", label: "Misteriosas" },
  { key: "autor", label: "De autor" },
];

function StorePage() {
  const [filter, setFilter] = useState<DrinkCategory | "todos">("todos");
  const [buying, setBuying] = useState<string | null>(null);

  const drinks = filter === "todos" ? DRINKS : DRINKS.filter((d) => d.category === filter);
  const selected = DRINKS.find((d) => d.id === buying);
  const fees = selected ? calcTotalWithFees(selected.price) : null;

  const confirmBuy = () => {
    setBuying(null);
    toast.success("Bebida agregada a tu Bar", {
      description: `${selected!.name} — pago simulado S/ ${fees!.total.toFixed(2)}`,
    });
  };

  return (
    <AppShell>
      <section className="fade-up px-5 pt-6">
        <p className="font-mono text-[10px] uppercase tracking-widest text-primary">La Cava</p>
        <h1 className="font-serif text-4xl italic text-foreground">Tienda de bebidas</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Cada bebida es un tipo de invitación. Elige el gesto correcto.
        </p>

        <div className="no-scrollbar mt-5 flex gap-2 overflow-x-auto pb-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`whitespace-nowrap rounded-full border px-4 py-1.5 text-xs font-medium transition-all ${
                filter === f.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-surface text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </section>

      <section className="fade-up space-y-3 px-5 py-6 [animation-delay:120ms]">
        {drinks.map((drink) => (
          <div
            key={drink.id}
            className="flex items-center gap-4 rounded-2xl border border-border/60 bg-surface p-4"
          >
            <div className="flex size-16 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <DrinkIcon type={drink.icon} size={26} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-mono text-[9px] uppercase tracking-tighter text-primary">
                {drink.categoryLabel}
              </p>
              <h4 className="font-serif text-base italic text-foreground">{drink.name}</h4>
              <p className="line-clamp-1 text-[11px] text-muted-foreground">{drink.description}</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-sm text-foreground">S/ {drink.price}</p>
              <button
                onClick={() => setBuying(drink.id)}
                className="mt-1 text-[10px] font-bold uppercase tracking-tighter text-primary"
              >
                Comprar
              </button>
            </div>
          </div>
        ))}
      </section>

      {selected && fees && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-sm"
          onClick={() => setBuying(null)}
        >
          <div
            className="mx-auto w-full max-w-md rounded-t-3xl border border-border/60 bg-surface p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-14 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <DrinkIcon type={selected.icon} size={26} />
                </div>
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-tighter text-primary">
                    {selected.categoryLabel}
                  </p>
                  <h3 className="font-serif text-xl italic text-foreground">{selected.name}</h3>
                </div>
              </div>
              <button onClick={() => setBuying(null)} className="text-muted-foreground">
                <X size={22} />
              </button>
            </div>

            <p className="mb-5 text-sm text-muted-foreground">{selected.description}</p>

            <div className="mb-5 space-y-2 rounded-2xl border border-border/60 bg-background p-4">
              <Row label="Bebida (100% al amigo)" value={`S/ ${fees.drink.toFixed(2)}`} />
              <Row label="Fee de servicio y seguridad (15%)" value={`S/ ${fees.service.toFixed(2)}`} />
              <Row label="Procesamiento de pago (5%)" value={`S/ ${fees.processing.toFixed(2)}`} />
              <div className="mt-3 border-t border-border/60 pt-3">
                <Row label="Total a pagar" value={`S/ ${fees.total.toFixed(2)}`} bold />
              </div>
            </div>

            <button
              onClick={confirmBuy}
              className="w-full rounded-2xl bg-primary py-4 text-sm font-bold uppercase tracking-widest text-primary-foreground shadow-[var(--shadow-glow)]"
            >
              Pagar S/ {fees.total.toFixed(2)}
            </button>
            <p className="mt-3 text-center text-[10px] text-muted-foreground">
              Pago simulado · MVP
            </p>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={bold ? "text-sm font-medium text-foreground" : "text-[11px] text-muted-foreground"}>
        {label}
      </span>
      <span
        className={
          bold
            ? "font-mono text-lg font-semibold text-primary"
            : "font-mono text-xs text-foreground"
        }
      >
        {value}
      </span>
    </div>
  );
}
