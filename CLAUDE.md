# Ayni — reglas del proyecto

App de **compañía social** ("rent a friend") en Perú. El pago se abstrae en **bebidas virtuales**; el encuentro se verifica presencialmente (QR + geofence + cronómetro) y solo entonces se libera el pago al amigo en renta.

**Stack:** React Native + **Expo** (cliente nativo) + **Supabase** (Auth, Postgres+RLS, Realtime, Storage, Edge Functions). El código de la app vive en la raíz de este folder; los planes y specs en `docs/`.

**Idioma:** el producto y todo el copy son en **español de Perú** (informal "tú"). El código/commits en inglés técnico está bien; los textos de UI en español.

---

## ⛔ Regla #1 — Desarrollo FASE POR FASE (lo más importante)

El trabajo avanza **una fase a la vez**, siguiendo los planes en `docs/`. **Nunca** trabajes fuera de la fase actual.

### Fase actual

```
FASE ACTUAL: D.4
```

> El usuario actualiza esta línea al inicio de cada sesión. Si dice algo como `FASE ACTUAL: MVP 3.1`, esa es tu única tarea.

### Protocolo obligatorio al iniciar sesión

1. **Lee `docs/ESTADO.md`** (la bitácora) para saber qué fases ya están concluidas y qué existe (tablas, Edge Functions, decisiones, deuda pendiente). Es tu fuente de verdad del progreso — no re-explores todo el código.
2. **Lee la línea `FASE ACTUAL`** de arriba.
3. **Abre el plan correspondiente** (`docs/2026-07-01-plan-mvp.md` o `docs/2026-07-01-plan-escalamiento.md`) y localiza esa fase exacta.
4. **Lee su prompt, modelo, esfuerzo y skills.** Si la fase pide un modelo/esfuerzo distinto al de la sesión (ej. pide Opus 4.8 + xhigh y estás en algo más liviano), **avísale al usuario antes de continuar** — las fases de dinero/seguridad exigen el modelo indicado.
5. **Confirma el alcance** con el usuario en una frase ("Fase X: hago Y, no toco Z") antes de escribir código.
6. **Implementa SOLO esa fase.** Usa las skills que la fase indica (casi siempre `test-driven-development`; `security-review` + `requesting-code-review` en fases de dinero/seguridad).
7. **Termina en el límite de la fase:** corre los tests, verifica verde (`verification-before-completion`), commitea, y **detente**. No arranques la siguiente fase sin que el usuario actualice `FASE ACTUAL`.

### Protocolo al concluir una fase (SOLO cuando el usuario diga "fase concluida")

No des una fase por concluida por tu cuenta — **espera la indicación explícita del usuario**. Cuando la dé:

1. **Verifica** que los tests de la fase estén verdes y el trabajo commiteado (`verification-before-completion`). Si no, dilo y no marques concluido.
2. **Añade una entrada a `docs/ESTADO.md`** (append, más reciente arriba, usando el formato de ese archivo): qué se construyó, archivos/pantallas, tablas/Edge Functions/migraciones (nombres exactos), decisiones no obvias, estado de tests, y deuda/notas para fases futuras.
3. **Marca la fase como ✅** en la tabla de fases de `docs/ESTADO.md`.
4. **Actualiza `FASE ACTUAL`** en este archivo (`CLAUDE.md`): déjala apuntando a la siguiente fase según el orden del plan, o `(esperando indicación)` si el usuario no dijo cuál sigue.
5. **Commitea** ESTADO.md + CLAUDE.md ("docs: cierre fase X.Y"). No arranques la siguiente fase en la misma sesión salvo que el usuario lo pida.

### Qué NO hacer entre fases

- **No adelantes trabajo** de fases futuras "de una vez porque es rápido". Rompe la ventana de contexto y cruza alcances.
- **No recomiendes ni implementes cosas que pertenecen a otra fase.** Si detectas algo fuera de alcance, **anótalo** (una línea en `docs/backlog.md`, créalo si no existe) y sigue con tu fase. No lo hagas.
- **No refactorices** código de fases ya cerradas salvo que tu fase actual lo exija directamente.
- **No dejes "ganchos" a medio hacer** de features futuras más allá de las **costuras** ya definidas en el diseño (feature flags, ledger, columnas de nivel, tabla `suscripcion`, enums de estado completos). Esas costuras SÍ van desde el MVP; nada más.
- Si el usuario pide algo que claramente es de otra fase, **recuérdaselo** ("eso es fase 6.2, ¿lo movemos o seguimos en la actual?") en vez de hacerlo calladamente.

---

## Documentos de referencia (no los dupliques, apúntalos)

| Doc | Para qué |
|-----|----------|
| `docs/2026-07-01-modelo-negocio-design.md` | Modelo de negocio: fees, niveles, seguridad, arquitectura, decisiones cerradas. |
| `docs/2026-07-01-plan-mvp.md` | Plan MVP fase por fase (sub-proyectos 1, 3, 4, 5). |
| `docs/2026-07-01-plan-escalamiento.md` | Plan escalamiento fase por fase (8, 6, 2, 9, 7). |
| `docs/2026-07-03-design-system.md` | Sistema de diseño, mapa de vistas, UX de seguridad. |
| `docs/ESTADO.md` | **Bitácora de progreso.** Leer al iniciar; escribir al concluir cada fase. Fuente de verdad de qué ya existe. |
| `docs/backlog.md` | Ideas fuera de alcance anotadas durante una fase (crear si no existe). |

