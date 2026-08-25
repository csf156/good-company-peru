# Fase D.3 — Onboarding paso a paso — diseño (2026-08-25)

**Qué es esto:** el diseño de la fase que reescribe el alta de perfil y la captura de KYC como flujos paso a paso, con sensación premium. Nace de que el usuario recorrió el flujo real por primera vez tras habilitar el login con Google (D.2) y encontró que el formulario de perfil es una sola pantalla con seis campos de texto libre.

**Este documento NO es un plan de implementación.** El plan tarea-por-tarea va en `docs/superpowers/plans/`.

**Ocupa el slot D.3.** El spec del design system (`2026-07-24-design-system-lovable-design.md` §7) reservaba D.3 para "onboarding: carrusel Cómo funciona + ToS + costura de referidos". Ese contenido **se mueve a D.4** — sigue pendiente, sin fecha, y no bloquea nada.

---

## 0. Contexto

### 0.1 Qué existe hoy

**`app/(auth)/profile-setup.tsx`** (214 líneas): una sola pantalla con seis campos, todos `TextInput` de texto libre — nombre, alias, **edad** (numérico), **género** (texto libre), **profesión** (texto libre), **hobbies** e **intereses** (texto libre "separados por coma"), más la foto. Todo o nada: se llena entero o no se envía.

**`app/(auth)/kyc.tsx`** (120 líneas): una sola pantalla con dos botones — "Escanear DNI" y "Tomar selfie" — que llaman a `ImagePicker.launchCameraAsync({ quality: 0.8 })` sin especificar qué cámara, suben a storage, y un tercer botón dispara la verificación.

**La verificación automática ya existe y no hay que construirla.** `decideKycProvider` (`supabase/functions/_shared/kyc.ts:23`) devuelve `'demo'` mientras no estén `KYC_PROVIDER=truora` **y** `TRUORA_API_KEY`; en modo demo, `runDemoVerification()` marca `kyc_estado='verificado'` de inmediato. La costura para Truora real ya está puesta y guardada por entorno. **Esta fase no toca esa lógica** — solo la UI que la invoca.

**No hay ninguna librería de iconos en el repo.** Cero. `package.json` no trae `@expo/vector-icons` ni equivalente, y ninguna pantalla usa iconos.

### 0.2 Decisiones tomadas con el usuario (2026-08-25)

1. **Sensación premium en todo momento.** Los iconos deben ser de línea, minimalistas y estilizados. **Emoji quedan prohibidos** — cada emoji trae su propia paleta y rompe el dorado/oscuro de Ayni.
2. **Fecha de nacimiento en vez de edad**, capturada con un selector de fecha, no escrita a mano.
3. **Género: lista corta + campo abierto.** Mujer / Hombre / No binario / Prefiero no decirlo / Otro (texto). Cubre cualquier identidad sin enumerar una taxonomía.
4. **Profesión sale del formulario.**
5. **Hobbies:** pantalla de sugeridos con iconos, 17 opciones, **máximo 5**, con "Otro" para agregar por texto separado por comas.
6. **"Intereses" cambia de significado: ahora es el tipo de salida que la persona busca**, con framing "por plan" (qué se hace), **máximo 2**, y **sin opción "Otro"**.
7. **"Salidas románticas" queda fuera**, decisión explícita del usuario tras plantearle el riesgo (ver §7).
8. **KYC en pantallas separadas:** primero cámara trasera para el DNI, después cámara frontal para la selfie. Sin verificación real — sigue el modo demo ya existente.

---

## 1. Wizard de perfil

`profile-setup.tsx` deja de ser una pantalla y pasa a ser un flujo de **seis pasos**, uno por pantalla:

| Paso | Contenido | Validación |
|---|---|---|
| 1 | Nombre y alias | Ambos no vacíos |
| 2 | Fecha de nacimiento | Debe existir y dar ≥18 años |
| 3 | Género | Una opción; si es "Otro", texto no vacío |
| 4 | Foto | Obligatoria (igual que hoy) |
| 5 | Hobbies | 1 a 5 seleccionados |
| 6 | Tipo de salida | 1 o 2 seleccionados |

**Reglas del wizard:**

- Indicador de progreso visible (paso N de 6), con la tipografía mono de labels del design system.
- Botón de retroceso en todos los pasos menos el primero. Los datos ya ingresados sobreviven al ir y volver.
- **El estado vive en memoria durante el flujo y se persiste una sola vez, al final.** No se escriben perfiles a medias. Si el usuario abandona, no queda basura en la tabla — y `route-guard` lo devuelve al paso 1 en la siguiente sesión, que es el comportamiento correcto hoy.
- El botón de avance se deshabilita mientras el paso no valide, con el motivo visible en texto — nunca solo un botón gris sin explicación.

