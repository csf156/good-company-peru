# Rent-a-Friend Perú — Modelo de negocio y diseño

**Fecha:** 2026-07-01 (act. 2026-07-21)
**Estado:** diseño aprobado. Prototipo UI construido en Lovable (repo `csf156/good-company-peru`) = **referencia de diseño**. Backend + lógica por construir.
**Marca:** **Martini** (reciprocidad andina).
**Proyecto:** independiente de Nestra.
**Stack:** React Native + Expo (nativo) + Supabase. Lovable (web Vite/React) NO se usa como base de código — solo como spec visual a portar a RN/Expo.
**Niveles (act. 2026-07-21):** bronce/plata/oro/diamante/élite — umbrales 0/300/1k/3k/8k.
**Referidos:** ACTIVOS (ver §B).

---

## 0. Resumen ejecutivo

Plataforma móvil (Perú) de **compañía social** ("renta un amigo") para eventos, salidas y compañía. El pago se abstrae en **bebidas virtuales** (tragos) que el rentador compra en una tienda interna e "invita" a un amigo en renta; cada bebida tiene un **valor económico (V)** y un **tipo de invitación** (divertida, romántica, misteriosa, de amigos, de autor). El encuentro se verifica presencialmente con **QR + geofence + cronómetro**; solo entonces se libera el pago al amigo.

**Decisiones core (cerradas):**

| # | Tema | Decisión |
|---|------|----------|
| 1 | Posicionamiento | **Compañía social/entretenimiento**. Sin contenido sexual (ToS + moderación). Base bancarizable. |
| 2 | Custodia de dinero | **Orquestada por la app, fondos en escrow de partner regulado** (no somos EEDE). |
| 3 | Take-rate | Amigo premium 100% / amigo gratis −20%. Rentador premium sin fee / gratis +15%. |
| 4 | Costo de procesamiento | El "100%" es **neto de procesamiento** (~4% pasarela se descuenta primero). |
| 5 | Cliente | **React Native + Expo** (nativo iOS+Android). Backend **Supabase**. |

---

## A. Motor de monetización + unit economics

### Fuentes de ingreso

| # | Fuente | Cuánto | De quién |
|---|--------|--------|----------|
| 1 | Buyer fee (recargo de compra) | **+15%** sobre V (baja por nivel de rentador) | Rentador **gratis** |
| 2 | Seller fee (comisión de servicio) | **−20%** de V (baja por nivel de amigo) | Amigo **gratis** |
| 3 | Suscripción Amigo Premium | **S/39 / mes** | Amigo que sube |
| 4 | Suscripción Rentador Premium | **S/39 / mes** | Rentador que sube |
| 5 | Fee de liquidación | S/0 lunes / **fee fijo** otro día (solo premium) | Amigo que cobra fuera de lunes |

**Procesamiento (~4% pasarela Perú)** se descuenta **primero** en toda transacción. "Amigo recibe 100%" = 100% de V neto de ese procesamiento, etiquetado transparente como "costo de procesamiento".

### Take-rate por cuadrante (V = valor nominal de la bebida)

| | Rentador **premium** | Rentador **gratis** |
|---|---|---|
| Amigo **premium** | amigo recibe V (−proc), rentador paga V (+proc) → take transaccional ≈ 0, margen = suscripciones | amigo recibe V (−proc), rentador paga V + 15% |
| Amigo **gratis** | amigo recibe 0.80·V (−proc), rentador paga V | amigo recibe 0.80·V, rentador paga V + 15% |

### Catálogo de bebidas (precio ↔ tipo de invitación)

La bebida define **V + tipo**. **NO define duración** — el tiempo de la cita es un campo independiente que pone quien crea la invitación/solicitud.

| Bebida (ejemplo) | Tipo de invitación | V (soles) |
|------------------|--------------------|-----------|
| Cerveza | Divertida | 40 |
| Vino | Romántica | 80 |
| Cóctel | Misteriosa | 120 |
| Trago de autor "X" | Significado específico | 180 |
| Botella premium | Amigos / grupo | 300 |

Escala de precios y tragos de autor: definibles/editables por el operador.

