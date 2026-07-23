// Edge Function: pago-webhook
//
// Recibe la confirmación de pago de Red Pontis (solo aplica en modo real — en
// modo mock, comprar-bebida confirma síncrono y este webhook nunca se invoca).
// Valida la firma HMAC, y confirma/falla la orden de forma ATÓMICA e idempotente
// vía la función SQL confirmar_orden_pago (row lock + chequeo de estado). Un
// webhook duplicado no duplica la bebida ni el ledger.
//
// Se despliega con `--no-verify-jwt`: se autentica por la firma del partner, no
// por una sesión Supabase (config.toml fija verify_jwt = false).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { parsePagoWebhookPayload, verifyPagoWebhookSignature } from '../_shared/pagos.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get('redpontis-signature') ?? '';
  const secret = Deno.env.get('REDPONTIS_WEBHOOK_SECRET')!;

  // Sin secreto o con firma inválida se rechaza: aceptar un webhook forjado
  // confirmaría un pago inexistente y crearía stock sin cobro.
  const validSignature = await verifyPagoWebhookSignature(rawBody, signature, secret);
  if (!validSignature) {
    return Response.json({ error: 'Firma inválida.' }, { status: 401 });
  }

  const body = JSON.parse(rawBody);
  const parsed = parsePagoWebhookPayload(body);
  if (!parsed) {
    return Response.json({ error: 'Payload no reconocido.' }, { status: 400 });
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // El escrow_ref (subcuenta de custodia del partner) viene en el payload en una
  // confirmación; los montos NO se leen del payload (están congelados en la
  // orden). El estado (confirmada/fallida) sí lo determina el partner.
  const escrowRef =
    parsed.estado === 'confirmada' && typeof body.escrow_ref === 'string' ? body.escrow_ref : null;

  const { data: resultado, error } = await admin.rpc('confirmar_orden_pago', {
    p_orden_id: parsed.ordenId,
    p_resultado: parsed.estado,
    p_escrow_ref: escrowRef,
  });

  if (error) {
    // Orden inexistente u otro error de la función → 404/500 para que el partner
    // reintente si corresponde.
    return Response.json({ error: 'No se pudo procesar el pago.' }, { status: 404 });
  }

  return Response.json({ ok: true, resultado });
});
