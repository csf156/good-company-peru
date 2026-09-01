# Fase D.3 — Bloque 2: wizard de alta — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir `app/(auth)/profile-setup.tsx` de una pantalla con seis campos de texto libre en un wizard de siete pasos con iconos, selectores y límites de selección — e instrumentarlo para poder medir en qué paso abandona la gente.

**Architecture:** El wizard es **una sola ruta** (`profile-setup.tsx`) con un índice de paso en estado, no siete rutas de Expo Router. Así el estado del formulario vive en un solo componente sin pasarse por params ni contexto, el botón de atrás del wizard no compite con el del navegador, y `route-guard` sigue viendo una única pantalla de alta. **El perfil se persiste una sola vez, al final** — no hay perfiles a medias en la tabla. La instrumentación de abandono es lo único que sí escribe durante el recorrido, en su propia tabla append-only.

**Tech Stack:** React Native + Expo Router · `@expo/vector-icons` (nuevo) · Postgres/Supabase · Jest + @testing-library/react-native · pgTAP

**Spec:** [`docs/superpowers/specs/2026-08-25-onboarding-premium-design.md`](../specs/2026-08-25-onboarding-premium-design.md) §1, §3

---

## Global Constraints

- **El bloque 1 ya está cerrado.** `profiles.fecha_nacimiento` (date), `profiles.tipo_salida` (text[]), sin `edad` ni `intereses`. `isMayorDeEdad(fechaNacimiento: string)` vive en `lib/validation.ts`. `REQUIRED_FIELDS` ya no incluye `profesion`. No re-hagas nada de eso.
- **Un solo `updateOwnProfile` al final.** Ningún paso intermedio escribe en `profiles`. Si el usuario abandona, no queda basura.
- **Sin emoji.** Iconos de línea, monocromos, dorado o color de texto sobre superficie oscura. Un solo grosor de trazo y un solo tamaño por contexto — la uniformidad es lo que hace que un set se lea como propio.
- **Siempre icono + texto**, nunca icono solo. Regla de accesibilidad vigente del proyecto.
- **Guardia anti-color-literal activa:** el CI falla si aparece un `#rrggbb`, `rgb(` o `hsl(` en `app/` o `components/`. Todo color sale de `lib/theme.ts`. Si te falta un token, agrégalo al theme — no metas un literal.
- **Targets ≥44 dp** en todo lo tocable. Los chips de selección también.
- **Idioma:** UI en español de Perú, informal "tú". Código y commits en inglés técnico.
- **El usuario revisa el SQL antes de aplicarlo** (Tarea 7). Regla del proyecto.
- **El runner de pgTAP no carga `.env` solo:** `set -a; . ./.env; set +a` antes de `npm run test:db`, en la misma línea.
- **El servidor de Expo reescribe `tsconfig.json` al arrancar.** Revisa `git diff tsconfig.json` antes de cualquier `git add -A`.
- **Cierre de cada tarea:** `npm run lint` + `npm run typecheck` + `npm test` en verde.
- **No hagas push. No cierres D.3.** El bloque 3 (KYC) viene después.

---

## File Structure

| Archivo | Responsabilidad | Tarea |
|---|---|---|
| `package.json` | `@expo/vector-icons` | 1 |
| `components/Icon.tsx` | Envoltorio único de iconos: tamaño, color y set fijos | 1 |
| `lib/onboarding-options.ts` | Las tres listas: hobbies, tipo de salida, distritos | 2 |
| `components/SelectionGrid.tsx` | Grilla de chips con límite de selección | 2 |
| `components/StepHeader.tsx` | Título + indicador "paso N de 7" | 3 |
| `components/DateOfBirthPicker.tsx` | Selector día/mes/año propio | 4 |
| `app/(auth)/profile-setup.tsx` | El wizard completo | 3–6 |
| `lib/onboarding-analytics.ts` | Registro de eventos de embudo | 7 |
| `supabase/migrations/20260826120000_onboarding_eventos.sql` | Tabla append-only + RLS | 7 |
| `supabase/tests/24_onboarding_eventos.sql` | pgTAP de aislamiento | 7 |

---

## Task 1: Iconos

**Files:**
- Modify: `package.json`, `package-lock.json`
- Create: `components/Icon.tsx`, `tests/components/Icon.test.tsx`

**Interfaces:**
- Produces: `<Icon name="bike" size="md" tone="accent" />` — el único punto por el que la app dibuja un icono.

- [ ] **Step 1: Instalar**

