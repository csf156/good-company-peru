# Unificación del design system bajo Lovable + Google OAuth + onboarding

**Fecha:** 2026-07-24
**Estado:** diseño aprobado, pendiente de plan de implementación
**Alcance:** tres fases secuenciales en un solo spec (ver §0.3)

---

## 0. Contexto

### 0.1 El problema

`CLAUDE.md` y `docs/2026-07-03-design-system.md` declaran que la fuente de verdad visual es el prototipo Lovable (`csf156/good-company-peru`, disponible localmente en `../good-company-peru`). La realidad del repo no cumple esa declaración. Auditoría del 2026-07-24:

| Hallazgo | Evidencia |
|---|---|
| **Los 15 tokens `ayni` difieren de Lovable.** Se aproximaron a ojo, no se convirtieron de HSL. | `lib/theme.ts:75-91` vs `../good-company-peru/src/styles.css` `:root`. Ej: `primary` real `#EEA62B`, actual `#F0B940`. El `background` actual (`#150F0A`) salió del meta `theme-color` de `src/routes/__root.tsx:73`, no de la variable CSS que realmente renderiza (`--background: hsl(24 20% 6%)` = `#120F0C`). |
| **Ninguna fuente carga.** | No existe `useFonts` ni `loadAsync` en todo el repo. `PlayfairDisplay-Italic` y `JetBrainsMono-Regular` se nombran en `lib/theme.ts:93-99` pero sus paquetes ni están instalados. Todo cae a la fuente del sistema: la identidad "títulos serif italic, labels mono" hoy no existe en pantalla. |
| **8 archivos siguen en la paleta teal/coral superada.** | `app/(auth)/{sign-in,verify-otp,select-role,profile-setup,kyc}.tsx`, `app/profile.tsx`, `app/profile/[id].tsx`, `components/Button.tsx` usan `colors.light` (fondo claro `#FAF7F2`). Las otras 6 pantallas ya usan `ayni`. La app se ve como dos productos distintos. |
| **No hay escala de espaciado ni de radio.** | `lib/theme.ts` no define ninguna; cada pantalla inventa sus números. |
| **`levelColors` pertenece a una escala obsoleta.** | Incluye `platinum`, que no existe en la escala élite vigente (bronce/plata/oro/diamante/élite, `docs/2026-07-03-design-system.md:58-62` y `../good-company-peru/src/lib/mock-data.ts:83-89`). |
| **El doc de design system documenta la paleta superada como si fuera la vigente.** | `docs/2026-07-03-design-system.md` §2 y §3 desarrollan teal/coral + Sora, con una nota al inicio diciendo que están superadas. Quien lo lea de arriba abajo implementa lo incorrecto. |

Causa raíz de que la deriva persista: **nada en el CI verifica que una pantalla use los tokens.** La deuda está anotada en `docs/backlog.md:14` desde la fase 1.0 y sobrevivió cuatro sub-proyectos.

### 0.2 Decisiones tomadas (con el usuario, 2026-07-24)

1. **Corregir los tokens a los valores exactos de Lovable**, aunque eso cambie sutilmente las 6 pantallas ya migradas. Razón: deja una sola fuente de verdad reproducible por conversión HSL→hex. Congelar aproximaciones haría falso el propio doc que estamos arreglando.
2. **Dark-only**, como Lovable (que no tiene paleta clara, ni toggle: `theme="dark"` fijo en `src/routes/__root.tsx:118`). Se borra `colors` completo (light + dark). Costo aceptado: un modo claro futuro habría que diseñarlo de cero.
3. **Migración estructural, no solo de color** (opción "B"). Las pantallas viejas adoptan también la voz tipográfica de Lovable (eyebrow mono uppercase, título serif italic, radios y espaciado), no solo los hex.
4. **Un spec, tres fases secuenciales.**
5. **Google OAuth sin verificación de celular** (ver §6.1). El flujo pedido originalmente no es realizable, y la alternativa (celular tipeado + OTP por SMS) se descartó al descubrir que el proveedor de SMS nunca estuvo habilitado y que no existe opción gratuita para producción. La autenticación queda: **Google + OTP por correo**.

