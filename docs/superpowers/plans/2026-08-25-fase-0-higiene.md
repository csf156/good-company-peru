# Fase 0 — Higiene del repo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar el repo en estado limpio y verificable antes de retomar el desarrollo: el código de D.2 en master, sin worktrees ni ramas muertas, los 230 tests pgTAP confirmados verdes contra la nube, y la suite de Jest verde sin flakes.

**Architecture:** No hay arquitectura — esta fase no escribe código de producto. Son cuatro operaciones independientes sobre el repo y las suites de test. La única que puede requerir un cambio de código real es la Tarea 4 (el flake), y ahí el cambio se decide **después** del diagnóstico, no antes.

**Tech Stack:** git (worktrees, merge) · Jest 29 + jest-expo · pgTAP vía runner casero (`tests/db/run-pgtap.mjs`, Node + `pg`, sin Docker ni psql)

**Spec:** [`docs/superpowers/specs/2026-08-25-retomar-mvp-design.md`](../specs/2026-08-25-retomar-mvp-design.md) §2

---

## Global Constraints

- **Esta fase no es una fase de producto.** No lleva entrada en `docs/ESTADO.md`, no marca nada ✅ en la tabla de fases, y no toca `FASE ACTUAL` en `CLAUDE.md`. Su cierre habilita a arrancar D.2.
- **No se escribe código de producto.** Si el diagnóstico de la Tarea 4 revela un bug real en `app/chats/[id].tsx`, se corrige (es un bug, no una feature); cualquier otra cosa que aparezca se anota en `docs/backlog.md` y no se toca.
- **Ninguna operación destructiva de git sin verificar antes.** Borrar un worktree o una rama es la parte irreversible de esta fase: cada borrado va precedido de su comprobación explícita, y **la Tarea 2 requiere confirmación del usuario antes de ejecutar los borrados**.
- **No hacer push.** El usuario no lo ha pedido. La única excepción es el borrado de la rama remota `claude-design-sync` en la Tarea 2, que **solo se ejecuta con su OK explícito**.
- **Idioma:** commits en inglés técnico o español, siguiendo el estilo ya presente en el repo (Conventional Commits).
- **Comandos:** el repo corre en Windows con Git Bash disponible. Los comandos de este plan son POSIX sh.

---

## File Structure

Esta fase casi no toca archivos. Lo que cambia:

| Archivo | Responsabilidad | Tarea |
|---|---|---|
| `package.json`, `package-lock.json` | Entran `expo-auth-session` y `expo-web-browser` por el merge de D.2 | 1 |
| `lib/auth.ts` | Entran `signInWithGoogle` / `completeGoogleSignIn` por el merge | 1 |
| `app/(auth)/sign-in.tsx` | Entra el botón de Google y sale la pestaña "Celular", por el merge | 1 |
| `tests/app/sign-in.test.tsx`, `tests/lib/auth.test.ts` | Entran los tests de D.2 por el merge | 1 |
| `tests/app/chat-detail.test.tsx` y/o `app/chats/[id].tsx` | Solo si el diagnóstico del flake lo exige | 4 |
| `docs/backlog.md` | Anotación de lo que se descubra y no corresponda a esta fase | 2, 4 |

---

## Task 1: Mergear D.2 a master

Las Tareas 1–3 del plan de D.2 (`docs/superpowers/plans/2026-07-25-design-system-d2.md`) están implementadas en la rama `worktree-d2-google-login`, que nunca se mergeó. Esta tarea la trae a master y verifica que la suite siga verde con ese código dentro.

**Files:**
- Modify (vía merge): `package.json`, `package-lock.json`, `lib/auth.ts`, `app/(auth)/sign-in.tsx`, `tests/app/sign-in.test.tsx`, `tests/lib/auth.test.ts`

**Interfaces:**
- Produces: `signInWithGoogle()` y `completeGoogleSignIn()` exportadas desde `lib/auth.ts`, disponibles para la fase D.2. La pantalla `app/(auth)/sign-in.tsx` queda sin la pestaña "Celular".

- [ ] **Step 1: Confirmar qué trae la rama y que no hay nada sin commitear**

```bash
git status --short
git log --oneline master..worktree-d2-google-login
git diff --stat master...worktree-d2-google-login
```

Esperado: `git status` limpio (o solo con este plan sin agregar). Tres commits en el log: `chore: instalar expo-auth-session y expo-web-browser`, `feat: signInWithGoogle y completeGoogleSignIn en lib/auth`, `feat: boton de Google en sign-in, retiro de la pestana Celular`. El diff toca solo los archivos de la tabla de arriba.

Si el `diff --stat` toca archivos fuera de esa lista, **detenerse y reportar al usuario** antes de mergear.