### Ejemplo trabajado — cerveza V=40, ambos gratis

- Rentador paga: 40 + 15% = **S/46.00**
- Pasarela (~4%): −~S/1.84
- Seller fee (20% de 40): −S/8.00
- Amigo recibe: **~S/32** (bruto 32, menos su parte de procesamiento)
- Margen plataforma: buyer fee 6 + seller fee 8 − procesamiento ≈ **~S/12** por cita de S/40.

### Calibración premium

- **Amigo premium** recupera S/39 con ~1 cita de V≈200 (ahorra el 20%).
- **Rentador premium** se justifica sobre ~S/260/mes de gasto (ahorra 15%).
- Precio calibrado a usuario de volumen medio-alto (el whale objetivo).
- **Nota IAP:** la suscripción S/39 se cobra por IAP de Apple/Google → comisión ~**15%** (programa small-business, <US$1M/año; 30% encima). Neto por suscripción ≈ **S/33/mes**. Las bebidas NO pierden comisión de store (van por Red Pontis).

### Regla anti-fuga

Todo pago ocurre dentro de la app. Compartir contacto para pagar por fuera = ban. La moderación de chat detecta números de teléfono / CBVU.

---

## B. Niveles + beneficios

### Niveles de Amigo (por recaudación acumulada verificada)

| Nivel | Recaudación (soles) | Beneficios |
|-------|---------------------|-----------|
| 🥉 Bronce | 0–299 | Base. Pool general. |
| 🥈 Plata | 300–999 | Badge, +visibilidad media, seller fee gratis 15%. |
| 🥇 Oro | 1,000–2,999 | Prioridad sobre bronce/plata, boost semanal, fee gratis 10%. |
| 💎 Diamante | 3,000–7,999 | Visible a rentadores premium, soporte prioritario, fee gratis 5%. |
| 🌟 Élite | 8,000+ | Máxima visibilidad a rentadores premium/alto gasto, perfil destacado, fee gratis 2%, liquidación on-demand con fee reducido, eventos exclusivos. |

### Niveles de Rentador (por gasto acumulado)

| Nivel | Gasto (soles) | Beneficios |
|-------|---------------|-----------|
| 🥉 Bronce | 0–299 | Base. |
| 🥈 Plata | 300–999 | Badge, más perfiles/día, buyer fee gratis 12%. |
| 🥇 Oro | 1,000–2,999 | Ve perfiles oro+, prioridad en invitaciones globales, fee 9%. |
| 💎 Diamante | 3,000–7,999 | Ve diamante, invitaciones globales destacadas, fee 5%. |
| 🌟 Élite | 8,000+ | Ve amigos Élite, badge dorado animado, boost de invitaciones, fee 2%, soporte VIP. |

### Reglas de nivel

- Umbrales **tunables** por el operador.
- Nivel calculado sobre recaudación/gasto **verificado por QR** (excluye citas canceladas/no-show). Anti-inflado.
- **Decaimiento:** el nivel se mantiene según actividad (gasto/recaudación) en los **últimos 45 días**; sin actividad suficiente, baja de escalón.
- **Match gated por nivel** = doble volante: amigo sube → lo ven rentadores de más gasto → gana más; rentador sube → accede a amigos top.

### Referidos — **ACTIVO** (reactivado 2026-07-21; UI ya existe en Lovable)

- **Amigo refiere amigo:** referidor gana **10% de la recaudación** del referido en sus **primeras 5 citas verificadas por QR**. Anti-abuso: el referido debe pasar KYC + 1 cita QR antes de que se pague comisión.
- **Rentador refiere rentador:** referidor gana **crédito en tienda = 10% del gasto** del referido en sus primeras 5 compras (crédito, no cash → retención).
- Ambos: código/link único, tope de comisión por referido, límite de referidos/mes anti-granja.

---

## C. Gratis vs Premium (S/39/mes ambos lados)

### Amigo en renta