### 1.1 Selector de fecha de nacimiento

**Sin dependencia nueva.** `@react-native-community/datetimepicker` (el estándar de Expo) **no funciona en web**, y el web es la superficie donde el usuario prueba. Se construye un selector propio de **día / mes / año** con primitivas de React Native.

Además de resolver el problema de plataforma, es mejor UX para este caso: un calendario obliga a retroceder ~30 años mes a mes; tres listas no.

**Corrección a una afirmación previa:** al ordenar el tramo se dijo que este picker "amortizaría" la fase 4.8 (la que corrige la hora de la cita). Solo en parte — 4.8 necesita fecha **y hora** para un instante futuro cercano, que es un widget distinto. 4.8 conserva ese trabajo.

### 1.2 Hobbies — 17 opciones, máximo 5

Fútbol · Vóley · Bicicleta · Gimnasio · Correr · Bailar · Cocinar · Fotografía · Videojuegos · Senderismo · Surf · Yoga · Tocar música · Pintar · Leer · Cine · Viajar

Más **"Otro"**, que abre un campo de texto donde se agregan valores separados por comas. Los valores libres cuentan para el máximo de 5.

### 1.3 Tipo de salida — 10 opciones, máximo 2, sin "Otro"

Conversar / café · Salir a comer · Vida nocturna · Conciertos y eventos · Cine y cultura · Deporte o aire libre · Turistear la ciudad · Acompañamiento a evento · Estudiar o trabajar juntos · Sin plan fijo

**Sin campo abierto, deliberadamente.** Con un conjunto cerrado, la fase 2.0 (Preferencias + filtros) puede filtrar por estos valores sin normalizar texto libre. Y evita que la vía de escape se use para declarar tipos de salida que el producto no ofrece (§7).

---

## 2. Esquema de datos

Los cambios tocan `public.profiles`, una tabla de fase cerrada (1.1) con RLS y grants por columna. **El usuario revisa el SQL antes de aplicar** (regla del proyecto).

### 2.1 `edad` → `fecha_nacimiento`

- **Se agrega** `fecha_nacimiento date` a `profiles`.
- **Se elimina** la columna `edad integer check (edad >= 18)`.
- **La edad pasa a calcularse en la vista** `perfiles_publicos`, no a guardarse.

**Por qué en la vista y no como columna generada:** una columna generada en Postgres debe ser `IMMUTABLE`, y calcular edad depende de la fecha de hoy. Guardar `edad` como número suelto la deja envejecer mal — el perfil diría 24 para siempre. Calculándola en la vista, siempre es correcta al leerla.

**Beneficio de privacidad, no buscado pero real:** la fecha de nacimiento es dato sensible y queda **solo en la tabla base**, que `profiles_select_own` restringe a la propia fila. Los demás usuarios siguen viendo únicamente la edad derivada.

**El check de 18+ se reescribe** como restricción sobre `fecha_nacimiento`, y se valida también en cliente antes de enviar.

**`fecha_nacimiento` necesita grants explícitos por columna**, no solo RLS — es la lección que dejó el endurecimiento de la fase 1.1 y aplica igual aquí.

### 2.2 `intereses` → `tipo_salida`

La columna `intereses text[]` cambia de significado por completo: ya no son temas de conversación sino el tipo de salida buscado. **Se renombra a `tipo_salida`.**

Dejarla llamándose `intereses` con contenido de otra cosa garantiza que alguien la malinterprete en la fase 2.0. El proyecto prohíbe refactorizar fases cerradas *salvo que la fase actual lo exija* — y aquí lo exige: el campo cambia de semántica, no de presentación.

El radio de impacto es el mismo que ya se paga por §2.1 (vista pública + grants), así que no agrega riesgo nuevo.

### 2.3 `profesion` queda muerta, no se borra

Sale del formulario, **pero la columna y su entrada en `perfiles_publicos` se conservan**. Borrarla obligaría a tocar la vista y los grants por una ganancia nula, y es irreversible si el usuario cambia de opinión. Queda como columna sin escritores.

**Detalle crítico que esto arrastra:** `lib/profile-complete.ts:18` lista `profesion` entre los `REQUIRED_FIELDS`. Si el formulario deja de pedirla sin sacarla de esa lista, **`route-guard` considerará todo perfil incompleto para siempre y devolverá al usuario al wizard en bucle**. Sacarla de `REQUIRED_FIELDS` es parte obligatoria de esta fase, no un detalle de limpieza.

