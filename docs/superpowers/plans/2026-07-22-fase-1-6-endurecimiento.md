# Fase 1.6 — Endurecimiento + revisión Sub-proyecto 1 (Identidad) — Plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDA: usa `superpowers:subagent-driven-development` (recomendado) o `superpowers:executing-plans` para ejecutar tarea por tarea. Los pasos usan checkbox (`- [ ]`).
>
> **Contexto de fase (obligatorio leer antes de empezar):** `CLAUDE.md` (raíz del repo) define el protocolo de fase-por-fase — esta fase (1.6) es la única fase activa; no toques nada de fase 3+ aunque parezca rápido. `docs/ESTADO.md` tiene la bitácora de fases 1.0–1.5 (todas ✅, reconstruidas retroactivamente el 2026-07-22) — es la fuente de verdad de qué ya existe, no re-explorar desde cero. `docs/2026-07-01-plan-mvp.md` sección "Fase 1.6" tiene el prompt original de esta fase.

**Goal:** cerrar el sub-proyecto 1 (Identidad) con una auditoría de seguridad completa (RLS, storage, webhook KYC, gate de verificación) y la suite 100% verde, dejándolo listo para que el usuario declare "fase concluida".

**Architecture:** no se añade producto nuevo. Es una pasada de revisión: (a) commitear 2 fixes de seguridad ya escritos y verdes pero sin commit, (b) auditar por introspección (no de memoria) cada RLS/policy/función del sub-proyecto 1, (c) corregir cualquier hallazgo nuevo con TDD, (d) correr la suite completa (jest + pgTAP + lint + typecheck) y dejar evidencia.

**Tech Stack:** Supabase (Postgres + RLS + Storage + Edge Functions Deno), Jest + @testing-library/react-native, pgTAP vía `tests/db/run-pgtap.mjs` (runner Node contra `DATABASE_URL`, sin Docker).

## Global Constraints

- El cliente NUNCA calcula ni mueve saldo — no aplica a esta fase (sin dinero en sub-proyecto 1) pero no violarlo si se toca algo colindante.
- RLS estricto: DNI y datos sensibles jamás visibles a otro usuario.
- Introspección real (`information_schema`, `pg_policy`, `pg_proc`) para verificar el esquema — nunca de memoria ni de los `.sql` de migración sin confirmar que se aplicaron.
- TDD: test que falla → implementación mínima → verde → commit. Commits pequeños, Conventional Commits, uno por hallazgo/fix.
- No hacer push ni abrir PR. No arrancar sub-proyecto 3 ni ninguna fase futura.
- Cualquier cosa fuera de alcance de 1.6 detectada en el camino: anotar en `docs/backlog.md`, no implementar.

---

### Task 1: Commitear los 2 fixes de seguridad ya escritos (path traversal + HMAC secreto vacío)

Estos cambios ya están en el working tree, con tests, y la suite completa pasa (146/146 verificado). Son exactamente el tipo de hallazgo que 1.6 debe capturar — solo falta el commit.

**Files:**
- Modify (ya modificados, solo confirmar y commitear): `supabase/functions/_shared/kyc.ts`, `supabase/functions/kyc-start/index.ts`, `tests/functions/kyc.test.ts`

**Interfaces:**
- Consumes: `isSelfOwnedStoragePath(path: string, uid: string): boolean` (ya definida en `supabase/functions/_shared/kyc.ts`), usada por `kyc-start/index.ts` en vez de `path.startsWith(...)`.
- Produces: nada nuevo para tareas siguientes — este task solo cierra un cambio existente.

- [ ] **Step 1: Confirmar que el diff es exactamente el esperado**

Run: `git diff supabase/functions/_shared/kyc.ts supabase/functions/kyc-start/index.ts tests/functions/kyc.test.ts`

Expected: dos cambios funcionales — (1) nueva función `isSelfOwnedStoragePath` reemplazando `startsWith` en la validación de rutas de storage de `kyc-start`, (2) guard `if (!secret) return false;` al inicio de `verifyWebhookSignature` en `_shared/kyc.ts` — más los tests nuevos correspondientes en `tests/functions/kyc.test.ts`.

