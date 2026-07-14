import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { LevelBadge } from "@/components/level-badge";
import { FRIENDS } from "@/lib/mock-data";
import { ArrowLeft, MapPin, ShieldCheck, Star } from "lucide-react";

export const Route = createFileRoute("/profile/$id")({
  head: ({ params }) => {
    const f = FRIENDS.find((x) => x.id === params.id);
    return { meta: [{ title: `${f?.name ?? "Perfil"} · Ayni` }, { name: "robots", content: "noindex" }] };
  },
  component: ProfileDetail,
});

function ProfileDetail() {
  const { id } = Route.useParams();
  const friend = FRIENDS.find((f) => f.id === id) ?? FRIENDS[0];
  const nav = useNavigate();

  return (
    <AppShell hideNav header={
      <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-border/60 bg-background/85 px-4 backdrop-blur-md">
        <button onClick={() => nav({ to: "/" })} className="text-muted-foreground">
          <ArrowLeft size={22} />
        </button>
        <p className="font-serif text-base italic text-foreground">{friend.name}</p>
      </header>
    }>
      <div className="relative h-80 w-full" style={{ background: friend.photo }}>
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <div className="absolute right-4 top-4 flex items-center gap-1.5 rounded-full border border-white/20 bg-black/40 px-2.5 py-1 backdrop-blur">
          <ShieldCheck size={12} className="text-primary" strokeWidth={2} />
          <span className="text-[10px] font-medium text-white">DNI verificado</span>
        </div>
      </div>

      <section className="-mt-16 px-5">
        <div className="mb-2 flex items-center gap-2">
          <h1 className="font-serif text-4xl italic text-foreground">{friend.name.split(" ")[0]}, {friend.age}</h1>
          <LevelBadge level={friend.level} size="md" />
        </div>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          {friend.profession} <span className="text-white/30">•</span> <MapPin size={12} /> {friend.district}
        </p>

        <p className="mt-4 leading-relaxed text-foreground/90">{friend.bio}</p>

        <div className="mt-6">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Intereses</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {friend.interests.map((i) => (
              <span key={i} className="rounded-full border border-border bg-surface px-3 py-1 text-[11px] text-foreground/90">
                {i}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3">
          <Stat label="Recaudado" value={`S/ ${friend.raised}`} />
          <Stat label="Citas" value="24" />
          <Stat label="Reseñas" value="4.9" icon={<Star size={12} className="text-primary" />} />
        </div>

        <div className="my-8">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Preferencias de salida</p>
          <div className="mt-2 space-y-2 rounded-2xl border border-border/60 bg-surface p-4 text-sm">
            <Row label="Horario" value="7 PM — 12 AM" />
            <Row label="Zonas" value="Miraflores, Barranco, San Isidro" />
            <Row label="Duración típica" value="60 — 120 min" />
          </div>
        </div>
      </section>

      <div className="sticky bottom-0 border-t border-border/60 bg-background/95 p-4 backdrop-blur">
        <Link
          to="/"
          className="flex w-full flex-col items-center justify-center gap-0.5 rounded-2xl bg-primary py-4 font-semibold text-primary-foreground shadow-[var(--shadow-glow)]"
        >
          <span className="text-[11px] font-bold uppercase tracking-[0.2em]">Invitar una bebida</span>
        </Link>
      </div>
    </AppShell>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/60 bg-surface p-3 text-center">
      <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 flex items-center justify-center gap-1 font-serif text-lg italic text-foreground">
        {icon} {value}
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-foreground text-xs">{value}</span>
    </div>
  );
}
