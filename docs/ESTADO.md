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
| 3.0 | Ledger + wallet + escrow (schema) | ⬜ |
| 3.1 | Integración pagos + escrow (Red Pontis) | ⬜ |
| 3.2 | Catálogo + Tienda (UI) | ⬜ |
| 3.3 | Bar / stock (UI) | ⬜ |
| 3.4 | Conciliación + revisión SP3 | ⬜ |
| 4.0 | Schema invitaciones + chat | ⬜ |
| 4.1 | Descubrimiento simple (swipe) | ⬜ |
| 4.2 | Crear invitación/solicitud + bloqueo fondos | ⬜ |
| 4.3 | Aceptar/rechazar → abre chat | ⬜ |
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
