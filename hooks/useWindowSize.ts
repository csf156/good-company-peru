import * as ReactNative from 'react-native';

/**
 * Delgado sobre `useWindowDimensions` de React Native.
 *
 * Existe solo para que los tests puedan mockearlo como cualquier otro
 * módulo local (`@/...`), en vez de pelear con la resolución interna de
 * `react-native` en Jest — mockear el hook nativo directamente rompe la
 * inicialización de módulos bajo jest-expo.
 *
 * Import de namespace (`* as ReactNative`), no nombrado: con esta versión
 * de Metro/Babel, `import { useWindowDimensions } from 'react-native'`
 * compila el sitio de llamada a `useWindowDimensions.default()` sobre un
 * valor que el propio interop ya desenvolvió — `.default` queda undefined
 * y truena en runtime web (`react-native-web`), aunque en Jest (que no pasa
 * por ese bundling) no se nota. El acceso por namespace evita el doble
 * desenvolvimiento.
 */
export function useWindowSize() {
  return ReactNative.useWindowDimensions();
}
