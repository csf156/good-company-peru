# Rediseño del modelo de dinero para evitar la licencia SBS (serie E)

**Qué es esto:** el diseño del ajuste que saca a la bebida virtual de la definición de dinero electrónico de la Ley 29985, y al importe del amigo de la definición de monedero. Nace de tres decisiones estructurales del usuario y del análisis legal del 2026-09-07, ya reflejado en el articulado del ToS (cláusulas 10 a 13 y 16) y en las 22 funcionalidades vetadas de `docs/backlog.md`.

**Ocupa la serie E** (E.1 a E.4), igual que la serie D nació de specs propios. **No reabre formalmente las fases 3.2 y 3.3**: su histórico queda intacto en la bitácora, y `ESTADO.md` anotará que la serie E las supera.

**Veredicto de alcance: es un ajuste, no un rediseño del sub-proyecto 3.** El ledger append-only sobrevive intacto y refuerza la figura; la idempotencia sobrevive; la vista agregada cambia de nombre, de definición y de copy, no de naturaleza.

---

## 1. Por qué existe

Tres decisiones del usuario, tomadas para que la bebida virtual no califique como dinero electrónico:

1. **Compra al invitar.** Se elimina el stock. Hoy la tabla `bar` tiene estado `disponible` y el rentador acumula bebidas compradas sin destinatario: eso es **valor almacenado**, la característica que define al dinero electrónico.
2. **El importe del amigo es cuenta por cobrar, no saldo.** Sin recargas, sin gasto interno, sin transferencias.
3. **La titularidad del dinero en custodia es de la pasarela** (Red Pontis). Martini solo instruye y recibe su comisión.

La defensa principal, verificada contra el texto de la norma: el reglamento (**DS 090-2013-EF, art. 1**) excluye del concepto de dinero electrónico los soportes "diseñados para atender usos generales y no aquellos para usos específicos". La decisión 1 mete a la bebida de lleno en la categoría excluida — sirve para **una** persona, **un** encuentro y **un** importe.

**Hallazgo sobre el retiro a demanda, que no hay que perder:** lo que define al dinero electrónico no es poder retirar, sino **disponer de un valor y decidir cuándo rescatarlo**. Por eso la liquidación automática y periódica es el piso obligatorio, y el retiro on-demand es un **adelanto de algo ya programado**. El usuario nunca decide mantener el dinero. Consecuencia para la fase 6.3, fuera del alcance de esta serie pero anotada aquí: no puede existir "prefiero acumular" ni umbral mínimo que en la práctica obligue a acumular (veto 16).

---

## 2. Lo que existe hoy (verificado por introspección, 2026-09-09)

| Pieza | Dónde | Qué hace |
|---|---|---|
| `ledger` | `20260723120000_money_ledger.sql` | Append-only por trigger, `idempotency_key` unique, RLS de solo lectura propia. **Sobrevive intacto.** |
| `balance` | misma migración | Vista `security_invoker` = suma del ledger, común a los dos roles. **Se reemplaza.** |
| `bebidas_catalogo` | misma migración | Catálogo del operador, `valor_v`. **Sobrevive.** |
| `bar` + enum `estado_bar` | misma migración | Stock del rentador: `disponible`/`bloqueada`/`consumida`. **Se elimina.** |
| `ordenes_pago` + `estado_orden` | `20260723130000_ordenes_pago.sql` | Montos congelados server-side; el webhook confirma con estos, no con los del payload. **Se extiende.** |
| `confirmar_orden_pago` | `20260723140000` | Transacción con row lock: mueve la orden a confirmada, escribe el trío de ledger e **inserta la fila de `bar`**. **Se reescribe.** |
| `crear_invitacion` | `20260724120000` | Valida KYC, reclama idempotencia, **bloquea la bebida del bar**. **Se reescribe.** |
| `responder_invitacion` | `20260724150000` | Al rechazar libera la bebida; al aceptar una `solicitud` **obliga al rentador a asignar una bebida de su bar**. **Se reescribe.** |
| `citas` + `estado_cita` | `20260703120000` / `20260723180000` | Enum completo desde 1.1: `pendiente`/`confirmada`/`en_curso`/`finalizada`/`no_show`/`disputa`. Costura ya lista para 5.4. |
| `app/store.tsx` (258 líneas) | Tienda, fase 3.2 | Compra suelta de bebidas. **Se convierte en selector.** |
| `app/bar.tsx` (129 líneas) | Bar, fase 3.3 | Muestra el stock. **Se reemplaza.** |
| `app/wallet.tsx` (43 líneas) | Wallet | Título literal **"Balance disponible"**. Viola los vetos 18 y 19 en pantalla. **Se elimina.** |
| `lib/bar.ts` (63 líneas) | Cliente | `getMiBar()`, `getBalance()`. **Se reemplaza.** |
| `comprar-bebida` (179 líneas) | Edge Function | Crea la orden y, en modo mock, confirma inline. **Se reescribe.** |
| `pago-webhook` | Edge Function | **Nunca desplegada** (deuda registrada en la bitácora de D.3). |

