import { createContext, useContext } from 'react';

/**
 * Permite al carrusel avisarle al layout de que ya se vio.
 *
 * Por qué existe: `app/_layout.tsx` lee `carruselVisto()` una sola vez, al
 * montar, y guarda el resultado en `carruselPendiente`. La pantalla escribía
 * la marca en el almacenamiento del dispositivo y navegaba — pero el layout
 * no se enteraba, así que `carruselPendiente` seguía en `true` y su efecto de
 * redirección devolvía al usuario al carrusel en cuanto cambiaba el segmento.
 * Bucle infinito: nadie podía llegar al sign-in, ni terminando el carrusel ni
 * saltándolo. Reproducido en el navegador antes de arreglarlo.
 *
 * Es el mismo problema y el mismo remedio que [[ProfileRefreshContext]]: una
 * pantalla acaba de cambiar un dato que el layout solo lee en su montaje, y
 * tiene que decírselo. Una notificación por escritura, en el momento exacto en
 * que el dato cambió, en vez de releer el almacenamiento en cada navegación.
 *
 * A diferencia de aquel, este NO devuelve una promesa: el layout solo tiene
 * que poner un booleano en `false`, sin pedirle nada a la red ni al disco. La
 * pantalla debe llamarlo ANTES de `router.replace`, para que el efecto de
 * redirección se ejecute ya con el valor nuevo.
 */
export const CarruselVistoContext = createContext<() => void>(() => {});

export function useCarruselVisto(): () => void {
  return useContext(CarruselVistoContext);
}
