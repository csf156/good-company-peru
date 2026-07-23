# Ayni — Sistema de diseño y mapa de vistas

**Fecha:** 2026-07-03 (alineado 2026-07-21)
**Estado:** referencia viva. Actualizar cada vez que se agregue/cambie una vista o decisión visual.
**Uso:** cualquier tarea de UI (frontend-design) debe consultar este doc antes de maquetar pantallas nuevas.

> ⚠️ **Fuente de verdad visual = prototipo Lovable `csf156/good-company-peru`** (decisión 2026-07-21: portar su diseño a RN/Expo). La identidad real de Ayni es **cálida (dorado/bronce, superficies oscuras, títulos serif italic, labels mono)**. La paleta teal/coral de la Sección 2 de este doc es una **propuesta PRE-Lovable superada** — se conserva por su racional (benchmark, reglas semánticas), pero los **valores de color reales se toman de `src/styles.css` de Lovable**. Reconciliar antes de usar.

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

### Primario — Teal profundo
```
--color-primary        #0E6E66   (teal profundo — marca, headers, botones primarios, tab activo)
--color-primary-dark   #0A4F49   (pressed states, texto sobre fondos claros)
--color-primary-light  #DCF2EF   (fondos suaves, chips, estados seleccionados)
```
**Por qué:** teal combina la confianza del azul financiero con el crecimiento/seguridad del verde (ver benchmark fintech). Es distintivo frente a Yape (morado), Plin (turquesa más claro/secundario), Tinder (coral) y Bumble (amarillo) — nadie más en el set de referencia lo usa como color dominante.

### Acento cálido — Coral/terracota
```
--color-accent         #FF7A5C   (CTA secundarios, "Invitar", bebidas, momentos sociales/festivos)
--color-accent-dark    #E85F41
--color-accent-light   #FFE4DC
```
**Por qué:** aporta la calidez social (el "trago", la invitación, el encuentro) sin caer en el rojo/rosa explícitamente romántico — mantiene el tono "compañía social", no "dating/sexual" (alineado al ToS de la Sección D del doc de negocio).

### Semánticos (uso estricto, no decorativo)
```
--color-success        #2FA84F   (pago liberado, cita confirmada, KYC verificado)
--color-warning        #E8A93B   (pendiente, tiempo por vencer, cronómetro <15min)
--color-danger         #E23D3D   (SOS/pánico, no-show, disputa, rechazo) — reservado, no decorativo
--color-info           #3B82C4   (notificaciones informativas, tips)
```
**Regla de oro:** rojo **solo** para pánico/error/no-show. Si el rojo se usa en todos lados pierde su función de alerta — la app tiene un botón SOS real y ese color debe seguir gritando "urgente" siempre.

### Niveles (escala élite — act. 2026-07-21; tomar valores finales de Lovable `--bronze/--silver/--gold/--diamond/--primary`)
```
🥉 Bronce (0–299)   🥈 Plata (300–999)   🥇 Oro (1,000–2,999)   💎 Diamante (3,000–7,999)   🌟 Élite (8,000+)
```
Metáfora metálica, con Élite como badge dorado animado (shimmer). Usar como **chips/badges**, nunca como fondo de pantalla completo — son indicadores de estatus, no la identidad de marca. (Reemplaza la escala vieja bronce/plata/oro/platino/diamante.)

### Neutros
```
--color-bg             #FAF7F2   (fondo cálido, no blanco puro — más cercano, menos "clínico")
--color-surface        #FFFFFF
--color-text           #1F2523
--color-text-muted     #6B7570
--color-border         #E7E2D9
```
Fondo ligeramente cálido (no `#FFFFFF` plano) para evitar la sensación fría de app bancaria — coherente con "compañía social".

### Modo oscuro
Requerido desde el día 1: buena parte del uso ocurre de noche (citas nocturnas, chat antes/durante la salida). Definir `--color-bg-dark: #12181A`, `--color-surface-dark: #1B2224`, manteniendo el mismo teal/coral con luminosidad ajustada (`--color-primary` sube a `#3FA79D` en dark para mantener contraste AA).

---

## 3. Tipografía

| Uso | Fuente propuesta | Motivo |
|---|---|---|
| Encabezados / marca / nombres de bebida / nivel | **Sora** o **Nunito Sans** (peso 600–700) | Geométrica con esquinas suavizadas — moderna sin ser fría, transmite cercanía (misma lógica que la tipografía redondeada de Plin) sin recurrir a manuscrita (evita colisión directa con Yape). |
| Cuerpo / UI / chat / formularios | **Inter** o **Manrope** | Máxima legibilidad en pantallas chicas, soporte completo de tildes/ñ, números tabulares (crítico para montos en soles — evita que "S/ 120.00" salte al actualizarse). |
| Montos y contadores (wallet, cronómetro, precios) | Misma familia de cuerpo, variante **tabular-nums**, peso 600 | Los números de dinero y el cronómetro de cita no deben "bailar" de ancho — usar `font-variant-numeric: tabular-nums`. |

Ambas (Sora/Nunito + Inter/Manrope) son variable fonts gratuitas de Google Fonts, cargables vía `expo-font`, con buen soporte RN/Expo y peso de archivo razonable para gama media/baja (importante: gran parte de usuarios en Perú usa Android de gama media).

Escala tipográfica sugerida (mobile): 12 / 14 / 16 (base) / 20 / 24 / 32.

---

## 4. Otras consideraciones de diseño

- **Iconografía:** set consistente y redondeado (Phosphor Icons o Lucide, variante "rounded"/"duotone") — nunca mezclar sets. Iconos de estado del bar (`disponible` = copa llena, `bloqueada` = candado, `consumida` = check) siempre con **texto + icono**, nunca solo color (accesibilidad, daltonismo).
- **Fotografía / imágenes:** discovery foto-forward tipo Bumble (una card grande, mínimo chrome), pero fotos con overlay sutil (gradiente inferior) para legibilidad del nombre/edad/badge sin tapar la foto — evitar la estética anticuada tipo directorio (lección de RentAFriend.com).
- **Insignias de confianza persistentes:** badge de verificado (check teal sobre la foto), rating (estrella + número), y candado de escrow junto al precio de cualquier bebida/invitación — la confianza no es una pantalla, es un elemento que viaja con el usuario y con el dinero en toda la UI.
- **Microinteracciones de verificación:** al escanear el QR y validar geofence, usar una animación breve y clara (pulso teal → check verde) — refuerza que "la verificación es real y ocurrió", momento crítico de confianza en persona.
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
4. ¿Soporta modo oscuro?
5. ¿Los montos usan tipografía tabular?
6. ¿Si toca dinero, escrow o verificación, muestra la señal de confianza correspondiente (candado, badge, rating)?
