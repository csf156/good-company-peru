# Ayni — Estado del proyecto (archivo de consulta general)

**Qué es esto:** la bitácora única de progreso. Cada vez que el usuario declara **"fase concluida"**, la sesión añade aquí una entrada. Toda sesión nueva **lee este archivo al arrancar** para saber qué ya existe, sin releer todo el código.

**Cómo usarlo:**
- **Al iniciar sesión:** leer la tabla de fases + las últimas entradas para conocer el estado real (tablas, Edge Functions, decisiones tomadas, deuda pendiente).
- **Al concluir una fase** (solo cuando el usuario lo indique): añadir una entrada nueva con el formato de abajo, marcar la fase como ✅ en la tabla, y actualizar `FASE ACTUAL` en `CLAUDE.md`.
- **No borrar entradas.** Es append-only (histórico). Corregir errores con una entrada nueva, no editando las viejas.

---

## Tabla de fases

Estado: ⬜ pendiente · 🟨 en curso · ✅ concluida

### MVP (`2026-07-01-plan-mvp.md`)

| Fase | Descripción | Estado |
|------|-------------|--------|
| 1.0 | Scaffold Expo + Supabase + theme Ayni | ✅ |
| 1.1 | Esquema + RLS + storage | ✅ |
| 1.2 | Auth (OTP + email) | ✅ |
| 1.3 | Alta de perfil | ✅ |
| 1.4 | KYC Truora | ✅ |
| 1.5 | Ver/editar perfil | ✅ |
| 1.6 | Endurecimiento + revisión SP1 | ✅ |
| 3.0 | Ledger + wallet + escrow (schema) | ✅ |
| 3.1 | Integración pagos + escrow (Red Pontis) | ✅ |
| 3.2 | Catálogo + Tienda (UI) | ✅ |
| 3.3 | Bar / stock (UI) | ✅ |
| 3.4 | Conciliación + revisión SP3 | ✅ |
| 4.0 | Schema invitaciones + chat | ✅ |
| 4.1 | Descubrimiento simple (swipe) | ✅ |
| 4.2 | Crear invitación/solicitud + bloqueo fondos | ✅ |
| 4.3 | Aceptar/rechazar → abre chat | ✅ |
| 4.4 | Chat realtime + moderación | ⬜ |
| 4.5 | Confirmar cita | ⬜ |
| 4.6 | Revisión SP4 | ⬜ |
| 5.0 | Sesión + token QR rotativo | ⬜ |
| 5.1 | Scan mutuo + geofence | ⬜ |
| 5.2 | Cronómetro + notificaciones | ⬜ |
| 5.3 | Extensión de cita | ⬜ |
| 5.4 | Liberación de pago + no-show | ⬜ |
| 5.5 | E2E + revisión final MVP | ⬜ |

### Escalamiento (`2026-07-01-plan-escalamiento.md`)

| Fase | Descripción | Estado |
|------|-------------|--------|
| 8.0 | Billing recurrente (IAP) | ⬜ |
| 8.1 | Motor de gating por flags (`puede()`) | ⬜ |
| 8.2 | Upgrade/downgrade/cancelar (UI) | ⬜ |
| 8.3 | Revisión SP8 | ⬜ |
| 6.0 | Motor de cálculo de nivel | ⬜ |
| 6.1 | Decaimiento 45 días | ⬜ |
| 6.2 | Beneficios de nivel (fees reducidos) | ⬜ |
| 6.3 | Liquidación (lunes + on-demand) | ⬜ |
| 6.4 | Paneles de nivel + revisión SP6 | ⬜ |
| 2.0 | Preferencias + filtros | ⬜ |
| 2.1 | Motor de visibilidad por nivel | ⬜ |
| 2.2 | Swipe premium + invitaciones globales | ⬜ |
| 2.3 | Revisión SP2 | ⬜ |
| 9.0 | Schema + motor de comisión referidos | ⬜ |
| 9.1 | Código/link único + atribución | ⬜ |
| 9.2 | UI referidos | ⬜ |
| 9.3 | Revisión SP9 | ⬜ |
| 7.0 | SOS / pánico | ⬜ |
| 7.1 | Contacto guardián | ⬜ |
| 7.2 | Ratings + reportes + bloqueo | ⬜ |
| 7.3 | Moderación automática de chat | ⬜ |
| 7.4 | Panel de operaciones/soporte | ⬜ |
| 7.5 | ToS enforcement + revisión final | ⬜ |

---

## Bitácora (append-only, más reciente arriba)

> Formato por entrada:

```
### Fase X.Y — <título> — <fecha YYYY-MM-DD>

- **Qué se construyó:** (resumen en 2–4 líneas)
- **Archivos/pantallas clave:** (rutas)
- **Tablas / Edge Functions / migraciones:** (nombres exactos, para introspección futura)
- **Decisiones tomadas en la fase:** (las no obvias; por qué)
- **Tests:** (qué cubre; estado verde/rojo)
- **Deuda / notas para fases futuras:** (lo fuera de alcance que se anotó, no se hizo)
```

<!-- Las entradas reales van debajo de esta línea. -->

### Fase 4.3 — Aceptar/rechazar → abre chat — 2026-07-24