### 0.3 Las tres fases

| Fase | Nombre | Depende de |
|---|---|---|
| **D.1** | Design system: tokens, fuentes, componentes base, migración de 8 pantallas, reescritura del doc | — |
| **D.2** | Login con Google; retiro de la pestaña "Celular" | D.1 (para nacer con la identidad correcta) |
| **D.3** | Onboarding: carrusel "Cómo funciona" + aceptación de ToS | D.1, D.2 |

Cada fase cierra con tests verdes y commit antes de empezar la siguiente.

### 0.4 Verificación de choque de alcance

Se revisaron `docs/2026-07-01-plan-mvp.md` y `docs/2026-07-01-plan-escalamiento.md` completos:

- **Google OAuth:** no aparece en ninguna fase de ningún plan. La fase 1.2 especifica textualmente "registro/login por teléfono (OTP SMS) y email". Alcance nuevo, sin choque.
- **Onboarding de perfil** (nombre, edad, foto, intereses): es la **fase 1.3**, ya cerrada (`app/(auth)/profile-setup.tsx`). **No se rehace.** El "onboarding" de D.3 es otra cosa: el carrusel explicativo previo al registro.
- **Carrusel "Cómo funciona", ToS explícito, pantalla de estado KYC:** propuestos como 🆕 en `docs/2026-07-03-design-system.md:115-119`, **sin dueño en ningún plan**. Libres. D.3 toma los dos primeros; la pantalla de estado KYC queda fuera (ver §9).
- **Fase 9.1 (referidos)** planea capturar el código de referido "en el onboarding (sub-proyecto 1)". No choca hoy, pero D.3 debe dejar la costura (§7.3).

**Nota de disciplina de fases:** este trabajo modifica pantallas de fases ya cerradas (1.2, 1.3, 1.4, 1.5), lo que `CLAUDE.md` normalmente prohíbe. Se hace por indicación explícita del usuario. `FASE ACTUAL` sigue siendo MVP 4.5 y no se toca lógica de negocio de ninguna fase cerrada — solo su capa visual, más las dos features nuevas de D.2/D.3.

---

## 1. Tokens (`lib/theme.ts`)

### 1.1 Qué se borra

- `colors` (objeto `light` + `dark`, paleta teal/coral) — completo.
- `typography` (familias Sora/Inter y su escala) — completo.
- `levelColors` — completo (contiene `platinum`, de la escala obsoleta).
- `ayni` y `ayniTypography` — se reemplazan por el objeto único de §1.2 (los nombres `ayni*` dejan de tener sentido cuando ya no hay una segunda paleta de la cual distinguirse).

Se conservan sin cambios: `touchTarget`, `tabularNums`.

### 1.2 Paleta

Todos los valores derivan del `:root` de `../good-company-peru/src/styles.css` por conversión HSL→hex. **Regla: ningún valor de esta tabla se escribe a mano; se obtiene ejecutando la conversión.** El plan de implementación debe incluir el script de conversión como artefacto verificable.

