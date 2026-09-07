# Retomar el MVP — diseño del tramo (2026-08-25)

**Qué es esto:** el diseño del tramo de trabajo que retoma el proyecto tras ~un mes de pausa (última actividad: 2026-07-31, cierre de la fase 4.6). Define la secuencia de fases hasta tener el **MVP recorrible de punta a punta en modo mock**, el alcance de cada una y lo que queda explícitamente fuera.

**Este documento NO es un plan de implementación.** Cada fase recibe su propio plan en `docs/superpowers/plans/`, escrito cuando esa fase arranca — no antes.

---

## 0. Contexto

### 0.1 Dónde quedó el proyecto

| Bloque | Estado real |
|---|---|
| SP1 identidad (1.0–1.6) | ✅ auth, perfil, KYC, RLS, storage |
| SP3 plata (3.0–3.4) | ✅ ledger, escrow, tienda, bar, conciliación |
| SP4 social (4.0–4.6) | ✅ invitaciones, chat realtime, moderación anti-fuga, confirmar cita |
| D.1 design system | ✅ tokens Martini, 13 pantallas migradas, guardia anti-hex en CI |
| D.2 login con Google | 🟨 código escrito, **sin mergear** (rama `worktree-d2-google-login`), sin verificar contra Google real |
| SP5 motor de cita (5.0–5.5) | ⬜ nada |
| Escalamiento (6, 7, 8, 2, 9) | ⬜ nada |

Tests al retomar: 291 jest (290 verdes, 1 flake por timeout), 230 pgTAP sin verificar contra la nube en esta sesión.

### 0.2 Los tres huecos que obligan a desviarse del plan

El plan MVP dice que después de 4.6 viene 5.0. **No se puede.** La auditoría del estado encontró tres huecos que ninguna fase de ningún plan toma:

1. **No existe navegación.** Después del login el usuario cae en `/` (descubrimiento) y no hay un solo botón que lleve a `/bar`, `/store`, `/wallet`, `/chats` ni `/profile`. El único `router.push` de toda la app es de la lista de chats al detalle del chat. Cinco pantallas construidas y probadas son inalcanzables salvo escribiendo la URL a mano. `app-shell` (la tab bar de Lovable) nunca se portó — está en `docs/backlog.md` desde la reconstrucción de la bitácora de 1.0.

2. **Las invitaciones no tienen puerta de entrada.** `crear-invitacion` y `responder-invitacion` (fases 4.2/4.3) están completas, testeadas y revisadas, pero **ningún componente las invoca**: el CTA de descubrimiento (`app/index.tsx`) y el botón "Invitar" de `bar.tsx` son inertes (sin `onPress`), y no existe pantalla de invitaciones entrantes. Como la `cita` nace solo al aceptar una invitación, el chat (4.4) y confirmar cita (4.5) —que sí están cableados— son inalcanzables end-to-end. Detectado en el code-review de 4.6 y anotado en backlog con la nota "decisión de alcance pendiente con el usuario". **Esta es esa decisión.**

3. **`hora` de la cita está corrida 5 horas.** Es texto libre (p. ej. `"2026-07-25 21:30"`) casteado a `timestamptz` bajo sesión Postgres en UTC → se guarda como `21:30Z`, que son las 16:30 de Lima. Hoy no se nota (ambas partes ven el string crudo), pero **el cronómetro de 5.2 y el no-show de 5.4 computan contra ese campo**. Entrar a SP5 sin corregirlo es construir el motor de cita sobre un reloj mal puesto.

### 0.3 Decisiones tomadas con el usuario (2026-08-25)

1. **Objetivo del tramo: MVP recorrible en mock.** El usuario debe poder recorrer el flujo completo con su pulgar, con plata falsa y KYC falso. Encender los proveedores reales (Truora, Red Pontis) queda fuera — cuesta plata y trámite, y no bloquea el recorrido.
2. **Cambio de estilo visual descartado.** Se evaluó un giro a "pixels & black and white" y el usuario lo dejó de lado. El design system de D.1 (dorado Martini, dark-only) sigue vigente sin cambios.
3. **D.2 se cierra de verdad, no de mentira.** Se mergea el código ya escrito Y el usuario hace el trámite de Google Cloud + Supabase para que la Tarea 4 (verificación manual) se pueda ejecutar. Cerrarla ✅ sin probarla repetiría el error de la fase 1.2, que cerró verde con un proveedor de SMS que nunca se habilitó.
4. **El cableado se parte en dos fases** (4.7a carcasa, 4.7b invitaciones): son trabajos independientes —uno es navegación pura, el otro toca plata bloqueada— y la disciplina del proyecto es fase por fase.
5. **`hora` se corrige en su propia fase (4.8)**, no dentro de 5.0. La fase 5.0 es el QR rotativo (HMAC, rotación, anti-replay); meterle un date-picker le cruza el alcance.