```bash
npx expo install @expo/vector-icons
```

`expo install` (no `npm install`) para que resuelva la versión compatible con el SDK.

- [ ] **Step 2: Escribir el test que falla**

`tests/components/Icon.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react-native';
import { Icon } from '@/components/Icon';

describe('Icon', () => {
  it('expone un label accesible cuando se le da uno', async () => {
    await render(<Icon name="bike" accessibilityLabel="Bicicleta" />);
    expect(screen.getByLabelText('Bicicleta')).toBeTruthy();
  });

  it('es decorativo por defecto (oculto para lectores de pantalla)', async () => {
    await render(<Icon name="bike" testID="icono" />);
    expect(screen.getByTestId('icono').props.accessibilityElementsHidden).toBe(true);
  });
});
```

El segundo test fija la regla del proyecto: como los iconos **siempre van acompañados de texto**, por defecto son decorativos y el lector de pantalla no los anuncia dos veces.

- [ ] **Step 3: Correr y verificar que falla**

```bash
npx jest tests/components/Icon.test.tsx
```

Esperado: FAIL, `Cannot find module '@/components/Icon'`.

- [ ] **Step 4: Implementar**

```typescript
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors } from '@/lib/theme';

/**
 * Único punto por el que la app dibuja iconos.
 *
 * Set fijo (MaterialCommunityIcons, variantes outline) y escala cerrada de
 * tamaños: lo que hace que un set se lea como propio y no como clipart es la
 * uniformidad de trazo y tamaño, no el icono individual. Feather se evaluó y
 * se descartó — sus ~280 iconos genéricos no cubren vóley, surf, senderismo
 * ni bicicleta (ver spec §3).
 *
 * Por defecto son DECORATIVOS: la regla del proyecto es icono + texto
 * siempre, así que anunciarlos duplicaría la lectura. Pasa
 * `accessibilityLabel` solo en el caso excepcional de un icono sin texto.
 */
type IconSize = 'sm' | 'md' | 'lg';
type IconTone = 'accent' | 'text' | 'muted';

const SIZES: Record<IconSize, number> = { sm: 16, md: 24, lg: 32 };
const TONES: Record<IconTone, string> = {
  accent: colors.primary,
  text: colors.foreground,
  muted: colors.mutedForeground,
};

type IconProps = {
  name: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  size?: IconSize;
  tone?: IconTone;
  accessibilityLabel?: string;
  testID?: string;
};

export function Icon({ name, size = 'md', tone = 'text', accessibilityLabel, testID }: IconProps) {
  const decorative = accessibilityLabel === undefined;

  return (
    <MaterialCommunityIcons
      name={name}
      size={SIZES[size]}
      color={TONES[tone]}
      testID={testID}
      accessibilityElementsHidden={decorative}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'yes'}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={decorative ? undefined : 'image'}
    />
  );
}
```

- [ ] **Step 5: Verificar**

```bash
npx jest tests/components/Icon.test.tsx && npm run lint && npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json components/Icon.tsx tests/components/Icon.test.tsx
git commit -m "feat: componente Icon con set y escala fijos"
```

---

## Task 2: Listas de opciones y grilla de selección

**Files:**
- Create: `lib/onboarding-options.ts`, `components/SelectionGrid.tsx`
- Test: `tests/components/SelectionGrid.test.tsx`

**Interfaces:**
- Produces: `HOBBIES`, `TIPOS_SALIDA`, `DISTRITOS` (`lib/onboarding-options.ts`) y `<SelectionGrid options={...} selected={...} onChange={...} max={5} />`. Los pasos 5, 6 y 7 lo consumen.

- [ ] **Step 1: Las listas**

`lib/onboarding-options.ts`. Los `value` son lo que se guarda en la base; los `label` son lo que se muestra. **No los unifiques** — cambiar un label no debe reescribir datos guardados.