- **Qué se construyó:** Edge Function `responder-invitacion` + función SQL atómica `responder_invitacion` (mismo patrón `SECURITY DEFINER`+lock que `crear_invitacion`). El receptor de una invitación/solicitud `pendiente` la acepta o rechaza. Rechazar libera la bebida a `disponible` si la invitación era de tipo `invitacion` (ya bloqueada desde 4.2); una `solicitud` nunca tuvo bebida. Aceptar: si es `invitacion`, no toma bebida adicional; si es `solicitud`, el receptor (rentador) DEBE asignar y bloquear una bebida de su propio bar; en ambos casos crea la fila `citas` (vacía, estado default `pendiente`) — su sola existencia habilita el chat a las dos partes vía la RLS que la fase 4.0 ya dejó lista. Ejecutado con `superpowers:subagent-driven-development`: implementador Opus 4.8 → controller detectó un bug de diseño antes de enviar a review → fix del implementador → task-reviewer Opus 4.8 (security-review) → aprobado sin hallazgos Critical/Important.
- **Archivos/pantallas clave:** `supabase/functions/responder-invitacion/index.ts`, `supabase/functions/_shared/invitaciones.ts` (ampliado con `validarResponderInvitacion`), `supabase/tests/20_responder_invitacion.sql` (pgTAP).
- **Tablas / Edge Functions / migraciones:** migraciones `20260724150000_responder_invitacion.sql` (función `responder_invitacion`), `20260724160000_responder_invitacion_kyc_scope.sql` (fix pre-review: el gate KYC aplicaba a rechazar Y aceptar; se reescopa a solo aceptar). Edge Function nueva: `responder-invitacion` (`verify_jwt=true`). Función SQL nueva: `responder_invitacion()` (`SECURITY DEFINER`, execute solo `service_role`).
- **Decisiones tomadas en la fase:** (1) **Idempotencia "ya_resuelta", no `idempotency_key`:** a diferencia de `crear_invitacion` (que CREA una fila y necesita idempotencia por-intento), `responder_invitacion` MUTA una fila existente por su id — el reintento seguro es chequear `estado <> 'pendiente'` y devolver `'ya_resuelta'` sin reaplicar (mismo criterio que `confirmar_orden_pago`). (2) **Gate KYC corregido antes de llegar a review:** la primera versión exigía receptor verificado para responder CUALQUIER acción; el controller detectó que eso crea un deadlock — rechazar nunca compromete escrow, solo libera una bebida, así que gatearlo tras KYC dejaría la bebida del emisor `bloqueada` para siempre si el receptor no estuviera verificado. Se corrigió (migración `20260724160000`) para que el gate aplique SOLO al aceptar; rechazar funciona sin importar el estado KYC del receptor. (3) **Sin push notifications:** el repo no tiene ninguna infraestructura de push (ni `expo-notifications`, ni tabla de push token) pese a que el plan menciona "notifica push" en varias fases sin que ninguna la construya explícitamente — se dejó fuera de alcance (un `TODO(push)` de una línea en el SQL) y anotado en backlog para que 5.2 (Cronómetro + notificaciones) la siente como costura real. (4) **`cita` nace vacía** (solo `invitacion_id`, resto por default) — zona/hora/mensaje y la transición a `estado='confirmada'` son la fase 4.5, no esta.
- **Tests:** 168→198 pgTAP (file 20 nuevo: 30 aserciones cubriendo los dos casos nombrados por el plan — "rechazo devuelve la bebida a disponible" y "aceptar habilita chat solo a las dos partes" — más el fix de KYC, anti-suplantación, ya_resuelta, ambos tipos de aceptar, bebida de otro bar) verdes; 206→214 jest verdes; lint y `tsc --noEmit` limpios. `security-review` vía subagente Opus 4.8: aprobado, 0 Critical/Important, 3 Minor anotados en backlog.
- **Deuda / notas para fases futuras:** anotado en `docs/backlog.md` — (a) sin infraestructura de push (candidata natural: 5.2); (b) el runner casero de migraciones (`apply-migrations.mjs`) deriva versión del prefijo del nombre de archivo y salta EN SILENCIO una migración si dos comparten prefijo (pasó una vez en 4.2/hardening, resuelto renombrando; el runner debería fallar ruidosamente ante la colisión, no confiar en que no se repita); (c) `responder_invitacion` distingue `AY404` (invitación inexistente) de `AY403` (existe pero no eres el receptor) — revela existencia a un tercero, riesgo bajo (UUIDs no enumerables).

### Fase 4.2 — Crear invitación/solicitud + bloqueo de fondos — 2026-07-24

