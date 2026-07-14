import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { CURRENT_USER, LEVEL_META, levelForAmount, nextLevelProgress, type Level } from "@/lib/mock-data";
import { ArrowLeft, Award, Check } from "lucide-react";

export const Route = createFileRoute("/levels")({
  head: () => ({ meta: [{ title: "Niveles · Ayni" }] }),
  component: LevelsPage,
});

const ORDER: Level[] = ["bronce", "plata", "oro", "diamante", "elite"];

function LevelsPage() {
  const current = levelForAmount(CURRENT_USER.spent);
  const prog = nextLevelProgress(CURRENT_USER.spent);

  return (
    <AppShell hideNav header={
      <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-border/60 bg-background/85 px-4 backdrop-blur-md">
        <Link to="/profile" className="text-muted-foreground"><ArrowLeft size={22} /></Link>
        <p className="font-serif text-base italic text-foreground">Niveles</p>
      </header>
    }>
      <section className="fade-up px-5 pt-6">
        <div className="rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/10 to-transparent p-6 text-center">
          <Award className="mx-auto text-primary" size={36} />
          <p className="mt-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Tu nivel actual</p>
          <h1 className="font-serif text-4xl italic text-foreground">{LEVEL_META[current].label}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            S/ {CURRENT_USER.spent} gastados en invitaciones
          </p>
          {prog.next && (
            <>
              <div className="mx-auto mt-5 h-2 max-w-xs overflow-hidden rounded-full bg-background">
                <div className="h-full rounded-full bg-primary" style={{ width: `${prog.percent}%` }} />
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Te faltan <span className="font-mono text-primary">S/ {prog.toNext}</span> para {LEVEL_META[prog.next].label}
              </p>
            </>
          )}
        </div>
      </section>

      <section className="fade-up space-y-3 px-5 py-6 [animation-delay:100ms]">
        {ORDER.map((lvl) => {
          const meta = LEVEL_META[lvl];
          const active = lvl === current;
          const achieved = ORDER.indexOf(lvl) <= ORDER.indexOf(current);
          return (
            <div
              key={lvl}
              className={`rounded-2xl border p-5 transition-all ${
                active ? "border-primary bg-primary/10" : "border-border/60 bg-surface"
              }`}
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="flex size-10 items-center justify-center rounded-full font-serif italic"
                    style={{
                      backgroundColor: `color-mix(in oklab, ${meta.color} 20%, transparent)`,
                      color: meta.color,
                    }}
                  >
                    {achieved ? <Check size={18} /> : meta.label.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-serif text-xl italic" style={{ color: meta.color }}>{meta.label}</h3>
                    <p className="font-mono text-[10px] text-muted-foreground">
                      S/ {meta.min} — {meta.max === Infinity ? "∞" : `S/ ${meta.max}`}
                    </p>
                  </div>
                </div>
                {active && <span className="rounded-sm bg-primary px-2 py-0.5 text-[9px] font-bold uppercase tracking-tighter text-primary-foreground">Actual</span>}
              </div>
              <ul className="space-y-1.5">
                {meta.benefits.map((b) => (
                  <li key={b} className="flex items-center gap-2 text-[12px] text-foreground/85">
                    <span className="size-1 rounded-full" style={{ backgroundColor: meta.color }} />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>
    </AppShell>
  );
}