```typescript
import type { ComponentProps } from 'react';
import type MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export type OpcionConIcono = { value: string; label: string; icon: IconName };

/** Hobbies — qué hace la persona. Máximo 5, con "Otro" de texto libre. */
export const HOBBIES: OpcionConIcono[] = [
  { value: 'futbol', label: 'Fútbol', icon: 'soccer' },
  { value: 'voley', label: 'Vóley', icon: 'volleyball' },
  { value: 'bicicleta', label: 'Bicicleta', icon: 'bike' },
  { value: 'gimnasio', label: 'Gimnasio', icon: 'dumbbell' },
  { value: 'correr', label: 'Correr', icon: 'run' },
  { value: 'bailar', label: 'Bailar', icon: 'dance-ballroom' },
  { value: 'cocinar', label: 'Cocinar', icon: 'chef-hat' },
  { value: 'fotografia', label: 'Fotografía', icon: 'camera-outline' },
  { value: 'videojuegos', label: 'Videojuegos', icon: 'gamepad-variant-outline' },
  { value: 'senderismo', label: 'Senderismo', icon: 'hiking' },
  { value: 'surf', label: 'Surf', icon: 'surfing' },
  { value: 'yoga', label: 'Yoga', icon: 'yoga' },
  { value: 'musica', label: 'Tocar música', icon: 'guitar-acoustic' },
  { value: 'pintar', label: 'Pintar', icon: 'palette-outline' },
  { value: 'leer', label: 'Leer', icon: 'book-open-outline' },
  { value: 'cine', label: 'Cine', icon: 'movie-open-outline' },
  { value: 'viajar', label: 'Viajar', icon: 'airplane' },
];

/**
 * Tipo de salida — qué plan busca la persona. Máximo 2, SIN "Otro".
 *
 * El conjunto es cerrado a propósito (spec §1.3 y §7): permite a la fase 2.0
 * filtrar sin normalizar texto libre, y evita que un campo abierto
 * reintroduzca por la puerta de atrás los tipos de salida que el producto
 * deliberadamente no ofrece.
 */
export const TIPOS_SALIDA: OpcionConIcono[] = [
  { value: 'conversar', label: 'Conversar / café', icon: 'coffee-outline' },
  { value: 'comer', label: 'Salir a comer', icon: 'silverware-fork-knife' },
  { value: 'noche', label: 'Vida nocturna', icon: 'glass-cocktail' },
  { value: 'conciertos', label: 'Conciertos y eventos', icon: 'music-note-outline' },
  { value: 'cine_cultura', label: 'Cine y cultura', icon: 'theater' },
  { value: 'deporte', label: 'Deporte o aire libre', icon: 'bike' },
  { value: 'turistear', label: 'Turistear la ciudad', icon: 'map-outline' },
  { value: 'acompanamiento', label: 'Acompañamiento a evento', icon: 'account-tie-outline' },
  { value: 'trabajar', label: 'Estudiar o trabajar juntos', icon: 'laptop' },
  { value: 'sin_plan', label: 'Sin plan fijo', icon: 'shuffle-variant' },
];

/**
 * Distritos de Lima Metropolitana y Callao. Máximo 5, sin iconos.
 *
 * Lista larga (50) a diferencia de las dos anteriores: la pantalla necesita
 * búsqueda, no una grilla plana (spec §1.4).
 */
export const DISTRITOS: string[] = [
  'Ancón', 'Ate', 'Barranco', 'Bellavista', 'Breña', 'Callao', 'Carabayllo',
  'Carmen de La Legua', 'Chaclacayo', 'Chorrillos', 'Cieneguilla', 'Comas',
  'El Agustino', 'Independencia', 'Jesús María', 'La Molina', 'La Perla',
  'La Punta', 'La Victoria', 'Lima (Cercado)', 'Lince', 'Los Olivos',
  'Lurigancho-Chosica', 'Lurín', 'Magdalena del Mar', 'Mi Perú', 'Miraflores',
  'Pachacámac', 'Pucusana', 'Pueblo Libre', 'Puente Piedra', 'Punta Hermosa',
  'Punta Negra', 'Rímac', 'San Bartolo', 'San Borja', 'San Isidro',
  'San Juan de Lurigancho', 'San Juan de Miraflores', 'San Luis',
  'San Martín de Porres', 'San Miguel', 'Santa Anita', 'Santa María del Mar',
  'Santa Rosa', 'Santiago de Surco', 'Surquillo', 'Ventanilla',
  'Villa El Salvador', 'Villa María del Triunfo',
];
```

- [ ] **Step 2: Test de la grilla que falla**

`tests/components/SelectionGrid.test.tsx`:

```typescript
import { render, screen, fireEvent } from '@testing-library/react-native';
import { SelectionGrid } from '@/components/SelectionGrid';

const OPCIONES = [
  { value: 'a', label: 'Alfa', icon: 'bike' as const },
  { value: 'b', label: 'Beta', icon: 'run' as const },
  { value: 'c', label: 'Gama', icon: 'yoga' as const },
];

describe('SelectionGrid', () => {
  it('selecciona y deselecciona una opción', async () => {
    const onChange = jest.fn();
    await render(<SelectionGrid options={OPCIONES} selected={[]} onChange={onChange} max={2} />);
    fireEvent.press(screen.getByText('Alfa'));
    expect(onChange).toHaveBeenCalledWith(['a']);
  });

  it('deselecciona una ya elegida', async () => {
    const onChange = jest.fn();
    await render(<SelectionGrid options={OPCIONES} selected={['a']} onChange={onChange} max={2} />);
    fireEvent.press(screen.getByText('Alfa'));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('no deja pasar del máximo y dice por qué', async () => {
    const onChange = jest.fn();
    await render(
      <SelectionGrid options={OPCIONES} selected={['a', 'b']} onChange={onChange} max={2} />,
    );
    fireEvent.press(screen.getByText('Gama'));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText(/máximo 2/i)).toBeTruthy();
  });

  it('marca lo seleccionado con estado accesible, no solo con color', async () => {
    await render(<SelectionGrid options={OPCIONES} selected={['a']} onChange={jest.fn()} max={2} />);
    expect(screen.getByLabelText('Alfa').props.accessibilityState.selected).toBe(true);
  });
});
```

El último test es la regla de accesibilidad del proyecto: **el estado no puede vivir solo en el color**.

- [ ] **Step 3: Correr y verificar que falla**

```bash
npx jest tests/components/SelectionGrid.test.tsx
```

- [ ] **Step 4: Implementar `components/SelectionGrid.tsx`**

Requisitos, no código literal — el diseño visual es tuyo dentro de estas reglas:

- Chips en grilla que fluye (`flexWrap`), cada uno con `<Icon>` + texto cuando la opción trae icono, solo texto cuando no (distritos).
- Seleccionado: borde y texto en `colors.primary`, más un `<Icon name="check" size="sm" />`. **El color no puede ser la única señal.**
- `accessibilityRole="button"`, `accessibilityState={{ selected }}`, `accessibilityLabel` con el label de la opción.
- Al intentar pasar del máximo: no llamar `onChange`, y mostrar un texto visible tipo "Puedes elegir máximo 2". No un botón gris mudo.
- `minHeight: 44` por chip.
- Prop opcional `searchable?: boolean` que muestra un `TextInput` de filtro encima — lo usa solo la pantalla de distritos. Filtra sin distinguir mayúsculas ni tildes (`localeCompare` con `sensitivity: 'base'`, o normaliza con `String.prototype.normalize('NFD')` quitando diacríticos).

- [ ] **Step 5: Verificar y commitear**

```bash
npx jest tests/components/SelectionGrid.test.tsx && npm run lint && npm run typecheck
git add lib/onboarding-options.ts components/SelectionGrid.tsx tests/components/SelectionGrid.test.tsx
git commit -m "feat: listas de onboarding y grilla de seleccion con limite"
```

---

## Task 3: Esqueleto del wizard — navegación y pasos 1 a 3

**Files:**
- Create: `components/StepHeader.tsx`
- Modify: `app/(auth)/profile-setup.tsx` (reescritura), `tests/app/profile-setup.test.tsx`

**Interfaces:**
- Produces: el wizard navegable con los pasos 1–3 funcionando. Las tareas 4–6 agregan los pasos restantes sobre esta estructura.

- [ ] **Step 1: Tests que fallan**

Reescribe `tests/app/profile-setup.test.tsx`. Los casos de esta tarea:

```typescript
it('arranca en el paso 1 de 7', async () => {
  await render(<ProfileSetupScreen />);
  expect(await screen.findByText('Paso 1 de 7')).toBeTruthy();
});

it('no avanza con el paso inválido y dice por qué', async () => {
  await render(<ProfileSetupScreen />);
  fireEvent.press(screen.getByText('Continuar'));
  expect(screen.getByText('Paso 1 de 7')).toBeTruthy();
  expect(screen.getByText(/nombre y alias/i)).toBeTruthy();
});

it('avanza cuando el paso es válido', async () => {
  await render(<ProfileSetupScreen />);
  fireEvent.changeText(screen.getByPlaceholderText('Nombre completo'), 'Ana Torres');
  fireEvent.changeText(screen.getByPlaceholderText('Alias'), 'ana');
  fireEvent.press(screen.getByText('Continuar'));
  expect(await screen.findByText('Paso 2 de 7')).toBeTruthy();
});

it('retroceder conserva lo ingresado', async () => {
  await render(<ProfileSetupScreen />);
  fireEvent.changeText(screen.getByPlaceholderText('Nombre completo'), 'Ana Torres');
  fireEvent.changeText(screen.getByPlaceholderText('Alias'), 'ana');
  fireEvent.press(screen.getByText('Continuar'));
  fireEvent.press(await screen.findByLabelText('Volver'));
  expect(screen.getByDisplayValue('Ana Torres')).toBeTruthy();
});

it('el paso 1 no muestra botón de volver', async () => {
  await render(<ProfileSetupScreen />);
  expect(screen.queryByLabelText('Volver')).toBeNull();
});

it('el género "Otro" exige texto', async () => {
  // avanzar hasta el paso 3, elegir "Otro", dejar el texto vacío
  // → no avanza y el motivo es visible
});
```