**El hecho que condiciona el diseño:** hoy la fila de `bar` es el objeto de dinero. Es lo que la compra crea, lo que la invitación bloquea y lo que la respuesta libera. Quitarla obliga a reasignar ese papel.

---

## 3. Decisiones tomadas (2026-09-09)

Las cuatro se discutieron explícitamente con el usuario.

### 3.1 Preautorizar al invitar, capturar al aceptar

El amigo todavía puede rechazar, y el **veto 4** prohíbe devolver a crédito interno: toda devolución va al medio de pago original. Cobrar al invitar generaría un reembolso por cada rechazo — coste, fricción, y el **veto 22** vigila el ciclo comprar-cancelar como ruta de cash-out.

Se preautoriza (hold sobre la tarjeta) al invitar y se captura al aceptar. Si el amigo rechaza o la invitación expira, se **anula el hold**: no hubo cobro y no hay devolución que gestionar.

Es además lo más limpio contra la SBS: **ningún valor existe hasta que hay un encuentro acordado.**

> **Dependencia dura, sin resolver.** Esto exige que Red Pontis soporte autorización / captura / anulación. Si solo hacen cobro directo, el bloque E.2 cambia entero y hay que volver a "cobrar al invitar, devolver si rechaza". Es la segunda pregunta que hay que hacerles **por escrito**, junto a la de titularidad (§8).

### 3.2 La invitación *es* la compra

Se evaluaron tres formas de matar el stock:

- **A — La orden de pago es el objeto de dinero.** Se borra `bar`, `ordenes_pago` gana `receptor_id`, `invitaciones` la referencia. Funciona, pero deja dos filas que nacen y mueren juntas y ninguna es obviamente la dueña del encuentro.
- **B — `bar` renombrada a `bebidas_invitacion`, una fila por invitación, sin estado `disponible`.** La migración más barata y la peor idea: conserva una tabla cuyo nombre y forma siguen diciendo "bebidas que un usuario tiene". El regulador y el procesador leen la interfaz y el esquema, no la intención.
- **C — La invitación es la compra. ✅ Elegida.** Se borran `bar` y el enum `estado_bar` enteros. `invitaciones` lleva `bebida_catalogo_id`; `ordenes_pago` apunta a `invitacion_id` y conserva sus montos congelados.

**Por qué C:** no existe ninguna fila en la base que represente una bebida sin destinatario. La ausencia de stock deja de ser una regla de aplicación y pasa a ser un **hecho del esquema** — que es exactamente lo que exige el backlog.

**Dónde vive cada dato, y por qué no es arbitrario.** La RLS de `invitaciones` deja ver la fila a **las dos partes**; la de `ordenes_pago`, **solo a su dueño**. De ahí se sigue el reparto:

| Dato | Tabla | Motivo |
|---|---|---|
| `bebida_catalogo_id` | `invitaciones` | El amigo tiene que ver a qué lo invitan. Con la RLS de `ordenes_pago` no podría. |
| `valor_v`, `buyer_fee`, `total` | `ordenes_pago` | Congelados server-side al crear la orden; el webhook confirma con **estos**, no con los del payload. Propiedad de seguridad ya existente de la fase 3.1, que no se toca. Además el amigo **no debe ver el buyer fee del rentador**. |