- [ ] **Step 2: Correr la suite completa para confirmar verde antes de commitear**

Run: `npx jest --silent`
Expected: `Test Suites: 20 passed, 20 total` / `Tests: 146 passed, 146 total`

- [ ] **Step 3: Lint + typecheck**

Run: `npm run lint && npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/_shared/kyc.ts supabase/functions/kyc-start/index.ts tests/functions/kyc.test.ts
git commit -m "fix: harden KYC storage path validation and reject empty-secret HMAC (Fase 1.6)

- isSelfOwnedStoragePath replaces startsWith() in kyc-start: startsWith
  accepted <uid>/../<otro>/dni.jpg (path traversal), and kyc-start signs
  URLs with service_role which bypasses storage RLS, so this would have
  let a user read another user's DNI in Truora mode.
- verifyWebhookSignature now rejects immediately when the secret is
  empty/undefined instead of computing HMAC with an empty key, which is
  forgeable by anyone if TRUORA_WEBHOOK_SECRET is ever left unset in a
  deploy with KYC_PROVIDER=truora."
```

---

### Task 2: Auditar RLS y column privileges de `profiles`, `preferencias_salida`, `suscripcion` por introspección

**Files:**
- Create: `docs/superpowers/plans/2026-07-22-fase-1-6-audit-notes.md` (notas de auditoría, no código — se borra o se deja como referencia histórica al cerrar la fase, decisión del usuario)
- Test: ninguno nuevo si no hay hallazgos; si hay hallazgo, sigue el patrón de Task 4.

**Interfaces:**
- Consumes: `DATABASE_URL` en `.env` (ya configurado, ver `docs/*db-testing-setup*` en memoria — no hace falta Docker).
- Produces: lista de hallazgos (posiblemente vacía) que alimenta Task 4.

- [ ] **Step 1: Conectar e introspectar policies de RLS**

Run (usando `psql` con `$DATABASE_URL`, o el runner existente si expone una consola — si no, usar `psql "$DATABASE_URL" -c "..."`):

```sql
select schemaname, tablename, policyname, cmd, qual, with_check
from pg_policies
where tablename in ('profiles', 'preferencias_salida', 'suscripcion', 'kyc_verificaciones')
order by tablename, policyname;
```

Expected: cada tabla tiene policy `select` restringida a `auth.uid() = id` (o `perfil_id`), y `suscripcion`/`kyc_verificaciones` no tienen policy de `insert`/`update`/`delete` para `authenticated` (confirmando que son `service_role`-only, según lo documentado en `docs/ESTADO.md` fase 1.1/1.4).

- [ ] **Step 2: Introspectar grants a nivel de columna en `profiles`**

```sql
select grantee, column_name, privilege_type
from information_schema.column_privileges
where table_name = 'profiles' and grantee = 'authenticated'
order by column_name;
```

Expected: `authenticated` tiene `insert` solo en `(id, rol)` y `update` solo en los campos editables de onboarding (nombre, alias, edad, genero, profesion, hobbies, intereses, foto_url, y las columnas de `preferencias_salida` vía esa tabla) — ninguna columna de `kyc_estado`, `verificado_at`, `recaudacion_acumulada`, `gasto_acumulado`, `nivel`, `nivel_actualizado_at`, `flags` debe aparecer con `update` para `authenticated`.

- [ ] **Step 3: Confirmar que `perfiles_publicos` no expone columnas sensibles a nivel de columna (no solo de vista)**

```sql
select column_name from information_schema.columns where table_name = 'perfiles_publicos';
```

Expected: exactamente `id, rol, alias, edad, genero, profesion, hobbies, intereses, foto_url, kyc_estado` — ni `nombre`, ni `recaudacion_acumulada`/`gasto_acumulado`/`nivel`/`flags`, ni columnas de teléfono/DNI (no viven en `profiles` de todos modos, confirmar que siguen sin existir ahí).