- [ ] **Step 2: Correr y verificar que fallan**

```bash
npx jest tests/app/profile-setup.test.tsx
```

- [ ] **Step 3: Implementar el esqueleto**

Estructura, no código literal:

- Un estado `paso` (1–7) y un objeto `datos` con todos los campos. **Nada se escribe en la base hasta la Tarea 6.**
- Una función `validarPaso(paso, datos): string | null` — devuelve el motivo del bloqueo o `null`. Pura, testeable por separado, y **es la única fuente de verdad de si se puede avanzar**.
- `<StepHeader paso={paso} total={7} titulo={...} />` con el indicador en la tipografía mono de labels (`textStyles.label`) y el botón de volver (`accessibilityLabel="Volver"`) oculto en el paso 1.
- Botón "Continuar" deshabilitado cuando `validarPaso` devuelve motivo, **con el motivo visible en texto** — nunca un botón gris sin explicación.
- Pasos de esta tarea: **1** nombre + alias; **2** placeholder temporal (la Tarea 4 mete el selector de fecha); **3** género con las cinco opciones (Mujer / Hombre / No binario / Prefiero no decirlo / Otro) y `TextInput` condicional al elegir "Otro".

- [ ] **Step 4: Verificar y commitear**

```bash
npx jest tests/app/profile-setup.test.tsx && npm run lint && npm run typecheck
git add -A && git commit -m "feat: esqueleto del wizard de alta con pasos 1-3"
```

---

## Task 4: Selector de fecha de nacimiento (paso 2)

**Files:**
- Create: `components/DateOfBirthPicker.tsx`, `tests/components/DateOfBirthPicker.test.tsx`
- Modify: `app/(auth)/profile-setup.tsx`

**Interfaces:**
- Produces: `<DateOfBirthPicker value={string|null} onChange={(iso: string) => void} />`, que emite `YYYY-MM-DD`.

**Por qué propio y no una dependencia:** `@react-native-community/datetimepicker` **no funciona en web**, y la web es donde el usuario prueba la app. Además, para una fecha de nacimiento un calendario es peor UX que tres listas — obliga a retroceder ~30 años mes a mes (spec §1.1).

- [ ] **Step 1: Tests que fallan**

```typescript
describe('DateOfBirthPicker', () => {
  it('emite YYYY-MM-DD al completar los tres campos', async () => {
    const onChange = jest.fn();
    await render(<DateOfBirthPicker value={null} onChange={onChange} />);
    // seleccionar día 5, mes marzo, año 1995
    expect(onChange).toHaveBeenLastCalledWith('1995-03-05');
  });

  it('rellena con cero a la izquierda', async () => {
    // día 5 y mes 3 → '1995-03-05', nunca '1995-3-5'
  });

  it('no ofrece 31 de febrero', async () => {
    // elegido febrero, la lista de días llega hasta 28 (o 29 en bisiesto)
  });

  it('no emite nada mientras falte un campo', async () => {
    const onChange = jest.fn();
    await render(<DateOfBirthPicker value={null} onChange={onChange} />);
    // seleccionar solo el año
    expect(onChange).not.toHaveBeenCalled();
  });
});
```

El tercer test importa: si la lista de días es siempre 1–31, alguien puede componer `1995-02-31`, que `new Date()` acepta rodando al 3 de marzo — y `isMayorDeEdad` lo validaría sobre una fecha distinta de la que el usuario eligió.

- [ ] **Step 2: Correr y verificar que fallan**

```bash
npx jest tests/components/DateOfBirthPicker.test.tsx
```

- [ ] **Step 3: Implementar**