`ordenes_pago.bebida_catalogo_id` **se elimina**: ahora es derivable por `invitacion_id` y mantenerlo en dos tablas es una fuente de deriva.

**Como máximo una orden viva por invitación.** Un fallo de preautorización debe poder reintentarse, así que `invitacion_id` no puede ser `unique` a secas. Va un **índice único parcial** sobre `invitacion_id` donde `estado in ('preautorizada','capturada')`: se permiten varios intentos fallidos o anulados, y jamás dos holds o dos capturas vivas sobre la misma invitación.

### 3.3 Superficies de dinero distintas por rol

El rentador **no tiene ninguna vista de dinero agregado**: nunca tuvo saldo. Tiene "Mis invitaciones", con qué pagó por cada una. El amigo tiene "Por cobrar": importe pendiente de liquidación y fecha de la próxima, sin ningún botón que sugiera gastarlo.

En base, `balance` se reemplaza por `por_cobrar`, definida **solo sobre créditos con origen en liberación de escrow**. Vetos 18 y 19.

### 3.4 `por_cobrar` se construye ahora, aunque muestre cero

El importe solo llega al amigo cuando se libera el escrow tras el encuentro verificado, y eso es la **fase 5.4**, que está ⬜ junto con todo el sub-proyecto 5. La vista y la pantalla se construyen igual, mostrando cero.

**Por qué:** saca el vocabulario prohibido del esquema y de la app de una vez, y deja a 5.4 sin nada que discutir sobre naming — solo tiene que insertar en el ledger. El coste es una pantalla que no enseña nada hasta el sub-proyecto 5.

**No se construye la tabla de liquidaciones**: es la fase 6.3 del plan de escalamiento y entrar ahí sería cruzar alcance.

---

## 4. Máquina de estados

Hoy:

```
comprar bebida → fila en `bar` (disponible) → invitar la bloquea → aceptar/rechazar la libera o la consume
```

Nueva:

```
elegir persona + bebida
  └→ invitaciones(estado='por_pagar')          ← invisible para el amigo
     + ordenes_pago(estado='pendiente', invitacion_id)
        └→ preautorización OK → invitaciones='pendiente'   ordenes='preautorizada'
           ├→ amigo acepta    → CAPTURA        → ordenes='capturada'  → escrow Red Pontis
           └→ rechaza/expira  → ANULA EL HOLD  → ordenes='anulada'    (sin cobro, sin devolución)
```

**Enums que se amplían de forma aditiva:**

- `estado_invitacion` gana `por_pagar`.
- `estado_orden` gana `preautorizada`, `capturada`, `anulada`.

**Regla que no se puede perder: la preautorización no escribe nada en el ledger.** No hay movimiento de dinero que registrar, y esa ausencia es parte de la defensa — un hold no es un pago.

El ledger se escribe **en la captura**, no en la compra. Es el mismo trío de hoy, movido de momento y de referencia:

| Fila | Monto | `referencia_id` |
|---|---|---|
| `compra` | `+total` | la invitación |
| `fee` | `−buyer_fee` | la invitación |
| `escrow_lock` | `−valor_v` | la invitación |

Netean a cero: capturar no da saldo disponible a nadie. El dinero está en custodia de Red Pontis, a su nombre (decisión 3).

### 4.1 La solicitud del amigo

Hoy el rentador acepta una solicitud y asigna una bebida de su bar. Sin bar, **aceptar una solicitud es el momento de pagar**:

```
amigo solicita → invitaciones(tipo='solicitud', estado='pendiente')   ← sin dinero
  └→ rentador acepta y elige bebida
     → estado='por_pagar' + orden preautorizada + captura inmediata
       (ya hay acuerdo de las dos partes: no hay nada que esperar)
     → estado='aceptada' → se abre el chat
```

Un fallo de tarjeta aquí deja la solicitud en `pendiente`, **no** aceptada, y no abre chat.

