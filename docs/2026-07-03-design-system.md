# Ayni — Sistema de diseño y mapa de vistas

**Fecha:** 2026-07-03 (reescrito 2026-07-25 tras la migración completa a tokens Ayni)
**Estado:** referencia viva. Actualizar cada vez que se agregue/cambie una vista o decisión visual.
**Uso:** cualquier tarea de UI (frontend-design) debe consultar este doc antes de maquetar pantallas nuevas.

Fuente de verdad visual: prototipo Lovable `csf156/good-company-peru`, concretamente `src/styles.css` (ruta absoluta desde este worktree anidado: `C:\Users\csf93\Desktop\good-company-peru\src\styles.css` — una relativa `../good-company-peru` no resuelve). Los tokens de `lib/theme.ts` son la implementación RN/Expo de esos valores.

Contexto de negocio y flujos en [`2026-07-01-modelo-negocio-design.md`](2026-07-01-modelo-negocio-design.md). Este archivo se enfoca en **qué pantallas existen**, **qué falta**, y **cómo se ven**.

---

## 1. Benchmark (apps similares)

| App | Categoría | Paleta / marca | Lección para nosotros |
|---|---|---|---|
| **Tinder** | Dating | Coral→naranja fuego, gradiente de la llama | Color cálido = pasión/urgencia. No nos sirve tal cual: no somos dating, es compañía social. |
| **Bumble** | Dating (mujer inicia) | Amarillo cálido | El amarillo comunica "seguro, cálido, sin presión" en vez del rojo/coral de Tinder — referencia directa para transmitir seguridad sin ser financiero-frío. |
| **Hinge** | Dating serio | Negro + morado | Serio/sobrio, pero morado ya está tomado en Perú por Yape (ver abajo) → evitar confusión de marca. |
| **RentAFriend.com** | Compañía (directo competidor) | Web anticuada, sin apenas experiencia mobile-first | Vara muy baja: cualquier producto pulido, mobile-first y con confianza visual (verificación, ratings) ya se diferencia fuerte. Oportunidad clara. |
| **Yape** (Perú, fintech) | Wallet/pagos P2P | Morado + acento turquesa, tipografía manuscrita, mascota "Yapito" | Rompe el código azul/gris típico de finanzas con morado + personaje amigable → prueba que en Perú "dinero" puede sentirse cercano, no corporativo. Pero el morado ya es *su* territorio: lo evitamos como color primario para no parecer un clon. |
| **Plin** (Perú, fintech) | Wallet/pagos P2P | Burbuja de chat, tipografía redondeada | Rounded + metáfora de conversación = cercanía/confianza instantánea. Buena referencia tipográfica. |
| **Airbnb / Uber / TaskRabbit** | Marketplace gig entre desconocidos (referencia más cercana a nuestro caso real que cualquier fintech) | Confianza vía **verificación de identidad + ratings bidireccionales**, no vía color | La confianza en un marketplace de desconocidos se construye con evidencia (KYC, historial, reviews), no con la paleta. Confirma que badges/ratings/candado de escrow deben ser omnipresentes en la UI — el color solo acompaña, no reemplaza esa señal. |
| **Apps de seguridad personal (Noonlight, bSafe, Companion)** | Seguridad física 1-a-1 | Interfaces minimalistas, alertas de alto contraste **solo cuando el usuario decide ser visible** | Hallazgo clave: el botón de pánico debe poder activarse **discretamente** (hold-and-release, vibración, sin gesto vistoso) — un SOS "bien visible siempre" puede delatar al usuario frente a su cita en el momento exacto en que necesita ayuda. Corrige el diseño original de esta sección (ver 4). |
| **Fintech genérico (Wealthsimple, Mint, etc.)** | Finanzas | Verde/teal | El verde-teal es el color más asociado a "dinero seguro, crecimiento, confirmación exitosa" — mejor que azul puro para no sentirse como banco tradicional. |