- Tres selectores: día, mes (nombres en español), año.
- Rango de años: desde `añoActual - 100` hasta `añoActual - 18`. Que el año más reciente ofrecido sea ya el de alguien de 18 hace el límite evidente antes de validar.
- Los días disponibles se recalculan según mes y año (bisiestos incluidos). Si había un día seleccionado que ya no existe, se recorta al último válido.
- Emite solo cuando los tres están completos, en `YYYY-MM-DD` con ceros a la izquierda.
- Números en tipografía tabular (`tabularNums` de `lib/theme.ts`) — regla del proyecto para cifras.

- [ ] **Step 4: Conectar al paso 2**

Reemplaza el placeholder de la Tarea 3. `validarPaso(2, datos)` usa `isMayorDeEdad(datos.fechaNacimiento)` y devuelve "Debes ser mayor de 18 años" cuando corresponda.

- [ ] **Step 5: Verificar y commitear**

```bash
npx jest tests/components/DateOfBirthPicker.test.tsx tests/app/profile-setup.test.tsx
npm run lint && npm run typecheck
git add -A && git commit -m "feat: selector de fecha de nacimiento dia/mes/anio"
```

---

## Task 5: Pasos 4 a 7 — foto, hobbies, tipo de salida, distritos

**Files:**
- Modify: `app/(auth)/profile-setup.tsx`, `tests/app/profile-setup.test.tsx`

**Interfaces:**
- Consumes: `SelectionGrid`, `HOBBIES`, `TIPOS_SALIDA`, `DISTRITOS` (Tarea 2).

- [ ] **Step 1: Tests que fallan**

```typescript
it('el 6º hobby es rechazado', async () => {
  // con 5 elegidos, presionar un sexto no lo agrega y el máximo se explica
});

it('el "Otro" de hobbies parsea texto separado por comas y cuenta contra el máximo', async () => {
  // 3 elegidos + "ajedrez, pesca" → 5 en total; agregar uno más se rechaza
});

it('la 3ª opción de tipo de salida es rechazada', async () => {
  // máximo 2
});

it('el paso de tipo de salida no ofrece "Otro"', async () => {
  // no existe control de texto libre en ese paso
});

it('la pantalla de distritos filtra sin distinguir tildes', async () => {
  // escribir "jesus maria" encuentra "Jesús María"
});

it('el 6º distrito es rechazado', async () => {
  // máximo 5
});
```

- [ ] **Step 2: Correr y verificar que fallan**

- [ ] **Step 3: Implementar**

- **Paso 4 (foto):** reusa la lógica de `ImagePicker` que ya existe en el archivo. Obligatoria, igual que hoy.
- **Paso 5 (hobbies):** `<SelectionGrid options={HOBBIES} max={5} />` más un control "Otro" que abre un `TextInput`. Los valores libres se parsean con `parseListInput` (ya existe en `lib/validation.ts`) y **cuentan contra el máximo de 5**.
- **Paso 6 (tipo de salida):** `<SelectionGrid options={TIPOS_SALIDA} max={2} />`. **Sin "Otro"** — es decisión de producto registrada en el spec §7, no un olvido. No lo agregues.
- **Paso 7 (distritos):** `<SelectionGrid options={...} max={5} searchable />` sobre `DISTRITOS`. Sin iconos (un distrito no tiene icono que lo represente sin caer en clipart).

- [ ] **Step 4: Verificar y commitear**

```bash
npx jest tests/app/profile-setup.test.tsx && npm run lint && npm run typecheck
git add -A && git commit -m "feat: pasos 4-7 del wizard (foto, hobbies, salida, distritos)"
```

---

## Task 6: Persistencia final

**Files:**
- Modify: `app/(auth)/profile-setup.tsx`, `tests/app/profile-setup.test.tsx`

**Interfaces:**
- Consumes: `updateOwnProfile`, `upsertPreferenciasSalida` (`lib/profile.ts`).

- [ ] **Step 1: Tests que fallan**

```typescript
it('guarda todo de una sola vez al terminar el paso 7', async () => {
  // recorrer los 7 pasos y presionar "Terminar"
  expect(mockedUpdateOwnProfile).toHaveBeenCalledTimes(1);
  expect(mockedUpdateOwnProfile).toHaveBeenCalledWith(
    expect.objectContaining({
      nombre: 'Ana Torres',
      alias: 'ana',
      fecha_nacimiento: '1995-03-05',
      genero: 'Mujer',
      hobbies: expect.arrayContaining(['futbol']),
      tipo_salida: ['conversar'],
    }),
  );
  expect(mockedUpsertPreferencias).toHaveBeenCalledWith({ distritos: ['Miraflores'] });
});

it('no escribe nada en pasos intermedios', async () => {
  // avanzar hasta el paso 4 sin terminar
  expect(mockedUpdateOwnProfile).not.toHaveBeenCalled();
});

it('un fallo al guardar deja al usuario en el paso 7 con el error visible y sin perder datos', async () => {
  mockedUpdateOwnProfile.mockResolvedValue({ error: 'Falló la red' });
  // recorrer y terminar
  expect(screen.getByText(/falló la red/i)).toBeTruthy();
  expect(screen.getByText('Paso 7 de 7')).toBeTruthy();
});
```

