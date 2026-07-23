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

---

## Resuelto

- [x] Path traversal en rutas de storage de `kyc-start` (`startsWith` no bastaba) — cubierto en fase 1.6 (fix ya escrito, pendiente commit).
- [x] `verifyWebhookSignature` aceptaba firma HMAC con secreto vacío/`undefined` — cubierto en fase 1.6 (fix ya escrito, pendiente commit).

