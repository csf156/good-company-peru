// Edge Function: pago-webhook
//
// Recibe eventos del ciclo hold de Red Pontis (solo aplica en modo real — en
// modo mock, crear-invitacion/responder-invitacion llaman al proveedor
// síncrono y este webhook nunca se invoca). Valida la firma HMAC, traduce el
// evento al vocabulario del hold (`_shared/pagos.ts`) y llama a la RPC que
// corresponda de forma ATÓMICA e idempotente. Un webhook duplicado no
// duplica ledger ni cita — es el mismo camino de idempotencia que ya usan
// capturar_orden / confirmar_preautorizacion desde dentro de la transacción.
//
// Rota desde E.2a: llamaba a confirmar_orden_pago, que ya no existe (el
// vocabulario paid/failed describía una compra directa, no el ciclo hold).
//
// Se despliega con `--no-verify-jwt`: se autentica por la firma del partner,
// no por una sesión Supabase (config.toml fija verify_jwt = false).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { parseHoldWebhookPayload, rpcParaEvento, verifyPagoWebhookSignature } from '../_shared/pagos.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get('redpontis-signature') ?? '';
  const secret = Deno.env.get('REDPONTIS_WEBHOOK_SECRET')!;

  // Sin secreto o con firma inválida se rechaza: aceptar un webhook forjado
  // confirmaría/capturaría un hold que nunca existió.
  const validSignature = await verifyPagoWebhookSignature(rawBody, signature, secret);
  if (!validSignature) {
    return Response.json({ error: 'Firma inválida.' }, { status: 401 });
  }

  const body = JSON.parse(rawBody);
  const parsed = parseHoldWebhookPayload(body);
  if (!parsed) {
    return Response.json({ error: 'Payload no reconocido.' }, { status: 400 });
  }

  const accion = rpcParaEvento(parsed.evento);
  if (!accion) {
    // Defensivo: con el vocabulario de EventoHold de hoy, rpcParaEvento
    // siempre devuelve una acción. Un evento sin acción se ack-ea sin tocar
    // la base — no es un error del partner, y no hay nada que reintentar.
    return Response.json({ ok: true, ignorado: parsed.evento });
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Los montos NUNCA se leen del payload (están congelados en la orden desde
  // que se creó); el webhook solo dispara la transición con el providerRef
  // del proveedor — que capturar_orden/confirmar_preautorizacion persisten
  // (coalesce con el que ya hubiera), nunca se manda null a propósito.
  const { data: resultado, error } =
    accion.rpc === 'confirmar_preautorizacion'
      ? await admin.rpc('confirmar_preautorizacion', {
          p_orden_id: parsed.ordenId,
          p_ok: accion.ok,
          p_provider_ref: parsed.providerRef,
        })
      : await admin.rpc('capturar_orden', {
          p_orden_id: parsed.ordenId,
          p_resultado: accion.resultado,
          p_provider_ref: parsed.providerRef,
        });

  if (error) {
    // Orden inexistente: no hay nada que reintentar, se ack-ea con 404 (el
    // partner deja de reintentar algo que nunca va a existir). Cualquier
    // OTRO error —transición ilegal, error transitorio de base— es
    // reintentable: un 500 le dice al partner que vuelva a intentar, en vez
    // de perder la confirmación para siempre con el 404 indiscriminado que
    // tenía esta función antes (backlog, code-review de la fase 3.4).
    const status = error.message.startsWith('orden no encontrada') ? 404 : 500;
    const mensaje = status === 404 ? 'Orden no encontrada.' : 'No se pudo procesar el evento.';
    return Response.json({ error: mensaje }, { status });
  }

  return Response.json({ ok: true, resultado });
});
