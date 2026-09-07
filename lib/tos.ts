import type { ComponentProps } from 'react';
import type MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { supabase } from '@/lib/supabase';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/**
 * Versión vigente del texto. Vive en el código, no en la base: subirla acá
 * obliga a todo el mundo a volver a aceptar, sin tocar el esquema. La fase
 * 7.5 (ToS enforcement) lee el histórico de `tos_aceptaciones` para saber
 * quién aceptó qué y cuándo.
 *
 * OJO AL SUBIRLA: la tabla tiene un CHECK que solo admite las versiones
 * existentes (migración 20260906140000). Cambiar esta constante sin una
 * migración que añada el valor nuevo deja a TODO el mundo atrapado en la
 * pantalla de términos, porque nadie podría aceptar. Las dos cosas van juntas.
 */
export const TOS_VERSION = 'v1';

/**
 * Las tres reglas que de verdad importan, para la pantalla.
 *
 * Estas SÍ van en tuteo, a diferencia del texto largo: son la capa de
 * comprensión, y la regla de copy informal del proyecto aplica aquí. El
 * articulado de abajo es la capa de obligación y va en tercera persona.
 */
export const TOS_RESUMEN: { icono: IconName; texto: string }[] = [
  {
    icono: 'account-heart-outline',
    texto:
      'Martini es compañía social. Nada de contenido sexual ni servicios de acompañamiento íntimo.',
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

/**
 * Articulado completo. Registro formal en tercera persona, a propósito: el
 * lector adverso de este texto no es el usuario final sino un procesador de
 * pagos, un banco o un regulador, y un ToS en tuteo coloquial se lee como no
 * vinculante. Castellano neutro.
 *
 * Redactado por la sesión de revisión legal del proyecto (2026-09-07). NO está
 * validado por un abogado colegiado, y la advertencia de la primera línea no
 * se quita hasta que lo esté.
 */
export const TOS_TEXTO = `BORRADOR SUJETO A REVISIÓN POR ABOGADO COLEGIADO. Este texto no ha sido
validado por un profesional del derecho habilitado en el Perú y puede ser
modificado antes del lanzamiento público.

1. Aceptación. El presente documento contiene los Términos y Condiciones que
regulan el acceso y el uso de la aplicación Martini (en adelante, la
Plataforma), operada por su titular (en adelante, el Operador). El registro, el
acceso o el uso de la Plataforma suponen la aceptación plena y sin reservas de
estos términos. Quien no los acepte debe abstenerse de utilizar la Plataforma.

2. Definiciones. Usuario: toda persona natural registrada en la Plataforma.
Rentador: el Usuario que cursa una invitación a un encuentro de compañía
social. Amigo en renta: el Usuario que acepta dicha invitación a cambio de una
retribución. Encuentro: la reunión presencial acordada entre ambos. Bebida
virtual: unidad de valor adquirida dentro de la Plataforma que representa el
importe destinado a retribuir el Encuentro. Custodia: retención de dicho
importe por un proveedor especializado hasta que el Encuentro sea verificado.

3. Objeto y naturaleza del servicio. La Plataforma es un servicio de
intermediación tecnológica que permite a los Usuarios coordinar encuentros
presenciales de compañía social, de carácter lícito y no íntimo, tales como una
conversación, un café o la asistencia a un evento. El Operador no presta el
servicio de compañía, no participa del Encuentro y no es parte del acuerdo que
los Usuarios celebran entre sí. La Plataforma no constituye un servicio de
citas, de emparejamiento romántico ni de acompañamiento íntimo.

4. Naturaleza de la relación entre las partes. Entre el Operador y los Usuarios
no existe relación laboral, de subordinación, de exclusividad, societaria ni de
agencia. El Amigo en renta actúa por cuenta y riesgo propios, organiza
libremente su disponibilidad y es el único responsable del cumplimiento de las
obligaciones tributarias y de cualquier otra índole que se deriven de los
importes que perciba.

5. Capacidad y mayoría de edad. El uso de la Plataforma está reservado a
personas naturales mayores de dieciocho (18) años con plena capacidad de
ejercicio. Queda prohibido el registro de personas menores de edad, así como el
uso de una cuenta por persona distinta de su titular.

6. Verificación de identidad. Ambos roles deben completar, de forma previa a la
habilitación de encuentros, un procedimiento de verificación de identidad que
comprende la presentación del documento nacional de identidad y una prueba de
vida, contrastados contra los registros oficiales a través de un proveedor
especializado. Dicha verificación acredita identidad y mayoría de edad; no
constituye una investigación de antecedentes penales, policiales ni judiciales,
y el Operador no la ofrece ni la garantiza.

7. Cuenta de Usuario. El Usuario declara que la información que proporciona es
veraz, exacta y actual, y se obliga a mantenerla actualizada. La cuenta es
personal e intransferible. El Usuario es responsable de la custodia de sus
credenciales y de toda actividad realizada desde su cuenta.

8. Prohibición de contenido y de servicios de naturaleza sexual o de
acompañamiento íntimo. La Plataforma tiene por finalidad exclusiva la compañía
social de carácter no íntimo. Queda terminantemente prohibido, y constituye
causal de baja inmediata y definitiva de la cuenta:
(i) ofrecer, solicitar, insinuar, negociar, pactar o retribuir servicios
sexuales, eróticos o de acompañamiento íntimo, sea de forma expresa, encubierta
o mediante lenguaje en clave;
(ii) publicar, remitir o intercambiar contenido sexual explícito, material de
desnudez o proposiciones de índole sexual en el perfil, en el chat, en las
fotografías o en cualquier otro espacio de la Plataforma;
(iii) condicionar la aceptación de una invitación, la calificación, la
retribución o la liberación del importe en Custodia a la realización de
conductas de naturaleza sexual o íntima;
(iv) emplear la Plataforma para publicitar, captar clientela o derivar Usuarios
hacia servicios sexuales, eróticos o de acompañamiento íntimo prestados por
cualquier medio, dentro o fuera de ella.
Las bebidas virtuales retribuyen únicamente el tiempo de compañía social
efectivamente verificado y en ningún caso constituyen contraprestación por
conducta sexual o íntima alguna. El Operador no tolera, no facilita ni obtiene
provecho del comercio sexual.
Ante indicios de explotación sexual, de trata de personas o de participación de
personas menores de edad, el Operador bloqueará las cuentas involucradas,
conservará la información asociada y colaborará con las autoridades
competentes.

9. Otras conductas prohibidas. Sin perjuicio de lo dispuesto en la cláusula
anterior, queda prohibido: el acoso, la intimidación y el hostigamiento en
cualquiera de sus formas; la discriminación por cualquier motivo; la
suplantación de identidad y el uso de fotografías o datos de terceros; la
amenaza, la violencia y la coacción; la solicitud de préstamos, donativos o
transferencias ajenas al Encuentro; la oferta o el consumo de sustancias
ilícitas; la promoción de actividades ilícitas; la extracción automatizada de
información de la Plataforma; y toda conducta dirigida a eludir los mecanismos
de verificación, de moderación o de cobro.

10. Régimen económico: bebidas virtuales. La retribución del Encuentro se
instrumenta mediante bebidas virtuales que el Rentador adquiere dentro de la
Plataforma. El Rentador no entrega dinero directamente al Amigo en renta. Las
bebidas virtuales carecen de valor fuera de la Plataforma, no son transferibles
entre Usuarios y no son canjeables por dinero fuera de los supuestos previstos
en estos términos y en las reglas vigentes publicadas en la aplicación.

11. Custodia y liberación del importe. Desde la adquisición de la bebida
virtual, el importe correspondiente queda retenido en custodia a través de un
proveedor especializado. El importe se libera a favor del Amigo en renta
únicamente después de que el Encuentro haya sido verificado de manera
presencial por la Plataforma, mediante los mecanismos implementados para tal
efecto, que comprenden la lectura de un código en el lugar del Encuentro, la
comprobación de proximidad geográfica y el registro de su duración. Sin
verificación no procede liberación alguna.

12. Comisiones y suscripción. La Plataforma percibe una comisión de compra a
cargo del Rentador y una comisión de servicio que se descuenta del importe que
percibe el Amigo en renta. A la fecha de estos términos, dichas comisiones
ascienden a quince por ciento (15%) y a veinte por ciento (20%),
respectivamente, para Usuarios sin suscripción. La Plataforma ofrece una
suscripción de pago, con un precio vigente de S/ 39.00 mensuales, que modifica
el régimen de comisiones aplicable. Las comisiones, el precio de la suscripción
y sus beneficios son los publicados en la aplicación al momento de cada
operación. Toda modificación se comunicará de forma previa y no afectará
operaciones ya iniciadas.

13. Prohibición de pagos fuera de la Plataforma. Toda retribución vinculada a
un Encuentro debe canalizarse íntegramente a través de la Plataforma. Queda
prohibido acordar, solicitar, ofrecer o ejecutar pagos por medios ajenos a
ella, así como intercambiar números telefónicos, cuentas bancarias, códigos de
cuenta interbancaria, billeteras digitales o cualquier otro dato con esa
finalidad. La infracción de esta cláusula faculta al Operador a suspender o dar
de baja las cuentas involucradas, sin perjuicio de las acciones que
correspondan.

14. Moderación de las comunicaciones. Las comunicaciones cursadas dentro de la
Plataforma están sujetas a mecanismos automatizados de moderación que pueden
detectar, ocultar o bloquear mensajes que contengan datos de contacto,
información bancaria, intentos de pago externo o contenido prohibido por estos
términos. El Usuario acepta dicha moderación como condición de uso. Estos
mecanismos constituyen una medida de prevención y no garantizan la detección de
la totalidad de las conductas infractoras.

15. Cancelación, inasistencia y controversias sobre el importe en custodia. Si
el Encuentro no se realiza, se cancela o se interrumpe, el destino del importe
en custodia se resolverá conforme a las reglas de cancelación, inasistencia y
disputas vigentes publicadas en la aplicación, las cuales forman parte
integrante de estos términos y detallan los supuestos, los plazos y los efectos
aplicables.

16. Seguridad durante el Encuentro. El Encuentro se desarrolla fuera del
entorno digital y bajo responsabilidad exclusiva de los Usuarios que lo
acuerdan. Se recomienda reunirse en lugares públicos y concurridos, mantener
toda la coordinación dentro de la Plataforma e informar a una persona de
confianza. Las herramientas de verificación y de aviso que la Plataforma pone a
disposición constituyen medidas de prevención y no garantizan la seguridad, la
integridad ni la conducta de ningún Usuario. El Operador no supervisa, no
acompaña ni controla el desarrollo del Encuentro.

17. Suspensión y baja de la cuenta. El Operador podrá suspender de forma
preventiva o dar de baja de forma definitiva la cuenta del Usuario que infrinja
estos términos, que sea objeto de reportes fundados, que suministre información
falsa o que incurra en conductas que pongan en riesgo a otros Usuarios o a la
Plataforma. La suspensión preventiva podrá mantenerse mientras dure la
evaluación del caso. Los importes en custodia asociados a operaciones en curso
se resolverán conforme a la cláusula 15. El Usuario podrá solicitar la revisión
de la medida por los canales de atención indicados en la aplicación.

18. Limitación de responsabilidad. El Operador responde por el correcto
funcionamiento de los servicios de intermediación, de verificación y de
canalización de pagos que presta de manera directa. En la máxima medida
permitida por la ley, el Operador no responde por los actos, las omisiones, las
declaraciones ni los daños ocasionados por un Usuario a otro durante el
Encuentro o con ocasión de él, ni por la veracidad de la información que los
Usuarios publican, ni por la calidad de la compañía brindada. Ninguna
disposición de esta cláusula excluye la responsabilidad del Operador por dolo o
culpa inexcusable, ni las garantías que la normativa de protección al
consumidor reconoce con carácter imperativo.

19. Propiedad intelectual. Los signos distintivos, el software, el diseño y los
contenidos de la Plataforma pertenecen al Operador o a sus licenciantes. Se
concede al Usuario una licencia limitada, revocable, no exclusiva e
intransferible para utilizar la Plataforma conforme a estos términos.

20. Datos personales. El tratamiento de los datos personales de los Usuarios,
incluidos los datos de identidad, los datos biométricos y los datos de
ubicación recabados para la verificación del Encuentro, se rige por la Política
de Privacidad, disponible en la aplicación y en el sitio web del Operador, la
cual forma parte integrante de estos términos.

21. Modificación de los términos. El Operador podrá modificar estos términos
por razones legales, regulatorias, técnicas u operativas. Toda nueva versión
será comunicada dentro de la aplicación y requerirá la aceptación expresa del
Usuario antes de que este pueda continuar utilizando la Plataforma. La versión
aceptada, así como la fecha y la hora de su aceptación, quedan registradas.

22. Atención al usuario y reclamos. Las consultas, las quejas y los reclamos se
canalizan por los medios de atención indicados en la aplicación. El Operador
habilita un libro de reclamaciones virtual accesible desde dichos medios,
conforme a la normativa de protección al consumidor.

23. Ley aplicable y jurisdicción. Estos términos se rigen por las leyes de la
República del Perú. Las controversias derivadas de ellos se someten a los
jueces y tribunales del distrito judicial de Lima, sin perjuicio del derecho
del Usuario consumidor de acudir a las autoridades administrativas de
protección al consumidor.

24. Disposiciones finales. La nulidad de alguna de estas cláusulas no afecta la
validez de las demás. La tolerancia del Operador frente a un incumplimiento no
supone renuncia a exigirlo con posterioridad. Estos términos, junto con la
Política de Privacidad y las reglas vigentes publicadas en la aplicación,
constituyen el acuerdo íntegro entre las partes.`;

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

  // Una violación del índice único (perfil_id, version) significa que esta
  // persona YA aceptó esta versión, que es justo la condición de éxito. Pasa
  // cuando `getTosAceptado()` falla de forma transitoria: el guardián devuelve
  // a la pantalla a alguien que ya había aceptado, y sin este caso quedaría
  // atrapado — cada reintento chocaría con la misma fila. Detectado en la
  // revisión de seguridad de D.4.
  if (error?.code === '23505') return { error: null };

  return { error: error ? error.message : null };
}