**Conclusión del benchmark:** el hueco de mercado es un producto que se sienta tan pulido como Bumble/Tinder (foto-forward, swipe fluido) pero con las señales de confianza de una fintech peruana (Yape/Plin) — sin copiar el morado de Yape ni el rojo/coral explícito de dating. Necesitamos **calidez social** (no somos banco) + **seguridad financiera/física** (manejamos plata y encuentros reales) al mismo tiempo.

---

## 2. Paleta de colores

App dark-only. Todos los tokens viven en `lib/theme.ts` (`export const colors`) y se derivan del HSL del `:root` de `src/styles.css` de Lovable — ver "De dónde salen estos valores" más abajo sobre la conversión.

### Tokens de color

| Token (`colors.*`) | HSL Lovable | Hex | Uso |
|---|---|---|---|
| `background` | `hsl(24 20% 6%)` | `#120F0C` | Fondo base de pantalla |
| `foreground` | `hsl(30 10% 96%)` | `#F6F5F4` | Texto principal |
| `surface` | `hsl(24 15% 10%)` | `#1D1916` | Tarjetas, superficies elevadas |
| `surface2` | `hsl(24 15% 14%)` | `#29231E` | Superficie sobre superficie (segundo nivel) |
| `card` | `hsl(24 15% 10%)` | `#1D1916` | Fondo de card (alias de `surface`) |
| `popover` | `hsl(24 15% 12%)` | `#231E1A` | Menús, popovers, bottom-sheets |
| `primary` | `hsl(38 85% 55%)` | `#EEA62B` | Marca, botones primarios, tab activo, `ring` |
| `primaryForeground` | `hsl(24 20% 6%)` | `#120F0C` | Texto/ícono sobre `primary` |
| `primaryGlow` | `hsl(38 90% 65%)` | `#F6BB55` | Glow/shimmer de marca (ej. badge Élite) |
| `secondary` | `hsl(24 15% 14%)` | `#29231E` | Botones secundarios |
| `muted` | `hsl(24 10% 20%)` | `#38322E` | Fondos apagados, skeletons |
| `mutedForeground` | `hsl(24 10% 60%)` | `#A3978F` | Texto secundario/apagado |
| `accent` | `hsl(38 60% 40%)` | `#A37629` | Acentos cálidos, bebidas, momentos sociales |
| `accentForeground` | `hsl(30 10% 96%)` | `#F6F5F4` | Texto/ícono sobre `accent` |
| `destructive` | `hsl(0 70% 55%)` | `#DD3C3C` | Relleno, borde o ícono destructivo (NO texto) |
| `destructiveForeground` | `hsl(30 10% 96%)` | `#F6F5F4` | Texto sobre `destructive` |
| `success` | `hsl(150 60% 45%)` | `#2EB873` | Pago liberado, cita confirmada, KYC verificado |
| `border` | `hsl(24 10% 20%)` | `#38322E` | Divisor decorativo entre superficies |
| `input` | `hsl(24 10% 20%)` | `#38322E` | Borde de inputs (uso decorativo) |
| `ring` | `hsl(38 85% 55%)` | `#EEA62B` | Foco/anillo de selección |
| `overlay` | — | `rgba(0, 0, 0, 0.6)` | Velo de modales/overlays (no viene de Lovable) |

**Regla de oro:** rojo (`destructive` / `destructiveText`) **solo** para pánico/error/no-show. Si el rojo se usa en todos lados pierde su función de alerta — la app tiene un botón SOS real y ese color debe seguir gritando "urgente" siempre.

### Niveles

Escala élite (bronce/plata/oro/diamante/élite), umbrales de puntos por decaimiento de actividad de 45 días:

| Nivel | Umbral | Token (`levels.*`) | Hex |
|---|---|---|---|
| 🥉 Bronce | 0 | `bronce` | `#DD7F3C` |
| 🥈 Plata | 300 | `plata` | `#B6BFC9` |
| 🥇 Oro | 1,000 | `oro` | `#F5C73D` |
| 💎 Diamante | 3,000 | `diamante` | `#80D4FF` |
| 🌟 Élite | 8,000 | `elite` | `#EEA62B` (reusa `primary`, igual que `LEVEL_META` en Lovable) |

