# La propuesta negociada (serie F)

**Qué es esto:** el diseño de cómo dos personas pasan de "te propongo algo" a "quedamos": proponer, aceptar, rechazar, contraproponer, retirar y vencer. Nace del recorrido que hizo el usuario sobre E.3 el 2026-09-16.

**Por qué es una serie nueva y no parte de E.3.** E.3 construyó la propuesta simple —proponer y responder— y funciona. Esto añade negociación, reglas de unicidad y ciclo de vida, que es otra fase de diseño con su propio dinero en juego. La serie E queda como el rediseño por la SBS; la F es producto.

---

## 1. Lo que el usuario observó

1. **Hay propuestas repetidas entre el mismo par.** Verificado: no son cosméticas, **cada una retiene dinero**. `chris → Vale` tiene una propuesta pendiente y otra aceptada, las dos con retención viva; `Rodri → Vale` y `Seba → Fer` tienen **dos encuentros aceptados y capturados a la vez**. Nada en el esquema lo impide: el único índice único es por clave de idempotencia, que evita repetir *el mismo intento*, no mandar otro.
2. **No hay forma de contraproponer.** Si un rentador invita con un Maracuyá Sour, el amigo solo puede aceptar o rechazar.

---

## 2. La bebida es la intención, no el precio

**Decisión del usuario, no se re-litiga.** La bebida es el **significante** de la intención del encuentro. Un Maracuyá Sour puede significar una salida casual; proponer otra bebida —más cara o más barata— es proponer **otra intención**, no regatear un importe.

**Consecuencia de diseño que sale de esa decisión:** la lectura solo existe para el usuario si **la pantalla la comunica**. Hoy el selector muestra nombre y precio, así que visualmente parece que se elige un importe. El usuario lo señaló en su primer recorrido. Cada bebida necesita **su intención escrita y visible**.

> **Textos aprobados por el usuario el 2026-09-16** (borrador de BRAIN, sin correcciones):
>
> | Bebida | Precio | Intención |
> |---|---|---|
> | Chicha Morada de la Casa | S/15 | **Solo compañía.** Un café, una conversación, sin plan fijo. |
> | Pisco Sour Clásico | S/25 | **Para pasarla bien.** Un bar, un juego, un rato de risas. |
> | Maracuyá Sour | S/35 | **Salida casual.** Pasear, comer algo, conocer un lugar. |
> | Algarrobina Especial | S/45 | **Algo distinto.** Un plan que no harías solo. |
> | Cóctel de Autor | S/60 | **Evento especial.** Un concierto, una exposición, una celebración. |
>
> **Jerarquía aprobada:** **nombre** como título; **intención** como línea principal de lectura, porque es lo que de verdad se elige; **precio** con tipografía de cifras y más discreto.
>
> **"Cóctel de Autor Ayni" pasa a "Cóctel de Autor".** Era un resto del nombre anterior de la app (Ayni → Martini, D.4) que vivía en la migración `20260904120000_catalogo_bebidas.sql`. No se usa "Cóctel de Autor Martini": el martini es además un cóctel, y el nombre se leería como la bebida, no como la marca.
>
> **No usar `tipo_invitacion` para esto.** Describe la bebida, no la salida, y su enum incluye `romantica`, categoría que el usuario vetó (spec `2026-08-25-onboarding-premium-design.md` §7). Ya está anotado en backlog.

---

## 3. Las reglas

### 3.1 Una relación activa por par

**Entre dos personas solo puede haber una relación activa a la vez**, sin importar quién propuso ni en qué sentido.

- **Termina cuando termina el encuentro**, no cuando se responde la propuesta. (Decisión del usuario.)
- **Si Rodri invita a Vale y Vale le manda una solicitud a Rodri, la segunda se bloquea.** (Decisión del usuario.)
- **También termina** si la propuesta se rechaza, vence o se retira.

> **Consecuencia aceptada por el usuario.** Hoy **ningún encuentro puede terminar**: llevarlo a `finalizada` o `no_show` es trabajo del motor de encuentro (sub-proyecto 5), que no existe. Así que **un par que acepta una propuesta queda bloqueado hasta que exista el sub-proyecto 5**. Soltarlo antes no sería solo desbloquear: la retención ya se capturó, y cerrar un encuentro que no ocurrió es **devolver un cobro**, que es la fase 5.4. El usuario prefirió aceptarlo antes que adelantar lógica de devoluciones sin el motor que la necesita.
>
> **Efecto práctico hasta entonces:** en las cuentas demo, un par que acepta no puede volver a proponer. Afecta a las revisiones.