---

## 5. Las invariantes van en Postgres, no en TypeScript

El backlog es explícito: *"dentro de dos fases alguien escribe un endpoint de crédito 'solo para pruebas' o 'solo para compensar a un usuario molesto' y ahí muere el argumento"*. Las reglas 1, 8, 9, 12 y 14 tienen que fallar en un `INSERT`, no en una revisión de código.

**Tres invariantes, como trigger y `CHECK`:**

1. **Crédito a un amigo solo con origen en liberación de escrow.** Trigger sobre `ledger`: si `monto > 0` y el `perfil_id` tiene `rol='amigo'`, exige `tipo='payout'` y que `referencia_id` apunte a una `cita` en estado `finalizada`. Cubre los vetos 8, 9 y 14.

   Hoy esta invariante **rechaza el cien por cien de los intentos**, porque 5.4 no existe y ninguna cita llega a `finalizada` por la vía del motor de cita. Eso es lo correcto, no un defecto: significa que la única puerta futura ya está tapiada antes de que nadie la abra.

2. **Débito de un amigo solo con destino en liquidación bancaria.** El enum `tipo_movimiento` no admite ningún tipo que gaste el importe dentro de la app; el trigger rechaza cualquier `monto < 0` sobre un perfil `amigo` que no sea la liquidación. Cubre los vetos 10, 11 y 12.

3. **No existe compra sin destinatario.** Garantizado por la forma del esquema: la única manera de crear una `orden_pago` es con `invitacion_id NOT NULL`, y toda invitación tiene `receptor_id` (o alcance `global`, que es SP2 y sigue teniendo un universo de destinatarios acotado). Cubre los vetos 1, 2, 3, 6 y 7.

**Cómo se testean.** Lección que ya costó cara: **los tests de seguridad reproducen el ataque, no leen `information_schema`**. Un revoke por columna que no hacía nada pasó desapercibido hasta que un test intentó el insert malicioso de verdad. Cada invariante necesita un pgTAP que **intente el INSERT prohibido y compruebe que Postgres lo rechaza**, no uno que verifique que el trigger existe.

Ataques mínimos a reproducir:

- Acreditar a un amigo con `tipo='compra'` (veto 14).
- Acreditar a un amigo con `tipo='payout'` referido a una cita **no** `finalizada` (veto 9).
- Debitar a un amigo con destino distinto de liquidación (vetos 10, 11).
- Insertar una `orden_pago` sin `invitacion_id` (vetos 1, 2).
- Insertar en `ledger` desde el rol `authenticated` (regresión del modelo existente).

---

## 6. Vocabulario, que no es cosmético

El **veto 18** prohíbe "saldo", "billetera", "monedero" y "wallet" en UI, ToS, soporte y marketing. El **veto 19** prohíbe mostrar el importe pendiente como poder de compra. El **veto 20** prohíbe expresar precios en bebidas con tipo de cambio propio: la bebida siempre muestra su importe en soles, 1:1.

Cambios concretos:

| Antes | Después |
|---|---|
| `app/wallet.tsx`, "Balance disponible" | eliminado |
| vista `balance` | vista `por_cobrar` |
| `lib/bar.ts` → `getBalance()` | `lib/por-cobrar.ts` → `getPorCobrar()` |
| pantalla Bar (stock) | "Mis invitaciones" (historial de pagos del rentador) |
| pantalla Tienda (compra suelta) | paso "elige la bebida" dentro del flujo de invitar |
| — | "Por cobrar" (amigo): importe pendiente + próxima liquidación |

El barrido de vocabulario alcanza también al copy del ToS en `lib/tos.ts` si quedara alguna mención; el articulado ya se ajustó en D.4, así que se espera que sea una verificación, no una reescritura.

---

## 7. Troceado en cuatro bloques

Cada bloque cierra con tests verdes y su propio commit. Ninguno deja la rama rota.

