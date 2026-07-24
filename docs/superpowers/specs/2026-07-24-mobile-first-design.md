# Mobile-first hygiene — diseño

**Fecha:** 2026-07-24
**Origen:** pedido cross-cutting del usuario — "asegurar que toda la app tenga el principio regente MOBILE FIRST". Autorizado explícitamente por el usuario (cruza fases ya cerradas 1.x–4.5; excepción a la disciplina fase-por-fase de `CLAUDE.md`).
**Skills:** `superpowers:brainstorming` (este spec) → `test-driven-development` (implementación) → `frontend-design` (identidad visual objetivo).

## Alcance (decidido con el usuario)

- **Entregable:** auditoría **+ arreglos** (no solo reporte).
- **Criterios mobile-first:** los 4 del design-system (`CLAUDE.md`): safe-area + scroll/teclado; targets ≥44dp; sin overflow + montos/cronómetro tabulares; dark-mode + a11y (icono+texto, contraste AA).
- **Restricción del usuario:** **mantener las pantallas 1.x en paleta clara.** NO voltear a dark. Se respeta la paleta actual de cada pantalla; el "split de paleta" (1.x claro con `colors.light`, 3.x/4.x oscuro con `ayni`) se deja como está. Se agrega solo la higiene mobile-first que falte, sin cambiar colores.

## Auditoría (estado actual)

| Criterio | Estado |
|---|---|
| Safe-area | ❌ Ninguna pantalla usa SafeAreaView/insets. |
| Teclado | ⚠ `sign-in`/`verify-otp`/`select-role`/`profile-setup`/`profile`(edit) tienen inputs sin scroll ni KeyboardAvoiding. `chat/[id]` ✓. |
| Targets ≥44dp | ⚠ `store` "Comprar", `bar` "Invitar", tabs de `sign-in`, "Enviar" del chat < 44dp. `Button` ✓, navButtons de discover ✓. |
| Tabular | ⚠ Montos en `store`/`wallet`/`bar` sin `fontVariant: ['tabular-nums']`. `chat` resumen ✓. |
| Overflow | ✅ Mayormente ok (flex + ScrollView). |
| Dark-mode | ⚠ Split de paleta — **se deja intencionalmente** por decisión del usuario. |

## Diseño

### 1. Primitivo `components/Screen.tsx` (palette-agnóstico)

Encapsula el andamiaje mobile-first para que cada pantalla no lo repita:

- `SafeAreaView` (de `react-native-safe-area-context`, ya dependencia; `SafeAreaProvider` lo provee expo-router por defecto) con edges configurables (default top+bottom).
- `KeyboardAvoidingView` (behavior `padding` en iOS) — inofensivo donde no hay inputs.
- Prop `scroll?: boolean` → envuelve el contenido en `ScrollView` (con `keyboardShouldPersistTaps="handled"`); si no, un `View` con `flex:1`.
- Prop `center?: boolean` → centra vertical (para pantallas de formulario corto).
- Prop `background: string` → color de fondo (cada pantalla pasa el suyo: `colors.light.bg` en 1.x, `ayni.background` en 3.x/4.x). Sin default sorpresa: explícito.
- Prop `contentStyle?` → padding/gap propios de la pantalla.

Interfaz: `<Screen background scroll center contentStyle>{children}</Screen>`. Una responsabilidad: layout seguro. Testeable en aislamiento.

### 2. Target táctil ≥44dp

Constante compartida `touchTarget` (`{ minHeight: 44, minWidth: 44, alignItems, justifyContent }`) aplicada a los Pressables de texto suelto (Comprar, Invitar, tabs de sign-in, Enviar). `accessibilityRole="button"` donde falte. `Button` ya cumple.

### 3. Montos tabulares

`fontVariant: ['tabular-nums']` en los estilos de monto/contador (`store` precio, `wallet` balance, `bar` si muestra valor, `index` contador "Perfil X de Y").

### 4. a11y

Estados con icono+texto (banners de `store` ya llevan texto; se conserva). Contraste AA ya cubierto por los tokens. Sin cambios de color (respeta la restricción).

## Rollout (pantalla por pantalla, TDD, suite verde en cada paso)

1. `components/Screen.tsx` + `Screen.test.tsx` (primitivo; TDD real: scroll vs no, edges, background).
2. 3.x/4.x (dark, `ayni`): `index`(discover), `store`, `bar`, `wallet`, `chats/index`, `chats/[id]`.
3. 1.x (claro, `colors.light`): `sign-in`, `verify-otp`, `select-role`, `profile-setup`, `kyc`, `profile`, `profile/[id]`.

Los tests existentes verifican texto/comportamiento (no colores) → aplicar `Screen` + tweaks de estilo no los rompe. Se agregan tests focalizados donde el criterio es verificable en estilo (target ≥44dp en `store`/`bar`; tabular en `wallet`/`store`).

## Fuera de alcance

- No se voltea 1.x a dark (decisión del usuario).
- No se rediseñan flujos ni se agregan features (solo higiene mobile-first).
- No se toca lógica de datos/dinero (SP3) ni de chat/cita (SP4).