| Feature | Gratis | Premium |
|---------|--------|---------|
| Payout por bebida | −20% (baja por nivel) | **100%** neto proc |
| Preferencias de salida (sexo, tipo, edad, horario, distritos) | ❌ recibe todo sin filtro | ✅ filtra propuestas |
| Perfil privado (preseleccionar quién puede invitarle) | ❌ | ✅ |
| Liquidación | solo **lunes** gratis | **on-demand** cualquier día (fee reducido) |
| Publicar solicitudes de invitación | máx **1 activa** | ilimitadas + destacada |
| Boost de visibilidad | ❌ | ✅ semanal |
| Ver quién vio su perfil | ❌ | ✅ |
| Fotos de perfil | 3 | hasta 8 |

### Rentador

| Feature | Gratis | Premium |
|---------|--------|---------|
| Buyer fee en compras | 15% (baja por nivel) | **0%** (solo proc) |
| Invitaciones globales/abiertas | ❌ | ✅ |
| Perfil privado (preseleccionar qué amigos pueden solicitarle) | ❌ | ✅ |
| Filtros de búsqueda | básicos | avanzados (distrito, edad, intereses, horario) |
| Perfiles vistos/día en swipe | límite (ej. 20) | ilimitado |
| Deshacer último descarte (rewind) | ❌ | ✅ |
| Boost de invitaciones globales | ❌ | ✅ |
| Ver interesados en invitaciones globales | ✅ | ✅ + orden por nivel |

Palancas: el amigo paga por **ganar más + control**; el rentador paga por **alcance + poder**.

---

## D. Verificación de encuentro + seguridad

### 1. Verificación de que el encuentro ocurrió (libera el pago)

**Flujo de fondos:** el rentador paga al comprar la bebida en la tienda → fondos a **escrow** (partner regulado) asociados a esa bebida en su "bar". Al invitar, bebida + fondos quedan **bloqueados** para la cita. El amigo no cobra hasta verificar.

**QR mutuo con token rotativo:**
- Al confirmar la cita, el backend crea una `session` con **token dinámico** (rota ~30s, server-side, atado a `cita_id`). No es QR estático screenshoteable.
- **Al inicio** de la cita, presencialmente: un lado muestra QR, el otro escanea. Verificación **bidireccional** contra el backend.
- **Geofence (activo desde MVP):** el backend exige que **ambos dispositivos** estén dentro de ~50–100 m al escanear. Bloquea colusión remota.
- El scan de inicio **arranca el cronómetro** y marca la cita `en_curso`. Sin scan de inicio, el amigo no puede cobrar.

**Cronómetro y cierre:**
- Duración = tiempo acordado en la confirmación de cita.
- Notif **15 min antes** del fin + notif **al fin** (push nativo).
- **Extensión:** rentador invita bebida adicional en curso → amigo acepta/rechaza → si acepta, suma su V al escrow y **extiende el cronómetro** por el tiempo acordado de esa bebida.
- **Liberación del pago:** al llegar el cronómetro a fin sin disputa/pánico → fondos pasan de escrow a **balance del amigo** (menos fees/proc).
- **Scan de fin: NO requerido** (evita que el rentador bloquee el pago no escaneando el cierre).
- **No-show:** sin scan de inicio dentro de ventana (~30 min post-hora) → cita expira, fondos **vuelven** al bar del rentador (bebida recuperada), sin cargo al amigo.

### 2. Seguridad del encuentro (integridad física)

- **KYC de AMBOS lados** — DNI escaneado + **selfie con liveness** con match contra el DNI, y validación contra **RENIEC**. Proveedor: **Truora** (LatAm, RENIEC nativo, pay-as-you-go). Alternativas: MetaMap; Didit para menor costo si el cruce RENIEC se difiere. Control de edad **18+** vía DNI.
- **Botón SOS / pánico** en cita `en_curso` → alerta a plataforma + ubicación en vivo + notifica a contacto de confianza.
- **Contacto guardián:** antes de la cita, comparte alias del otro, zona, hora inicio/fin y check-in de llegada.
- **Zona aproximada**, no dirección exacta, hasta confirmar. Nudge a **lugares públicos** en primeras citas.
- **Ratings bidireccionales** + reportes/bloqueo. Flags repetidos → revisión / suspensión.
- **Filtros de seguridad** (premium amigo): solo mismo sexo, solo verificados, solo preseleccionados.
- **Moderación de chat:** detecta pago por fuera (números/CBVU) y contenido que viole ToS.
- **ToS explícito:** prohíbe servicios sexuales; incumplimiento = ban + posible reporte. Requisito para mantener las pasarelas.