| Bloque | Alcance | Entregable |
|---|---|---|
| **E.1** | Esquema | Borrar `bar` y `estado_bar`; `invitaciones` pierde `bebida_bar_id` (la FK que apuntaba al stock) y gana `bebida_catalogo_id`; `ordenes_pago` gana `invitacion_id` (con índice único parcial) y pierde `bebida_catalogo_id`; ampliar los dos enums; las tres invariantes; vista `por_cobrar` en lugar de `balance`. pgTAP que **reproduce los ataques**. |
| **E.2** | Provider y funciones | `PaymentProvider` gana `preautorizar` / `capturar` / `anular`; `confirmar_orden_pago`, `crear_invitacion` y `responder_invitacion` reescritas; Edge Functions `comprar-bebida` (renombrada) y `pago-webhook`. Idempotencia en las tres operaciones nuevas. |
| **E.3** | UI del rentador | Catálogo dentro del flujo de invitar; "Mis invitaciones"; muerte de Tienda y Bar; `lib/bar.ts` reemplazada. |
| **E.4** | UI del amigo y vocabulario | "Por cobrar"; barrido de vocabulario en toda la app; verificación del copy del ToS. |

**Orden obligatorio:** E.1 antes que E.2 (las funciones necesitan el esquema nuevo), E.2 antes que E.3 y E.4 (la UI necesita algo que llamar). E.3 y E.4 son independientes entre sí.

**Los bloques de UI (E.3 y E.4) usan las skills de diseño de `awesome-design-skills/`** (repo de typeui.sh clonado en la raíz, sin trackear). Las dos que casan con la identidad Martini —serif italic en títulos, labels mono, superficies oscuras cálidas— son:

- `awesome-design-skills/skills/refined/SKILL.md` — serif elegante, paletas sobrias y contenidas.
- `awesome-design-skills/skills/editorial/SKILL.md` — retícula estructurada y jerarquía tipográfica de revista.

**Restricción dura:** se usan para retícula, jerarquía y ritmo tipográfico. **Los tokens de `lib/theme.ts` ganan sobre cualquier paleta que proponga la skill** — la identidad Martini ya está cerrada y sale de `src/styles.css` de Lovable. Y siguen mandando las reglas de UI de `CLAUDE.md`: rojo solo para SOS/error/no-show, estados con icono **y** texto, contraste AA, targets ≥44dp, cifras tabulares, modo oscuro.

---

## 8. Lo que este rediseño NO toca

- **El ledger append-only y su idempotencia.** Sobreviven intactos y refuerzan la figura.
- **KYC, chat, moderación, descubrimiento, onboarding.**
- **La liberación de escrow** tras el encuentro verificado: sigue siendo la fase **5.4**.
- **La liquidación al amigo** (periódica + adelanto on-demand): sigue siendo la fase **6.3**, con la restricción del §1 anotada.
- **El motor de cita** (QR, geocerca, cronómetro): sigue siendo el sub-proyecto **5**, entero ⬜.

## 9. Riesgos y preguntas abiertas

1. **Red Pontis y auth/capture/void.** Si no lo soportan, cae la decisión 3.1 y E.2 se rehace. **Preguntar por escrito.**
2. **Titularidad de la custodia.** La pregunta que puede tumbar el modelo entero: cuando el rentador paga, ¿Red Pontis recibe por cuenta del amigo, de Martini, o propia? Si la respuesta es "de Martini", la decisión 3 del usuario no se sostiene y el análisis legal hay que rehacerlo. **Preguntar por escrito.**
3. **Datos existentes.** Hay filas de demo en `bar` (`scripts/seed-demo.mjs`). La migración de E.1 las destruye. Es aceptable — son datos de demo — pero el script de seed hay que actualizarlo en el mismo bloque o queda roto.
4. **`pago-webhook` sigue sin desplegar.** E.2 lo toca; el despliegue real es infraestructura y no bloquea el cierre del bloque, pero hay que anotarlo otra vez y no darlo por hecho.
5. **El código de referencia de un plan es una hipótesis.** El plan de D.3 traía dos bugs reales y el de D.4 otros dos, todos descubiertos al ejecutar. Si un test y el snippet del plan se contradicen, **gana el test**.
