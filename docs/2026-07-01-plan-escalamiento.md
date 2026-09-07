# Plan de implementación — Escalamiento (post-MVP)

> **Para workers agénticos:** cada fase trae **prompt, modelo, esfuerzo y skills**. Ejecutar fase por fase con checkpoint entre fases. Construye sobre las "costuras" ya presentes desde el MVP (feature flags, ledger, columnas de nivel, tabla `suscripcion`, enums completos). Nada aquí debe cambiar el significado de un campo del MVP: solo columnas nullable, estados aditivos y nuevas Edge Functions.

**Objetivo:** capa de crecimiento y retención — descubrimiento con gating (2), niveles y liquidación (6), seguridad y moderación completa (7), suscripciones premium (8), **referidos (9)**.

**Marca:** Martini. **Referencia de diseño:** prototipo Lovable `csf156/good-company-peru` (web solo-UI) = spec visual a portar a RN/Expo. Cada fase de UI porta la pantalla equivalente; no se reutiliza su código.

**Escala de niveles (act. 2026-07-21):** bronce/plata/oro/diamante/**élite** — umbrales 0/300/1,000/3,000/8,000. (Reemplaza la escala vieja bronce→diamante 0/500/2k/5k/10k.)

**Arquitectura:** misma stack (Expo + Supabase). Toda lógica de dinero/nivel sigue en Edge Functions con `service_role`, sobre el ledger append-only. Jobs programados con `pg_cron` / Edge Functions agendadas.

**Referencia de diseño:** `2026-07-01-modelo-negocio-design.md` secciones B, C, D.2, H.

---

## Leyenda

| Campo | Valores |
|-------|---------|
| Modelo | Opus 4.8 `claude-opus-4-8` (dinero/seguridad/nivel) · Sonnet 5 `claude-sonnet-5` (UI/CRUD) · Haiku 4.5 `claude-haiku-4-5` (mecánico) |
| Esfuerzo | low · medium · high · xhigh · max |
| Skills | test-driven-development, systematic-debugging, frontend-design, security-review, requesting-code-review, verification-before-completion |

**Orden recomendado entre sub-proyectos:** **8 → 6 → 2 → 9 → 7** (primero activar premium para monetizar y desbloquear el gating; luego niveles/liquidación que dependen del ledger; luego descubrimiento con gating por premium+nivel; luego referidos sobre citas verificadas; por último la capa completa de confianza/seguridad). Puedes reordenar 7 antes si la seguridad es prioridad regulatoria.

**Decisión cerrada:** la suscripción S/39 se cobra **vía IAP de Apple/Google** (~15% comisión small-business; neto ~S/33/mes). Las bebidas van fuera de IAP por Red Pontis. Afecta fase 8.0.

---

## Estado post-Lovable (qué está listo vs falta) — sub-proyectos de escalamiento

Lovable entregó **solo-UI web mock**. Para el escalamiento:

- **LISTO (solo diseño, a portar):** pantallas de premium, niveles, invitaciones globales (`global`), referidos y el botón de pánico (dentro de `date.$id`).
- **FALTA (todo lo funcional, 0%):** motor de niveles + decaimiento 45d, liquidación (lunes/on-demand), gating server-side (`puede()`), billing IAP + validación de recibo, filtros/visibilidad por nivel, SOS/guardián/ratings reales, moderación avanzada, panel de operaciones, motor de comisión de referidos.

### Mapeo Lovable → fase (escalamiento)

| Ruta Lovable | Fase |
|---|---|
| `premium.tsx` | 8.2 (portar) |
| `levels.tsx`, `wallet.tsx` (historial liquidaciones) | 6.4 (portar) |
| `global.tsx`, ajustes de `index.tsx` (swipe premium) | 2.2 (portar) |
| `referrals.tsx` | 9.2 (portar) |
| botón/modal de pánico en `date.$id.tsx` | 7.0 (portar UI; alerta real es nueva) |

### Riesgos

- **UI engaña:** premium/niveles/referidos/pánico "se ven hechos" pero no tienen lógica (pánico = `toast`). Toda la lógica de esta capa es nueva y server-side.
- **No portar `LEVEL_META` ni fees de `mock-data.ts` tal cual** — la escala/fees finales son los del doc de negocio (§B), escala élite.
- **Referidos:** la UI existe (`referrals.tsx`) pero el motor de comisión anti-abuso (SP9) es íntegro.

---

# Sub-proyecto 8 — Premium / suscripciones

**Meta:** activar el cobro recurrente S/39 y encender el gating vía los feature flags ya presentes. Bajo riesgo: la lógica de gating se diseñó desde el MVP leyendo flags.

### Fase 8.0 — Billing recurrente (CRÍTICO)

- **Objetivo:** cobrar S/39/mes a ambos roles.
- **Prompt para Claude:**
  > Con TDD, implementa la suscripción recurrente de S/39/mes **vía IAP de Apple (StoreKit) y Google Play Billing**, detrás de una interfaz `SubscriptionProvider` (canal intercambiable si más adelante calificas para links externos). Valida los recibos server-side (App Store Server API / Google Play Developer API). Edge Function `suscripcion-webhook` (App Store Server Notifications V2 / Google RTDN) actualiza la tabla `suscripcion` (estado `activa`/`inactiva`, `vigente_hasta`) idempotentemente. Maneja renovación, fallo de cobro (grace period) y expiración → `inactiva`. Registra el neto (~85% de S/39 tras comisión de store) para conciliación. Tests: recibo inválido rechazado; notificación idempotente; expiración baja a inactiva; fallo de cobro entra en gracia.
- **Modelo:** Opus 4.8
- **Esfuerzo:** high
- **Skills:** test-driven-development, security-review, systematic-debugging

### Fase 8.1 — Motor de gating por flags

- **Objetivo:** una sola fuente de verdad para permisos.
- **Prompt para Claude:**
  > Con TDD, crea un helper server-side `puede(perfil, capacidad)` que resuelve permisos leyendo `suscripcion` + `nivel` + `flags`. Capacidades: `payout_100`, `preferencias_salida`, `perfil_privado`, `liquidacion_on_demand`, `solicitudes_ilimitadas`, `invitaciones_globales`, `filtros_avanzados`, `rewind`, `boost`. Refactoriza los puntos del MVP que ya asumían "free" (buyer fee 15%, seller fee 20%, 1 solicitud activa) para consultar este helper. Tests: usuario premium activo obtiene capacidad; expirado la pierde a mitad de sesión.
- **Modelo:** Opus 4.8
- **Esfuerzo:** high
- **Skills:** test-driven-development, security-review

### Fase 8.2 — Upgrade / downgrade / cancelar (UI)

- **Objetivo:** pantallas de suscripción.
- **Prompt para Claude:**
  > Con TDD ligero, **porta `routes/premium.tsx` de Lovable** a RN/Expo: planes (gratis vs premium por rol, matriz de la sección C), flujo de upgrade vía IAP, ver estado/renovación, cancelar. Refleja en vivo las capacidades desbloqueadas. Estados de carga/error.
- **Modelo:** Sonnet 5
- **Esfuerzo:** medium
- **Skills:** frontend-design, test-driven-development

### Fase 8.3 — Revisión

- **Prompt para Claude:**
  > Revisa sub-proyecto 8: idempotencia de billing, que TODO gating pase por `puede()` (sin checks sueltos), y que perder premium revoque capacidades de inmediato server-side. Corre la suite y confirma verde.
- **Modelo:** Opus 4.8
- **Esfuerzo:** high
- **Skills:** requesting-code-review, security-review, verification-before-completion

---

# Sub-proyecto 6 — Niveles + liquidación

**Meta:** calcular nivel sobre el ledger, aplicar decaimiento 45 días, y ejecutar la liquidación (lunes gratis / on-demand premium). Depende del ledger (MVP) y de `puede()` (8).

### Fase 6.0 — Motor de cálculo de nivel (CRÍTICO)

- **Objetivo:** nivel derivado de recaudación/gasto verificado.
- **Prompt para Claude:**
  > Con TDD, Edge Function/consulta que calcula `recaudacion_acumulada` (amigo) y `gasto_acumulado` (rentador) SOLO de eventos de ledger verificados por QR (citas `finalizada`), excluyendo canceladas/no-show. Mapea a nivel con los umbrales de la sección B (**bronce 0–299, plata 300–999, oro 1,000–2,999, diamante 3,000–7,999, élite 8,000+**). Actualiza `profiles.nivel` + `nivel_actualizado_at`. Idempotente/recomputable. Tests: no-show no suma; umbral exacto asigna nivel correcto.
- **Modelo:** Opus 4.8
- **Esfuerzo:** high
- **Skills:** test-driven-development, security-review

### Fase 6.1 — Decaimiento 45 días

- **Objetivo:** mantener nivel exige actividad reciente.
- **Prompt para Claude:**
  > Con TDD, job `pg_cron` diario que recalcula el nivel usando la actividad (recaudación/gasto verificado) de los **últimos 45 días**; si cae bajo el umbral de su nivel actual, baja un escalón. Tests: usuario sin actividad 45d baja de nivel; actividad reciente lo mantiene.
- **Modelo:** Opus 4.8
- **Esfuerzo:** high
- **Skills:** test-driven-development, systematic-debugging

### Fase 6.2 — Beneficios de nivel (fees reducidos)

- **Objetivo:** aplicar el fee según nivel.
- **Prompt para Claude:**
  > Con TDD, conecta el nivel al motor de fees del MVP: buyer fee y seller fee para usuarios gratis se reducen por nivel según la sección B — **amigo (seller): bronce 20%, plata 15%, oro 10%, diamante 5%, élite 2%; rentador (buyer): bronce 15%, plata 12%, oro 9%, diamante 5%, élite 2%.** El cálculo sigue 100% server-side. Tests: fee aplicado coincide con el nivel vigente; premium sigue en 0/100.
- **Modelo:** Opus 4.8
- **Esfuerzo:** high
- **Skills:** test-driven-development, security-review

### Fase 6.3 — Liquidación (lunes + on-demand) (CRÍTICO)

- **Objetivo:** pagar el balance al amigo.
- **Prompt para Claude:**
  > Con TDD, Edge Function `liquidar`: job `pg_cron` de los **lunes** que paga el balance de todos los amigos con saldo (gratis y premium) sin fee, transfiriendo desde el partner a su cuenta y escribiendo al ledger. Además, ruta on-demand solo para amigos premium (valida con `puede(perfil,'liquidacion_on_demand')`) cualquier día cobrando el fee fijo de liquidación. Idempotente (no doble pago). Tests: gratis no puede on-demand; on-demand cobra el fee; lunes liquida sin fee; doble corrida no duplica payout.
- **Modelo:** Opus 4.8
- **Esfuerzo:** xhigh
- **Skills:** test-driven-development, security-review

### Fase 6.4 — Paneles de nivel + revisión

- **Objetivo:** UI de progreso + cierre.
- **Prompt para Claude:**
  > Con TDD ligero, **porta `routes/levels.tsx` de Lovable** (ya trae `LEVEL_META`, barra de progreso y beneficios — ajusta a la escala élite y fees finales) y el historial de liquidaciones en `routes/wallet.tsx`, a los paneles de amigo y rentador (progreso hacia el siguiente umbral, beneficios, aviso de decaimiento). Luego revisa el sub-proyecto: idempotencia de liquidación, exactitud del nivel vs ledger, y que el decaimiento no borre historial. Corre la suite y confirma verde.
- **Modelo:** Opus 4.8
- **Esfuerzo:** high
- **Skills:** frontend-design, requesting-code-review, verification-before-completion

---

# Sub-proyecto 2 — Descubrimiento y match (completo, con gating)

**Meta:** llevar el swipe básico del MVP a descubrimiento con preferencias (premium) y visibilidad por nivel. Depende de 8 (premium) y 6 (nivel).

### Fase 2.0 — Preferencias + filtros (schema/lógica)

- **Objetivo:** habilitar filtrado.
- **Prompt para Claude:**
  > Con TDD, activa el uso de `preferencias_salida` (ya creada en el MVP): filtra el pool por sexo, tipo de salida, rango de edad, horario y distritos. El filtrado avanzado se gatea con `puede(perfil,'filtros_avanzados')`/`'preferencias_salida'` (premium); gratis recibe pool sin filtro. Tests: gratis ignora filtros; premium filtra correctamente.
- **Modelo:** Opus 4.8
- **Esfuerzo:** medium
- **Skills:** test-driven-development, security-review

### Fase 2.1 — Motor de visibilidad por nivel

- **Objetivo:** doble volante de niveles.
- **Prompt para Claude:**
  > Con TDD, motor de ranking del pool: amigos de mayor nivel obtienen más visibilidad ante rentadores premium/alto gasto; rentadores diamante ven amigos diamante; aplica boost (premium) y perfil privado (solo preseleccionados pueden invitar/solicitar). Evita el problema de arranque en frío (si el pool filtrado queda vacío, degrada el filtro con aviso). Tests: perfil privado bloquea a no-preseleccionados; boost sube posición; pool vacío degrada.
- **Modelo:** Opus 4.8
- **Esfuerzo:** high
- **Skills:** test-driven-development, security-review

### Fase 2.2 — Swipe premium (UI) + invitaciones globales

- **Objetivo:** UX completa de descubrimiento.
- **Prompt para Claude:**
  > Con TDD ligero, mejora el swipe (**porta ajustes de `routes/index.tsx`**): filtros premium en UI, rewind (premium), límite de perfiles/día para gratis (ej. 20) vs ilimitado premium; y **porta `routes/global.tsx` de Lovable** para la publicación/listado de **invitaciones globales** (rentador premium) y **solicitudes globales** con vista de interesados ordenada por nivel y selección de uno. Todo gateado con `puede()`. Tests de límites y gating.
- **Modelo:** Sonnet 5
- **Esfuerzo:** medium
- **Skills:** frontend-design, test-driven-development

### Fase 2.3 — Revisión

- **Prompt para Claude:**
  > Revisa sub-proyecto 2: que el gating de filtros/visibilidad pase por `puede()`, que el perfil privado sea infranqueable server-side, y el manejo de arranque en frío. Corre la suite y confirma verde.
- **Modelo:** Opus 4.8
- **Esfuerzo:** medium
- **Skills:** requesting-code-review, security-review, verification-before-completion

---

# Sub-proyecto 9 — Referidos (reactivado 2026-07-21)

**Meta:** referidos con comisión anti-abuso. UI ya existe en Lovable (`routes/referrals.tsx`). Depende del ledger (MVP) y de citas verificadas (5).

### Fase 9.0 — Esquema + motor de comisión (CRÍTICO)

- **Objetivo:** registrar referidos y acreditar comisión solo tras actividad verificada.
- **Prompt para Claude:**
  > Con TDD, crea el modelo de referidos. Tabla `referidos` (referidor_id, referido_id unique, codigo, estado, citas_verificadas int, comision_pagada numeric). Edge Function que, al verificarse una cita/compra del referido (por QR), acredita al referidor: amigo→amigo 10% de la recaudación del referido en sus primeras 5 citas verificadas; rentador→rentador 10% del gasto como **crédito en tienda** en sus primeras 5 compras. Anti-abuso: referido con KYC verificado + ≥1 cita QR antes de pagar; tope por referido; límite de referidos/mes. Escribe al ledger. Idempotente. Tests: comisión solo tras cita verificada; se corta en la 6ª; auto-referido bloqueado.
- **Modelo:** Opus 4.8 · **Esfuerzo:** high · **Skills:** test-driven-development, security-review

### Fase 9.1 — Código/link único + atribución

- **Prompt para Claude:**
  > Con TDD, código/link único por usuario, captura del código en el onboarding (sub-proyecto 1) y atribución del referido al referidor. Tests: código válido atribuye; código inválido/propio rechazado.
- **Modelo:** Opus 4.8 · **Esfuerzo:** medium · **Skills:** test-driven-development, security-review

### Fase 9.2 — UI (portar Lovable)

- **Prompt para Claude:**
  > **Porta `routes/referrals.tsx` de Lovable** a RN/Expo y cablea: mostrar código/link, invitados, progreso de las 5 citas/compras, comisión/crédito acumulado. Compartir por sistema nativo.
- **Modelo:** Sonnet 5 · **Esfuerzo:** medium · **Skills:** frontend-design, test-driven-development

### Fase 9.3 — Revisión

- **Prompt para Claude:**
  > Revisa sub-proyecto 9: anti-abuso (auto-referido, granjas, tope), idempotencia de comisión, y que el crédito de tienda sea gastable pero no retirable. Corre la suite y confirma verde.
- **Modelo:** Opus 4.8 · **Esfuerzo:** medium · **Skills:** requesting-code-review, security-review, verification-before-completion

---

# Sub-proyecto 7 — Seguridad y moderación (completo)

**Meta:** capa completa de confianza — SOS, contacto guardián, ratings, reportes, moderación automática, panel de operaciones, enforcement de ToS. KYC y anti-fuga básica ya vienen del MVP.

### Fase 7.0 — SOS / pánico (CRÍTICO)

- **Objetivo:** botón de emergencia en cita en curso.
- **Prompt para Claude:**
  > Con TDD, **porta la UI del botón de pánico + modal de `routes/date.$id.tsx` de Lovable** (hoy solo hace `toast`) y cablea la lógica real: durante cita `en_curso`, al activarse comparte ubicación en vivo, alerta a la plataforma (cola de operaciones) y notifica al contacto guardián. Registra el evento. Tests: SOS solo en `en_curso`; dispara alerta + notificación.
- **Modelo:** Opus 4.8
- **Esfuerzo:** high
- **Skills:** test-driven-development, security-review

### Fase 7.1 — Contacto guardián

- **Objetivo:** red de seguridad previa a la cita.
- **Prompt para Claude:**
  > Con TDD, permite registrar un contacto de confianza; antes de una cita confirmada, comparte con él (link/SMS) alias del otro, zona, hora inicio/fin; pide check-in de llegada y de fin. Tests: se comparte al confirmar; recordatorio de check-in al fin del cronómetro.
- **Modelo:** Sonnet 5
- **Esfuerzo:** medium
- **Skills:** test-driven-development, frontend-design

### Fase 7.2 — Ratings + reportes + bloqueo

- **Objetivo:** reputación bidireccional.
- **Prompt para Claude:**
  > Con TDD, tras una cita `finalizada` ambos se califican (rating + comentario). Reportar/bloquear usuario. Flags repetidos o rating bajo encolan revisión. Tests: solo partes de una cita finalizada califican; bloqueo impide futuras invitaciones entre ellos.
- **Modelo:** Sonnet 5
- **Esfuerzo:** medium
- **Skills:** test-driven-development

### Fase 7.3 — Moderación automática de chat (avanzada)

- **Objetivo:** subir la moderación básica del MVP.
- **Prompt para Claude:**
  > Con TDD, endurece la moderación: detección robusta de teléfono/CBVU/redes ofuscadas y de contenido que viole el ToS (servicios sexuales), con escalamiento (warning → flag → suspensión temporal → ban). Cola de casos dudosos para revisión humana. Tests: variantes ofuscadas detectadas; escalamiento por reincidencia.
- **Modelo:** Opus 4.8
- **Esfuerzo:** high
- **Skills:** test-driven-development, security-review

### Fase 7.4 — Panel de operaciones / soporte

- **Objetivo:** herramienta interna de moderación.
- **Prompt para Claude:**
  > Con TDD ligero, panel interno (web o ruta protegida) para el equipo: cola de reportes/SOS/flags, ver contexto de cita (sin exponer DNI salvo permiso), acciones (advertir, suspender, banear, resolver disputa que libere o reembolse escrow). Acceso restringido por rol de staff. Tests: solo staff accede; acción de disputa mueve el escrow correctamente.
- **Modelo:** Opus 4.8
- **Esfuerzo:** high
- **Skills:** frontend-design, test-driven-development, security-review

### Fase 7.5 — ToS enforcement + revisión final

- **Prompt para Claude:**
  > Integra el enforcement de ToS (ban = corta acceso y congela/resuelve fondos pendientes según reglas), y haz la revisión de seguridad global del sistema completo (MVP + escalamiento): RLS, escrow, QR/geofence, moderación, privacidad de DNI. Corre toda la suite y entrega evidencia verde.
- **Modelo:** Opus 4.8
- **Esfuerzo:** max
- **Skills:** requesting-code-review, security-review, verification-before-completion

---

## Orden de ejecución (escalamiento)

```
8.0 → 8.1 → 8.2 → 8.3
                   └→ 6.0 → 6.1 → 6.2 → 6.3 → 6.4
                                              └→ 2.0 → 2.1 → 2.2 → 2.3
                                                                  └→ 9.0 → 9.1 → 9.2 → 9.3
                                                                                      └→ 7.0 → 7.1 → 7.2 → 7.3 → 7.4 → 7.5
```

## Auto-revisión del plan (cobertura vs diseño)

- Sección B (niveles, umbrales, decaimiento 45d, beneficios por fee) → 6.0, 6.1, 6.2. ✅
- Sección C (matriz gratis/premium, gating) → 8.1, 8.2, 2.0, 2.2. ✅
- Liquidación lunes/on-demand (A + F) → 6.3. ✅
- Sección D.2 restante (SOS, guardián, ratings, moderación avanzada, ToS) → 7.0–7.5. ✅
- Invitaciones globales/abiertas + interesados por nivel (F) → 2.2. ✅
- Costura sin romper MVP: todo nivel/fee/gating lee flags/ledger existentes; solo columnas/estados aditivos. ✅
- Referidos: **ACTIVOS** → sub-proyecto 9 (9.0–9.3). UI portada de `routes/referrals.tsx`.
- Escala de niveles élite (0/300/1k/3k/8k) y fees por nivel actualizados → 6.0, 6.2. ✅
- UI portada de Lovable → 6.4 (levels/wallet), 8.2 (premium), 2.2 (global/swipe), 7.0 (pánico), 9.2 (referrals). ✅
- Marca Martini + stack RN/Expo reflejados en el encabezado. ✅