| token | HSL en Lovable | hex |
|---|---|---|
| `background` | `hsl(24 20% 6%)` | `#120F0C` |
| `foreground` | `hsl(30 10% 96%)` | `#F6F5F4` |
| `surface` | `hsl(24 15% 10%)` | `#1D1916` |
| `surface2` | `hsl(24 15% 14%)` | `#29231E` |
| `card` | `hsl(24 15% 10%)` | `#1D1916` |
| `popover` | `hsl(24 15% 12%)` | `#231E1A` |
| `primary` | `hsl(38 85% 55%)` | `#EEA62B` |
| `primaryForeground` | `hsl(24 20% 6%)` | `#120F0C` |
| `primaryGlow` | `hsl(38 90% 65%)` | `#F6BB55` |
| `secondary` | `hsl(24 15% 14%)` | `#29231E` |
| `muted` | `hsl(24 10% 20%)` | `#38322E` |
| `mutedForeground` | `hsl(24 10% 60%)` | `#A3978F` |
| `accent` | `hsl(38 60% 40%)` | `#A37629` |
| `accentForeground` | `hsl(30 10% 96%)` | `#F6F5F4` |
| `destructive` | `hsl(0 70% 55%)` | `#DD3C3C` |
| `destructiveForeground` | `hsl(30 10% 96%)` | `#F6F5F4` |
| `success` | `hsl(150 60% 45%)` | `#2EB873` |
| `border` | `hsl(24 10% 20%)` | `#38322E` |
| `input` | `hsl(24 10% 20%)` | `#38322E` |
| `ring` | `hsl(38 85% 55%)` | `#EEA62B` |

Niveles (escala élite; `elite` reusa `primary`, confirmado en `../good-company-peru/src/lib/mock-data.ts:88`):

| nivel | umbral | token | hex |
|---|---|---|---|
| bronce | 0–299 | `bronze` | `#DD7F3C` |
| plata | 300–999 | `silver` | `#B6BFC9` |
| oro | 1,000–2,999 | `gold` | `#F5C73D` |
| diamante | 3,000–7,999 | `diamond` | `#80D4FF` |
| élite | 8,000+ | `primary` | `#EEA62B` |

### 1.3 Dos correcciones de accesibilidad sobre Lovable

`docs/2026-07-03-design-system.md:100` exige contraste AA. Se midieron todos los pares de la paleta; **dos valores de Lovable no cumplen** y se corrigen aquí en vez de heredarse:

| Par | Ratio | Requisito | Resolución |
|---|---|---|---|
| `destructive #DD3C3C` sobre `background` | **4.35:1** | 4.5:1 (texto normal) | Se añade `destructiveText` = `hsl(0 70% 60%)` = **`#E05252`** (5.00:1 sobre background, 4.57:1 sobre surface). `destructive` original se conserva **solo para rellenos, bordes e iconos**, nunca para texto de error. |
| `border #38322E` sobre `background` | **1.51:1** | 3:1 (WCAG 1.4.11, componentes de UI) | Se añade `borderStrong` = `hsl(24 10% 38%)` = **`#6B5F57`** (3.09:1). Uso: **bordes que son la única señal de un control** (inputs, campos de formulario). El `border` original se mantiene para divisores decorativos entre superficies, donde 1.4.11 no aplica porque el cambio de superficie ya delimita.|

Ratios verificados que **sí** pasan y no requieren acción: `foreground`/bg 17.54:1 · `mutedForeground`/bg 6.71:1 · `mutedForeground`/surface 6.14:1 · `primary`/bg 9.21:1 · `primaryForeground`/primary 9.21:1 · `success`/bg 7.48:1.

### 1.4 Escalas nuevas

**Radio** — derivado de `--radius: 0.875rem` (=14px) y las expresiones `calc()` de `styles.css`:

| token | px |
|---|---|
| `sm` | 10 |
| `md` | 12 |
| `lg` | 14 |
| `xl` | 18 |
| `2xl` | 22 |
| `3xl` | 26 |
| `full` | 9999 |

**Espaciado** — grid de 4px (Tailwind), con los pasos que Lovable realmente usa (medidos por frecuencia sobre `src/routes` y `src/components`: `gap-2` 47×, `gap-1` 38×, `p-4` 29×, `gap-3` 30×, `px-5` 42×, `p-6` 18×):

`1`=4 · `2`=8 · `3`=12 · `4`=16 · `5`=20 · `6`=24

**Tamaños de texto** — incluyendo los valores arbitrarios que Lovable usa para labels mono (`text-[9px]`, `text-[10px]`, `text-[11px]`):

`9` · `10` · `11` · `12` · `14` · `16` · `18` · `20` · `24` · `30` · `36`