- **Qué se construyó:** Edge Function `crear-invitacion` + función SQL atómica `crear_invitacion` (mismo patrón `SECURITY DEFINER` + `search_path` fijo + `for update` lock que `confirmar_orden_pago`). El rentador emite una `invitacion` con una bebida de su bar (la bloquea `disponible`→`bloqueada`, atómico con el insert); el amigo emite una `solicitud` sin bebida (la asigna el rentador al aceptar, fase 4.3). Emisor debe estar `kyc_estado='verificado'` (gate testeable en SQL, fuente de verdad). Idempotente por `(emisor_id, idempotency_key)`. Ejecutado con `superpowers:subagent-driven-development`: implementador Opus 4.8 → task-reviewer Opus 4.8 (security-review) → fix → re-review → aprobado, más una desviación puntual autorizada (hardening de `ordenes_pago`, ver abajo).
- **Archivos/pantallas clave:** `supabase/functions/crear-invitacion/index.ts`, `supabase/functions/_shared/invitaciones.ts` (validación de forma pura, Jest), `supabase/tests/19_crear_invitacion.sql` (pgTAP).
- **Tablas / Edge Functions / migraciones:** migraciones `20260724120000_crear_invitacion.sql` (función `crear_invitacion`, columna `invitaciones.idempotency_key`), `20260724130000_invitacion_idempotency_scope.sql` (fix post-review: índice único de `(idempotency_key)` global a `(emisor_id, idempotency_key)` compuesto). Edge Function nueva: `crear-invitacion` (`verify_jwt=true`). Función SQL nueva: `crear_invitacion()` (`SECURITY DEFINER`, execute solo `service_role`).
- **Decisiones tomadas en la fase:** (1) **Idempotencia insert-first:** la función reclama la fila de `invitaciones` ANTES de bloquear la bebida — así un doble disparo concurrente con la misma key pierde en el unique index (`unique_violation` → devuelve la fila ya creada), nunca en el chequeo de disponibilidad de la bebida (que daría un falso "ya bloqueada" a un reintento legítimo). (2) **Gate KYC duplicado a propósito:** vive en la función SQL (fuente de verdad testeable con pgTAP, ya que este repo no tiene arnés Deno para testear `index.ts` directamente) y también como chequeo temprano en el Edge Function (optimización, evita una llamada RPC en el caso obvio). (3) **`alcance='especifica'` fijo, no viene del cliente** — `global` es sub-proyecto 2, la costura del schema (4.0) no se expone todavía. (4) **Hallazgo de security-review corregido en la misma fase:** el índice único de `idempotency_key` era global, no por emisor — el fast-path devolvía la fila COMPLETA de otro usuario (receptor, zona, tiempo) ante una colisión de key, sin chequear dueño ni KYC. Se corrigió reescopando a `(emisor_id, idempotency_key)` (migración `20260724130000`), con pgTAP nuevo probando que el mismo emisor+key sigue siendo idempotente y que otro emisor con la misma key NO colisiona ni recibe la fila ajena. (5) **Desviación autorizada fuera de secuencia:** el mismo patrón de bug (idempotency_key global) existía también en `ordenes_pago` desde la fase 3.4 — menor severidad ahí (no exponía PII, solo estado/montos), pero el usuario autorizó corregirlo de inmediato como hardening puntual de SP3 (commit `609b4b5`, revisado y aprobado igual que el resto), en vez de solo anotarlo en backlog.
- **Tests:** 148→168 pgTAP (file 19 nuevo: 19 aserciones de `crear_invitacion`, incluyendo los dos casos nombrados por el plan — "no se puede invitar con bebida ya bloqueada" y "emisor no verificado rechazado" — más el caso cross-emisor del fix; file 12 ampliado con el caso cross-perfil de `ordenes_pago`) verdes; 196→206 jest (`_shared/invitaciones.ts`) verdes; lint y `tsc --noEmit` limpios. `security-review` vía subagente Opus 4.8 en 2 rondas (hallazgo Important corregido, 1 Minor aceptado y anotado — ver deuda).
- **Deuda / notas para fases futuras:** anotado en `docs/backlog.md` — `foreign_key_violation` en `crear_invitacion` asume que la FK que falla es siempre `bebida_bar_id`; un `receptor_id` inexistente también dispararía FK y se reportaría como "bebida no encontrada" (mensaje engañoso, bajo riesgo porque el receptor real siempre viene del descubrimiento). No se corrigió en esta fase por decisión explícita del usuario.

### Fase 4.1 — Descubrimiento simple (swipe) — 2026-07-24

- **Qué se construyó:** portada `routes/index.tsx` de Lovable a RN/Expo: vista un-perfil-a-la-vez del rol opuesto al propio, solo perfiles verificados, sin filtros premium ni gating por nivel (eso es sub-proyecto 2). Reemplaza el home stub de scaffold de 1.0 — el mapeo del plan asigna esa ruta a esta fase.
- **Archivos/pantallas clave:** `lib/descubrimiento.ts` (`getPerfilesDescubrir`), `app/index.tsx` (`DiscoverScreen`).
- **Tablas / Edge Functions / migraciones:** ninguna nueva (consume `perfiles_publicos` de 1.5, vía `getOwnProfile`/`getPublicProfile` de `lib/profile.ts`).
- **Decisiones tomadas en la fase:** (1) **`getPerfilesDescubrir` resuelve el rol opuesto server-side-friendly:** lee el perfil propio primero (`getOwnProfile`), calcula el rol buscado (`amigo`↔`rentador`) y filtra `perfiles_publicos` por ese rol + `kyc_estado='verificado'` — sin ese primer paso el cliente tendría que adivinar o hardcodear el rol contrario. (2) **CTA (Invitar/Solicitar) queda visualmente presente pero inerte** — mismo patrón que "Invitar" en `bar.tsx` (fase 3.3): el botón no dispara nada porque el Edge Function `crear-invitacion` que la fase 4.2 construye todavía no existe; conectarlo antes sería trabajo de otra fase. (3) **Sin componente `FriendCard`/`AppShell` portado** — se sigue el patrón inline de `store.tsx`/`bar.tsx` (deuda de portado de componentes base ya anotada desde 1.0 en backlog, no se resuelve aquí). (4) **Sin navegación entre pantallas** — ninguna fase anterior (bar/store/wallet) enlaza entre sí tampoco; no es alcance de 4.1 introducirla.
- **Tests:** 10 aserciones nuevas (4 `descubrimiento.test.ts` + 6 `index.test.tsx`) → 196/196 jest (se borró `tests/app/home.test.tsx`, obsoleto: probaba el stub de 1.0 que esta fase reemplaza); lint y `tsc --noEmit` limpios. Sin `security-review` (UI pura, sin escritura nueva; la RLS de `perfiles_publicos` ya se auditó en 1.5/1.6). pgTAP sin cambios (148, fase sin schema).
- **Deuda / notas para fases futuras:** ninguna nueva (la única pendiente es la ya anotada en backlog sobre componentes base sin portar).

### Fase 4.0 — Schema invitaciones + chat — 2026-07-23

