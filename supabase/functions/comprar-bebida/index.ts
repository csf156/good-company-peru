// Edge Function: comprar-bebida
//
// El rentador compra una bebida del catálogo. Calcula el desglose SERVER-SIDE
// (el cliente solo envía `bebidaId` — nunca montos), crea la orden de pago y:
//   * modo MOCK (default): confirma de inmediato vía confirmar_orden_pago
//     (RPC atómica) → fondos a escrow simulado, ledger + bebida al bar.
//   * modo Red Pontis real: crea la orden en el partner y la deja `pendiente`;
//     pago-webhook la confirma al llegar la notificación firmada.
//
// Toda la lógica de negocio testeable vive en ../_shared/pagos.ts (Jest); la
// confirmación atómica vive en la función SQL confirmar_orden_pago (pgTAP).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  buildRedPontisOrderRequest,
  calcularDesgloseCompra,
  decidePaymentProvider,
} from '../_shared/pagos.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
  } = await callerClient.auth.getUser();

  if (!user) {
    return Response.json({ error: 'No hay sesión activa.' }, { status: 401 });
  }

  const { bebidaId, idempotencyKey } = await req.json();
  if (typeof bebidaId !== 'string' || typeof idempotencyKey !== 'string' || !idempotencyKey) {
    return Response.json({ error: 'bebidaId e idempotencyKey son requeridos.' }, { status: 400 });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);

  // Gate de dinero: solo un usuario verificado (KYC) puede comprar/mover plata.
  const { data: perfil } = await admin
    .from('profiles')
    .select('kyc_estado')
    .eq('id', user.id)
    .maybeSingle();

  if (!perfil || perfil.kyc_estado !== 'verificado') {
    return Response.json(
      { error: 'Debes verificar tu identidad (KYC) antes de comprar.' },
      { status: 403 },
    );
  }

  // El valor de la bebida se lee del catálogo (server-side); el cliente no lo
  // envía ni puede alterarlo. Solo bebidas activas.
  const { data: bebida } = await admin
    .from('bebidas_catalogo')
    .select('id, valor_v, activo')
    .eq('id', bebidaId)
    .maybeSingle();

  if (!bebida || !bebida.activo) {
    return Response.json({ error: 'Bebida no disponible.' }, { status: 404 });
  }

  // Desglose calculado en el servidor (MVP: rentador free = +15%).
  const desglose = calcularDesgloseCompra(Number(bebida.valor_v), 'free');

  const provider = decidePaymentProvider(Deno.env.toObject());

  // Genera el id de la orden primero: es el external_id que ve el partner y por
  // el que el webhook la correlaciona.
  const ordenId = crypto.randomUUID();

  const { error: insertError } = await admin.from('ordenes_pago').insert({
    id: ordenId,
    perfil_id: user.id,
    bebida_catalogo_id: bebida.id,
    valor_v: desglose.valorV,
    buyer_fee: desglose.buyerFee,
    total: desglose.total,
    estado: 'pendiente',
    provider,
    idempotency_key: idempotencyKey,
  });
  if (insertError) {
    // Idempotencia de creación: si ya existe una orden con esta idempotency_key
    // (reintento del mismo intento de compra), devolvemos ESA orden en vez de
    // crear una segunda — evita doble bebida (mock) / doble checkout (real).
    if (insertError.code === '23505') {
      const { data: existente } = await admin
        .from('ordenes_pago')
        .select('id, estado, valor_v, buyer_fee, total')
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();
      if (existente) {
        return Response.json({
          estado: existente.estado,
          ordenId: existente.id,
          desglose: {
            valorV: Number(existente.valor_v),
            buyerFee: Number(existente.buyer_fee),
            total: Number(existente.total),
          },
          idempotente: true,
        });
      }
    }
    return Response.json({ error: 'No se pudo crear la orden.' }, { status: 500 });
  }

  if (provider === 'mock') {
    // Sin pasarela real: se confirma de inmediato de forma atómica.
    const escrowRef = `mock-escrow-${ordenId}`;
    const { data: resultado, error: rpcError } = await admin.rpc('confirmar_orden_pago', {
      p_orden_id: ordenId,
      p_resultado: 'confirmada',
      p_escrow_ref: escrowRef,
    });
    if (rpcError) {
      return Response.json({ error: 'No se pudo confirmar la compra.' }, { status: 500 });
    }
    return Response.json({ estado: 'confirmada', ordenId, desglose, resultado });
  }

  // Modo Red Pontis real: crear la orden en el partner (fondos a subcuenta de
  // escrow). La confirmación llega luego por webhook firmado.
  const orderReq = buildRedPontisOrderRequest({
    apiKey: Deno.env.get('REDPONTIS_API_KEY')!,
    externalId: ordenId,
    total: desglose.total,
    moneda: 'PEN',
  });
  const partnerRes = await fetch(orderReq.url, {
    method: orderReq.method,
    headers: orderReq.headers,
    body: orderReq.body,
  });
  if (!partnerRes.ok) {
    await admin.from('ordenes_pago').update({ estado: 'fallida' }).eq('id', ordenId);
    return Response.json({ error: 'No se pudo iniciar el pago.' }, { status: 502 });
  }
  const { id: providerRef, checkout_url: checkoutUrl } = await partnerRes.json();
  await admin.from('ordenes_pago').update({ provider_ref: providerRef }).eq('id', ordenId);

  return Response.json({ estado: 'pendiente', ordenId, desglose, checkoutUrl });
});