---

## 2. Tipografía

### 2.1 Familias

Lovable declara tres (`styles.css`, bloque `@theme inline`):

| Rol | Familia | Paquete | Estado |
|---|---|---|---|
| Display / títulos | Playfair Display *Italic* | `@expo-google-fonts/playfair-display@0.4.2` | **instalar** |
| Label / eyebrow | JetBrains Mono | `@expo-google-fonts/jetbrains-mono@0.4.1` | **instalar** |
| Cuerpo / UI | Inter | `@expo-google-fonts/inter` | ya instalado |

**Sora se desinstala** — no aparece en Lovable; venía de la propuesta pre-Lovable.

Pesos a cargar, medidos sobre Lovable (`font-medium` 45×, `font-bold` 25×, `font-semibold` 17×, `font-normal` 4×): 400, 500, 600, 700 para Inter; 400 y 600 italic para Playfair; 400 y 500 para JetBrains Mono. Cargar solo estos pesos, no las familias completas — el público objetivo incluye Android de gama media (`docs/2026-07-03-design-system.md:87`).

### 2.2 Carga

`app/_layout.tsx` incorpora `useFonts` con gate: no renderiza el árbol hasta que las fuentes resuelven (o fallan). Hoy no existe ese gate, y es la razón por la que ninguna fuente carga. Debe manejar el caso de error sin dejar la app en blanco: si la carga falla, renderizar igual con el fallback del sistema.

### 2.3 Los tres roles tipográficos

Derivados de los patrones medidos en Lovable (`font-mono` 69× / `uppercase` 68× / `tracking-widest` 59× — fuertemente correlacionados; `font-serif` 53× / `italic` 56×):

| Rol | Familia | Tratamiento | Uso |
|---|---|---|---|
| `display` | Playfair Display Italic | `letterSpacing` negativo | Títulos de pantalla, montos grandes, nombres |
| `label` | JetBrains Mono | UPPERCASE + `letterSpacing` amplio | Eyebrows, labels de campo, texto de botón, badges de nivel |
| `body` | Inter | pesos 400–700 | Todo lo demás |

Los tres se exponen como helpers de estilo desde `lib/theme.ts`, para que ninguna pantalla vuelva a componer `fontFamily` + `letterSpacing` + `textTransform` a mano.

---

## 3. Componentes base

- **`components/Button.tsx`** — se reescribe con los tokens y roles nuevos. Es el único componente compartido hoy y lo consumen varias pantallas migradas.
- **`components/Screen.tsx`** — su prop `background` es hoy obligatoria y sin default, justamente porque convivían dos paletas (`components/Screen.tsx:15-20`). Con dark-only, pasa a tener default `background` y la prop queda opcional.
- Cualquier otro componente se extrae **solo si dos o más de las pantallas migradas lo necesitan**. No se crean componentes especulativos.

**Fuera de alcance:** `friend-card`, `drink-icon`, `app-shell` (deuda de `docs/backlog.md:14`). Pertenecen a pantallas ya cerradas o futuras, no a las 8 que se migran. `app-shell` además introduciría navegación entre pantallas, que hoy no existe en ninguna (decisión registrada en `docs/ESTADO.md` fase 4.1) — eso es un cambio de producto, no de design system. **Permanecen en el backlog.**

---

## 4. Migración de las 7 pantallas

(El octavo archivo en paleta vieja es `components/Button.tsx`, cubierto en §3.)

| Pantalla | Estrategia | Referencia |
|---|---|---|
| `app/profile.tsx` | **Portar** | `../good-company-peru/src/routes/profile.tsx` |
| `app/profile/[id].tsx` | **Portar** | `../good-company-peru/src/routes/profile.$id.tsx` |
| `app/(auth)/sign-in.tsx` | **Derivar de las reglas** | Lovable no tiene pantallas de auth |
| `app/(auth)/verify-otp.tsx` | Derivar | " |
| `app/(auth)/select-role.tsx` | Derivar | " |
| `app/(auth)/profile-setup.tsx` | Derivar | " |
| `app/(auth)/kyc.tsx` | Derivar | " |