- **Qué se construyó:** modelo de datos del sub-proyecto 4. Tablas `invitaciones` (propuesta rentador→amigo o amigo→rentador), `citas` (nace al aceptar una invitación, reusa `estado_cita` completo de 1.1) y `chat_mensajes` (única tabla donde el cliente escribe directo). RLS estricto: solo las dos partes de la invitación ven invitación/cita/chat. Realtime habilitado en `chat_mensajes` y `citas`.
- **Archivos/pantallas clave:** `supabase/migrations/20260723180000_invitaciones_chat.sql`; tests `supabase/tests/15_invitaciones_rls.sql`, `16_citas_rls.sql`, `17_chat_mensajes_rls.sql`, `18_realtime_publication.sql`.
- **Tablas / Edge Functions / migraciones:** migración `20260723180000_invitaciones_chat.sql`. Tablas nuevas: `invitaciones`, `citas`, `chat_mensajes`. Enums nuevos: `tipo_propuesta` (`invitacion`|`solicitud` — distinto de `tipo_invitacion`, que es categoría de bebida), `alcance_invitacion` (`especifica`|`global`), `estado_invitacion` (`pendiente`|`aceptada`|`rechazada`|`expirada`). `citas.estado` reusa el enum `estado_cita` de 1.1 sin cambios. (Sin Edge Functions — crear/responder invitación es 4.2/4.3.)
- **Decisiones tomadas en la fase:** (1) **Invitaciones/citas siguen el patrón de bar/ledger/ordenes_pago:** el cliente solo `select` (filtrado a las partes); insert/update/delete revocados — toda transición (crear, aceptar, rechazar, confirmar) es `service_role` en Edge Functions de fases posteriores. (2) **`chat_mensajes` es la ÚNICA tabla de la fase donde el cliente escribe:** `insert` propio (`emisor_id = auth.uid()`) y solo en una cita de la que es parte — sin eso, el chat en tiempo real necesitaría un Edge Function por cada mensaje, más lento y sin valor de seguridad extra (el emisor y la pertenencia ya los garantiza el `with check`). `update`/`delete` revocados: la moderación anti-fuga (4.4) oculta vía `service_role`, nunca edita el texto. (3) **`invitaciones` tiene CHECK `alcance`↔`receptor_id`:** `especifica` exige receptor, `global` lo exige null — costura para el descubrimiento premium (SP2) sin abrir la tabla a nadie más todavía. (4) **`citas.invitacion_id` es `unique`:** una invitación produce como mucho una cita (aceptar dos veces no debe crear dos citas; el enforcement real de "no aceptar dos veces" es responsabilidad de 4.3, esto es la invariante de datos). (5) **Realtime:** `citas` con `replica identity full` (los UPDATE de estado deben viajar con la fila completa para que la UI refleje el nuevo estado sin un round-trip extra); `chat_mensajes` con la identidad por defecto basta (solo insert).
- **Tests:** 125→148 pgTAP (files 15–18 nuevos: RLS de invitaciones/citas/chat, publicación Realtime) verdes; 187/187 jest (sin cambios de código TS en esta fase); lint y `tsc --noEmit` limpios. Sin `security-review` dedicado (fase de schema puro, ver nota de seam abajo); revisión inline confirmó aislamiento RLS correcto en las 3 tablas.
- **Deuda / notas para fases futuras:** anotado en `docs/backlog.md` — `chat_mensajes.oculto` (columna de moderación) no lo filtra la RLS: ambas partes pueden `select` un mensaje aunque esté `oculto=true`. Si 4.4 oculta solo en el cliente, la contraparte podría leer un mensaje moderado consultando directo la tabla. 4.4 debe forzar el filtro server-side (RLS que excluya `oculto` para quien no es el emisor, o una vista/RPC de lectura).

### Fase 3.4 — Conciliación + revisión SP3 — 2026-07-23  ·  **cierra sub-proyecto 3**

- **Qué se construyó:** cierre de dinero seguro del sub-proyecto 3. Job de conciliación que detecta discrepancias contables + auditoría final (security-review + code-review con `superpowers:requesting-code-review`). El review confirmó money core correcto, 0 Critical; sus 2 hallazgos Important se arreglaron dentro de esta fase.
- **Archivos/pantallas clave:** `supabase/functions/comprar-bebida/index.ts` (idempotencia de creación), `lib/tienda.ts` (`newIdempotencyKey`), `app/store.tsx` (manejo de key por intento).
- **Tablas / Edge Functions / migraciones:** migraciones `20260723150000_conciliacion_sp3.sql` (función `detectar_discrepancias_sp3`), `20260723160000_conciliacion_montos.sql` (5ª invariante de montos), `20260723170000_orden_idempotency.sql` (`ordenes_pago.idempotency_key` + unique index). Función nueva: `detectar_discrepancias_sp3()` (`SECURITY DEFINER`, search_path fijo, execute solo `service_role`).
- **Decisiones tomadas en la fase:** (1) **Conciliación como función SQL de solo-lectura** que devuelve una fila por discrepancia (vacío = todo cuadra); agendarla (pg_cron / Edge Function + cron) es paso de deploy, no de código. (2) **5 invariantes:** orden confirmada con !=3 filas de ledger; orden no-confirmada con ledger; grupo de compra que no netea a 0; desbalance global escrow_lock↔bar; **y (post-review) montos del ledger != a los congelados en la orden** — la #3 (netea a 0) dejaba pasar un grupo balanceado-pero-mal-preciado. (3) **Idempotencia de creación de orden (post-review):** el cliente genera una `idempotency_key` por intento y la reusa en reintentos; `comprar-bebida` inserta con ella y ante `23505` devuelve la orden existente. `confirmar_orden_pago` ya era idempotente por-orden; esto cierra el hueco de la *creación*. (4) **Conciliación balance↔partner** queda documentada como costura para el payout real (5.4) — el provider mock no tiene ledger de partner que reconciliar.
- **Tests:** 121→125 pgTAP (files 12 y 14 ampliados: idempotency_key unique, invariante de montos) verdes; 185→187 jest (idempotencia en tienda/store) verdes; lint y `tsc --noEmit` limpios. `security-review` + `requesting-code-review`: money core correcto, 0 Critical; 2 Important arreglados; 4 Minor anotados en backlog.
- **Deuda / notas para fases futuras:** anotado en `docs/backlog.md` (Minor del review) — `pago-webhook` devuelve 404 genérico ante cualquier error de RPC; `parsePagoWebhookPayload` solo mapea `paid`/`failed`; `partnerRes.json()` sin guardia deja órdenes `pendiente` colgadas; invariante #4 se vuelve frágil si se agrega borrado de cuentas. Todos son robustez/edge para cuando Red Pontis sea real, no bloquean.

