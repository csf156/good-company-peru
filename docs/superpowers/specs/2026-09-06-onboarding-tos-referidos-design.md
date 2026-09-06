# Fase D.4 — Carrusel "Cómo funciona", ToS y costura de referidos

**Qué es esto:** el diseño de la fase que cierra el onboarding. Añade lo que el spec del design system (`2026-07-24-design-system-lovable-design.md` §7) había reservado y que D.3 movió aquí: explicar el concepto antes del registro, hacer que el usuario acepte los términos de forma verificable, y dejar capturado el referido para que la fase 9 no tenga que rehacer el alta.

**Ocupa el slot D.4.** Es la última fase "D"; después de esta el onboarding queda completo y el trabajo vuelve al plan MVP (sub-proyecto 5, motor de cita).

---

## 1. Por qué esta fase existe

Tres motivos distintos, uno por pieza:

1. **El concepto es inusual.** El usuario compra una "bebida" en vez de pagar directo. Sin explicación previa eso parece arbitrario o sospechoso — justo la impresión que no puede dar una app donde se paga por adelantado a un desconocido. Registrado en `docs/2026-07-03-design-system.md:181`.
2. **No hay aceptación de términos en ninguna pantalla.** El posicionamiento sin contenido sexual es un **requisito para mantener las pasarelas de pago** (`CLAUDE.md`, decisiones cerradas), y hoy no existe evidencia de que ningún usuario lo haya aceptado. La fase 7.5 (ToS enforcement) necesitará esa evidencia y no tendría de dónde sacarla.
3. **El referido solo se puede capturar una vez.** El momento es el registro y no vuelve. Quien se registre entre hoy y la fase 9 queda sin atribuir para siempre si no se guarda ahora.

---

## 2. Lo que ya existe (verificado por introspección, 2026-09-06)

| Pieza | Dónde | Estado |
|---|---|---|
| Orden del guardián | `lib/route-guard.ts` (`computeRedirect`) | sesión → `select-role` → `profile-setup` → `kyc` → home |
| `AuthSegment` | `lib/route-guard.ts` | `sign-in`, `verify-otp`, `select-role`, `profile-setup`, `kyc`, `null` |
| `ProfileStatus` | `lib/route-guard.ts` | `none` = **no existe fila en `profiles`**; `incomplete` = existe pero falta el formulario |
| Campos que completan el perfil | `lib/profile-complete.ts` | `REQUIRED_FIELDS` = nombre, alias, fecha_nacimiento, genero, foto_url |
| Columnas de `profiles` | introspección | 19 columnas; **no existe** ninguna de ToS ni de referido |
| Política de privacidad | `public/privacidad.html` | Estática, ya desplegada. **No es un ToS.** |
| Wizard de alta | `app/(auth)/profile-setup.tsx` | 6 pasos (rentador) / 7 (amigo), patrón `StepHeader` + `Screen textured` |

**El hecho que condiciona el diseño:** la fila de `profiles` **no existe** hasta que el usuario elige rol en `select-role`. Cualquier dato que se persista por perfil necesita que esa pantalla haya pasado.

---

## 3. Decisiones tomadas (2026-09-06)

Las cuatro se discutieron explícitamente con el usuario:

1. **El texto del ToS no existe y se redacta en esta fase**, como **borrador marcado**, con la advertencia visible de que debe revisarlo un abogado antes de considerarse vinculante. Quien lo escribe no es abogado.
2. **El carrusel se recuerda en el almacenamiento del dispositivo** (`AsyncStorage` nativo, `localStorage` web). Es lo único disponible antes de que exista sesión. Se ve una vez por dispositivo y reaparece si el usuario cambia de teléfono o limpia datos: coste aceptable para cuatro slides saltables.
3. **El ToS va en pantalla propia, gateada por el guardián**, no como paso del wizard ni como checkbox del sign-in. Así bloquea de verdad (nadie invita ni compra sin aceptar), da un único punto que revisar a la fase 7.5, y no alarga un alta que el usuario ya notó larga.
4. **La costura de referidos captura y guarda, sin usar.** Campo opcional en el alta más una columna en `profiles`. Sin códigos propios, sin comisiones, sin panel.