El tercero es el que evita el peor final posible: que un error de red al terminar borre siete pasos de trabajo del usuario.

- [ ] **Step 2: Correr, implementar, verificar**

Un solo `updateOwnProfile` con todos los campos de `profiles`, más `upsertPreferenciasSalida({ distritos })`. Si `updateOwnProfile` falla, **no llames a `upsertPreferenciasSalida`** y conserva el estado del wizard. Al éxito, `router.replace('/')` como hoy — `route-guard` decide a dónde va según su estado de KYC.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: persistencia unica al cerrar el wizard"
```

---

## Task 7: Medición de abandono

**Files:**
- Create: `supabase/migrations/20260826120000_onboarding_eventos.sql`, `supabase/tests/24_onboarding_eventos.sql`, `lib/onboarding-analytics.ts`, `tests/lib/onboarding-analytics.test.ts`
- Modify: `app/(auth)/profile-setup.tsx`

**Interfaces:**
- Produces: `registrarPasoOnboarding(paso: number)` y `registrarOnboardingCompletado()`.

**El diseño y por qué:**

El usuario pidió poder medir en qué paso abandona la gente. Se resuelve con una **tabla append-only propia**, no con un servicio de analítica externo: no hay ninguno integrado, sumar uno arrastra decisiones de privacidad y costo ajenas a esta fase, y el embudo de la propia app es dato del proyecto.

**Se elige un registro de eventos, no un contador de "paso máximo alcanzado".** Un contador ocupa menos y es más fácil de consultar, pero solo responde "hasta dónde llegó". Con eventos con marca de tiempo también se responde *cuánto tardó en cada paso* y *si retrocedió*, que es lo que distingue "el paso 5 es confuso" de "el paso 5 es aburrido". Es la misma filosofía append-only que el proyecto ya usa para el ledger.

**Advertencia honesta que va en el reporte al usuario:** hoy **nadie puede leer estos datos desde la app** — el panel de operaciones es la fase 7.4 y no existe. Esto acumula historia desde ahora para que ese panel tenga qué mostrar, en vez de empezar a contar el día que se construya. Mientras tanto se consultan con SQL directo.

- [ ] **Step 1: pgTAP que falla**

`supabase/tests/24_onboarding_eventos.sql` — sin `begin`/`rollback` (el runner los pone), y creando `auth.users` antes de cualquier perfil (patrón de los archivos existentes). Debe cubrir:

- La tabla existe con `perfil_id`, `paso`, `evento`, `created_at`.
- **Aislamiento:** un usuario NO puede leer los eventos de otro (es el test que importa — el embudo de otra persona no es asunto suyo).
- Un usuario **sí** puede insertar los propios.
- Un usuario **no** puede insertar con el `perfil_id` de otro (anti-suplantación).
- **Append-only:** `UPDATE` y `DELETE` están revocados para `authenticated`, igual que en el ledger.

- [ ] **Step 2: Escribir la migración**

```sql
-- Fase D.3 — embudo de onboarding.
--
-- Registro append-only de por qué pasos pasa cada persona al darse de alta,
-- para poder medir en qué punto abandona. Eventos con marca de tiempo y no
-- un contador de "paso máximo": así se responde también cuánto tardó en cada
-- paso y si retrocedió — lo que distingue un paso confuso de uno aburrido.
--
-- NO hay lector todavía: el panel de operaciones es la fase 7.4. Esto
-- acumula historia desde hoy para que ese panel tenga qué mostrar.

create table public.onboarding_eventos (
  id bigint generated always as identity primary key,
  perfil_id uuid not null references auth.users (id) on delete cascade,
  paso smallint not null check (paso between 1 and 7),
  evento text not null check (evento in ('paso_visto', 'completado')),
  created_at timestamptz not null default now()
);

create index onboarding_eventos_perfil_idx
  on public.onboarding_eventos (perfil_id, created_at);

alter table public.onboarding_eventos enable row level security;