> **Sub-proyecto 3 (Tienda + Bar + Wallet/Escrow) CERRADO.** Construido: schema de dinero (`ledger` append-only, vista `balance`, `bebidas_catalogo`, `bar`, `ordenes_pago`); Edge Functions `comprar-bebida` + `pago-webhook` tras interfaz `PaymentProvider` (mock|redpontis); funciones SQL `confirmar_orden_pago` (atómica) + `detectar_discrepancias_sp3`; UI de tienda/bar/wallet. Todo el dinero server-side, ledger append-only, idempotente, RLS estricto.

### Fase 3.3 — Bar / stock (UI) — 2026-07-23

- **Qué se construyó:** portadas `routes/bar.tsx` y `routes/wallet.tsx` de Lovable a RN/Expo, cableadas a datos reales. El bar del rentador lista su stock (`bar`, RLS select-own) con estado; la wallet muestra el balance calculado de la vista `balance` (Fase 3.0).
- **Archivos/pantallas clave:** `lib/bar.ts` (`getMiBar`, `getBalance`), `app/bar.tsx`, `app/wallet.tsx`.
- **Tablas / Edge Functions / migraciones:** ninguna nueva (consume `bar` + vista `balance` de 3.0).
- **Decisiones tomadas en la fase:** (1) **Alcance recortado del Lovable original** — `bar.tsx` de Lovable mostraba nivel/gasto y `wallet.tsx` traía botones de liquidación (lunes/on-demand), fee de S/8, e historial. Todo eso es sub-proyecto 6 (motor de liquidación/niveles), que no existe; se portó solo lo que el plan de 3.3 pide: estado del stock y balance. (2) **"Invitar" es solo visual** — aparece únicamente en filas `disponible`, sin acción; la conecta el sub-proyecto 4 (crear invitación bloquea la bebida). (3) **`getMiBar` tolera `bebida=null`** — el join a `bebidas_catalogo` (RLS `activo=true`) no trae una bebida desactivada tras la compra; la UI muestra "Bebida no disponible" en vez de romper. Anotado como deuda (el dueño debería seguir viendo lo que pagó).
- **Tests:** 5 aserciones nuevas (`bar.test.ts`) + 4 (`bar.test.tsx`) + 2 (`wallet.test.tsx`) → 185/185 jest; lint y `tsc --noEmit` limpios. Sin `security-review` (UI pura).
- **Deuda / notas para fases futuras:** anotado en `docs/backlog.md` — el join `bar → bebidas_catalogo` pierde datos si el operador desactiva una bebida ya comprada; considerar congelar nombre/tipo/valor en `bar` o relajar la RLS del catálogo para filas referenciadas por el propio stock (endurecimiento 3.4).

### Fase 3.2 — Catálogo + Tienda (UI) — 2026-07-23

- **Qué se construyó:** portada `routes/store.tsx` de Lovable a RN/Expo, cableada a datos reales. Lista `bebidas_catalogo` (RLS ya filtra `activo=true`), filtro por `tipo_invitacion`, compra vía `comprar-bebida` (Fase 3.1). El desglose de fee mostrado tras la compra es el que devuelve el servidor — no se porta `calcTotalWithFees` ni `mock-data.ts` de Lovable.
- **Archivos/pantallas clave:** `lib/tienda.ts` (`getCatalogo`, `comprarBebida`), `app/store.tsx`, `lib/theme.ts` (tokens `ayni`/`ayniTypography` agregados).
- **Tablas / Edge Functions / migraciones:** ninguna nueva (consume el schema/Edge Function de 3.0/3.1).
- **Decisiones tomadas en la fase:** (1) **Sin preview de fee client-side** — a diferencia del bottom-sheet de Lovable (que mostraba el desglose antes de confirmar, calculado en cliente), la compra se dispara directo al tocar "Comprar"; el banner de éxito muestra el total real que devolvió el servidor. Evita reintroducir cálculo de fee en el cliente (`comprar-bebida` en modo mock del MVP es síncrono, no hay paso de "cotización" separado). (2) **Tokens `ayni`/`ayniTypography` agregados en `lib/theme.ts` sin tocar `colors`/`typography`** — son los valores reales de `src/styles.css` de Lovable (dorado/bronce sobre superficies oscuras); la paleta vieja teal/coral sigue siendo la que usan las pantallas ya cerradas (1.x). El portado completo del design-system sigue como deuda en `docs/backlog.md` desde fase 1.0. (3) **Corolario de testing confirmado:** `fireEvent.press` en `@testing-library/react-native@14` espera a que el handler `onPress` async termine antes de resolver — si el test necesita capturar un estado intermedio (loading) con una promesa mockeada pendiente, no se debe `await` ese press (cuelga hasta el timeout). Documentado en memoria de sesión.
- **Tests:** 4 aserciones nuevas (`tienda.test.ts`) + 6 (`store.test.tsx`) → 174/174 jest; lint y `tsc --noEmit` limpios. Sin `security-review` (fase de UI pura; el dinero ya se resolvió server-side en 3.1, según el plan).
- **Deuda / notas para fases futuras:** ninguna nueva.

### Fase 3.1 — Integración pagos + escrow (Red Pontis) — 2026-07-23