**Corrección hecha durante el diseño:** la decisión 3 se planteó primero como "pantalla propia justo después del sign-in". La introspección mostró que ahí no hay fila de `profiles` donde persistir la aceptación. La pantalla se corre **un escalón**, a después de `select-role`. La intención se mantiene intacta: elegir rol es un solo toque.

---

## 4. Carrusel "Cómo funciona"

**Cuándo:** antes del sign-in, para quien no tiene sesión y no lo ha visto en ese dispositivo.

**Cuatro slides**, en este orden, que son la cadena que nadie entiende sola:

| # | Idea | Por qué está |
|---|---|---|
| 1 | Qué es Ayni: compañía social, no citas | Fija la expectativa correcta desde el primer segundo |
| 2 | Compras una bebida virtual, no le pagas a una persona | El concepto raro, explicado antes de que lo vea en la tienda |
| 3 | El dinero queda retenido hasta que se encuentren | Responde "¿y si no aparece?" antes de que lo pregunte |
| 4 | Se libera al confirmar el encuentro con QR | Cierra la cadena y anticipa el motor de cita (5.x) |

**Comportamiento:** saltable desde cualquier slide, indicador de posición, y avance por botón — no solo por gesto, porque el gesto solo no es accesible. Al terminar o saltar, se marca visto en el dispositivo y se va al sign-in.

**No se persiste en la base.** No hay usuario todavía, y ver el carrusel dos veces no rompe nada.

**Cómo encaja con el guardián.** Hoy la rama de "sin sesión" manda a `sign-in` y solo tolera `sign-in` y `verify-otp`; con cualquier otra pantalla redirige. El carrusel es una pantalla más de esa rama, así que `AuthSegment` gana también el valor `carrusel` y la lista de pantallas toleradas sin sesión lo incluye — si no, el guardián lo expulsaría al sign-in en cuanto se pintara.

Quién decide mostrarlo es el propio arranque, no `computeRedirect`: la marca vive en el dispositivo y leerla es asíncrono, mientras que el guardián es una función pura y sincrónica sobre estado de sesión. Meter ahí una lectura de almacenamiento lo volvería impuro y difícil de testear. El guardián solo debe **permitir** la pantalla; la decisión de entrar en ella se toma antes, con la marca ya leída.

---

## 5. Aceptación de términos

### 5.1 Dónde

Pantalla propia en el grupo `(auth)`, gateada por `computeRedirect`. El orden nuevo del guardián:

```
sin sesión           → sign-in
sin perfil           → select-role      (crea la fila de profiles)
sin ToS aceptado     → tos              ← NUEVO
perfil incompleto    → profile-setup
KYC no verificado    → kyc
                     → home
```

`AuthSegment` gana el valor `tos` y `RouteGuardInput` gana una entrada que diga si la versión vigente está aceptada.

### 5.2 Cómo se persiste

**Tabla nueva, append-only.** No una columna en `profiles`.

**Por qué append-only:** cuando el texto cambie habrá que re-pedir aceptación, y una columna pierde la anterior. La fase 7.5 necesita evidencia histórica — "aceptó la v1 en tal fecha, la v2 en tal otra" — no el último valor. Es el mismo criterio del `ledger` (fase 3.0): los registros que sirven de evidencia no se mutan.

Guarda, como mínimo: el perfil, la **versión** del texto aceptado, y **cuándo**. La forma exacta de las columnas se fija en el plan, por introspección del esquema real.

**RLS:** cada quien ve e inserta solo lo suyo; `update` y `delete` revocados al cliente. Mismo patrón que `onboarding_eventos` (fase D.3).

**La versión vive en el código**, como constante junto al texto. Subirla obliga a re-aceptar sin tocar la base.

### 5.3 Qué dice la pantalla

Resumen legible de las tres reglas que de verdad importan, en español de Perú, informal:

- **Compañía social, sin contenido sexual.** Es lo que sostiene las pasarelas de pago.
- **Todo pago dentro de la app.** Coordinar pagos por fuera es motivo de baja — coherente con la moderación anti-fuga de la fase 4.4, que ya detecta y oculta esos mensajes.
- **Mayores de 18.** Ya se valida en el alta con `fecha_nacimiento`; aquí se enuncia.

Debajo, el texto completo del ToS (borrador) y enlace a `public/privacidad.html`, que ya existe.

