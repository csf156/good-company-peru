import { useWindowDimensions } from 'react-native';

/**
 * Delgado sobre `useWindowDimensions` de React Native.
 *
 * Existe solo para que los tests puedan mockearlo como cualquier otro
 * módulo local (`@/...`), en vez de pelear con la resolución interna de
 * `react-native` en Jest — mockear el hook nativo directamente rompe la
 * inicialización de módulos bajo jest-expo.
 */
export function useWindowSize() {
  return useWindowDimensions();
}