- **Qué se construyó:** cobro real y custodia detrás de una interfaz `PaymentProvider` (`mock` | `redpontis`) — misma bisagra que KYC demo/truora: activar Red Pontis real es solo configurar `PAYMENT_PROVIDER=redpontis` + `REDPONTIS_API_KEY`, sin cambios de código. Edge Function `comprar-bebida` calcula el fee server-side (cliente solo envía `bebidaId`) y confirma inline en modo mock; `pago-webhook` confirma en modo real, autenticado por firma HMAC. La confirmación (ledger + bar) es una función SQL atómica e idempotente.
- **Archivos/pantallas clave:** `supabase/functions/_shared/pagos.ts` (isomórfico, testeado con Jest), `supabase/functions/comprar-bebida/index.ts`, `supabase/functions/pago-webhook/index.ts`, `tests/functions/pagos.test.ts`.
- **Tablas / Edge Functions / migraciones:** migraciones `20260723130000_ordenes_pago.sql` (tabla `ordenes_pago`, enum `estado_orden`), `20260723140000_confirmar_orden_pago.sql` (función `confirmar_orden_pago`, `SECURITY DEFINER`, execute solo `service_role`). Edge Functions `comprar-bebida`, `pago-webhook`.
- **Decisiones tomadas en la fase:** (1) **Fee modelo diseño §A**, no el resumen literal del plan/CLAUDE.md: rentador gratis paga V + buyer fee 15%; el ~4% de procesamiento sale del margen de la plataforma, NO se cobra encima (decisión confirmada explícitamente con el usuario ante la discrepancia — anotada en backlog para alinear los docs). (2) **Confirmación atómica vía función SQL, no vía escrituras sueltas en el Edge Function** — un `INSERT` de ledger + `INSERT` de bar hechos como pasos separados en TS dejarían un hueco de fallo parcial (orden confirmada sin su bebida) inaceptable en dinero; `confirmar_orden_pago` hace todo en una transacción con `for update` lock, e idempotencia por chequeo de estado (`ya_resuelta` en un segundo intento) además del `unique` del ledger. (3) **`ordenes_pago` congela los montos al crearse** — el webhook confirma con esos montos, nunca con los del payload, así ni el cliente ni un webhook forjado pueden alterar el fee. (4) **`config.toml` ahora pinnea `verify_jwt` por función** (`comprar-bebida`/`kyc-start` = true, `pago-webhook`/`kyc-webhook` = false) — cierra deuda anotada en 1.6 sobre depender del flag `--no-verify-jwt` en cada deploy manual.
- **Tests:** 18 aserciones Jest nuevas (`pagos.test.ts`) → 164/164 jest; 27 pgTAP nuevas (files 12–13: RLS de `ordenes_pago`, atomicidad/idempotencia de `confirmar_orden_pago`, rechazo de ejecución por cliente) → 115/115 pgTAP; lint y `tsc --noEmit` limpios. `security-review` inline: 0 hallazgos HIGH/MEDIUM.
- **Deuda / notas para fases futuras:** anotado en `docs/backlog.md` — (a) creación de orden en `comprar-bebida` no es idempotente por-click (doble-tap crea 2 órdenes `pendiente`); considerar en 3.2 (UI) o endurecimiento 3.4. (b) el procesamiento (~4%) no se registra en ningún ledger de plataforma todavía — solo aplica cuando exista una cuenta contable de operador (conciliación 3.4 / niveles 6). (c) alinear el texto de fees del plan/CLAUDE.md al diseño §A (son inconsistentes entre sí; se implementó el diseño).

### Fase 3.0 — Ledger + wallet + escrow (schema) — 2026-07-23

- **Qué se construyó:** núcleo de dinero del sub-proyecto 3. Contabilidad append-only e idempotente. Tablas `ledger` (movimientos con signo, `idempotency_key` unique global), `bebidas_catalogo` (config del operador) y `bar` (stock del rentador); vista `balance` calculada del ledger. Todo con RLS estricto y escritura reservada al `service_role`.
- **Archivos/pantallas clave:** `supabase/migrations/20260723120000_money_ledger.sql`; tests `supabase/tests/07_money_schema.sql`, `08_ledger_append_only.sql`, `09_balance_view.sql`, `10_bar_rls.sql`, `11_bebidas_catalogo_rls.sql`.
- **Tablas / Edge Functions / migraciones:** migración `20260723120000_money_ledger.sql`. Tablas nuevas: `ledger`, `bebidas_catalogo`, `bar`. Vista nueva: `balance`. Enums nuevos: `tipo_movimiento` (`compra`|`escrow_lock`|`escrow_release`|`payout`|`refund`|`fee`), `tipo_invitacion` (`divertida`|`romantica`|`misteriosa`|`amigos`|`autor`), `estado_bar` (`disponible`|`bloqueada`|`consumida`). Función/trigger: `ledger_append_only()` + triggers `ledger_no_update`/`ledger_no_delete`. (Sin Edge Functions — eso es 3.1.)
- **Decisiones tomadas en la fase:** (1) **Append-only real vía trigger, no solo revoke.** `ledger_append_only()` hace `raise exception` en cualquier UPDATE/DELETE y aplica a TODOS los roles, incluido `service_role` (que bypassa RLS y grants, pero no triggers). Las correcciones se hacen con filas compensatorias nuevas (`refund`), nunca mutando. (2) **`balance` con `security_invoker = on`** — a diferencia de `perfiles_publicos` (que a propósito lee todas las filas), la vista de balance DEBE correr la RLS de `ledger` como el usuario que consulta, si no filtraría el saldo de todos. Es el control de seguridad crítico de la fase; probado en `09_balance_view.sql` (Alice no ve el balance de Bob). (3) **`monto` con signo, fijado por el writer.** La vista solo suma; qué tipos afectan el balance disponible vs. escrow lo integran 3.1 (compra) y 5.4 (payout) con sus propios tests. No se hardcodea contabilidad por-tipo en el schema para no chocar con el writer real. (4) **`idempotency_key` unique global** → una compra escribirá varias filas (`compra`/`fee`/`escrow_lock`) con keys derivadas distintas (`<op>:compra`, `<op>:fee`, `<op>:lock`). (5) **`ledger.perfil_id` sin `on delete cascade`** — registro financiero que sobrevive; un perfil con historial no se borra en duro. (6) **catálogo con RLS `using(activo)`** → el cliente nunca ve bebidas retiradas ni sus precios.
- **Tests:** 44 aserciones pgTAP nuevas (files 07–11) → **88 pgTAP totales** verdes; 146/146 jest; lint (`eslint . --max-warnings=0`) y `tsc --noEmit` limpios. `security-review` sobre la migración: 0 hallazgos HIGH/MEDIUM. Ciclo TDD respetado (RED con tablas ausentes → migración → GREEN).
- **Deuda / notas para fases futuras:** (a) la **convención de signo** de cada `tipo` de movimiento la define e integra 3.1/5.4 — el schema solo garantiza append-only, idempotencia y balance=suma. (b) La vista `balance` es "disponible/liquidable" simple (suma total); si más adelante se necesita distinguir *disponible* de *en escrow* habrá que derivarlo por `tipo` (aditivo, sin migración destructiva). (c) `referencia_id` es un uuid polimórfico sin FK (apunta a bar/cita/orden según el flujo) — el acceso lo gobierna la RLS del objeto referenciado.