Usar como **chips/badges**, nunca como fondo de pantalla completo — son indicadores de estatus, no la identidad de marca.

### Dos correcciones de accesibilidad

Ayni se aparta de Lovable a propósito en dos tokens, porque el valor original de Lovable no alcanza el contraste AA que exige este design system. Ambos están congelados por `tests/theme-contrast.test.ts` — si alguien "acerca" el token al valor de Lovable y eso rompe el contraste, el test falla.

| Token | Lovable (no usar) | Ayni (usar) | Motivo |
|---|---|---|---|
| `destructiveText` | `destructive` = `hsl(0 70% 55%)` / `#DD3C3C` (contraste ≈4.35:1 sobre `background`, no alcanza 4.5:1) | `hsl(0 70% 60%)` / `#E05252` (≈5.00:1 sobre `background`, ≈4.57:1 sobre `surface`) | Texto de error debe cumplir 4.5:1 para texto normal. `destructive` crudo se reserva para relleno/borde/ícono, nunca texto. |
| `borderStrong` | `border`/`input` = `hsl(24 10% 20%)` / `#38322E` (no diseñado para ser la única señal de un control) | `hsl(24 10% 38%)` / `#6B5F57` (≈3.09:1 sobre `background`) | Borde que ES la única señal visual de un control (ej. inputs sin fondo) debe cumplir el mínimo de 3:1 para elementos no-textuales. |

---

## 3. Tipografía

Tres roles tipográficos (`textStyles.*` en `lib/theme.ts`), derivados de los patrones reales de Lovable. Se exponen como estilos compuestos completos (familia + tracking + transform), no solo como familias, para que ninguna pantalla vuelva a componer `fontFamily` + `letterSpacing` + `textTransform` a mano y se desvíe en el camino.

| Rol (`textStyles.*`) | Familia (`fontFamily.*`) | Tratamiento | Uso |
|---|---|---|---|
| `display` | `PlayfairDisplay-Italic` | `letterSpacing: -0.5` | Títulos, marca, nombres de bebida/nivel — serif itálica cálida |
| `label` | `JetBrainsMono-Regular` | `textTransform: 'uppercase'`, `letterSpacing: 1.6` | Labels, badges, metadatos — mono en mayúsculas con tracking amplio |
| `body` | `Inter-Regular` | (sin tratamiento extra) | Cuerpo, UI, chat, formularios — máxima legibilidad |

Montos y contadores (wallet, cronómetro, precios) usan `tabularNums` (`fontVariant: ['tabular-nums']`) sobre la familia de `body`, para que las cifras no "bailen" de ancho al actualizarse.

Solo se cargan los pesos enumerados arriba (no la familia variable completa) por peso de bundle en Android de gama media — gran parte de usuarios en Perú usa hardware de gama media/baja. Los nombres (`PlayfairDisplay-Italic`, `JetBrainsMono-Regular`, `Inter-Regular`) son las claves exactas que `useFonts` registra en `app/_layout.tsx` y deben coincidir literalmente.

---

## Escalas: radio, espaciado y tamaños de texto

Antes de esta reescritura, ninguna de estas tres escalas estaba documentada — por eso cada pantalla inventaba sus propios números. Viven en `lib/theme.ts` (`radius`, `spacing`, `fontSize`).

### Radio (`radius.*`)

Derivado de `--radius: 0.875rem` (=14px) de Lovable y sus `calc()`.

| Token | Valor (px) | Relación |
|---|---|---|
| `sm` | 10 | `--radius - 4` |
| `md` | 12 | `--radius - 2` |
| `lg` | 14 | `--radius` (base) |
| `xl` | 18 | `--radius + 4` |
| `xxl` | 22 | `--radius + 8` |
| `xxxl` | 26 | `--radius + 12` |
| `full` | 9999 | Círculo/píldora |

### Espaciado (`spacing.*`)

Grid de 4px — solo los pasos que Lovable realmente usa.

| Token | Valor (px) |
|---|---|
| `1` | 4 |
| `2` | 8 |
| `3` | 12 |
| `4` | 16 |
| `5` | 20 |
| `6` | 24 |