---

## 1. Secuencia

```
Fase 0 (higiene) → D.2 → 4.7a → 4.7b → 4.8 → 5.0 → 5.1 → 5.2 → 5.3 → 5.4 → 5.5
```

Al cerrar **4.7b** el flujo social camina end-to-end desde la app: invitar → aceptar → chatear → confirmar.
Al cerrar **5.5** el MVP está completo en modo mock.

Las fases 5.0–5.5 mantienen el alcance, modelo, esfuerzo y skills que ya define `docs/2026-07-01-plan-mvp.md`. Este spec no las redefine; solo fija que **no arrancan hasta que 4.8 esté cerrada**.

---

## 2. Fase 0 — Higiene (no es fase de producto)

No entrega funcionalidad. Deja el repo en estado limpio para trabajar. No lleva entrada en `ESTADO.md` ni actualiza `FASE ACTUAL`.

**Alcance:**

- **Mergear `worktree-d2-google-login` a master** (3 commits: dependencias, `lib/auth.ts`, pantalla de sign-in). La rama `worktree-design-system-d2` es un prefijo de la anterior — se descarta sin mergear.
- **Podar worktrees.** Los dos de D.2 (`.claude/worktrees/d2-google-login`, `.claude/worktrees/design-system-d2`) tras el merge. El de `fase-1-6-endurecimiento` está `locked` y adelantado a master desde julio: **verificar primero** que `dfca2da` no tenga trabajo que master no tenga antes de borrarlo.
- **Rama `claude-design-sync`:** divergida desde la fase 1.2, sin nada que aportar al estado actual. Se borra (local y remota) salvo indicación contraria del usuario.
- **Verificar pgTAP contra la nube** (`npm run test:db`, requiere `DATABASE_URL` en `.env`). Los 230 tests no se han corrido en esta sesión; el estado ✅ de SP3/SP4 se apoya en ellos.
- **Arreglar el flake de `tests/app/chat-detail.test.tsx`:** falla por timeout de 15 s bajo suite completa, pasa en 4 s aislado. Diagnosticar con `superpowers:systematic-debugging` antes de subir el timeout — un timeout que solo aparece bajo carga puede ser un `await` faltante, no lentitud.

**Criterio de cierre:** `git worktree list` muestra solo el checkout principal, `npm test` verde sin flakes en dos corridas seguidas, `npm run test:db` verde.

---

## 3. Fase D.2 — Login con Google (cierre)

El plan ya existe: `docs/superpowers/plans/2026-07-25-design-system-d2.md`. Las Tareas 1–3 están implementadas en la rama que se mergea en la Fase 0. **Solo queda la Tarea 4: verificación manual.**

**Lo que hace el usuario** (no lo puede hacer un agente — son credenciales de su cuenta): crear el cliente OAuth en Google Cloud Console, autorizar los orígenes y el redirect URI, y pegar Client ID + Secret en el dashboard de Supabase. Los pasos exactos están en el plan, sección "Antes de empezar".

**Lo que hace el agente:** acompañar la verificación en el preview real, corregir lo que falle, y cerrar.

**Criterio de cierre:** el botón "Continuar con Google" abre el consentimiento de Google, vuelve con sesión válida, y el usuario aterriza donde `route-guard` mande según su estado de perfil/KYC. **Sin esa evidencia la fase queda 🟨, no ✅.**

---

## 4. Fase 4.7a — Carcasa de navegación

**Objetivo:** que las pantallas ya construidas sean alcanzables con el pulgar.

**Alcance:**

- Portar `app-shell` de Lovable como tab bar de Expo Router.
- Tabs propuestas: **Descubrir · Bar · Chats · Perfil**, con `store` alcanzable desde Bar y `wallet` desde Perfil (no ocupan tab propia). **El juego exacto de tabs se confirma contra `app-shell` de Lovable al escribir el plan de esta fase** — Lovable es la referencia visual y puede tener otra distribución; esta propuesta es el punto de partida, no la decisión final.
- **Filtrado por rol:** el amigo y el rentador no ven el mismo juego de tabs. La fuente de verdad del rol es `profiles.rol`, ya disponible vía la sesión.
- Estado activo señalado con **icono + texto**, nunca solo color (regla de accesibilidad del proyecto). Targets ≥44 dp.