- [ ] **Step 2: Verificar que `worktree-design-system-d2` es un prefijo, no trabajo extra**

```bash
git log --oneline worktree-design-system-d2 ^worktree-d2-google-login
```

Esperado: **salida vacía** — significa que todo lo que tiene esa rama ya está contenido en `worktree-d2-google-login` y se puede descartar sin perder nada.

Si sale algún commit, **detenerse y reportar**: hay trabajo divergente que hay que revisar antes de borrar nada.

- [ ] **Step 3: Mergear**

```bash
git merge --no-ff worktree-d2-google-login -m "merge: fase D.2 tareas 1-3 (login con Google)"
```

Esperado: merge limpio. `master` y la rama divergen solo en que master tiene commits de docs posteriores; no tocan los mismos archivos.

Si hay conflicto, resolverlo a favor de la rama en los archivos de D.2 (`lib/auth.ts`, `sign-in.tsx`, sus tests) y a favor de master en `package-lock.json` regenerándolo con `npm install`.

- [ ] **Step 4: Instalar las dependencias nuevas**

```bash
npm install
```

Esperado: `expo-auth-session` y `expo-web-browser` quedan en `node_modules`. Sin cambios en `package-lock.json` (ya venía en el merge); si `npm install` lo modifica, incluirlo en el commit del Step 6.

- [ ] **Step 5: Verificar la suite con el código de D.2 dentro**

```bash
npm run lint && npm run typecheck && npm test
```

Esperado: lint y typecheck limpios. Jest: **todas verdes salvo, posiblemente, el flake conocido de `tests/app/chat-detail.test.tsx`** (timeout de 15 s), que es exactamente lo que ataca la Tarea 4. Cualquier OTRO fallo es un problema del merge y debe reportarse antes de seguir.

Anotar el número exacto de suites y tests para comparar después: el baseline previo al merge era 37 suites / 291 tests.

- [ ] **Step 6: Commit (solo si `npm install` modificó algo)**

```bash
git status --short
# si package-lock.json cambió:
git add package-lock.json && git commit -m "chore: regenerar lockfile tras el merge de D.2"
```

Si `git status` está limpio, no hay nada que commitear — el merge ya es un commit.

---

## Task 2: Podar worktrees y ramas muertas

**Esta tarea contiene las operaciones irreversibles de la fase.** Los pasos 1–3 solo verifican; los pasos 4–6 borran y **requieren el OK del usuario**.

**Files:**
- Modify: `docs/backlog.md` (entrada del worktree de 1.6, si resulta que tiene trabajo sin mergear)

**Interfaces:**
- Produces: `git worktree list` muestra únicamente el checkout principal.

- [ ] **Step 1: Inventario**

```bash
git worktree list
git branch -a -v
```

Esperado: tres worktrees (`d2-google-login`, `design-system-d2`, `fase-1-6-endurecimiento`) más el principal; las ramas `claude-design-sync`, `origin/claude-design-sync`, `origin/main`.

- [ ] **Step 2: Verificar el worktree de la fase 1.6**

El backlog dice que quedó `locked` y adelantado a master desde julio (`dfca2da`), con la nota "revisar si tiene trabajo sin mergear antes de borrarlo". Esto lo comprueba:

```bash
git log --oneline master..worktree-fase-1-6-endurecimiento
git diff --stat master...worktree-fase-1-6-endurecimiento
```

**Interpretación:**
- Si el `diff --stat` sale **vacío**: los commits son duplicados (mismo contenido, distinto hash — se cherry-pickearon a master en su momento). El worktree se puede borrar sin perder nada.
- Si el `diff --stat` muestra **cambios reales**: hay trabajo de 1.6 que master no tiene. **No borrar.** Anotar en `docs/backlog.md` qué contiene exactamente y dejarlo para una decisión del usuario.

Registrar cuál de los dos casos aplica antes de seguir.

- [ ] **Step 3: Verificar la rama `claude-design-sync`**

```bash
git log --oneline master..claude-design-sync
git diff --stat master...claude-design-sync
```

Esperado según el spec: divergida desde la fase 1.2, sin nada que master necesite (master la superó por completo entre 1.3 y 4.6).

Si el diff muestra algo que master NO tiene y que parezca útil, **detenerse y reportar** en vez de borrar.

- [ ] **Step 4: Presentar los hallazgos al usuario y pedir confirmación**

Antes de borrar nada, resumir en un mensaje: qué dio el Step 2 (worktree de 1.6: ¿duplicado o trabajo real?), qué dio el Step 3 (`claude-design-sync`: ¿algo rescatable?), y qué se va a borrar exactamente. **Esperar el OK explícito.**

Los borrados son irreversibles con `--force`. No ejecutarlos sin respuesta del usuario.