-- Cada quien ve e inserta solo lo suyo. El embudo de otra persona no es
-- asunto de nadie más.
create policy onboarding_eventos_select_own on public.onboarding_eventos
  for select to authenticated
  using (perfil_id = auth.uid());

create policy onboarding_eventos_insert_own on public.onboarding_eventos
  for insert to authenticated
  with check (perfil_id = auth.uid());

-- Append-only, igual que el ledger: sin UPDATE ni DELETE para el cliente.
revoke update, delete on public.onboarding_eventos from authenticated;
grant select, insert on public.onboarding_eventos to authenticated;
```

- [ ] **Step 3: ALTO — el usuario revisa el SQL**

Regla del proyecto. Señálale:

1. **Tabla nueva, no modifica ninguna existente.** Riesgo bajo comparado con la migración del bloque 1.
2. **Guarda comportamiento de uso, no contenido.** Solo número de paso y marca de tiempo — ningún dato del formulario.
3. **Nadie la lee todavía** (panel = fase 7.4). Es acumulación deliberada.

- [ ] **Step 4: Aplicar y verificar**

```bash
set -a; . ./.env; set +a; node tests/db/apply-migrations.mjs
set -a; . ./.env; set +a; npm run test:db
```

Verifica también por introspección que las policies quedaron como se escribieron, no solo que los tests pasen.

- [ ] **Step 5: `lib/onboarding-analytics.ts`**

```typescript
import { supabase } from '@/lib/supabase';

/**
 * Registra el avance por el wizard de alta, para medir en qué paso se
 * abandona.
 *
 * Falla en silencio a propósito: la analítica NUNCA debe romper el alta ni
 * hacerla más lenta. Si el insert falla, el usuario no se entera y sigue.
 */
async function registrar(paso: number, evento: 'paso_visto' | 'completado'): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('onboarding_eventos').insert({ perfil_id: user.id, paso, evento });
  } catch {
    // Silencio deliberado — ver arriba.
  }
}

export function registrarPasoOnboarding(paso: number): void {
  void registrar(paso, 'paso_visto');
}

export function registrarOnboardingCompletado(): void {
  void registrar(7, 'completado');
}
```

Ambas devuelven `void` y no se esperan con `await`: el wizard no debe bloquearse por analítica.

- [ ] **Step 6: Tests de la instrumentación**

```typescript
it('registra el paso al entrar en él', async () => {
  // avanzar del 1 al 2 → registrarPasoOnboarding llamado con 2
});

it('registra el completado al guardar con éxito', async () => {
  // terminar el wizard → registrarOnboardingCompletado llamado
});

it('un fallo de la analítica no rompe el alta', async () => {
  mockedRegistrar.mockRejectedValue(new Error('sin red'));
  // el wizard avanza igual y no muestra error
});
```

El tercero es el que garantiza que la medición nunca se coma el alta.

- [ ] **Step 7: Verificar y commitear**

```bash
npm run lint && npm run typecheck && npm test
set -a; . ./.env; set +a; npm run test:db
git add -A && git commit -m "feat: medicion de abandono en el onboarding"
```

---

## Cierre del bloque 2

- [ ] **Verificación final, con la salida mostrada**

```bash
npm run lint && npm run typecheck && npm test
set -a; . ./.env; set +a; npm run test:db
git status --short
git diff tsconfig.json
```

El último comando por la trampa conocida: el servidor de Expo reescribe `tsconfig.json` al arrancar y le quita `.expo/types`.

- [ ] **Levantar el preview y dejarlo corriendo**

El criterio de cierre de esta fase **no es solo que los tests pasen** — es que el usuario recorra el alta y le parezca premium. Deja el preview web en `localhost:8081` y dile que está listo para que lo mire.

Señálale expresamente **los iconos**: son MaterialCommunityIcons outline en dorado sobre oscuro. Si no dan la sensación buscada, la alternativa (SVG a medida) es trabajo de diseño real y quedaría anotada en backlog, no improvisada dentro de esta fase.

- [ ] **Reportar y detenerte**

**Este bloque NO cierra D.3.** No escribas en `docs/ESTADO.md`, no marques nada ✅, no toques `FASE ACTUAL`. Falta el bloque 3 (KYC en dos pantallas).

Reporta: conteos reales de ambas suites, la introspección de las policies de `onboarding_eventos`, y cualquier decisión visual que hayas tomado y no estuviera en el plan — sobre todo si tuviste que agregar un token a `lib/theme.ts`, porque eso significa que al design system le faltaba algo y conviene saberlo.
