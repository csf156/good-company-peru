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
 */
export const ProfileRefreshContext = createContext<() => void>(() => {});

export function useProfileRefresh(): () => void {
  return useContext(ProfileRefreshContext);
}