- [ ] **Step 5: Podar los worktrees de D.2 (ya mergeados en la Tarea 1)**

```bash
git worktree remove .claude/worktrees/d2-google-login
git worktree remove .claude/worktrees/design-system-d2
git branch -d worktree-d2-google-login
git branch -D worktree-design-system-d2
```

`-d` (minúscula) en el primero: git rehúsa borrarlo si NO estuviera mergeado, que es la red de seguridad que queremos. `-D` en el segundo porque es un prefijo descartado deliberadamente (verificado en la Tarea 1, Step 2), no un merge.

Si `git worktree remove` se queja de cambios sin commitear en el worktree, inspeccionarlos antes de forzar — puede haber trabajo real ahí.

- [ ] **Step 6: Podar el worktree de 1.6 y la rama de design-sync (solo lo que el usuario aprobó)**

Si el Step 2 dio "duplicado" y el usuario aprobó:

```bash
git worktree unlock .claude/worktrees/fase-1-6-endurecimiento
git worktree remove .claude/worktrees/fase-1-6-endurecimiento
git branch -D worktree-fase-1-6-endurecimiento
```

Si el usuario aprobó borrar `claude-design-sync`:

```bash
git branch -D claude-design-sync
# la remota SOLO con OK explícito (es un push):
git push origin --delete claude-design-sync
```

- [ ] **Step 7: Verificar el estado final**

```bash
git worktree list
git branch -a -v
git status --short
```

Esperado: un solo worktree (el principal), sin las ramas borradas, working tree limpio.

- [ ] **Step 8: Commit (solo si se tocó el backlog)**

```bash
git add docs/backlog.md && git commit -m "docs(backlog): registrar el contenido del worktree de la fase 1.6"
```

Si el Step 2 dio "duplicado" y no se anotó nada, no hay commit — podar worktrees no genera cambios de archivos versionados.

---

## Task 3: Verificar pgTAP contra la nube

Los 230 tests pgTAP son la evidencia del estado ✅ de SP3 y SP4 (el esquema, las RLS, las funciones `SECURITY DEFINER` de plata). No se han corrido en esta sesión. Antes de construir encima hay que confirmar que la base en la nube sigue coincidiendo con las migraciones del repo.

**Files:**
- Ninguno. Es una verificación. Si falla, el arreglo se decide con el resultado en la mano.

**Interfaces:**
- Produces: confirmación de que el esquema de la nube coincide con `supabase/migrations/`, requisito de las fases 4.7b, 4.8 y todo SP5.

- [ ] **Step 1: Confirmar que hay `DATABASE_URL`**

```bash
grep -c '^DATABASE_URL=' .env
```

Esperado: `1`. El runner (`tests/db/run-pgtap.mjs`) sale con código 2 y el mensaje `ERROR: falta la variable de entorno DATABASE_URL.` si no la encuentra.

- [ ] **Step 2: Correr la suite**

```bash
npm run test:db
```

Esperado: los 23 archivos de `supabase/tests/` (`00_schema.sql` … `22_confirmar_cita.sql`) corren, cada uno en su propia transacción con ROLLBACK, y el total de aserciones da **230 ok, 0 not ok**.

- [ ] **Step 3: Interpretar el resultado**

- **230 verdes:** la nube coincide con el repo. Tarea terminada, sin commit (no cambió ningún archivo).
- **Fallos de "función/tabla no existe":** hay migraciones del repo sin aplicar en la nube. Aplicarlas con el runner de migraciones (`node tests/db/apply-migrations.mjs`) y volver a correr. **Ojo con el footgun conocido:** ese runner deriva la versión del prefijo numérico del nombre del archivo y **se salta en silencio** una migración cuyo prefijo ya esté aplicado. Si dos migraciones comparten prefijo, la segunda nunca corre y no avisa (ya pasó una vez, en 4.2/hardening). Comprobar unicidad antes de confiar en el resultado:

```bash
ls supabase/migrations/ | cut -d_ -f1 | sort | uniq -d
```

Esperado: salida vacía. Si sale algún prefijo repetido, ese es el problema.

- **Fallos de aserción real** (una policy o función que ya no se comporta como el test espera): **detenerse y reportar al usuario**. Significa que alguien tocó la base fuera de las migraciones, y eso es un hallazgo, no un trámite.

---

## Task 4: Diagnosticar y arreglar el flake de `chat-detail`

`tests/app/chat-detail.test.tsx` falla por `Exceeded timeout of 15000 ms` en su primer test bajo la suite completa, pero pasa en 4,3 s corrido aislado (8 tests verdes). **No dar por hecho que es lentitud.** Un timeout que solo aparece bajo carga puede ser un `await` faltante, una suscripción que no se limpia, o un handle abierto de otra suite.