---

## E. Arquitectura técnica y costos

### Stack

- **Cliente:** React Native + **Expo** (un código → iOS+Android nativos). Push, cámara/QR, geoloc background nativos.
- **Backend:** **Supabase**
  - **Auth** — teléfono/OTP + email.
  - **Postgres + RLS** — data con seguridad por fila.
  - **Realtime** — chat + estado de cita en vivo.
  - **Storage** — fotos de perfil; **DNI en bucket privado cifrado**, acceso restringido.
  - **Edge Functions** — lógica sensible server-side: fees, escrow, token QR rotativo, geofence, niveles, liquidación.
- **Integraciones:**
  - **Pagos/escrow:** **Red Pontis** (partner de escrow/custodia con subcuentas). Custodia = Red Pontis. Implementar detrás de una interfaz `PaymentProvider` por si cambia.
  - **Suscripción premium (S/39):** vía **IAP de Apple/Google** (bien digital → obligatorio). Las **bebidas** NO van por IAP (servicio del mundo real) → Red Pontis.
  - **KYC:** Truora (webhook → Edge Function marca `verificado`).
  - **Push:** Expo Push / FCM+APNs.

### Postura de costos (serverless, paga-por-uso)

- Supabase escala lineal, sin servidores idle. Edge Functions solo en evento.
- QR rotativo y geofence = cálculo server-side, sin infra extra.
- Costo variable real = **KYC por usuario** + **% pasarela por transacción** (ya en unit economics).

### Reglas de arquitectura (seguridad del dinero)

- **El cliente nunca calcula ni mueve saldo.** Solo Edge Functions con `service_role`.
- **RLS estricto** en todas las tablas: DNI y saldos jamás expuestos a otro usuario.
- **Idempotencia** en pagos/escrow (evita doble cobro / doble payout).
- **Ledger append-only** de movimientos (auditoría, disputas, cálculo de niveles verificados).

---

## F. Plataformas de usuario (paneles)

### Panel del Amigo en renta

- Invitaciones recibidas pendientes de aceptación.
- Historial de invitaciones (estado, fecha, bebida, rentador).
- Progreso de nivel por recaudación (con decaimiento 45d).
- Publicar **solicitudes de invitación** (bebida + tiempo estimado + zona), específicas o globales.
- Ver interesados en sus solicitudes globales y elegir uno.
- Balance y **liquidación** (lunes gratis / on-demand premium).
- Bar recibido / historial de bebidas cobradas.
- Estado de verificación KYC, ratings recibidos, seguridad (SOS, guardián).

### Panel del Rentador

- Invitaciones realizadas pendientes de aceptación.
- Historial de invitaciones.
- Progreso de nivel por gasto (con decaimiento 45d).
- **Tienda** (comprar bebidas) + **Bar** (stock disponible para invitar).
- Publicar **invitaciones globales/abiertas** (premium) (bebida + tiempo estimado + zona aproximada).
- Ver interesados en sus invitaciones globales y elegir uno.
- Ratings recibidos, seguridad (SOS, guardián).

### Descubrimiento

- Vista tipo **Bumble** (perfiles uno por uno), no catálogo, para captar atención.
- Filtrado por preferencias (premium) y gating por nivel.

---

## G. Descomposición en sub-proyectos

Cada sub-proyecto = su propio ciclo **spec → plan → build**. Orden por dependencia:

1. **Identidad y perfiles** — registro, KYC (Truora), perfiles amigo/rentador, base gratis/premium.
2. **Descubrimiento y match** — swipe Bumble, filtros, preferencias, gating por nivel.
3. **Tienda + Bar + wallet/escrow** — catálogo, compra, stock, integración pagos/escrow, ledger.
4. **Invitaciones y solicitudes** — específicas + globales, aceptación, chat realtime, confirmación de cita.
5. **Motor de cita** — QR rotativo, geofence, cronómetro, extensión, liberación de pago, notificaciones.
6. **Niveles + liquidación** — cálculo por recaudación/gasto verificado, decaimiento 45d, payout lunes/on-demand.
7. **Seguridad y moderación** — SOS, guardián, ratings, reportes, moderación de chat, ToS.
8. **Premium/suscripciones** — billing recurrente S/39, gating de features.