**Fuera de alcance:** cualquier cambio de lógica de negocio, Edge Functions o SQL. Es navegación pura. Tampoco entra `friend-card` ni `drink-icon` (siguen en backlog) — se portan cuando una fase los reclame.

**Tests:** cada tab renderiza su pantalla; las tabs se filtran correctamente por rol en ambas direcciones; el estado activo expone texto además de color; los targets cumplen el mínimo.

**Criterio de cierre:** `lint` + `typecheck` + `test` verdes. Sin `security-review` (no toca plata ni datos sensibles).

---

## 5. Fase 4.7b — Invitaciones (cableado)

**Objetivo:** cerrar el hueco #2. Que el backend de invitaciones —completo desde julio— sea alcanzable desde la app.

**Alcance:**

- **Pantalla de invitaciones entrantes:** lista de invitaciones/solicitudes `pendiente` donde el usuario es receptor, con aceptar y rechazar. Al aceptar una `solicitud`, el rentador debe elegir una bebida de su bar (la Edge Function ya lo exige).
- **Cablear los CTAs muertos:** "Invitar" en descubrimiento → `crear-invitacion`; "Invitar" en el bar → la misma función con la bebida ya seleccionada.
- **Navegar al chat** tras aceptar (la `cita` nace en ese momento y habilita el chat vía RLS).

**Sin backend nuevo.** `crear-invitacion` y `responder-invitacion` ya existen, están testeadas (49 aserciones pgTAP entre las dos) y revisadas con `security-review`. Esta fase es UI + cableado.

**Cuidado que hereda del backend** (no es opcional, la UI tiene que respetarlo):

- El emisor debe estar `kyc_estado='verificado'` para emitir, y el receptor para **aceptar** (rechazar no requiere KYC — se corrigió deliberadamente en 4.3 para no dejar bebidas bloqueadas para siempre).
- La creación es idempotente por `(emisor_id, idempotency_key)`. El cliente genera la key por intento y la **conserva** entre reintentos, como ya hace `store.tsx` con las órdenes de pago.
- `alcance='especifica'` es fijo del servidor. La UI no lo manda ni lo ofrece — `global` es sub-proyecto 2.

**Tests:** los tres CTAs invocan la Edge Function correcta con el payload correcto; aceptar/rechazar reflejan el resultado; un usuario sin KYC verificado ve el camino bloqueado con mensaje claro en vez de un error crudo; el reintento reusa la idempotency key.

**Criterio de cierre:** `lint` + `typecheck` + `test` verdes **y `security-review`** — aunque no escriba SQL, esta fase dispara el bloqueo de bebidas (plata en escrow) desde la UI.

---

## 6. Fase 4.8 — Saneamiento pre-5.x

**Objetivo:** desactivar el hueco #3 antes de que SP5 dependa de él.

**Alcance:**

- **Date-picker nativo** para el campo `hora` de confirmar cita, reemplazando el texto libre validado con `Date.parse`. Primera dependencia de UI nueva del repo — se evalúa `@react-native-community/datetimepicker` (el estándar de Expo) antes de agregarla.
- **Offset explícito de Perú (`-05:00`)** al construir el `timestamptz` en `confirmar_cita`, en vez de castear un string sin zona bajo la sesión Postgres. Perú no tiene horario de verano, así que el offset fijo es correcto y no necesita librería de zonas.
- **Migración de corrección** para las filas de `citas` ya confirmadas con hora corrida, si las hay. En la práctica probablemente sean cero (no hay usuarios reales), pero la migración se escribe igual: es más barato que descubrir después que había tres.

**Test que fija la regla:** confirmar "21:30 hora de Lima" guarda `2026-XX-XXT02:30:00Z` del día siguiente, **no** `21:30Z`. Este test es la razón de ser de la fase; si pasa, 5.2 y 5.4 pueden confiar en `hora`.

**Criterio de cierre:** `lint` + `typecheck` + `test` + `test:db` verdes. Con `security-review` por tocar una función `SECURITY DEFINER` del camino de la cita.

---

## 7. Fases 5.0–5.5 — Motor de cita

Sin cambios respecto a `docs/2026-07-01-plan-mvp.md`. Se listan aquí solo para fijar el orden y las dependencias que este spec introduce:

