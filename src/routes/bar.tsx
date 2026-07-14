import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { DrinkIcon } from "@/components/drink-icon";
import { MY_BAR, CURRENT_USER } from "@/lib/mock-data";
import { Plus, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/bar")({
  head: () => ({
    meta: [
      { title: "Mi Bar · Ayni" },
      { name: "description", content: "Tu stock de bebidas listas para invitar." },
    ],
  }),
  component: BarPage,
});

function BarPage() {
  const totalStock = MY_BAR.reduce((s, i) => s + i.stock, 0);
  const totalValue = MY_BAR.reduce((s, i) => s + i.stock * i.drink.price, 0);

  return (
    <AppShell>
      <section className="fade-up px-5 pt-6">
        <p className="font-mono text-[10px] uppercase tracking-widest text-primary">Mi Bar</p>
        <h1 className="font-serif text-4xl italic text-foreground">Tu inventario</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Bebidas compradas listas para invitar. Cada trago que envíes se descuenta de este stock.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-border/60 bg-surface p-4">
            <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Stock total</p>
            <p className="mt-1 font-serif text-3xl italic text-foreground">{totalStock}</p>
            <p className="text-[10px] text-muted-foreground">bebidas listas</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-surface p-4">
            <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Valor</p>
            <p className="mt-1 font-serif text-3xl italic text-primary">S/{totalValue}</p>
            <p className="text-[10px] text-muted-foreground">para invitar</p>
          </div>
        </div>
      </section>

      <section className="fade-up space-y-3 px-5 py-8 [animation-delay:120ms]">
        <div className="flex items-center justify-between">
          <h3 className="font-mono text-sm uppercase tracking-widest text-muted-foreground">Inventario</h3>
          <Link
            to="/store"
            className="flex items-center gap-1 text-[11px] font-medium text-primary"
          >
            <Plus size={12} /> Comprar más
          </Link>
        </div>

        {MY_BAR.map(({ drink, stock }) => (
          <div
            key={drink.id}
            className="flex items-center gap-4 rounded-2xl border border-border/60 bg-surface p-4"
          >
            <div className="flex size-14 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <DrinkIcon type={drink.icon} size={24} />
            </div>
            <div className="flex-1">
              <p className="font-mono text-[9px] uppercase tracking-tighter text-primary">
                {drink.categoryLabel}
              </p>
              <h4 className="font-serif text-base italic text-foreground">{drink.name}</h4>
              <p className="text-[10px] text-muted-foreground">S/ {drink.price} c/u</p>
            </div>
            <div className="text-right">
              <div className="rounded-lg bg-primary/10 px-3 py-1.5">
                <p className="font-mono text-lg font-semibold text-primary">×{stock}</p>
              </div>
            </div>
          </div>
        ))}
      </section>

      <section className="fade-up px-5 pb-4 [animation-delay:240ms]">
        <Link
          to="/levels"
          className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-transparent p-4"
        >
          <TrendingUp className="text-primary" size={22} />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">
              Nivel {CURRENT_USER.level.charAt(0).toUpperCase() + CURRENT_USER.level.slice(1)}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Gastaste S/ {CURRENT_USER.spent} en invitaciones. Ver progreso →
            </p>
          </div>
        </Link>
      </section>
    </AppShell>
  );
}