### 2.4 Radio de impacto completo

| Archivo | Qué cambia |
|---|---|
| `supabase/migrations/` | Migración nueva: `fecha_nacimiento`, baja de `edad`, rename de `intereses`, check 18+ |
| `perfiles_publicos` (vista) | `edad` pasa a expresión calculada; `intereses` → `tipo_salida` |
| Grants por columna | `fecha_nacimiento` explícito; ajuste por el rename |
| `lib/profile.ts` | `PROFILE_SELECT` y los tipos |
| `lib/profile-complete.ts` | `REQUIRED_FIELDS`: sale `profesion`, `edad` → `fecha_nacimiento` |
| `lib/validation.ts` | `isValidEdad` → validación sobre fecha de nacimiento |
| `app/profile.tsx` | Editar perfil propio: mismos campos nuevos |
| `app/profile/[id].tsx`, `app/index.tsx` | Muestran `edad` de la vista — siguen funcionando, verificar |
| pgTAP `01`, `04`, `06` | RLS, grants por columna y vista pública |

---

## 3. Iconografía

**Se agrega `@expo/vector-icons`** (oficial de Expo, hoy ausente). Se usan las **variantes outline de MaterialCommunityIcons**: `bike`, `volleyball`, `surfing`, `hiking`, `yoga`, `guitar-acoustic`, `chef-hat` y equivalentes existen ahí, y no en sets más pequeños.

**Se evaluó y descartó Feather** — es el set más minimal, pero sus ~280 iconos genéricos no cubren vóley, surf, senderismo ni bicicleta.

**Reglas de uso:**
- Monocromos, del color del texto o del dorado de acento. Nunca multicolor.
- Un solo tamaño por contexto y un solo grosor de trazo. Lo que hace que un set se lea como propio y no como clipart es la uniformidad.
- **Siempre icono + texto**, nunca icono solo — regla de accesibilidad ya vigente en el proyecto.

**Esta dependencia sirve más allá de esta fase:** la tab bar de 4.7a la necesita, y la regla "estados con icono + texto" hoy es imposible de cumplir sin ella.

**Alternativa descartada por costo:** dibujar ~30 SVG a medida con `react-native-svg`. Control total y el resultado más premium posible, pero es trabajo de diseño real. Si al ver los iconos en pantalla el resultado no convence, se reabre — anotado en `docs/backlog.md`, no en esta fase.

---

## 4. KYC en dos pantallas

El flujo pasa de una pantalla con dos botones a una secuencia:

| Pantalla | Contenido |
|---|---|
| 1 — Intro | Qué se va a pedir y por qué. Botón para empezar |
| 2 — DNI | **Cámara trasera**, guía de encuadre del documento, captura y subida |
| 3 — Selfie | **Cámara frontal**, captura y subida |
| 4 — Resultado | Verificación (modo demo → `verificado`) y salida al home |

**Sin dependencia nueva.** `expo-image-picker` 57.0.2 ya expone la opción `cameraType` (`CameraType.back` / `CameraType.front`), verificado en `node_modules`. No hace falta `expo-camera`.

**La lógica de verificación no se toca.** `startKycVerification` y la Edge Function `kyc-start` quedan igual; en modo demo devuelven `verificado` al instante, que es exactamente lo que el usuario pidió. Cuando se configure `KYC_PROVIDER=truora` + `TRUORA_API_KEY`, el mismo código pasa a verificación real sin cambios de UI.

**Lo que la UI debe dejar claro al usuario:** en modo demo la verificación es instantánea. La pantalla de resultado no debe simular un proceso de revisión que no existe — decir "verificado" cuando el modo demo verifica, sin animaciones de falso análisis.

---

## 5. Testing

Cada paso del wizard es una unidad testeable. Los tests que esta fase debe traer:

- **Validación por paso:** no se avanza con el paso inválido, y el motivo es visible.
- **Ida y vuelta:** retroceder y volver a avanzar conserva lo ingresado.
- **18+:** una fecha de nacimiento de hace 17 años y 11 meses es rechazada; una de hace exactamente 18 años es aceptada. Cliente **y** base de datos (pgTAP).
- **Límites de selección:** 6º hobby rechazado, 3ª opción de tipo de salida rechazada.
- **"Otro" de hobbies:** el texto separado por comas se parsea y cuenta contra el máximo de 5.
- **`REQUIRED_FIELDS` sin `profesion`:** un perfil sin profesión se considera completo y `route-guard` no lo devuelve al wizard. **Este test es el que impide el bucle de §2.3.**
- **pgTAP:** grants por columna de `fecha_nacimiento`, la vista pública expone `edad` calculada y no la fecha, el rename de `tipo_salida` no rompió el aislamiento.
- **KYC:** la pantalla de DNI pide cámara trasera y la de selfie cámara frontal.