### Tamaños de texto (`fontSize.*`)

Incluye los tamaños chicos que Lovable usa para labels mono.

| Token | Valor (px) |
|---|---|
| `micro` | 9 |
| `tiny` | 10 |
| `caption` | 11 |
| `small` | 12 |
| `body` | 14 |
| `bodyLg` | 16 |
| `title` | 18 |
| `titleLg` | 20 |
| `heading` | 24 |
| `display` | 30 |
| `displayLg` | 36 |

### De dónde salen estos valores

Los hex de `colors` se obtienen convirtiendo el HSL del `:root` de `src/styles.css` de Lovable (`C:\Users\csf93\Desktop\good-company-peru\src\styles.css`) a hex. `tests/theme.test.ts` rederiva cada valor con la misma fórmula HSL→hex y falla si alguien edita un hex a mano en `lib/theme.ts` — por eso **los valores no se editan a mano**: si Lovable cambia su `:root`, se actualiza el HSL de origen y se deja que el test regenere/valide el hex.

---

## 4. Otras consideraciones de diseño

- **Iconografía:** set consistente y redondeado (Phosphor Icons o Lucide, variante "rounded"/"duotone") — nunca mezclar sets. Iconos de estado del bar (`disponible` = copa llena, `bloqueada` = candado, `consumida` = check) siempre con **texto + icono**, nunca solo color (accesibilidad, daltonismo).
- **Fotografía / imágenes:** discovery foto-forward tipo Bumble (una card grande, mínimo chrome), pero fotos con overlay sutil (gradiente inferior) para legibilidad del nombre/edad/badge sin tapar la foto — evitar la estética anticuada tipo directorio (lección de RentAFriend.com).
- **Insignias de confianza persistentes:** badge de verificado (check en `colors.primary` sobre la foto), rating (estrella + número), y candado de escrow junto al precio de cualquier bebida/invitación — la confianza no es una pantalla, es un elemento que viaja con el usuario y con el dinero en toda la UI.
- **Microinteracciones de verificación:** al escanear el QR y validar geofence, usar una animación breve y clara (pulso dorado `colors.primary` → check `colors.success`) — refuerza que "la verificación es real y ocurrió", momento crítico de confianza en persona.
- **Botón SOS:** disponible durante `en_curso`, pero con **dos modos de activación**, no solo uno vistoso: (1) discreto — hold-and-release o gesto (ej. mantener presionado 3s) sin texto/color alarmante en pantalla, para no delatar al usuario frente a su cita si el riesgo requiere disimulo; (2) visible — acceso directo desde el Centro de seguridad para quien prefiere el botón claro y grande (útil también para el segmento de usuarios mayores/menos digitales). No usar alto contraste rojo permanente en la pantalla de cita — reservarlo para el instante posterior a la activación (confirmación de que la alerta se envió).
- **Accesibilidad:** contraste mínimo AA (4.5:1 texto normal), soporte a Dynamic Type/escala de fuente del sistema, targets táctiles ≥44×44dp, nunca comunicar estado solo por color.
- **Tono de copy:** "tú" informal, cálido, en español de Perú neutro (nada de "usted" corporativo bancario ni jerga que suene a dating explícito — coherente con el posicionamiento "compañía social" del ToS).
- **Rendimiento:** animaciones ligeras (Reanimated, evitar Lottie pesado), imágenes comprimidas/responsive — buena parte del público objetivo está en gama media/baja y datos móviles limitados.
- **Espacios vacíos y errores:** ilustraciones simples y amigables (no genéricas de stock), tono ligero — nunca alarmista salvo en pantallas de seguridad (SOS, disputa, no-show) donde el tono cambia a serio/directo.

---

## 5. Mapa de vistas

Vistas ya contempladas en el doc de negocio (Sección F) se listan con ✅. Vistas nuevas propuestas van con 🆕 y una razón.

### 5.1 Onboarding y cuenta (compartidas)

