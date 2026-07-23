# Ayni — Backlog (ideas fuera de alcance)

**Qué es esto:** aquí se **anota** cualquier cosa detectada durante una fase que pertenece a OTRA fase o que está fuera del alcance actual — en vez de hacerla. Mantiene la disciplina fase-por-fase (ver `../CLAUDE.md`).

**Cómo usarlo:**
- **Durante una fase:** si detectas algo útil pero fuera de alcance, añádelo abajo con una línea. No lo implementes.
- **Al planear una fase futura:** revisa si algo de aquí ya le corresponde; si se implementa, muévelo a la sección "Resuelto" con la fase que lo cubrió.
- Formato: `- [ ] <descripción> — detectado en fase <X.Y> — ¿pertenece a? <fase/área>`

---

## Pendiente

- [ ] Portar componentes base `level-badge`, `drink-icon`, `friend-card`, `app-shell` de Lovable — detectado al reconstruir bitácora 1.0 (2026-07-22), el commit de scaffold solo trajo `Button` + tokens — ¿pertenece a? fase que primero los necesite (`level-badge` candidata natural: 1.5 lo resolvió inline sin componente, o 6.4 paneles de nivel).
- [ ] Redirect de `_layout.tsx` corre en `useEffect` post-render — pantalla protegida puede parpadear antes de redirigir. No explotable hoy, revisar cuando `app/index.tsx` tenga contenido sensible — detectado en fase 1.2 — ¿pertenece a? 1.6 o fase que añada contenido sensible a home.
- [ ] `perfiles_publicos` expone `kyc_estado` con granularidad completa (`pendiente`/`verificado`/`rechazado`) a cualquier autenticado; el badge de verificado solo necesita un booleano `verificado`. Sobre-disclosure leve, no explotable — detectado en auditoría 1.6 — ¿pertenece a? endurecimiento de vista pública (2.x visibilidad, o cuando se rediseñe el badge).
- [ ] `config.toml` no pinnea `verify_jwt = false` para `kyc-webhook`; depende del flag `--no-verify-jwt` en cada deploy (riesgo de drift). La seguridad NO depende de esto (el HMAC es la auth real), pero conviene fijarlo en config — detectado en auditoría 1.6 — ¿pertenece a? higiene de deploy / cuando se active Truora real (3.x+). **[Resuelto en 3.1: `[functions.*] verify_jwt` pinneado en config.toml para las 4 funciones. Mover a Resuelto al confirmar.]**
- [ ] Creación de orden en `comprar-bebida` no es idempotente por-click: un doble-tap crea 2 órdenes `pendiente` (en modo mock = 2 bebidas; en real, sin doble-cobro salvo doble-pago). Considerar idempotency key del cliente o dedupe de órdenes pendientes recientes — detectado en fase 3.1 — ¿pertenece a? UI tienda (3.2) o endurecimiento 3.4.
- [ ] Discrepancia doc: el **plan** 3.1/3.2 y el resumen de fees en CLAUDE.md dicen que el rentador paga "buyer fee + procesamiento", pero el **diseño §A** (ejemplo trabajado) cobra solo V+15% y absorbe el ~4% de procesamiento del margen. Fase 3.1 implementó el **modelo del diseño §A** (decisión confirmada por el usuario). El procesamiento hoy NO se registra en ningún ledger (es margen/costo de plataforma) — cuando exista una cuenta contable de plataforma (conciliación 3.4 / niveles 6) habrá que registrarlo. Alinear el texto del plan/CLAUDE.md al diseño — detectado en fase 3.1 — ¿pertenece a? 3.4 (conciliación) o limpieza de docs.
- [ ] Worktree anidado `.claude/worktrees/fase-1-6-endurecimiento` (commit `dfca2da`, adelantado a master, `locked`) quedó de una sesión previa. Revisar si tiene trabajo sin mergear antes de borrarlo — detectado en fase 1.6.

---

## Resuelto

- [x] Path traversal en rutas de storage de `kyc-start` (`startsWith` no bastaba) — cubierto en fase 1.6 (fix ya escrito, pendiente commit).
- [x] `verifyWebhookSignature` aceptaba firma HMAC con secreto vacío/`undefined` — cubierto en fase 1.6 (fix ya escrito, pendiente commit).