**MVP mínimo vendible = sub-proyectos 1, 3, 4, 5** (identidad → comprar bebida → invitar → cita verificada con pago), con match básico (2) **sin** gating.

---

## H. Guía de expansión (post-MVP)

Cómo incorporar el resto sin reescribir el MVP. Principio: **construir el MVP con las costuras ya puestas** (feature flags + tablas listas) para que cada expansión sea aditiva.

### Costuras a dejar listas desde el MVP

- **Feature flags** por usuario/rol (`is_premium`, `nivel`, `flags`) leídos server-side en Edge Functions. Todo gating pasa por aquí.
- **Ledger append-only** desde el día 1 → niveles y liquidación (sub-proyecto 6) se calculan sobre datos ya existentes, sin migración.
- **Campos de nivel** (`recaudacion_acumulada`, `gasto_acumulado`, `nivel`, `nivel_actualizado_at`) en perfiles desde el inicio, aunque el MVP no los use para gating.
- **Tabla de suscripciones** (`suscripcion`: estado, tipo, vigencia) presente aunque el MVP no cobre premium todavía — el gating lee de ahí.
- **Estados de cita** enumerados completos (`pendiente`, `confirmada`, `en_curso`, `finalizada`, `no_show`, `disputa`) aunque el MVP no use todos.

### Fase 2 — Retención y crecimiento (orden sugerido)

1. **Premium/suscripciones (8)** — activar billing S/39 + gating vía los feature flags ya presentes. Bajo riesgo: la lógica de gating ya existe, solo se "encienden" los flags al cobrar.
2. **Niveles + liquidación (6)** — activar cálculo sobre el ledger existente. Añade job programado (Edge Function + cron Supabase) para decaimiento 45d y liquidación de lunes.
3. **Descubrimiento con gating por nivel (2 completo)** — el MVP trae swipe básico; aquí se añade filtrado por preferencias (premium) y visibilidad por nivel.

### Fase 3 — Confianza y escala

4. **Seguridad y moderación completa (7)** — SOS y KYC ya en MVP; aquí se suma guardián, ratings bidireccionales, reportes, moderación automática de chat, panel de operaciones/soporte.
5. **Invitaciones globales/abiertas** — extensión del sub-proyecto 4: mismo modelo de invitación con `alcance = global`, más vista de interesados y selección.

### Fase 4 — Optimización

6. **Referidos** (ACTIVO, ver §B) — comisión por primeras 5 citas/compras verificadas, crédito en tienda, anti-abuso. Plan: sub-proyecto 9.
7. **Tragos de autor** con narrativa/significado, packs, promociones estacionales.
8. **Analítica y antifraude avanzado** — scoring de riesgo, detección de patrones de colusión geofence, panel de métricas de negocio (LTV, take-rate efectivo por cuadrante, churn premium).

### Reglas de expansión

- Cada expansión **no rompe** contratos del MVP: nuevas columnas nullable, nuevos estados aditivos, nuevas Edge Functions; nunca cambiar el significado de un campo existente.
- Toda lógica de plata nueva mantiene **idempotencia** y escribe al **ledger**.
- Cada sub-proyecto nuevo pasa por su propio spec → plan → build antes de tocar producción.

---

## Decisiones cerradas

- **Partner de escrow:** Red Pontis.
- **Suscripción premium:** vía IAP de Apple/Google (~15% comisión; neto ~S/33). Bebidas fuera de IAP.

## Decisiones abiertas / a definir después

- Escala exacta de precios del catálogo y tragos de autor.
- Fee fijo exacto de liquidación on-demand.
- Límites finales de features gratis (fotos, perfiles/día, solicitudes activas).
- Confirmar tarifas vigentes de Truora y de Red Pontis antes de cerrar contrato.