### 3.2 Toda propuesta trae lo mismo

**Bebida, momento y lugar**, en los dos sentidos. (Decisión del usuario.)

Hoy la **solicitud no lleva bebida**: la elige el rentador al aceptar. Eso cambia. El amigo propone también una bebida, porque **sin intención propuesta no hay nada que contraproponer**. Las dos direcciones quedan simétricas.

### 3.3 La contrapropuesta

```
A propone: bebida + momento + lugar
  │
  ├─ B acepta ──────────────────────────→ conversación → pactan el encuentro
  ├─ B rechaza ─────────────────────────→ fin
  └─ B contrapropone (una sola vez)
       │
       ├─ A acepta la contrapropuesta ────→ conversación → pactan el encuentro
       └─ A la rechaza ──→ vuelve a B, que acepta o rechaza la propuesta ORIGINAL

En cualquier espera, quien propuso puede retirar.
```

- **Una sola contrapropuesta** por propuesta. (Decisión del usuario.)
- **Aplica en los dos sentidos**: el amigo contrapropone una invitación; el rentador contrapropone una solicitud.
- Si A rechaza la contrapropuesta, **B decide sobre la original sabiendo que su contrapropuesta fue rechazada**.

### 3.4 Retirar y vencer

- **Quien propuso puede retirar** mientras espera. Retirar **libera cualquier retención al instante**.
- **Una propuesta sin respuesta vence a las 48 horas** y libera su retención. (Decisión del usuario.) El estado `expirada` existe desde la fase 4.0, **pero nada lo ha disparado nunca**.

---

## 4. El dinero

### 4.1 El principio: las retenciones solo nacen de una acción del rentador

**Toda autorización sobre una tarjeta ocurre cuando el rentador actúa.** El amigo puede provocar una **captura** —cobrar una retención que el rentador ya autorizó—, pero nunca una retención nueva.

Es lo que garantiza que el rentador **está presente** cuando se toca su tarjeta: si falla la autorización, lo ve él, en su pantalla, en el momento.

### 4.2 Cómo se aplica en cada camino

| Camino | Qué pasa con la tarjeta del rentador |
|---|---|
| **Invitación** (rentador → amigo, bebida X) | Al proponer: **retiene X**. |
| · el amigo acepta | Captura X. |
| · el amigo contrapropone Y | Nada todavía. X sigue retenida. |
| · · el rentador acepta Y | **Retiene Y; solo si funciona, libera X y captura Y** — el rentador está presente. |
| · · el rentador rechaza Y → el amigo acepta X | Captura X. |
| · · … → el amigo rechaza X | Libera X. |
| **Solicitud** (amigo → rentador, bebida X) | Al proponer: **nada** — el amigo no paga. |
| · el rentador acepta | **Retiene X y captura X** — el rentador está presente. |
| · el rentador contrapropone Y | **Retiene Y** — el rentador está presente y ofrece pagarla. |
| · · el amigo acepta Y | Captura Y. |
| · · el amigo rechaza Y | **Libera Y**. Vuelve al rentador. |
| · · · el rentador acepta X | **Retiene X y captura X**. |

En todos los casos, **cerrar sin acuerdo** —rechazo, retiro o vencimiento— **libera toda retención viva**.

> **El orden de "cambiar de bebida" importa y no es negociable: primero se autoriza la nueva, después se libera la vieja.** Al revés, si la autorización de Y falla, el rentador ya perdió la retención de X y la propuesta queda sin dinero detrás. Es la misma regla de E.2b —proveedor primero— aplicada a una sustitución.

### 4.3 Cuánto puede vivir una retención

**Las autorizaciones de tarjeta caducan**: suele ser alrededor de 7 días, y puede ser menos según la red y el emisor. Con 48 h por cada espera y hasta **tres esperas encadenadas** (propuesta → contrapropuesta → vuelta a la original), la retención de una invitación puede llegar a vivir **unos 6 días** antes de capturarse.

