import { supabase } from '@/lib/supabase';
import { getOwnProfile } from '@/lib/profile';

// Capa de datos de la confirmación de cita (Fase 4.5). Lectura directa (RLS de
// 4.0: citas_select_parte) — solo las dos partes ven la fila. La transición de
// estado ('pendiente' → 'confirmada') NO la hace el cliente: pasa por el Edge
// Function confirmar-cita (service_role), que invoca la función SQL
// confirmar_cita (determina "quién es el amigo" dinámicamente, ver esa
// función). Acá solo se lee el resultado.

export type EstadoCita =
  | 'pendiente'
  | 'confirmada'
  | 'en_curso'
  | 'finalizada'
  | 'no_show'
  | 'disputa';

export type CitaDetalle = {
  estado: EstadoCita;
  // true si YO (el usuario de la sesión) soy "el amigo" de esta cita. La RLS ya
  // garantiza que si la fila se pudo leer, soy una de las dos partes — así que
  // basta con mi propio rol para saber si soy el amigo o el rentador.
  esAmigo: boolean;
  zona: string | null;
  hora: string | null;
  mensaje: string | null;
  // Resumen "Cita confirmada" (bebida + V + tiempo estimado), leído vía
  // invitaciones → bebidas_catalogo directo — `bebida_catalogo_id` vive en
  // `invitaciones` desde E.1 (el salto intermedio por `bar`, que E.1
  // eliminó, sobra: se dejó puesto por error hasta E.3 Tarea 3b, y la
  // consulta rota fallaba en silencio, ver `getCitaDetalle` abajo).
  bebidaNombre: string | null;
  valorV: number | null;
  tiempoEstimadoMin: number | null;
};

type CitaRow = {
  estado: EstadoCita;
  zona: string | null;
  hora: string | null;
  mensaje: string | null;
  invitaciones: {
    tiempo_estimado_min: number | null;
    bebidas_catalogo: { nombre: string; valor_v: number } | null;
  } | null;
};

/**
 * Detalle de una cita para la pantalla de chat: su estado, si el usuario actual
 * es "el amigo" (habilita el botón de confirmar) y el resumen a mostrar tras
 * confirmar. Devuelve null si no hay sesión o la fila no es legible (RLS).
 */
export async function getCitaDetalle(citaId: string): Promise<CitaDetalle | null> {
  const own = await getOwnProfile();
  if (!own) {
    return null;
  }

  const { data, error } = await supabase
    .from('citas')
    .select(
      'estado, zona, hora, mensaje, invitaciones(tiempo_estimado_min, bebidas_catalogo(nombre, valor_v))',
    )
    .eq('id', citaId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const row = data as unknown as CitaRow;
  const bebida = row.invitaciones?.bebidas_catalogo ?? null;

  return {
    estado: row.estado,
    esAmigo: own.rol === 'amigo',
    zona: row.zona,
    hora: row.hora,
    mensaje: row.mensaje,
    bebidaNombre: bebida?.nombre ?? null,
    valorV: bebida?.valor_v ?? null,
    tiempoEstimadoMin: row.invitaciones?.tiempo_estimado_min ?? null,
  };
}

export type ConfirmarCitaResult = { resultado: string | null; error: string | null };

/**
 * Confirma la cita vía el Edge Function confirmar-cita (service_role). El
 * cliente solo envía zona/hora/mensaje — el amigo se toma de la sesión en el
 * Edge Function (anti-suplantación), no de acá.
 */
export async function confirmarCita(
  citaId: string,
  zona: string,
  hora: string,
  mensaje: string | null,
): Promise<ConfirmarCitaResult> {
  const { data, error } = await supabase.functions.invoke('confirmar-cita', {
    body: { citaId, zona, hora, mensaje },
  });

  if (error) {
    return { resultado: null, error: error.message ?? 'No se pudo confirmar la cita.' };
  }

  return { resultado: data?.resultado ?? null, error: null };
}