**Aceptación explícita:** un control que el usuario activa a propósito. Nada de "al continuar aceptas". El botón de continuar queda deshabilitado hasta entonces, con el motivo visible — mismo patrón que el wizard de D.3, donde el usuario nunca se queda adivinando por qué no avanza.

---

## 6. Costura de referidos

**Columna nueva en `profiles`**, nullable, de texto: quién lo invitó. Nada la lee.

**Campo opcional en el alta**, claramente marcado como opcional, con copy que no presione. Se guarda tal cual lo escriba el usuario, sin validar contra ningún catálogo de códigos — ese catálogo es la fase 9.1 y todavía no existe.

**Lo que esta fase NO hace, y conviene que quede escrito:** generar códigos propios, mostrarle su código al usuario, calcular comisiones, atribuir nada, o pintar un panel de referidos. Todo eso es el sub-proyecto 9.

---

## 7. Testing

- **Carrusel:** se muestra sin sesión y sin marca en el dispositivo; no se muestra con la marca puesta; saltar lo marca igual que terminarlo.
- **Guardián:** un perfil sin ToS aceptado va a `tos` y no a `profile-setup`, aunque su perfil ya esté completo; con ToS aceptado sigue al paso que le toque. Cubrir también el caso de la **versión subida**: quien aceptó una versión anterior vuelve a la pantalla.
- **Pantalla de ToS:** el botón no avanza sin aceptación explícita, y el motivo es visible; aceptar escribe versión y fecha.
- **pgTAP:** aislamiento RLS de la tabla nueva (nadie ve la aceptación de otro), y que `update` y `delete` estén revocados al cliente.
- **Referido:** se guarda lo que el usuario escribe; dejarlo vacío no rompe el alta.

---

## 8. Fuera de alcance

- **Referidos de verdad** (códigos, atribución, comisiones, panel) — sub-proyecto 9.
- **Captura del referido desde el link** (`?ref=CODIGO`, deep links) — se evaluó y se descartó por superficie; si la fase 9 lo necesita, la columna ya está.
- **ToS enforcement** (baja por incumplimiento, revisión de reincidentes) — fase 7.5. Esta fase solo deja la evidencia.
- **Revisión legal del texto.** El borrador es del proyecto; validarlo es del usuario.
- **Rediseño de pantallas existentes.** Solo se toca `route-guard`, y `profile-setup` para el campo de referido.
- **Pantalla de estado KYC** (`pendiente` en revisión, `rechazado`) — sigue sin dueño en `docs/backlog.md`.

---

## 9. Riesgos

| Riesgo | Mitigación |
|---|---|
| El gate de ToS deja fuera a las cuentas existentes, incluida la del usuario, en su próximo ingreso. | Es el comportamiento correcto y está avisado. La pantalla es un toque. |
| Añadir un escalón al guardián puede provocar bucles si la condición se evalúa con datos viejos — ya pasó dos veces en este proyecto (bloque 2b de D.3, y el refresco tras el KYC). | El guardián es una función pura con tests; el estado se relee antes de navegar, no después. Cubrir el caso en los tests del guardián, no solo a mano. |
| El texto del ToS es un borrador sin revisar y podría tomarse por vinculante. | Advertencia visible en la propia pantalla y en el documento. Anotado en `docs/backlog.md` como pendiente de revisión legal. |
| Guardar texto libre del usuario en la columna de referido es una entrada no validada. | Se guarda como dato: nunca se interpola en SQL (el cliente escribe por PostgREST con parámetros) ni se renderiza como HTML. La fase 9.1 valida contra su catálogo cuando exista. |

---

## 10. Criterio de cierre

1. `npm run lint` + `npm run typecheck` + `npm test` + `npm run test:db` verdes, **con la salida mostrada** (`superpowers:verification-before-completion`).
2. El usuario recorre en el preview web el carrusel completo, el carrusel saltado y la pantalla de ToS, y los aprueba. Esta fase es de UI y ese es su criterio final.
3. Entrada en `docs/ESTADO.md`, fase ✅ en la tabla, `FASE ACTUAL` actualizada en `CLAUDE.md`.
4. Conventional Commits. Sin push salvo que el usuario lo pida.

Por tocar esquema con RLS, la fase cierra además con `security-review`.