**Decisión del spec: la negociación entera tiene un tope de 96 horas desde la propuesta original**, además de las 48 h por espera. Deja margen holgado incluso ante una red con caducidad de 5 días.

> **Depende de Red Pontis**, cuya capacidad de autorizar y capturar sigue **asumida, no confirmada** (spec de la serie E, §3.1). La caducidad real de sus autorizaciones es una pregunta más para hacerles por escrito.

### 4.4 Si una autorización falla

- **Al proponer una invitación**: como hoy (E.2b) — la invitación vence sin llegar a ser visible.
- **Al aceptar o contraproponer** (el rentador actúa): **la acción no se completa** y la propuesta **queda en el estado anterior**, esperando al rentador. Se lo dice a él, en su pantalla. **El amigo no ve nada** — misma regla de privacidad que E.2b: una tarjeta rechazada de una parte nunca se le revela a la otra.

### 4.5 Por qué no roza la SBS

Cada contrapropuesta aceptada es **liberar una retención y crear otra para el mismo encuentro**. No se acumula valor, no se reasigna una bebida entre personas (veto 3) y nada vuelve a crédito interno (veto 4). **El tope de una contrapropuesta** impide el ciclo de retener y liberar sin fin que el veto 22 identifica como vía para mover dinero.

---

## 5. Estados

`estado_invitacion` hoy: `pendiente`, `aceptada`, `rechazada`, `expirada`, `preautorizando`.

Se añaden:

| Estado | Significa | Espera a |
|---|---|---|
| `contrapropuesta` | B contrapropuso | A |
| `contrapropuesta_rechazada` | A rechazó la contrapropuesta | B, sobre la original |
| `retirada` | A retiró | — (terminal) |
| `concluida` | El encuentro terminó | — (terminal; **la pone el sub-proyecto 5**, nadie antes) |

**Estados terminales:** `rechazada`, `expirada`, `retirada`, `concluida`. Todo lo demás es relación activa.

### 5.1 Visibilidad

La lista blanca de E.2a hace que **todo estado nuevo nazca invisible para quien recibe**. Es la protección funcionando como se diseñó, y obliga a decidir uno por uno:

- `contrapropuesta`, `contrapropuesta_rechazada`, `retirada` y `concluida`: **visibles para las dos partes** — son estados de una conversación en la que las dos participan.
- `preautorizando`: **sigue oculto** para quien recibe.

### 5.2 Todo estado tiene salida

Regla heredada de E.2a. Verificación explícita:

| Estado | Salidas |
|---|---|
| `pendiente` | aceptar · rechazar · contraproponer · retirar · vencer |
| `contrapropuesta` | aceptar · rechazar · retirar · vencer |
| `contrapropuesta_rechazada` | aceptar la original · rechazarla · retirar · vencer |
| `aceptada` | `concluida` — **sin salida hasta el sub-proyecto 5**, aceptado por el usuario |

---

## 6. Cómo se hace cumplir la regla del par

**Un índice único parcial sobre el par sin ordenar**, que ignora quién propuso:

```sql
create unique index invitaciones_una_relacion_activa_por_par
  on public.invitaciones (least(emisor_id, receptor_id), greatest(emisor_id, receptor_id))
  where estado not in ('rechazada', 'expirada', 'retirada', 'concluida');
```

- **Cubre los dos sentidos a la vez**: `least`/`greatest` hace que Rodri→Vale y Vale→Rodri ocupen la misma clave.
- **Índice y no consulta dentro de una función.** Lección de E.2a (Tarea 3b): una consulta sufre carreras entre transacciones concurrentes; dos propuestas simultáneas no se verían entre sí. El índice no tiene ese problema.
- **Por eso existe `concluida`.** La regla abarca la propuesta **y** su encuentro, pero un índice no puede mirar la tabla `citas`. La invitación queda `aceptada` mientras el encuentro esté vivo, y el sub-proyecto 5 la pasará a `concluida` al terminar.

### 6.1 Los datos de hoy violan la regla

**El índice no se puede crear mientras haya pares duplicados.** Y no basta con borrar:

- **Las órdenes capturadas no se pueden borrar** (hallazgo de E.2b: son tan inmutables como el ledger que escribieron), y arrastran a su invitación.
- **Uno de los pares es de la cuenta real del usuario** (`chris → Vale`).

**Resolución aprobada por el usuario el 2026-09-16.** Medido por par sin importar el sentido:

| Par | Activas | Qué se hace |
|---|---|---|
| chris ↔ Vale | 2 | **Se borra** la `pendiente`: su orden está solo `preautorizada`, sin movimientos contables ni cita. |
| Rodri ↔ Vale | **3** | Las **dos** sobrantes pasan a `concluida`. Todas están cobradas. |
| Fer ↔ Seba | **3** | Las **dos** sobrantes pasan a `concluida`. Todas están cobradas. |

**Hay tres por par y no dos** porque la regla también bloquea el sentido contrario: Vale le hizo una solicitud a Rodri además de sus dos invitaciones, y Seba a Fer igual.

**Por qué las cobradas no se borran:** cada una dejó tres movimientos en el `ledger`, que **no admite borrados para ningún rol**. Borrar la propuesta los dejaría huérfanos para siempre y la conciliación quedaría en rojo permanente — lo que ya obligó a un reset destructivo en E.2b.

**Cuál se conserva:** la **más antigua** de cada par por `created_at`, desempatando por `id`. Las demás, `concluida`.

> **`concluida` no es verdad para esas cuatro**: sus encuentros no ocurrieron. Se elige igual porque es el único estado terminal que no finge otra cosa peor (`retirada` o `rechazada` inventarían una acción que nadie tomó) y porque **son datos demo de la base de desarrollo, que no llegará a producción** si se lanza sobre un proyecto limpio, como está recomendado. **Cualquier invariante futura del tipo "`concluida` implica cita finalizada" tiene que contar con estas cuatro**, y queda anotado en backlog.

---

## 7. El vencimiento necesita un programador

**No hay ninguno en el proyecto** (ni `pg_cron` ni `pg_net`). Y **vencer no es solo cambiar un estado**: hay que **liberar la retención**, lo que exige llamar al proveedor de pagos — cosa que SQL no puede hacer.

Así que el vencimiento es una **Edge Function programada** que:

1. Busca propuestas activas cuya espera superó las 48 h **o** cuya negociación superó las 96 h.
2. Libera sus retenciones contra el proveedor.
3. Las pasa a `expirada`.

**Es la primera tarea programada del proyecto.** Cómo se programa —`pg_cron` + `pg_net`, o un planificador externo— se decide en el plan. Tiene que ser **idempotente**: si corre dos veces sobre la misma propuesta, no libera dos veces.

---

## 8. Momento y lugar

- **Lugar**: ya existe `zona_aproximada`.
- **Momento**: se añade `momento_propuesto timestamptz`.

> **Cuidado con la zona horaria.** La revisión de la fase 4.6 dejó anotado que `confirmar_cita` convierte la hora a `timestamptz` con la sesión en UTC, **corriéndola 5 horas** respecto a Lima. Aquí la hora pasa a ser central, así que **se guarda con zona horaria explícita `America/Lima`** y se prueba en los dos sentidos: lo que se guarda y lo que se muestra.

Tras aceptar, **la conversación sirve para pactar el encuentro**, partiendo del momento y lugar ya propuestos.

---

## 8b. Duración y cantidad (decisiones del usuario, 2026-09-18)

### Duración

**Ya existe desde la fase 4.2** (`invitaciones.tiempo_estimado_min`), pero **el flujo de invitar nunca la ha pedido**: la envía vacía. El "~30 min" que el usuario vio en el panel de la cita venía de los datos demo.

- **Se expresa en minutos libres.** (Decisión del usuario; BRAIN había sugerido rangos con nombre.)
- **Forma parte de la propuesta y es contraproponible**, igual que la bebida.
- **Nunca se muestra junto al importe.** Es la observación que la originó: "S/ 15 · ~30 min" en la misma línea invita a dividir, y el resultado es una tarifa. **La duración va en el bloque del plan** (cuándo, dónde, cuánto dura) **y el importe en un bloque aparte.** Tampoco se calcula ni se muestra ninguna relación entre ambos.

### Cantidad

