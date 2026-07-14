import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ArrowLeft, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: "Privacidad · Ayni" }] }),
  component: PrivacyPage,
});

function PrivacyPage() {
  const [priv, setPriv] = useState(false);

  return (
    <AppShell hideNav header={
      <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-border/60 bg-background/85 px-4 backdrop-blur-md">
        <Link to="/profile" className="text-muted-foreground"><ArrowLeft size={22} /></Link>
        <p className="font-serif text-base italic text-foreground">Perfil privado</p>
      </header>
    }>
      <section className="fade-up px-5 pt-6">
        <div className="rounded-3xl border border-border/60 bg-surface p-6">
          <Lock className="text-primary" size={28} />
          <h2 className="mt-3 font-serif text-2xl italic text-foreground">Preselecciona quién te contacta</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Con perfil privado activado, solo los usuarios que apruebes pueden enviarte una invitación (o una solicitud, si eres amigo en renta).
          </p>
          <label className="mt-5 flex items-center justify-between rounded-xl border border-border/60 bg-background p-4">
            <span className="text-sm text-foreground">Activar perfil privado</span>
            <button
              onClick={() => {
                if (priv) { setPriv(false); toast("Perfil público"); }
                else { toast("Requiere Premium", { description: "Activa Ayni Premium para usar perfil privado." }); }
              }}
              className={`relative h-7 w-12 rounded-full transition-colors ${priv ? "bg-primary" : "bg-muted"}`}
            >
              <span className={`absolute top-0.5 size-6 rounded-full bg-background transition-all ${priv ? "left-5" : "left-0.5"}`} />
            </button>
          </label>
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-primary/10 p-3">
            <ShieldCheck className="flex-shrink-0 text-primary" size={16} />
            <p className="text-[11px] text-muted-foreground">
              Función exclusiva de Ayni Premium. <Link to="/premium" className="text-primary underline">Ver planes →</Link>
            </p>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