Las 6 pantallas ya en tokens Ayni (`index`, `store`, `bar`, `wallet`, `chats/index`, `chats/[id]`) **no se rediseñan** — solo absorben los valores corregidos de §1.2 al cambiar el nombre del import. Cambio visual sutil y esperado.

**Restricción dura: ninguna migración altera comportamiento.** Los tests existentes de cada pantalla deben pasar sin modificarse, salvo aserciones que dependan literalmente de un color o de una familia tipográfica. Si un test de comportamiento requiere cambio, es señal de que la migración se pasó de alcance.

---

## 5. Reescritura de `docs/2026-07-03-design-system.md`

- **§2 (Paleta):** se reemplaza por la tabla de §1.2, más las dos correcciones de §1.3 con su justificación. Se elimina toda la paleta teal/coral y el bloque "Modo oscuro" (deja de tener sentido en una app dark-only).
- **§3 (Tipografía):** se reemplaza por §2 de este spec. Se elimina Sora/Nunito/Manrope.
- **Se agrega** la tabla de radio, espaciado y tamaños de texto (§1.4), hoy inexistente.
- **Se agrega** el procedimiento de conversión HSL→hex, para que cualquiera reverifique los valores contra Lovable sin confiar en este documento.
- **Se conserva** §1 (benchmark) — su racional sigue siendo válido y no depende de la paleta.
- **§6 (checklist):** se actualiza. El punto 4 ("¿Soporta modo oscuro?") se reemplaza por "¿Todos los colores salen de `lib/theme.ts`, sin hex crudos?".
- Se elimina la nota de advertencia del encabezado: deja de ser necesaria cuando el cuerpo ya es correcto.

---

## 6. Fase D.2 — Login con Google + verificación de celular

### 6.1 Corrección al requisito original

El pedido fue: entrar con Google y que la app mande OTP "al número linkeado a ese correo". **No es realizable.** Google OAuth/OIDC devuelve `email`, `name`, `picture` y `sub`; **no devuelve teléfono** en los scopes estándar, y el campo de People API suele venir vacío o sin verificar. La app no tiene forma de conocer ese número.

La alternativa inicialmente aprobada (pedir el celular tipeado y mandarle OTP) **también se descartó**, por lo descubierto en §6.2.

### 6.2 Hallazgo: el login por celular nunca funcionó

Auditoría de la configuración real del proyecto Supabase `zmtclismywmkratmufov` (2026-07-24, vía Management API):

```
external_phone_enabled   false
sms_twilio_account_sid   null
external_email_enabled   true
```

La fase 1.2 está marcada ✅ en `docs/ESTADO.md` y su código de OTP por celular existe y tiene tests, **pero los tests mockean el cliente de Supabase**, así que nadie detectó que el proveedor de SMS jamás se habilitó. En producción, la pestaña "Celular" de `app/(auth)/sign-in.tsx` falla; solo el correo funciona.

Se evaluaron las opciones para habilitarlo:

| Opción | Veredicto |
|---|---|
| Mapa `sms_test_otp` (pares fijos número→código, sin proveedor) | Gratis, pero solo sirve para demo — quien conozca el par entra a esa cuenta. No es autenticación real. |
| Trial de Twilio/Vonage | Solo envía a números verificados uno por uno en su consola. No escala más allá de pruebas. |
| Proveedor de pago | ~S/0.20 por SMS. **No existe camino gratuito para producción.** |

**Decisión (usuario, 2026-07-24): se descarta el celular. La autenticación es Google + OTP por correo.**

### 6.3 Alcance