- ✅ Selección de rol (amigo / rentador) en primer login
- ✅ Sign-in / Verify OTP
- 🆕 **Carrusel "Cómo funciona"** (3–4 slides antes del registro): explica bebidas→escrow→QR→pago. Necesario porque el concepto es inusual — sin esto el usuario no entiende por qué "compra una bebida" en vez de "pagar directo", y el ToS anti-contenido-sexual debe quedar claro desde el inicio para fijar expectativas correctas.
- ✅ Alta de perfil (amigo/rentador) — campos + foto
- ✅ Captura DNI + selfie liveness (KYC)
- 🆕 **Pantalla de estado KYC** (`pendiente` en revisión / `rechazado` con motivo y reintento) — el doc de negocio define los 3 estados pero no la vista; sin ella el usuario queda "colgado" sin saber qué pasa tras subir su DNI.
- 🆕 **Aceptación de ToS/community guidelines** explícita (checkbox + resumen de reglas anti-fuga y anti-contenido-sexual) dentro del onboarding, no solo enterrado en texto legal.
- ✅ Ver/editar perfil propio
- ✅ Ver perfil público de otro (sin datos sensibles)
- 🆕 **Detalle de insignia de verificación** (modal/bottom-sheet al tocar el badge): qué se verificó (DNI+RENIEC+selfie), fecha, nivel, rating — la confianza debe ser explicable, no solo un ícono.

### 5.2 Panel del Amigo en renta

- ✅ Invitaciones recibidas pendientes
- ✅ Historial de invitaciones
- ✅ Progreso de nivel (con decaimiento 45d)
- ✅ Publicar solicitud de invitación (específica/global)
- ✅ Ver interesados en solicitudes globales
- ✅ Balance + liquidación (lunes gratis / on-demand premium)
- ✅ Bar recibido / historial de bebidas cobradas
- ✅ Estado KYC, ratings recibidos, seguridad (SOS, guardián)
- 🆕 **"Mis ganancias" con desglose** (por período, por tipo de bebida, fee retenido, neto) — el balance existe pero un desglose tipo mini-dashboard ayuda a entender de dónde viene la plata (transparencia = confianza, y reduce tickets de soporte "¿por qué recibí menos?").
- 🆕 **Disponibilidad / calendario** ("estoy disponible hoy 7pm–11pm, zona X") — hoy solo existe "recibir invitaciones", pero el amigo no tiene forma de comunicar cuándo quiere ser encontrado. Reduce invitaciones fallidas y mejora el match del descubrimiento.
- 🆕 **Favoritos / rentadores guardados** — para el amigo que quiere repetir con un rentador de confianza sin tener que re-buscarlo en el swipe.

### 5.3 Panel del Rentador

- ✅ Invitaciones realizadas pendientes
- ✅ Historial de invitaciones
- ✅ Progreso de nivel (con decaimiento 45d)
- ✅ Tienda (comprar bebidas)
- ✅ Bar (stock disponible)
- ✅ Publicar invitación global/abierta (premium)
- ✅ Ver interesados en invitaciones globales
- ✅ Ratings recibidos, seguridad (SOS, guardián)
- 🆕 **"Mi agenda"** — vista calendario de citas confirmadas próximas (hoy solo hay listas planas de invitaciones; con varias citas en curso de negociación, un calendario evita choques de horario).
- 🆕 **Recibo/desglose de compra** por bebida (V + buyer fee + procesamiento = total, con historial descargable) — útil para quien gasta con frecuencia y quiere control de gasto propio.
- 🆕 **Favoritos / amigos guardados** (simétrico al de arriba).

### 5.4 Descubrimiento y match (compartida)

- ✅ Swipe tipo Bumble (perfil a la vez)
- ✅ Filtros premium (preferencias de salida)
- 🆕 **Explorar invitaciones/solicitudes globales en formato lista/mapa** (no solo swipe 1-a-1) — el swipe es para descubrir personas nuevas, pero las invitaciones/solicitudes *globales* son ofertas concretas con zona/tiempo/bebida; una vista tipo lista con filtros (zona, tipo de bebida, franja horaria) sirve mejor para "quiero salir ya" que un swipe secuencial.