---

## 6. Fuera de alcance

- **Verificación real de identidad.** Truora sigue desconectado; el modo demo ya existe y no se toca.
- **Carrusel "Cómo funciona", aceptación de ToS y costura de referidos** — es D.4 (lo que el spec de design system llamaba D.3).
- **Pantalla de estado KYC** (`pendiente` en revisión / `rechazado` con motivo y reintento). Sigue sin dueño en `docs/backlog.md`. En modo demo nunca se alcanzan esos estados.
- **Filtros por género o tipo de salida.** Es la fase 2.0. Esta fase solo deja los datos limpios para que aquella los use.
- **Borrar la columna `profesion`.**
- **Iconos SVG a medida.**
- **Rediseño de las demás pantallas.** Solo se tocan las que el cambio de esquema obliga.

---

## 7. La decisión sobre "salidas románticas"

El usuario propuso inicialmente incluir "románticas" entre los tipos de salida y, tras plantearle el riesgo, **decidió dejarla fuera**. Queda registrado el porqué, para que no se re-litigue por olvido:

`CLAUDE.md` fija el posicionamiento como **compañía social, sin contenido sexual**, y lo justifica como **requisito para mantener las pasarelas de pago**. "Salidas románticas" no es contenido sexual, pero es la categoría que corre la lectura del producto de "compañía" a "citas pagadas" — que es precisamente el encuadre por el que un procesador cierra una cuenta. El riesgo es operativo antes que reputacional: sin pasarela, no hay negocio.

Interactúa además con lo ya construido: el detector anti-fuga del chat y la moderación (fase 4.4) se diseñaron sobre el supuesto de compañía social. Una categoría romántica cambiaría qué mensajes son esperables y qué debería levantar una alerta.

La decisión de **no incluir "Otro"** en tipo de salida (§1.3) es consecuencia directa: un campo abierto reintroduce por la puerta de atrás exactamente lo que la lista deja fuera, y sin control.

---

## 8. Riesgos

| Riesgo | Mitigación |
|---|---|
| Sacar `profesion` del formulario sin sacarla de `REQUIRED_FIELDS` deja a todo usuario en un bucle hacia el wizard. | Test explícito (§5). Es el riesgo más probable de esta fase porque el fallo aparece lejos del cambio. |
| Tocar `profiles` toca RLS, grants por columna y la vista pública de una fase cerrada. | Migración versionada, revisada por el usuario antes de aplicar, con pgTAP de aislamiento actualizado. Nunca por SQL editor suelto. |
| El selector día/mes/año propio se ve peor que un picker nativo. | Es el precio de que funcione en web, donde el usuario prueba. Si el resultado no convence en nativo, se puede añadir un picker nativo por plataforma después — la validación de 18+ no cambia. |
| Los iconos de MaterialCommunityIcons no dan la sensación premium buscada. | Se ve en pantalla antes de cerrar la fase. Si no convence, la alternativa (SVG a medida) queda anotada en backlog, no se improvisa dentro de la fase. |
| Seis pantallas de alta se sienten largas y aumentan el abandono. | Es lo que el usuario pidió explícitamente tras recorrer el formulario de una sola pantalla. Medir abandono no es posible hoy (sin analítica) — se revisa cuando haya usuarios reales. |
| El rename `intereses` → `tipo_salida` rompe algo que lo lea y no esté en la tabla de §2.4. | La tabla salió de un `grep` sobre `lib/`, `app/`, `supabase/functions/` y `tests/`, no de memoria. El typecheck cierra el resto. |

---

## 9. Criterio de cierre

1. `npm run lint` + `npm run typecheck` + `npm test` + `npm run test:db` verdes, **con la salida mostrada** (`superpowers:verification-before-completion`).
2. El usuario recorre el alta completa en el preview web y la aprueba visualmente — esta fase es de UI y su criterio final es que se vea premium, algo que ningún test verifica.
3. Entrada en `docs/ESTADO.md`, fase marcada ✅ en la tabla, `FASE ACTUAL` actualizada en `CLAUDE.md`.
4. Commit con Conventional Commits. Sin push salvo que el usuario lo pida.

Por tocar esquema con RLS y grants, la fase cierra además con `security-review`.
