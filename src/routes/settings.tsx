import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { ArrowLeft, Bell, ChevronRight, HeartHandshake, LogOut, ShieldAlert, ShieldCheck, User } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Ajustes · Ayni" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <AppShell hideNav header={
      <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-border/60 bg-background/85 px-4 backdrop-blur-md">
        <Link to="/profile" className="text-muted-foreground"><ArrowLeft size={22} /></Link>
        <p className="font-serif text-base italic text-foreground">Ajustes y seguridad</p>
      </header>
    }>
      <section className="fade-up space-y-6 px-5 py-6">
        <Group title="Cuenta">
          <Item icon={<User size={18} />} label="Editar perfil e intereses" />
          <Item icon={<ShieldCheck size={18} />} label="Verificación de identidad (DNI)" trailing={<span className="rounded-sm bg-[color:var(--success)]/10 px-2 py-0.5 font-mono text-[9px] text-[color:var(--success)]">Verificado</span>} />
          <Item icon={<Bell size={18} />} label="Notificaciones" />
        </Group>

        <Group title="Seguridad del encuentro">
          <Item icon={<HeartHandshake size={18} />} label="Contactos de emergencia" trailing={<span className="text-[10px] text-muted-foreground">3</span>} />
          <Item icon={<ShieldAlert size={18} />} label="Lugares verificados sugeridos" />
          <Item icon={<ShieldCheck size={18} />} label="Compartir ubicación en cita" />
        </Group>

        <button onClick={() => toast("Sesión cerrada · MVP")} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 py-4 text-sm font-medium text-destructive">
          <LogOut size={16} /> Cerrar sesión
        </button>

        <p className="pt-4 text-center font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
          Ayni · MVP · Hecho en Lima
        </p>
      </section>
    </AppShell>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 px-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{title}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Item({ icon, label, trailing }: { icon: React.ReactNode; label: string; trailing?: React.ReactNode }) {
  return (
    <button onClick={() => toast(label + " · MVP")} className="flex w-full items-center gap-4 rounded-2xl border border-border/60 bg-surface p-4 text-left">
      <div className="flex size-10 items-center justify-center rounded-xl bg-background text-muted-foreground">
        {icon}
      </div>
      <span className="flex-1 text-sm text-foreground">{label}</span>
      {trailing}
      <ChevronRight className="text-muted-foreground" size={16} />
    </button>
  );
}
