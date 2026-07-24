import { supabase } from '@/lib/supabase';
import { getPublicProfile } from '@/lib/profile';

// Capa de datos del chat (Fase 4.4). El cliente lee/escribe chat_mensajes DIRECTO
// (RLS de 4.0: chat_insert_propio / chat_select_parte, esta última corregida en
// 4.4 para que un mensaje oculto solo lo vea su emisor). NO pasa por Edge
// Function: es chat en tiempo real. La moderación anti-fuga vive en el trigger
// server-side (migración 20260724170000) — el cliente jamás decide el
// ocultamiento; solo muestra el resultado (mine + oculto ⇒ aviso al emisor).

export type ChatResumen = {
  citaId: string;
  alias: string | null;
  // Último mensaje VISIBLE para mí. La RLS ya excluye los mensajes ocultos de la
  // contraparte, así que un mensaje moderado ajeno nunca aparece como "último".
  ultimoMensaje: string | null;
};

export type Mensaje = {
  id: string;
  texto: string;
  // true si lo envié yo (burbuja propia). Se resuelve contra la sesión, no viene
  // del server como flag.
  mine: boolean;
  // Un mensaje oculto que YO puedo ver es, por la RLS, siempre uno propio marcado
  // por moderación: la UI lo usa para avisarme (el "warning" del plan).
  oculto: boolean;
  createdAt: string;
};

type InvRow = { emisor_id: string; receptor_id: string | null };
type CitaRow = { id: string; created_at: string; invitaciones: InvRow | null };
type MensajeRow = {
  id: string;
  texto: string;
  emisor_id: string;
  oculto: boolean;
  created_at: string;
};

async function getUserId(): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

function contraparteId(inv: InvRow | null, uid: string): string | null {
  if (!inv) {
    return null;
  }
  return inv.emisor_id === uid ? inv.receptor_id : inv.emisor_id;
}

/**
 * Conversaciones activas: una por `cita` de la que soy parte, más reciente
 * primero. La RLS de `citas` ya limita a mis citas. Por cada una resuelvo el
 * alias público de la contraparte y el último mensaje visible.
 */
export async function getChats(): Promise<ChatResumen[]> {
  const uid = await getUserId();
  if (!uid) {
    return [];
  }

  const { data, error } = await supabase
    .from('citas')
    .select('id, created_at, invitaciones(emisor_id, receptor_id)')
    .order('created_at', { ascending: false });

  if (error || !data) {
    return [];
  }

  const rows = data as unknown as CitaRow[];

  return Promise.all(
    rows.map(async (row) => {
      const otherId = contraparteId(row.invitaciones, uid);
      const alias = otherId ? ((await getPublicProfile(otherId))?.alias ?? null) : null;

      const { data: msg } = await supabase
        .from('chat_mensajes')
        .select('texto')
        .eq('cita_id', row.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      return { citaId: row.id, alias, ultimoMensaje: msg?.texto ?? null };
    }),
  );
}

/** Alias público de la contraparte de una cita (header del chat). */
export async function getContraparteAlias(citaId: string): Promise<string | null> {
  const uid = await getUserId();
  if (!uid) {
    return null;
  }

  const { data } = await supabase
    .from('citas')
    .select('invitaciones(emisor_id, receptor_id)')
    .eq('id', citaId)
    .maybeSingle();

  const inv = (data as { invitaciones: InvRow | null } | null)?.invitaciones ?? null;
  const otherId = contraparteId(inv, uid);
  if (!otherId) {
    return null;
  }
  return (await getPublicProfile(otherId))?.alias ?? null;
}

/** Mensajes de una cita, cronológicos. La RLS decide qué veo (mis ocultos sí). */
export async function getMensajes(citaId: string): Promise<Mensaje[]> {
  const uid = await getUserId();

  const { data, error } = await supabase
    .from('chat_mensajes')
    .select('id, texto, emisor_id, oculto, created_at')
    .eq('cita_id', citaId)
    .order('created_at', { ascending: true });

  if (error || !data) {
    return [];
  }

  return (data as MensajeRow[]).map((m) => ({
    id: m.id,
    texto: m.texto,
    mine: m.emisor_id === uid,
    oculto: m.oculto,
    createdAt: m.created_at,
  }));
}

/**
 * Inserta mi mensaje en la cita (RLS chat_insert_propio lo permite solo como yo
 * mismo y en una cita de la que soy parte). El trigger de moderación decide si
 * nace oculto — no lo sabe el cliente hasta releer.
 */
export async function enviarMensaje(citaId: string, texto: string): Promise<{ error: string | null }> {
  const uid = await getUserId();
  if (!uid) {
    return { error: 'No hay sesión activa.' };
  }
  const limpio = texto.trim();
  if (!limpio) {
    return { error: 'El mensaje está vacío.' };
  }

  const { error } = await supabase
    .from('chat_mensajes')
    .insert({ cita_id: citaId, emisor_id: uid, texto: limpio });

  return { error: error?.message ?? null };
}

/**
 * Suscribe a inserts en `chat_mensajes` de esta cita vía Supabase Realtime. La
 * RLS también gobierna el stream, así que un mensaje oculto de la contraparte ni
 * siquiera llega. `onInsert` se dispara ante cada nuevo mensaje visible; la
 * pantalla re-lee la lista (simple y consistente con el orden/estado de RLS).
 * Devuelve una función de limpieza para el unmount.
 */
export function subscribeMensajes(citaId: string, onInsert: () => void): () => void {
  const channel = supabase
    .channel(`chat:${citaId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'chat_mensajes', filter: `cita_id=eq.${citaId}` },
      () => onInsert(),
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