**Antes de afirmar cómo funciona una regla de negocio o una fase, léela en el doc.** No la cites de memoria.

---

## Decisiones cerradas (no re-litigar)

- **Posicionamiento:** compañía social. **Sin contenido sexual** (ToS + moderación). Requisito para mantener pasarelas.
- **Fees (modelo del diseño):** rentador gratis paga buyer fee 15% + procesamiento ~4%; amigo gratis se le descuenta seller fee 20%; **amigo premium recibe 100%** (neto de procesamiento); rentador premium sin buyer fee.
- **Custodia:** wallet orquestada por la app, fondos en escrow de **Red Pontis** (partner regulado). Integrar detrás de interfaz `PaymentProvider`.
- **Suscripción premium (S/39/mes):** vía **IAP de Apple/Google** (~15%). Las bebidas NO van por IAP (servicio del mundo real) → Red Pontis.
- **Niveles (escala élite):** bronce/plata/oro/diamante/élite — umbrales 0/300/1,000/3,000/8,000. Decaimiento por actividad de 45 días.
- **Referidos:** activos (sub-proyecto 9).
- **KYC:** Truora (DNI + liveness + RENIEC), ambos roles, 18+.
- **Diseño:** portar el prototipo Lovable (`csf156/good-company-peru`) a RN/Expo. Lovable es **solo referencia visual**; no se reutiliza su código, ni `mock-data.ts`, ni su fee cliente.

---

## Reglas de desarrollo (dinero y seguridad)

Estas aplican en **toda** fase que toque plata o datos sensibles:

- **El cliente nunca calcula ni mueve saldo.** Fees, escrow, payout, niveles: solo en **Edge Functions con `service_role`**.
- **RLS estricto** en todas las tablas. DNI y saldos jamás visibles a otro usuario. Escribe tests de aislamiento RLS.
- **Ledger append-only** para todo movimiento (sin UPDATE/DELETE). El balance es una vista calculada, nunca un número mutable suelto.
- **Idempotencia** en todo pago/escrow/payout (`idempotency_key`). Doble webhook no duplica.
- **TDD siempre:** test que falla → implementación mínima → verde → commit. Fases de dinero/seguridad cierran con `security-review` + `requesting-code-review`.
- **Migraciones:** verificar el esquema por **introspección** (`information_schema`, `pg_proc`, `pg_policy`), no de memoria. **El usuario revisa el SQL antes de aplicar.** Aplicar como migración versionada, no por SQL editor suelto.
- **Anti-fuga:** todo pago dentro de la app; la moderación de chat detecta teléfono/CBVU/pago externo.

## Reglas de diseño (UI)

- **Portar la pantalla de Lovable** equivalente a la fase (ver mapeo Lovable→fase en cada plan) — no inventar de cero si Lovable ya la tiene.
- **Identidad Ayni cálida** (dorado/bronce, superficies oscuras, títulos serif italic, labels mono). Tomar los **valores de color reales de `src/styles.css` de Lovable**, no de la paleta teal/coral vieja del design-system (está marcada como superada).
- **Rojo solo para SOS/error/no-show.** Nunca decorativo.
- **Estados con icono + texto**, nunca solo color (accesibilidad/daltonismo). Contraste AA. Targets ≥44dp.
- **Montos y cronómetro con tipografía tabular** (no "bailan" de ancho).
- **Modo oscuro desde el día 1** (uso nocturno).

---

## Commits y ramas

- Commits pequeños y frecuentes, uno por step de TDD cuando aplique. Conventional Commits.
- No hagas push ni abras PR salvo que el usuario lo pida.
- Deja la rama en estado que compila y con tests verdes al cerrar una fase.

## Gotchas

- **No reutilizar `mock-data.ts` de Lovable como esquema** — es de prototipo. El modelo real lo definen las fases de backend.
- **La UI de Lovable engaña:** el motor de cita "se ve terminado" pero su QR es `Math.random()`, el timer es local y el pánico es un `toast`. Todo eso es trabajo real pendiente (fases 5.x y 7.0), no está hecho.
- **El servidor de Expo reescribe `tsconfig.json` en cada arranque.** Le quita `.expo/types/**/*.ts` y `expo-env.d.ts` del `include`, que es lo que da tipado a las rutas de expo-router — comitearlo así apaga esa red de seguridad **en silencio**: `router.push('/ruta-que-no-existe')` deja de ser error de compilación y el typecheck sigue en verde. **Revisar `git diff tsconfig.json` antes de cualquier `git add -A` o commit, siempre**, y revertirlo con `git checkout tsconfig.json`. Se detectó y revirtió a mano cinco veces en una sola sesión (2026-09-01); basta un descuido para que entre.
- **Un repo, dos ramas (no dos repos):** `good-company-peru` (GitHub) tiene rama `main` = prototipo Lovable (referencia visual, `.lovable`/`vite.config.ts`/`src`) y rama `master` = **este proyecto RN/Expo** (lo que hay en esta carpeta, `origin/master`). GitHub Pages del proyecto despliega desde `master` vía Actions, no toca `main`. No mezclar código entre ramas — Lovable sigue siendo solo referencia visual. `rent-a-friend-peru` (otro repo, mismo dueño) es una copia vieja y abandonada de este proyecto (último push 2026-07-05, pre-fase D.2) — no usar, no sincronizar con ella. Verificado por introspección 2026-08-25.