- **Métodos de autenticación finales:** OTP por correo (ya funciona) + Google OAuth (nuevo). Sin SMS.
- **Se elimina la pestaña "Celular"** de `app/(auth)/sign-in.tsx`. Hoy ofrece un camino que falla siempre — es un bug visible en el preview compartido.
- `lib/auth.ts` conserva `requestOtp`/`verifyOtp` para email. **El código de la rama de teléfono (`toE164Peru`, la variante `{phone}`) se retira** de la ruta de autenticación. `toE164Peru` puede seguir viviendo en `lib/validation.ts` si otra parte lo usa — verificar por búsqueda antes de borrarlo.
- **No se toca `profiles`.** Sin celular verificado no hace falta columna nueva, y por tanto tampoco migración en esta fase.
- **`lib/route-guard.ts` no cambia.** No hay estado nuevo: la máquina (`hasSession` → `profileStatus` → `kycEstado`) sigue igual. Todos sus tests actuales deben pasar sin tocarse.
- Dependencias a instalar: `expo-auth-session` y `expo-web-browser` (ninguna está hoy en `package.json`).
- El redirect de OAuth debe funcionar en nativo (scheme `rentafriendperu`, ya en `app.config.js`) **y en web** (preview de GitHub Pages).

### 6.4 Configuración externa

Estado al 2026-07-24:

- ✅ **Hecho:** `site_url` = `https://csf156.github.io/good-company-peru/` y `uri_allow_list` = `rentafriendperu://**,https://csf156.github.io/good-company-peru/**,http://localhost:3000/**,http://localhost:8081/**` (aplicado vía Management API; antes apuntaban a `localhost:3000` con allow-list vacía).
- ⬜ **Pendiente, solo el usuario:** crear el cliente OAuth en Google Cloud (redirect autorizado: `https://zmtclismywmkratmufov.supabase.co/auth/v1/callback`) y pegar client ID + secret en Supabase → Authentication → Providers → Google. **El secret es una credencial: no lo maneja el agente.**
- ⚠️ Mientras la app de Google esté en modo *Testing*, solo los correos agregados como test users pueden entrar (máx. 100). Para el preview con amigos: agregarlos ahí, o publicar la app (con scopes básicos no requiere verificación de Google).

**D.2 no puede cerrarse verde sin el paso pendiente.**

---

## 7. Fase D.3 — Onboarding

### 7.1 Carrusel "Cómo funciona"

3–4 slides antes del registro, explicando la cadena bebidas → escrow → QR → pago. Justificación registrada en `docs/2026-07-03-design-system.md:115`: el concepto es inusual y sin esto el usuario no entiende por qué "compra una bebida" en lugar de pagar directo.

Se muestra **una sola vez**, antes del primer sign-in. Debe poder saltarse.

### 7.2 Aceptación de ToS

Checkbox explícito con resumen de las reglas anti-fuga y anti-contenido-sexual, dentro del onboarding. Hoy no existe en ninguna pantalla, y el posicionamiento sin contenido sexual es un requisito para mantener pasarelas de pago (`CLAUDE.md`, decisiones cerradas).

La aceptación debe **persistirse** (con fecha y versión del texto), no solo validarse en el cliente: la fase 7.5 (ToS enforcement) necesitará esa evidencia. La columna se define por introspección del esquema real.

### 7.3 Costura para referidos

La fase 9.1 planea capturar el código de referido en estas mismas pantallas (`docs/2026-07-01-plan-escalamiento.md:203`). D.3 **no implementa referidos**, pero deja el punto de extensión evidente para que 9.1 no tenga que rehacer el flujo.

---

## 8. Testing

### 8.1 Estado actual

35 suites / 270 tests verdes. Solo dos archivos tocan el theme: `tests/theme.test.ts` (fija la paleta teal/coral completa — se reescribe) y `tests/components/Button.test.tsx`. Una sola aserción de color en toda la suite. **El churn de tests es bajo**; la migración no debería tocar tests de comportamiento.

### 8.2 Tests nuevos

