import { supabase } from '@/lib/supabase';

// Lectura de "Por cobrar" (Fase E.4, Tarea 1) — la vista `por_cobrar` (E.1)
// suma los movimientos `payout` del ledger por `perfil_id`, con
// `security_invoker` + la policy `ledger_select_own`: cada quien solo puede
// ver su propia fila. Hoy siempre da 0 para todos, porque la liberación de
// escrow (payout) es la fase 5.4 — nadie tiene todavía un movimiento `payout`
// en el ledger. Es el comportamiento correcto, no un placeholder roto.

type PorCobrarRow = { por_cobrar: number };

/**
 * Lo que el usuario tiene por cobrar, en soles. 0 si no tiene nada.
 *
 * La vista agrupa por `perfil_id`: un usuario sin `payout` no tiene fila del
 * todo (no una fila en 0). Ausencia de fila, y cualquier error de red, se
 * tratan igual — 0, nunca un throw.
 */
export async function getPorCobrar(): Promise<number> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return 0;
  }

  const { data, error } = await supabase
    .from('por_cobrar')
    .select('por_cobrar')
    .eq('perfil_id', user.id)
    .maybeSingle();

  if (error || !data) {
    return 0;
  }

  return (data as PorCobrarRow).por_cobrar;
}