> **Nota de reconstrucción (2026-07-22):** las entradas 1.0–1.5 de abajo se escribieron retroactivamente porque esta bitácora nunca se actualizó al cerrar cada fase, aunque el código y los commits sí existen. Reconstruidas por introspección de `git log --stat` y `git show` de cada commit, no de memoria.

### Fase 1.6 — Endurecimiento + revisión Sub-proyecto 1 — 2026-07-23

- **Qué se construyó:** cierre del sub-proyecto 1 (Identidad). Auditoría de seguridad completa por introspección: RLS de `profiles`/`preferencias_salida`/`suscripcion`/`kyc_verificaciones`, column privileges, policies de storage (`dni`/`fotos`), manejo del webhook KYC (orden de verificación de firma, idempotencia), y confirmación de que el gate de verificación (`kyc_estado`) solo lo escribe `service_role`. 0 hallazgos nuevos HIGH/MEDIUM — los únicos 2 fixes de seguridad de la fase ya estaban escritos (de sesión previa) y solo faltaba commitearlos.
- **Archivos/pantallas clave:** `supabase/functions/_shared/kyc.ts` (`isSelfOwnedStoragePath`, guard de secret vacío en `verifyWebhookSignature`), `supabase/functions/kyc-start/index.ts`, `tests/functions/kyc.test.ts`, `eslint.config.js`.
- **Tablas / Edge Functions / migraciones:** ninguna nueva (auditoría, no schema nuevo).
- **Decisiones tomadas en la fase:** (1) `isSelfOwnedStoragePath` reemplaza `startsWith()` en `kyc-start` — `startsWith` aceptaba `<uid>/../<otro>/dni.jpg` (path traversal), explotable porque `kyc-start` firma URLs con `service_role` y eso bypassa la RLS de storage; ahora exige exactamente `<uid>/<archivo>`. (2) `verifyWebhookSignature` rechaza de inmediato si el secreto está vacío/`undefined`, en vez de computar HMAC con clave vacía (forjable por cualquiera si `TRUORA_WEBHOOK_SECRET` queda sin setear en un deploy con `KYC_PROVIDER=truora`). (3) `.claude/*` se agregó a los ignores de eslint: un worktree anidado de sesión previa rompía `npm run lint` porque `eslint .` recorría su copia de las Edge Functions Deno (el glob de `supabase/functions/*` no cubre rutas bajo `.claude/worktrees/`).
- **Tests:** 146/146 unit verdes, 44/44 aserciones pgTAP verdes, lint (`eslint . --max-warnings=0`) y `tsc --noEmit` limpios. Suite completa confirmada verde antes de cada commit.
- **Deuda / notas para fases futuras:** anotado en `docs/backlog.md` — (a) `perfiles_publicos` expone `kyc_estado` con granularidad completa (`pendiente`/`rechazado`/`verificado`) en vez de un booleano `verificado`, sobre-disclosure leve no explotable; (b) `supabase/config.toml` no pinnea `verify_jwt = false` para `kyc-webhook`, depende del flag `--no-verify-jwt` en cada deploy manual — revisar al activar Truora real (sub-proyecto 3+). **Sub-proyecto 1 (Identidad) queda cerrado.**

### Fase 1.5 — Ver/editar perfil + foto — 2026-07-04

- **Qué se construyó:** perfil propio (ver/editar, reemplazo de foto, badge verificado) y perfil público de otro usuario vía vista con allowlist de columnas (excluye nombre real, DNI, saldo, teléfono, flags). Fotos del bucket privado `fotos` servidas por signed URL.
- **Archivos/pantallas clave:** `app/profile.tsx`, `app/profile/[id].tsx`, `lib/profile.ts` (`getPublicProfile`), `lib/storage.ts` (`getPhotoSignedUrl`).
- **Tablas / Edge Functions / migraciones:** migración `20260705120000_perfiles_publicos.sql` (vista `perfiles_publicos`, grant a `authenticated`, revoke de `anon`).
- **Decisiones tomadas en la fase:** la vista es el único camino sancionado para leer datos de otro usuario (RLS de `profiles` sigue bloqueando la tabla base); se excluye `nombre` (solo `alias` es público) y toda columna de dinero/nivel/flags aunque no se pidió explícitamente.
- **Tests:** 139/139 unit verdes, 44 aserciones pgTAP verdes (incluye prueba de que columnas excluidas fallan por "column does not exist", no por permiso bypasseable).
- **Deuda / notas para fases futuras:** ninguna nueva; endurecimiento pendiente en 1.6.

### Fase 1.4 — KYC Truora (DNI + liveness) — 2026-07-04