- [ ] **Step 4: Registrar resultado**

Escribe en `docs/superpowers/plans/2026-07-22-fase-1-6-audit-notes.md` los 3 resultados anteriores (pegar el output real de las queries, no un resumen). Si algo no coincide con lo esperado, es un hallazgo → pasa a Task 4 con su propio fix+test.

---

### Task 3: Auditar policies de Storage (`dni`, `fotos`) y el webhook KYC por introspección

**Files:**
- Modify: `docs/superpowers/plans/2026-07-22-fase-1-6-audit-notes.md` (continúa el mismo archivo de Task 2)

**Interfaces:**
- Consumes: mismo `DATABASE_URL`.
- Produces: hallazgos para Task 4.

- [ ] **Step 1: Introspectar policies de `storage.objects` para los buckets `dni` y `fotos`**

```sql
select policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
order by policyname;
```

Expected: policy de `dni` restringe `select`/`insert` a `(storage.foldername(name))[1] = auth.uid()::text` (owner-only, sin `select` para otros usuarios); policy de `fotos` permite `select` a cualquier `authenticated` pero `insert`/`update`/`delete` solo al owner.

- [ ] **Step 2: Releer `supabase/functions/kyc-start/index.ts` y `kyc-webhook/index.ts` completos, confirmando en el código (no de memoria) 3 propiedades**

Read: `supabase/functions/kyc-start/index.ts`, `supabase/functions/kyc-webhook/index.ts`, `supabase/functions/_shared/kyc.ts`

Verificar y anotar evidencia (cita de línea) de:
1. `kyc-start` usa `isSelfOwnedStoragePath` (post Task 1) antes de firmar cualquier URL con `service_role`.
2. `kyc-webhook` llama `verifyWebhookSignature` con el secreto de env ANTES de aplicar cualquier cambio de estado, y usa `shouldProcessWebhook`/`decideStartAction` para no duplicar sobre reintentos (doble webhook no duplica fila).
3. Ninguna de las dos funciones expone `TRUORA_API_KEY` ni el secreto del webhook en la respuesta HTTP (ni en error messages).

- [ ] **Step 3: Confirmar que el deploy de `kyc-webhook` sigue con `--no-verify-jwt`**

Run: `cat supabase/config.toml | grep -A3 kyc-webhook` (o el mecanismo de config que use este proyecto para deploy de functions — revisar `supabase/config.toml` primero para saber dónde vive ese flag).

Expected: `verify_jwt = false` para `kyc-webhook` específicamente (documentado en fase 1.4 porque el webhook lo autentica Truora vía HMAC, no una sesión Supabase) y `verify_jwt` no está deshabilitado globalmente para el resto de functions.

- [ ] **Step 4: Registrar resultado en el mismo archivo de notas de Task 2**

---

### Task 4: Corregir hallazgos (plantilla — instanciar una copia de este task por cada hallazgo real de Tasks 2–3)

Si Tasks 2–3 no arrojan hallazgos nuevos (fixes de Task 1 eran los únicos pendientes), este task se salta y se anota explícitamente en el reporte final ("0 hallazgos nuevos, solo los 2 de Task 1").

**Files:**
- Depende del hallazgo. Si es RLS/columna: nueva migración `supabase/migrations/<timestamp>_<descripcion>.sql` + `supabase/tests/<NN>_<descripcion>.sql` (pgTAP). Si es código de Edge Function: el archivo afectado + su test en `tests/functions/`.

**Interfaces:**
- Consumes: hallazgo documentado en `docs/superpowers/plans/2026-07-22-fase-1-6-audit-notes.md`.
- Produces: fix verificado + test.

- [ ] **Step 1: Escribir el test que falla, demostrando el hallazgo**

(Código real del test depende del hallazgo — no hay hallazgo conocido de antemano en este plan; si aparece uno, el subagente escribe aquí el test concreto antes de tocar el fix, siguiendo el patrón de `supabase/tests/04_profiles_column_privileges.sql` o `tests/functions/kyc.test.ts` según corresponda.)