**El usuario puede invitar una chicha o diez**, con un selector de más y menos.

- **La fija solo quien paga**, y **no es contraproponible**. (Decisión del usuario.) En una invitación, el rentador la elige al proponer. En una solicitud, el amigo propone intención, momento, lugar y duración, **pero no cantidad**: la fija el rentador al aceptar o al contraproponer.
- **Por qué**: la bebida es la intención, pero **la cantidad no cambia la intención** — diez chichas siguen siendo "solo compañía". Es la única variable que mueve el importe sin mover la intención; si fuera negociable, sería negociar cuánto vale el tiempo de alguien. Que solo la fije quien paga conserva el gesto de generosidad sin abrir esa lectura.
- **Es un solo cobro.** Diez chichas son **una** retención y **una** captura, consumidas en **un** encuentro. Nunca "usar tres ahora y siete después": eso sería valor almacenado, lo que la serie E eliminó.
- **Sin tope de negocio.** (Decisión del usuario; BRAIN había recomendado uno por importe total, por antilavado.) **Lo que sí hay es un límite técnico**: la columna del importe es `numeric(12,2)`, y la base tiene que rechazar con un error claro un total que no quepa, en vez de desbordarse. En la práctica la autorización de la tarjeta fallará mucho antes, y eso cae en el camino de fallo ya diseñado (§4.4).

> **Riesgo que queda abierto, anotado en backlog:** sin tope, dos cuentas pueden mover importes grandes entre sí. El veto 22 del backlog vigila precisamente esa vía.

### Qué se puede contraproponer

**Bebida y/o duración.** Una contrapropuesta puede cambiar una, la otra o las dos. **No** la cantidad, **ni** el momento ni el lugar, que se pactan en la conversación tras aceptar.

### Dónde se guarda la contrapropuesta

**Hueco del plan de F.1 original**, detectado al integrar esto: definía los estados de la contrapropuesta pero no **dónde se guarda lo que propone**. Como solo hay **una** contrapropuesta por propuesta, van como columnas de `invitaciones` — la unicidad queda garantizada por la forma del esquema, sin índice:

- `contra_bebida_catalogo_id` y `contra_tiempo_estimado_min`, nulas hasta que haya contrapropuesta.
- **Una contrapropuesta tiene que cambiar algo**: `check` de que al menos una de las dos difiere de la original.

---

## 9. Lo que esta serie NO hace

- **Cerrar encuentros** (`concluida`, `no_show`, devoluciones): sub-proyecto 5.
- **Conversar antes de aceptar.** Es el momento con más incentivo para cerrar el trato fuera de la app, porque todavía no hay dinero comprometido. Descartado para la primera versión.
- **El segundo factor**: fuera de la primera versión.

---

## 10. Troceado

| Bloque | Alcance |
|---|---|
| **F.1** | Esquema y datos: estados nuevos, `momento_propuesto`, **`cantidad` y las columnas de la contrapropuesta**, intención de cada bebida y corrección de "Ayni", visibilidad, **resolución de duplicados** e índice por par. |
| **F.2** | Funciones del flujo: **la solicitud pasa a llevar bebida y duración**, contraproponer bebida y/o duración, aceptar y rechazar la contrapropuesta, decidir sobre la original, retirar. **`calcular_desglose` gana la cantidad.** El dinero de §4, con la regla de que las retenciones solo nacen de una acción del rentador. |
| **F.3** | Vencimiento: la Edge Function programada, idempotente. |
| **F.4** | Interfaz: proponer con momento, lugar y duración; **cantidad con selector de más y menos** (solo quien paga); contraproponer, retirar, estados; la intención de cada bebida visible; y **separar duración e importe** también en el panel de la cita del chat. |

**Orden:** F.1 → F.2 → F.3 y F.4 (independientes entre sí).

---

## 11. Preguntas abiertas

1. ~~El texto de la intención de cada bebida.~~ **Resuelto el 2026-09-16** (§2).
2. **Red Pontis:** cuánto dura una autorización antes de caducar. Se suma a las dos preguntas pendientes (titularidad y auth/capture/void).
3. **Orden respecto a E.4.** E.4 cierra la serie E y deja la app publicable; esta serie reescribe pantallas que E.4 barrería de vocabulario.
