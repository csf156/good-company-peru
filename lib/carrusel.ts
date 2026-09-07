import AsyncStorage from '@react-native-async-storage/async-storage';

const CLAVE = 'martini.carrusel.visto';

/**
 * El carrusel va ANTES del sign-in, así que no hay usuario a quien atarlo:
 * la marca vive en el dispositivo. Se ve una vez por dispositivo y reaparece
 * si el usuario cambia de teléfono o limpia datos — coste aceptable para
 * cuatro slides saltables.
 *
 * Falla en silencio a propósito: que el almacenamiento no esté disponible
 * (modo privado, permisos) no puede impedir entrar a la app. Ante la duda,
 * mostrar el carrusel es inofensivo.
 */
export async function carruselVisto(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(CLAVE)) !== null;
  } catch {
    return false;
  }
}

export async function marcarCarruselVisto(): Promise<void> {
  try {
    await AsyncStorage.setItem(CLAVE, '1');
  } catch {
    // Silencio deliberado — ver arriba.
  }
}
