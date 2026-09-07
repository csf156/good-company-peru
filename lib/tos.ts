import type { ComponentProps } from 'react';
import type MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { supabase } from '@/lib/supabase';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/**
 * Versión vigente del texto. Vive en el código, no en la base: subirla acá
 * obliga a todo el mundo a volver a aceptar, sin tocar el esquema. La fase
 * 7.5 (ToS enforcement) lee el histórico de `tos_aceptaciones` para saber
 * quién aceptó qué y cuándo.
 */
export const TOS_VERSION = 'v1';

/** Las tres reglas que de verdad importan, para la pantalla. */
export const TOS_RESUMEN: { icono: IconName; texto: string }[] = [
  {
    icono: 'account-heart-outline',
    texto:
      'Ayni es compañía social. Nada de contenido sexual ni servicios de acompañamiento íntimo.',
  },
  {
    icono: 'shield-check-outline',
    texto:
      'Todo pago va por la app. Coordinar pagos por fuera es motivo de baja, y el chat lo detecta.',
  },
  {
    icono: 'calendar-check-outline',
    texto: 'Solo mayores de 18 años. Verificamos tu edad con tu documento.',
  },
];

export const TOS_TEXTO = `BORRADOR — pendiente de revisión legal.

1. Qué es Ayni. Ayni conecta personas que quieren compañía para actividades
sociales: una conversación, un café, un evento. No es una app de citas ni de
servicios sexuales, y no se permite ofrecerlos ni solicitarlos.

2. Edad mínima. Debes ser mayor de 18 años. Verificamos tu edad con tu
documento de identidad.

3. Pagos. Las bebidas virtuales se compran dentro de la app y el monto queda
retenido hasta que el encuentro se confirme. Coordinar o realizar pagos fuera
de la app está prohibido y es motivo de baja de la cuenta.

4. Conducta. Trata a la otra persona con respeto. El acoso, la discriminación
y la suplantación de identidad son motivo de baja inmediata.

5. Cancelaciones y no-shows. Si el encuentro no ocurre, el monto retenido se
resuelve según las reglas de cancelación vigentes en la app.

6. Datos personales. Tratamos tus datos según nuestra política de privacidad.

7. Cambios. Si estos términos cambian, te pediremos aceptarlos de nuevo antes
de seguir usando la app.`;

/**
 * ¿El usuario actual aceptó la versión VIGENTE? Falla cerrado a propósito:
 * ante cualquier error devuelve `false`, porque esto alimenta un gate de
 * navegación y equivocarse hacia "sí aceptó" dejaría pasar a alguien que no.
 */
export async function getTosAceptado(): Promise<boolean> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;

    const { data, error } = await supabase
      .from('tos_aceptaciones')
      .select('id')
      .eq('perfil_id', user.id)
      .eq('version', TOS_VERSION)
      .limit(1);

    if (error) return false;
    return (data?.length ?? 0) > 0;
  } catch {
    return false;
  }
}

export async function aceptarTos(): Promise<{ error: string | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'No hay sesión activa.' };

  const { error } = await supabase
    .from('tos_aceptaciones')
    .insert({ perfil_id: user.id, version: TOS_VERSION });

  return { error: error ? error.message : null };
}