- **Qué se construyó:** verificación de identidad en **modo demo** (cualquier DNI escaneado aprueba al instante) con interfaz lista para Truora real vía config (`KYC_PROVIDER=truora` + `TRUORA_API_KEY`), sin cambios de código para el swap.
- **Archivos/pantallas clave:** `app/(auth)/kyc.tsx`, `lib/kyc.ts`, `lib/storage.ts` (`uploadDniDocument`), `supabase/functions/_shared/kyc.ts`, `supabase/functions/kyc-start`, `supabase/functions/kyc-webhook` (deploy con `--no-verify-jwt`, autenticado por HMAC de Truora en vez de sesión Supabase).
- **Tablas / Edge Functions / migraciones:** migración `20260704120000_kyc_verificaciones.sql` (tabla `kyc_verificaciones`, RLS select-own, insert/update/delete solo `service_role`); Edge Functions `kyc-start`, `kyc-webhook`.
- **Decisiones tomadas en la fase:** `decideKycProvider` cae a demo por defecto salvo que AMBAS env vars estén set (evita activar Truora por accidente si una key se filtra al entorno); `kyc-start` es idempotente también en estado `pendiente` (fix de security-review: doble llamada durante verificación real habría re-enviado a Truora).
- **Tests:** 125/125 unit verdes (al cerrar la fase), 39 aserciones pgTAP. *(Ahora 146/146 y 44 pgTAP tras fixes de 1.6, ver abajo.)*
- **Deuda / notas para fases futuras:** el gate "usuario no verificado no puede comprar/recibir dinero" es de navegación únicamente hasta que exista sub-proyecto 3 (escrow) — anotado en el plan, no es deuda nueva.

### Fase 1.3 — Alta de perfil (amigo / rentador) — 2026-07-04

- **Qué se construyó:** onboarding de perfil (nombre, alias, edad ≥18, género, profesión, hobbies, intereses, foto; `preferencias_salida` solo para amigo) con validación cliente + server (columnas con grant restringido de 1.1 + CHECK de edad en DB).
- **Archivos/pantallas clave:** `app/(auth)/profile-setup.tsx`, `lib/profile.ts` (`updateOwnProfile`, `upsertPreferenciasSalida`), `lib/profile-complete.ts`, `lib/storage.ts` (`uploadProfilePhoto`), `lib/route-guard.ts` (estado `profileStatus`: none/incomplete/complete).
- **Tablas / Edge Functions / migraciones:** ninguna nueva (usa esquema de 1.1).
- **Decisiones tomadas en la fase:** `lib/profile-complete.ts` se separó de `lib/profile.ts` para no depender de supabase/AsyncStorage en tests puros.
- **Tests:** 90/90 unit verdes, lint y typecheck limpios.
- **Deuda / notas para fases futuras:** ninguna.

### Fase 1.2 — Auth (OTP teléfono + email) — 2026-07-04

- **Qué se construyó:** login/registro por OTP (SMS teléfono normalizado a E.164 Perú, y email), selección de rol en primer login, guardas de ruta según sesión/perfil.
- **Archivos/pantallas clave:** `app/(auth)/sign-in.tsx`, `verify-otp.tsx`, `select-role.tsx`, `app/_layout.tsx`, `lib/auth.ts`, `lib/validation.ts`, `lib/route-guard.ts`, `hooks/useAuthSession.ts`, `hooks/useResendCooldown.ts`.
- **Tablas / Edge Functions / migraciones:** ninguna nueva.
- **Decisiones tomadas en la fase:** cooldown de reenvío de 30s; `computeRedirect` como función pura testeable aparte de la navegación real.
- **Tests:** 57/57 unit verdes, lint y typecheck limpios.
- **Deuda / notas para fases futuras:** el redirect de `_layout.tsx` corre en un `useEffect` (post-render) — una pantalla protegida puede parpadear antes del redirect. No explotable hoy (index sin contenido sensible) pero revisar cuando lo tenga.

### Fase 1.1 — Esquema de datos + RLS + storage — 2026-07-03

- **Qué se construyó:** esquema base con costuras de expansión: `profiles` (rol, KYC, columnas de nivel, flags), `preferencias_salida`, `suscripcion`, enum `estado_cita` completo. Bucket privado `dni` (owner-only) y `fotos` (owner-write, authenticated-read).
- **Archivos/pantallas clave:** `supabase/migrations/20260703120000_initial_schema.sql`, `20260703120100_column_privileges.sql`, runner de tests `tests/db/apply-migrations.mjs` + `run-pgtap.mjs` (sin Docker, contra Supabase cloud vía `DATABASE_URL`).
- **Tablas / Edge Functions / migraciones:** `profiles`, `preferencias_salida`, `suscripcion`, buckets `dni`/`fotos`.
- **Decisiones tomadas en la fase:** RLS de fila no bastaba — un usuario podía UPDATE su propia fila para auto-verificarse KYC o auto-otorgarse premium. Fix con **privilegios a nivel de columna**: `authenticated` solo puede tocar (id, rol) en insert y campos editables en update; columnas sensibles son `service_role`-only.
- **Tests:** 33 aserciones pgTAP verdes.
- **Deuda / notas para fases futuras:** ninguna.

### Fase 1.0 — Scaffold del proyecto — 2026-07-03

- **Qué se construyó:** proyecto Expo Router (TypeScript) + cliente Supabase, estructura `app/`/`components/`/`lib/`/`supabase/`/`tests/`, ESLint+Prettier+TS estricto, Jest, CI (lint+typecheck+test). El theme Ayni (tokens de color/tipografía portados de Lovable) y componentes base (`Button`) se añadieron en un commit posterior de sync de design system (`9762e97`), no en el commit original de scaffold.
- **Archivos/pantallas clave:** `lib/supabase.ts`, `app/_layout.tsx`, `app/index.tsx`, `.github/workflows/ci.yml`.
- **Tablas / Edge Functions / migraciones:** ninguna (carpetas vacías `.gitkeep`).
- **Decisiones tomadas en la fase:** ninguna no obvia.
- **Tests:** smoke test verde.
- **Deuda / notas para fases futuras:** el plan pedía portar theme + componentes base (`level-badge`, `drink-icon`, `friend-card`, `app-shell`) *dentro* de 1.0; solo `Button` + tokens llegaron vía el commit de design-sync. `level-badge`, `drink-icon`, `friend-card`, `app-shell` siguen sin portar — anotado en `docs/backlog.md` para retomar cuando la fase que los necesite (1.5 ya usó badge de verificado inline, sin componente dedicado).