| Fase | Entrega | Depende de |
|---|---|---|
| 5.0 | Token QR rotativo (HMAC, ~30 s) | 4.7b (poder llegar a una cita confirmada) |
| 5.1 | Scan mutuo + geofence 50–100 m | 5.0 |
| 5.2 | Cronómetro + push (Expo Push) | **4.8** (`hora` correcta) |
| 5.3 | Extensión de cita (bebida adicional) | 5.2 |
| 5.4 | Liberación de escrow + no-show | **4.8**, 5.1 |
| 5.5 | E2E del flujo completo + revisión final MVP | todas |

**Deuda que estas fases absorben** (ya anotada en `docs/backlog.md`, confirmada en esta sesión):

- **Infraestructura de push → 5.2.** Hoy no existe: ni `expo-notifications`, ni tabla/columna de push token. Las fases 4.3, 4.5, 5.2 y 5.3 la mencionan sin que ninguna la construya. 5.2 la siembra de verdad.
- **Expiración de invitación → 5.4.** Una invitación `pendiente` nunca respondida deja su bebida `bloqueada` indefinidamente; el valor `expirada` del enum no se setea en ningún camino. Necesita cron, igual que el no-show — misma fase, misma infraestructura.

---

## 8. Fuera de alcance de este tramo

- **Proveedores reales.** Truora (KYC) y Red Pontis (pagos) siguen en mock. **Sus fases están ✅ sobre tests que mockean el cliente de Supabase — eso no es evidencia de que funcionen.** Auditarlos y encenderlos es un tramo propio, previo a cualquier intento de producción (anotado en backlog desde 2026-07-24).
- **SMS / verificación de celular.** Descartada por costo. Sin opción gratuita para producción.
- **Cambio de estilo visual.** Evaluado y descartado por el usuario en esta sesión.
- **Modo claro.** Consecuencia aceptada de la decisión dark-only de D.1.
- **D.3 (onboarding: carrusel + ToS).** Definida en el spec de design system §7, sin fecha. No bloquea el recorrido del MVP.
- **Pantalla de estado KYC** (pendiente en revisión / rechazado con motivo). Sigue sin dueño en backlog.
- **Todo el escalamiento:** niveles (SP6), suscripción (SP8), visibilidad premium (SP2), referidos (SP9), SOS/ratings/moderación (SP7).
- **`friend-card`, `drink-icon`.** Se portan cuando una fase los necesite, no antes.
- **Refactor de fases cerradas.** Incluido el N+1 de `getChats` y la asimetría cosmética de regex del detector anti-fuga.

---

## 9. Riesgos

| Riesgo | Mitigación |
|---|---|
| D.2 se vuelve a cerrar sin verificar (el pecado de la fase 1.2). | Criterio explícito: sin evidencia del login real, la fase queda 🟨. |
| El flake de `chat-detail` esconde un bug real (`await` faltante), no lentitud. | Fase 0 lo diagnostica con `systematic-debugging` **antes** de subir el timeout. |
| 4.7b dispara bloqueo de bebidas desde una UI nueva y escapa algo. | La fase cierra con `security-review` pese a no escribir SQL. |
| El date-picker de 4.8 arrastra una dependencia pesada o incompatible con Expo. | Evaluar `@react-native-community/datetimepicker` (el que Expo soporta) antes de instalarlo; medir el bundle. |
| Borrar el worktree de 1.6 pierde trabajo sin mergear. | Verificar `dfca2da` contra master antes de podar. Está `locked` por algo. |
| SP5 avanza sobre un mock de pagos y al encender Red Pontis se rompe la liberación de escrow. | Riesgo aceptado por decisión del usuario. La interfaz `PaymentProvider` existe justo para acotarlo; la auditoría de proveedores es tramo propio. |
| Cinco fases nuevas antes de 5.0 alargan la distancia al MVP. | Tres de ellas (0, D.2, 4.8) son chicas. Las dos grandes (4.7a/b) desbloquean lo que ya está construido y sin usar — no es trabajo nuevo, es trabajo represado. |

---

## 10. Criterio de cierre común

Toda fase de producto cierra con:

1. `npm run lint` + `npm run typecheck` + `npm test` verdes, **con la salida mostrada** (`superpowers:verification-before-completion`). Las que tocan SQL, también `npm run test:db`.
2. Entrada nueva en `docs/ESTADO.md` con el formato de ese archivo.
3. Fase marcada ✅ en la tabla de `ESTADO.md` (las fases nuevas 4.7a/4.7b/4.8 se agregan a la tabla del MVP).
4. `FASE ACTUAL` actualizada en `CLAUDE.md`.
5. Commit con Conventional Commits. Sin push salvo que el usuario lo pida.

Las fases que tocan plata o datos sensibles (4.7b, 4.8, todas las de SP5) cierran además con `security-review` y `requesting-code-review`.