### 5.5 Invitación → chat → cita (compartida)

- ✅ Crear invitación/solicitud (bebida, tiempo, zona)
- ✅ Aceptar/rechazar
- ✅ Chat realtime
- ✅ Confirmar cita (resumen: bebida, V, tiempo, zona, hora)
- 🆕 **Pantalla de resumen pre-cita ("Antes de salir")** — checklist ligera: zona pública sugerida, compartir con contacto guardián, recordatorio de reglas de seguridad. Convierte las reglas de la Sección D del doc de negocio (nudge a lugares públicos, contacto guardián) en un paso de producto real, no solo una política.

### 5.6 Motor de cita (compartida)

- 🆕 **Pantalla "Mi QR" / "Escanear"** (no estaba explícita) — cada lado necesita una vista para mostrar su QR rotativo y otra (o modo cámara integrado) para escanear el del otro, con estado de geofence en vivo ("buscando al otro dispositivo… ✅ dentro de rango").
- ✅ Cronómetro en curso (tiempo restante en vivo)
- ✅ Extensión de cita (aceptar/rechazar bebida adicional)
- 🆕 **Resumen post-cita / rating mutuo** — el doc de negocio menciona "ratings bidireccionales" en general (Sección D) pero no como paso obligatorio post-cita; proponerlo como pantalla que aparece automáticamente al finalizar (`finalizada`) para maximizar tasa de rating (insumo clave de confianza para todo el sistema).
- 🆕 **Vista "modo espectador" para el contacto guardián** (link/página ligera, sin necesidad de cuenta) que muestra en vivo: estado de la cita, ubicación aproximada, hora de inicio/fin — hace tangible la "costura" de seguridad ya prevista en el diseño de negocio (Sección D.2, "contacto de confianza").

### 5.7 Seguridad y soporte (compartida)

- 🆕 **Centro de seguridad** (hub único): botón SOS, contacto guardián, tips de citas seguras, cómo reportar/bloquear, explicación de KYC — hoy estas piezas están dispersas dentro de cada panel; agruparlas en un solo lugar de fácil acceso (ícono persistente) refuerza la marca de "esto es serio y está resuelto", en línea con el diferencial frente a RentAFriend.com.
- 🆕 **Pantalla de reporte/disputa** — el enum `disputa` existe en el modelo de citas pero no hay UI descrita; necesaria para que un usuario pueda iniciar una disputa antes de que `cita-liquidar` libere el pago automáticamente.
- ✅ (implícito) Bloqueo de usuario — formalizar como pantalla/flujo, no solo backend.

### 5.8 Dinero y suscripción (compartida)

- 🆕 **Ledger/historial de movimientos** (vista simple del `ledger` filtrada por el usuario) — más granular que "balance": compras, fees, escrow, payouts, refunds en una lista tipo estado de cuenta. Da soporte visual a la transparencia que ya es requisito técnico (ledger append-only).
- 🆕 **Paywall/comparativa Gratis vs Premium** — pantalla dedicada que traduce la tabla de la Sección C del doc de negocio a un comparador visual simple (no una tabla técnica), con CTA a suscribirse vía IAP.

### 5.9 Notificaciones (compartida)

- 🆕 **Centro de notificaciones in-app** (histórico de push: invitación recibida, cronómetro, verificación, nivel subido, etc.) — los push nativos son efímeros; sin un centro in-app se pierden si el usuario no reacciona al momento.

---

## 6. Checklist rápido para nuevas vistas

Antes de maquetar cualquier pantalla nueva, verificar:

1. ¿Usa los tokens de color de la Sección 2 (nunca hex sueltos)?
2. ¿El rojo se reserva solo para SOS/error/no-show?
3. ¿Los estados (bebida, cita, KYC) se comunican con icono + texto, no solo color?
4. ¿Todos los colores salen de `lib/theme.ts`, sin literales? (lo verifica `tests/design-system-guard.test.ts`)
5. ¿Los montos usan tipografía tabular?
6. ¿Si toca dinero, escrow o verificación, muestra la señal de confianza correspondiente (candado, badge, rating)?