**Files:**
- Modify (solo si el diagnóstico lo justifica): `tests/app/chat-detail.test.tsx` y/o `app/chats/[id].tsx`

**Interfaces:**
- Produces: `npm test` verde en dos corridas seguidas, requisito de cierre de la fase.

- [ ] **Step 1: Reproducir y aislar la variable**

Usar `superpowers:systematic-debugging`: primero reproducir de forma fiable, después formular la hipótesis, y recién entonces tocar código.

```bash
npx jest tests/app/chat-detail.test.tsx
npm test
npx jest --maxWorkers=1
```

Registrar cuál falla y cuál no. Si falla con la suite completa pero no con `--maxWorkers=1`, apunta a contención de CPU entre workers (jest-expo es pesado en Windows). Si falla también con un solo worker, es un problema del test o del componente, no de carga.

- [ ] **Step 2: Buscar handles abiertos**

```bash
npx jest --detectOpenHandles --maxWorkers=1 2>&1 | tail -40
```

Esperado si todo está sano: ninguna advertencia de handles abiertos. Si aparece alguno, ese es el hilo del que tirar — el candidato natural es una suscripción de Realtime que no se desuscribe al desmontar (`subscribeMensajes` en `app/chats/[id].tsx:48`; en el test está mockeada devolviendo `() => {}`, así que un handle apuntaría a otra suite, no a esta).

- [ ] **Step 3: Formular la hipótesis por escrito antes de tocar nada**

Escribir en una línea: *"el test tarda >15 s bajo suite completa porque X"*. Las tres hipótesis plausibles, en orden de probabilidad:

1. **Contención de CPU.** 37 suites de jest-expo en paralelo en Windows; el primer test de una suite paga el costo de transformar el módulo. Fix correcto: subir `testTimeout`, no reescribir el test.
2. **`await` faltante en el propio test.** `render` es async en testing-library RN v14 (el repo ya lo sabe: usa `await render(...)`). Si algún `fireEvent` o assertion posterior corre sin `await`/`waitFor`, el test puede quedar esperando un estado que nunca llega. Fix correcto: agregar el `await`.
3. **Cascada de otra suite** que deja trabajo pendiente y arrastra a la que corre después. Fix correcto: arreglar la suite culpable, no ésta.

**Solo la hipótesis 1 justifica subir el timeout.** Las otras dos son bugs y subir el timeout los escondería.

- [ ] **Step 4: Aplicar el fix que corresponda a la hipótesis confirmada**

Si es la **hipótesis 1**, subir el timeout **solo para esta suite**, no globalmente — un `testTimeout` global más alto hace que cualquier test colgado tarde más en reportar:

```typescript
// tests/app/chat-detail.test.tsx — al inicio del archivo, tras los mocks
// La primera transformación de módulos de esta suite excede los 15 s
// globales cuando corre en paralelo con las otras 36 (jest-expo, Windows).
jest.setTimeout(30000);
```

Si es la **hipótesis 2**, agregar el `await`/`waitFor` que falta en el test afectado. Si es la **hipótesis 3**, arreglar la suite que lo causa y dejar `chat-detail` intacta.

- [ ] **Step 5: Verificar que el flake se fue**

```bash
npm test
npm test
```

Esperado: **verde en las dos corridas seguidas**. Una sola corrida verde no prueba nada de un flake — por definición no falla siempre.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "test: estabilizar chat-detail bajo la suite completa"
```

Ajustar el mensaje a lo que realmente se arregló: si fue un `await` faltante, `fix(test): agregar await faltante en chat-detail`; si fue otra suite, nombrarla.

---

## Cierre de la Fase 0

- [ ] **Verificación final**

```bash
git worktree list
git status --short
npm run lint && npm run typecheck && npm test && npm run test:db
```

Esperado, **con la salida mostrada al usuario** (`superpowers:verification-before-completion`):
- Un solo worktree.
- Working tree limpio.
- Lint y typecheck sin errores.
- Jest verde (el conteo de tests sube respecto a 291: el merge de D.2 trae los suyos).
- pgTAP 230 verdes.

- [ ] **Reportar y detenerse**

Esta fase **no** escribe en `docs/ESTADO.md`, **no** marca nada ✅ en la tabla de fases y **no** toca `FASE ACTUAL` — no es una fase de producto (ver Global Constraints).

Reportar al usuario: qué se mergeó, qué se borró, el estado de las dos suites, y lo que haya salido del diagnóstico del flake. Lo siguiente es **D.2**, que arranca con un trámite suyo (crear el cliente OAuth en Google Cloud y pegarlo en Supabase — los pasos exactos están en `docs/superpowers/plans/2026-07-25-design-system-d2.md`, sección "Antes de empezar"). No arrancar D.2 sin que el usuario lo indique.