- **`tests/theme.test.ts` reescrito:** verifica los valores de §1.2 **derivándolos de HSL en el propio test**, no copiándolos como literales. Así el test falla si alguien edita un hex a mano, que es exactamente el fallo que originó este spec.
- **Test de contraste:** verifica programáticamente que los pares de §1.3 cumplen sus ratios. Congela las dos correcciones de accesibilidad para que nadie las revierta "para que se parezca más a Lovable".
- **Test de guardia anti-hex:** falla si aparece un color literal (`#rrggbb`, `rgb(`, `hsl(`) en `app/` o `components/`. **Es el mecanismo que hace que "todas las pantallas siguen el design system" sea verificable por el CI en vez de una promesa.** Sin él, la deriva vuelve en la primera fase con prisa — exactamente como pasó entre 1.0 y 4.5.
- **Test de carga de fuentes:** verifica que `_layout.tsx` no renderice el árbol antes de que las fuentes resuelvan, y que un fallo de carga no deje la app en blanco.
- D.2 y D.3 traen sus propios tests de comportamiento (TDD, según `CLAUDE.md`).

### 8.3 Criterio de cierre por fase

Cada fase cierra con: `npm run lint` + `npm run typecheck` + `npm test` verdes, evidencia mostrada, y commit. Sin excepciones (`superpowers:verification-before-completion`).

---

## 9. Fuera de alcance

- **Modo claro.** Consecuencia aceptada de la decisión dark-only.
- **`friend-card`, `drink-icon`, `app-shell`** y la navegación entre pantallas que `app-shell` implicaría. Siguen en `docs/backlog.md`.
- **Pantalla de estado KYC** (🆕 en el design system, sin dueño). Se anota en backlog; no la toma este spec.
- **Rediseño estructural de las 6 pantallas ya en tokens Ayni.** Solo absorben los valores corregidos.
- **Referidos** (fase 9.1). D.3 solo deja la costura.
- **Autenticación y verificación por SMS.** Descartada en §6.2. Si el producto llega a necesitar celular verificado (KYC real, encuentros presenciales), será un proveedor de pago y una fase propia. Anotado en `docs/backlog.md`.
- **Cualquier cambio de lógica de negocio** en fases cerradas. Este trabajo es visual, más dos features nuevas acotadas.

---

## 10. Riesgos

| Riesgo | Mitigación |
|---|---|
| Corregir los tokens cambia el aspecto de 6 pantallas ya aprobadas por el usuario. | El cambio es sutil (mismo dorado, menos saturado). Decisión tomada conscientemente en §0.2.1. Revisable en el preview web antes de cerrar D.1. |
| El test anti-hex bloquea casos legítimos (gradientes, overlays con alpha). | Permitir excepción explícita y comentada. Si las excepciones proliferan, es señal de que a `theme.ts` le falta un token — que es justamente la señal que queremos recibir. |
| Cargar tres familias de fuentes pesa en Android de gama media. | Cargar solo los pesos enumerados en §2.1, no las familias completas. Medir el bundle antes/después. |
| OAuth de Google requiere configuración manual fuera del repo. | Listado en §6.4 como prerrequisito del usuario, antes de empezar D.2. D.2 no puede cerrarse verde sin eso. |
| Quitar la pestaña "Celular" reduce las opciones de ingreso a dos (Google + correo). | Es lo correcto: hoy esa pestaña ofrece un camino que **siempre falla** (§6.2). Quitarla arregla un bug visible, no reduce funcionalidad real. |
| Otras fases pudieron cerrarse ✅ con integraciones externas nunca habilitadas, igual que 1.2. | Fuera del alcance de este spec auditarlas, pero conviene revisar KYC (Truora) y pagos (Red Pontis) con el mismo criterio antes de confiar en su estado. Anotado en `docs/backlog.md`. |
| El alcance de D.1 (7 pantallas + tokens + fuentes + doc) es amplio para una sola tanda. | Las pantallas son independientes entre sí: se migran de a una, cada una con sus tests pasando, commit por pantalla. |
