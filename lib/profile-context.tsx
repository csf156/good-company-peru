import { createContext, useContext } from 'react';

/**
 * Permite a una pantalla pedirle al layout que vuelva a leer el perfil.
 *
 * Por qué existe: `app/_layout.tsx` lee el perfil solo cuando cambia la
 * sesión. Al terminar el alta la sesión NO cambia, así que el guardián
 * seguía viendo `profileStatus: 'incomplete'` y devolvía al usuario al
 * paso 1 — con el perfil ya guardado en la base. Bug presente desde la
 * fase 1.3, invisible hasta que alguien completó el alta entera.
 *
 * Se prefiere esto a releer en cada navegación: una lectura por escritura,
 * en el momento exacto en que el dato cambió.
 *
 * Devuelve una promesa (no `void`): la pantalla que llama debe esperarla
 * antes de `router.replace('/')`. Si no espera, la navegación dispara el
 * efecto de redirección de `_layout` con el `profileStatus` todavía viejo
 * — exactamente el mismo bug que este contexto existe para arreglar, solo
 * que como una carrera en vez de un fetch que nunca ocurre.
 */
export const ProfileRefreshContext = createContext<() => Promise<void>>(async () => {});

export function useProfileRefresh(): () => Promise<void> {
  return useContext(ProfileRefreshContext);
}