- [ ] **Step 2: Confirmar que falla**

Run: `node tests/db/run-pgtap.mjs` (si es de DB) o `npx jest --silent <archivo>` (si es de código)
Expected: FAIL, mensaje coincide con el hallazgo.

- [ ] **Step 3: Fix mínimo**

- [ ] **Step 4: Confirmar verde**

Run: mismo comando de Step 2
Expected: PASS

- [ ] **Step 5: Si el fix toca una migración, aplicarla con el flujo del proyecto**

**IMPORTANTE — regla de `CLAUDE.md`:** el usuario revisa el SQL de toda migración antes de aplicarse. El subagente NO aplica la migración directamente contra la base — la deja escrita y pausa pidiendo revisión antes de correr `apply-migrations.mjs` contra `DATABASE_URL`.

- [ ] **Step 6: Commit**

```bash
git add <archivos del fix>
git commit -m "fix: <descripción del hallazgo> (Fase 1.6)"
```

---

### Task 5: Verificación final de la fase + reporte

**Files:**
- Modify: ninguno de código. Solo lectura/ejecución.

**Interfaces:**
- Consumes: estado de Tasks 1–4.
- Produces: evidencia para que el usuario decida decir "fase concluida" (el subagente NO cierra la fase — eso lo hace el usuario explícitamente, per `CLAUDE.md`).

- [ ] **Step 1: Suite completa de unit tests**

Run: `npx jest --silent`
Expected: todas las suites `PASS`, conteo total ≥146 (146 + los que Task 4 haya añadido).

- [ ] **Step 2: pgTAP**

Run: `node tests/db/run-pgtap.mjs`
Expected: todas las aserciones verdes, conteo ≥44 (44 + las que Task 4 haya añadido).

- [ ] **Step 3: Lint + typecheck**

Run: `npm run lint && npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Reporte final (texto, no archivo nuevo salvo que el usuario lo pida)**

Resumir al usuario: hallazgos totales (Task 1: 2, Task 4: N), estado de la suite (comandos + conteos reales, no estimados), y recordar explícitamente que la fase queda pendiente de que el usuario diga "fase concluida" para que se actualice `docs/ESTADO.md` (tabla + nueva entrada de bitácora 1.6) y `CLAUDE.md` (`FASE ACTUAL` → 3.0).

- [ ] **Step 5: NO hacer commit de `docs/ESTADO.md` ni `CLAUDE.md` en este task**

Eso pertenece al protocolo de cierre de fase, disparado solo cuando el usuario dice "fase concluida" — fuera de alcance de este plan.

---

## Self-Review

- **Cobertura del prompt original de 1.6** (`docs/2026-07-01-plan-mvp.md`): "audita RLS" → Task 2. "políticas de storage" → Task 3 Step 1. "manejo del webhook KYC" → Task 3 Steps 2–3. "gate de verificación server-side" → cubierto por Task 2 Step 2 (nadie salvo `service_role` puede escribir `kyc_estado`) — no hay gate de compra/payout que auditar todavía porque sub-proyecto 3 no existe (correcto, es deuda ya anotada en fase 1.4, no de esta fase). "corre verification-before-completion" → Task 5.
- **Placeholders:** Task 4 es intencionalmente una plantilla condicional (no hay hallazgo conocido de antemano para RLS/storage — a diferencia de Task 1 que sí tiene fix conocido). Esto no es un placeholder de pereza: la auditoría de Tasks 2–3 puede legítimamente no encontrar nada nuevo, y el plan lo dice explícitamente en vez de inventar un hallazgo falso.
- **Consistencia de nombres:** `isSelfOwnedStoragePath`, `verifyWebhookSignature`, `shouldProcessWebhook`, `decideStartAction` usados igual en Tasks 1 y 3 — coinciden con los nombres reales en `supabase/functions/_shared/kyc.ts` (confirmados por lectura directa del archivo, no de memoria).
