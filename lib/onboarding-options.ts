import type { ComponentProps } from 'react';
import type MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export type OpcionConIcono = { value: string; label: string; icon: IconName };

/** Hobbies — qué hace la persona. Máximo 5, con "Otro" de texto libre. */
export const HOBBIES: OpcionConIcono[] = [
  { value: 'futbol', label: 'Fútbol', icon: 'soccer' },
  { value: 'voley', label: 'Vóley', icon: 'volleyball' },
  { value: 'bicicleta', label: 'Bicicleta', icon: 'bike' },
  { value: 'gimnasio', label: 'Gimnasio', icon: 'dumbbell' },
  { value: 'correr', label: 'Correr', icon: 'run' },
  { value: 'bailar', label: 'Bailar', icon: 'dance-ballroom' },
  { value: 'cocinar', label: 'Cocinar', icon: 'chef-hat' },
  { value: 'fotografia', label: 'Fotografía', icon: 'camera-outline' },
  { value: 'videojuegos', label: 'Videojuegos', icon: 'gamepad-variant-outline' },
  { value: 'senderismo', label: 'Senderismo', icon: 'hiking' },
  { value: 'surf', label: 'Surf', icon: 'surfing' },
  { value: 'yoga', label: 'Yoga', icon: 'yoga' },
  { value: 'musica', label: 'Tocar música', icon: 'guitar-acoustic' },
  { value: 'pintar', label: 'Pintar', icon: 'palette-outline' },
  { value: 'leer', label: 'Leer', icon: 'book-open-outline' },
  { value: 'cine', label: 'Cine', icon: 'movie-open-outline' },
  { value: 'viajar', label: 'Viajar', icon: 'airplane' },
];

/**
 * Tipo de salida — qué plan busca la persona. Máximo 2, SIN "Otro".
 *
 * El conjunto es cerrado a propósito (spec §1.3 y §7): permite a la fase 2.0
 * filtrar sin normalizar texto libre, y evita que un campo abierto
 * reintroduzca por la puerta de atrás los tipos de salida que el producto
 * deliberadamente no ofrece.
 */
export const TIPOS_SALIDA: OpcionConIcono[] = [
  { value: 'conversar', label: 'Conversar / café', icon: 'coffee-outline' },
  { value: 'comer', label: 'Salir a comer', icon: 'silverware-fork-knife' },
  { value: 'noche', label: 'Vida nocturna', icon: 'glass-cocktail' },
  { value: 'conciertos', label: 'Conciertos y eventos', icon: 'music-note-outline' },
  { value: 'cine_cultura', label: 'Cine y cultura', icon: 'theater' },
  { value: 'deporte', label: 'Deporte o aire libre', icon: 'bike' },
  { value: 'turistear', label: 'Turistear la ciudad', icon: 'map-outline' },
  { value: 'acompanamiento', label: 'Acompañamiento a evento', icon: 'account-tie-outline' },
  { value: 'trabajar', label: 'Estudiar o trabajar juntos', icon: 'laptop' },
  { value: 'sin_plan', label: 'Sin plan fijo', icon: 'shuffle-variant' },
];

/**
 * Distritos de Lima Metropolitana y Callao. Máximo 5, sin iconos.
 *
 * Lista larga (50) a diferencia de las dos anteriores: la pantalla necesita
 * búsqueda, no una grilla plana (spec §1.4).
 */
export const DISTRITOS: string[] = [
  'Ancón', 'Ate', 'Barranco', 'Bellavista', 'Breña', 'Callao', 'Carabayllo',
  'Carmen de La Legua', 'Chaclacayo', 'Chorrillos', 'Cieneguilla', 'Comas',
  'El Agustino', 'Independencia', 'Jesús María', 'La Molina', 'La Perla',
  'La Punta', 'La Victoria', 'Lima (Cercado)', 'Lince', 'Los Olivos',
  'Lurigancho-Chosica', 'Lurín', 'Magdalena del Mar', 'Mi Perú', 'Miraflores',
  'Pachacámac', 'Pucusana', 'Pueblo Libre', 'Puente Piedra', 'Punta Hermosa',
  'Punta Negra', 'Rímac', 'San Bartolo', 'San Borja', 'San Isidro',
  'San Juan de Lurigancho', 'San Juan de Miraflores', 'San Luis',
  'San Martín de Porres', 'San Miguel', 'Santa Anita', 'Santa María del Mar',
  'Santa Rosa', 'Santiago de Surco', 'Surquillo', 'Ventanilla',
  'Villa El Salvador', 'Villa María del Triunfo',
];
