// Mock data for Ayni — Rent a Friend Peru MVP

export type Role = "rentador" | "amigo";
export type Level = "bronce" | "plata" | "oro" | "diamante" | "elite";
export type DrinkCategory = "divertida" | "romantica" | "misteriosa" | "amistosa" | "autor";

export interface Drink {
  id: string;
  name: string;
  category: DrinkCategory;
  categoryLabel: string;
  price: number; // soles
  description: string;
  icon: "beer" | "wine" | "cocktail" | "shot" | "champagne";
}

export interface Friend {
  id: string;
  name: string;
  alias: string;
  age: number;
  profession: string;
  district: string;
  photo: string; // gradient identity
  level: Level;
  interests: string[];
  bio: string;
  verified: boolean;
  premium: boolean;
  raised: number; // total soles recaudados
}

export interface Renter {
  id: string;
  name: string;
  alias: string;
  age: number;
  profession: string;
  photo: string;
  level: Level;
  interests: string[];
  spent: number;
  premium: boolean;
}

export interface Invitation {
  id: string;
  from: string; // user id
  fromName: string;
  fromPhoto: string;
  to: string;
  toName: string;
  drink: Drink;
  status: "pendiente" | "aceptada" | "rechazada" | "confirmada" | "en_curso" | "finalizada";
  createdAt: string;
  message?: string;
  estimatedMinutes: number;
  location?: string;
  meetingTime?: string;
  direction: "sent" | "received";
}

export interface ChatMessage {
  id: string;
  from: "me" | "them";
  text: string;
  time: string;
}

export interface Chat {
  id: string;
  otherName: string;
  otherPhoto: string;
  otherLevel: Level;
  lastMessage: string;
  time: string;
  unread: number;
  drinkName: string;
  confirmed: boolean;
  messages: ChatMessage[];
}

export const LEVEL_META: Record<Level, { label: string; color: string; min: number; max: number; benefits: string[] }> = {
  bronce: { label: "Bronce", color: "var(--bronze)", min: 0, max: 300, benefits: ["Acceso básico a la plataforma"] },
  plata: { label: "Plata", color: "var(--silver)", min: 300, max: 1000, benefits: ["Badge visible", "+10% visibilidad", "Filtros básicos"] },
  oro: { label: "Oro", color: "var(--gold)", min: 1000, max: 3000, benefits: ["Filtros avanzados", "Prioridad en búsqueda", "Notificaciones express"] },
  diamante: { label: "Diamante", color: "var(--diamond)", min: 3000, max: 8000, benefits: ["Match con Diamante+", "Visibilidad premium", "Soporte prioritario"] },
  elite: { label: "Élite", color: "var(--primary)", min: 8000, max: Infinity, benefits: ["Soporte VIP 24/7", "Eventos exclusivos", "Badge dorado animado"] },
};

export const DRINKS: Drink[] = [
  { id: "d1", name: "Cusqueña Golden", category: "divertida", categoryLabel: "Invitación Divertida", price: 18, description: "Cerveza fría, ligera, para romper el hielo.", icon: "beer" },
  { id: "d2", name: "Golden Lager Artesanal", category: "divertida", categoryLabel: "Invitación Divertida", price: 28, description: "Artesanal de Barranco, para tardes largas.", icon: "beer" },
  { id: "d3", name: "Reserva del Valle Sagrado", category: "romantica", categoryLabel: "Invitación Romántica", price: 65, description: "Tinto suave, conversación de cerca.", icon: "wine" },
  { id: "d4", name: "Rosé de Ica", category: "romantica", categoryLabel: "Invitación Romántica", price: 48, description: "Rosado seco, para atardecer en Miraflores.", icon: "wine" },
  { id: "d5", name: "Misterio de Barranco", category: "misteriosa", categoryLabel: "Invitación Misteriosa", price: 52, description: "Coctel de autor con botánicos andinos y humo de palo santo.", icon: "cocktail" },
  { id: "d6", name: "El Pisco Sour Clásico", category: "amistosa", categoryLabel: "Invitación de Amigos", price: 32, description: "El brindis peruano por excelencia.", icon: "cocktail" },
  { id: "d7", name: "Chilcano de Guinda", category: "amistosa", categoryLabel: "Invitación de Amigos", price: 26, description: "Refrescante, para conversaciones sin apuro.", icon: "shot" },
  { id: "d8", name: "Coca Sour Élite", category: "autor", categoryLabel: "Coctel de Autor", price: 88, description: "Autor: hoja de coca macerada, jarabe de algarrobina, espuma de merengue.", icon: "champagne" },
  { id: "d9", name: "Amazonía Salvaje", category: "autor", categoryLabel: "Coctel de Autor", price: 95, description: "Autor: camu camu, aguaje y ron añejo — un viaje sensorial.", icon: "cocktail" },
];

export const FRIENDS: Friend[] = [
  {
    id: "f1", name: "Alessandra Vargas", alias: "Ale", age: 27, profession: "Arquitecta", district: "Miraflores",
    photo: "linear-gradient(135deg, hsl(38 60% 30%), hsl(24 80% 50%), hsl(340 40% 45%))",
    level: "diamante", interests: ["Vinos Tintos", "Jazz en Vivo", "Arte Contemporáneo", "Barranco de noche"],
    bio: "Amante del jazz y los atardeceres frente al mar. Busco conversaciones profundas.",
    verified: true, premium: true, raised: 4820,
  },
  {
    id: "f2", name: "Camila Reyes", alias: "Cami", age: 24, profession: "Chef", district: "Barranco",
    photo: "linear-gradient(135deg, hsl(180 40% 25%), hsl(38 70% 45%), hsl(20 60% 40%))",
    level: "oro", interests: ["Cocktails de autor", "Fotografía", "Vinilos", "Mercados"],
    bio: "Cocinera de día, buscadora de sabores raros de noche. Cuéntame algo que nadie sepa.",
    verified: true, premium: true, raised: 1920,
  },
  {
    id: "f3", name: "Sebastián Ríos", alias: "Seba", age: 29, profession: "Músico", district: "Barranco",
    photo: "linear-gradient(135deg, hsl(220 30% 20%), hsl(38 50% 40%), hsl(0 40% 35%))",
    level: "diamante", interests: ["Jazz", "Cine peruano", "Bares con historia", "Salsa"],
    bio: "Toco piano en un bar de Barranco los jueves. Puedo hablar de cine tres horas seguidas.",
    verified: true, premium: false, raised: 3410,
  },
  {
    id: "f4", name: "Renata Salas", alias: "Rena", age: 26, profession: "Diseñadora", district: "San Isidro",
    photo: "linear-gradient(135deg, hsl(300 30% 25%), hsl(38 70% 55%), hsl(45 60% 50%))",
    level: "plata", interests: ["Café de especialidad", "Libros", "Museos", "Piscos raros"],
    bio: "Vivo entre libros y buenas conversaciones. Prefiero un buen café a una fiesta.",
    verified: true, premium: false, raised: 720,
  },
  {
    id: "f5", name: "Diego Mendoza", alias: "Dieg", age: 31, profession: "Ingeniero", district: "Miraflores",
    photo: "linear-gradient(135deg, hsl(210 40% 20%), hsl(38 40% 35%), hsl(30 50% 45%))",
    level: "oro", interests: ["Running", "Whisky", "Tecnología", "Viajes"],
    bio: "Corro maratones y colecciono whiskies. Me interesan las historias raras.",
    verified: true, premium: true, raised: 2140,
  },
];

export const RENTERS: Renter[] = [
  {
    id: "r1", name: "Martín Delgado", alias: "Martín", age: 34, profession: "Empresario",
    photo: "linear-gradient(135deg, hsl(38 50% 25%), hsl(24 60% 40%))",
    level: "diamante", interests: ["Vino", "Golf", "Arte"], spent: 5320, premium: true,
  },
  {
    id: "r2", name: "Andrea Portal", alias: "Andy", age: 29, profession: "Abogada",
    photo: "linear-gradient(135deg, hsl(340 40% 30%), hsl(38 70% 50%))",
    level: "oro", interests: ["Teatro", "Cocteles", "Viajes"], spent: 1680, premium: true,
  },
];

export const INVITATIONS: Invitation[] = [
  {
    id: "i1", from: "r1", fromName: "Martín D.", fromPhoto: RENTERS[0].photo,
    to: "me", toName: "Yo", drink: DRINKS[7], status: "pendiente",
    createdAt: "Hace 12 min", estimatedMinutes: 90, message: "Me encantaría conversar sobre arte contemporáneo. Un coctel de autor va perfecto.",
    direction: "received",
  },
  {
    id: "i2", from: "r2", fromName: "Andrea P.", fromPhoto: RENTERS[1].photo,
    to: "me", toName: "Yo", drink: DRINKS[2], status: "aceptada",
    createdAt: "Ayer", estimatedMinutes: 120, direction: "received",
  },
  {
    id: "i3", from: "me", fromName: "Yo", fromPhoto: "linear-gradient(135deg, hsl(38 85% 55%), hsl(24 60% 40%))",
    to: "f1", toName: "Alessandra V.", drink: DRINKS[5], status: "pendiente",
    createdAt: "Hace 5 min", estimatedMinutes: 60, direction: "sent",
  },
  {
    id: "i4", from: "me", fromName: "Yo", fromPhoto: "linear-gradient(135deg, hsl(38 85% 55%), hsl(24 60% 40%))",
    to: "f3", toName: "Sebastián R.", drink: DRINKS[8], status: "confirmada",
    createdAt: "Hace 2 días", estimatedMinutes: 120, location: "Ayahuasca Bar, Barranco", meetingTime: "Vie 9:30 PM",
    direction: "sent",
  },
];

export const GLOBAL_INVITATIONS = [
  {
    id: "g1", type: "invitation" as const, fromName: "Martín D.", fromLevel: "diamante" as Level,
    drink: DRINKS[7], zone: "San Isidro / Miraflores", estimatedMinutes: 90, timeAgo: "Hace 8 min",
    interested: 4, note: "Busco alguien con quien conversar de arte y cine. Coctel de autor.",
  },
  {
    id: "g2", type: "invitation" as const, fromName: "Andrea P.", fromLevel: "oro" as Level,
    drink: DRINKS[2], zone: "Barranco", estimatedMinutes: 120, timeAgo: "Hace 25 min",
    interested: 12, note: "Vino tinto y buena conversación en un bar tranquilo.",
  },
  {
    id: "g3", type: "request" as const, fromName: "Camila R.", fromLevel: "oro" as Level,
    drink: DRINKS[8], zone: "Barranco", estimatedMinutes: 60, timeAgo: "Hace 1 h",
    interested: 7, note: "Solicito Coca Sour Élite. Puedo mostrar bares escondidos de Barranco.",
  },
];

export const CHATS: Chat[] = [
  {
    id: "c1", otherName: "Alessandra V.", otherPhoto: FRIENDS[0].photo, otherLevel: "diamante",
    lastMessage: "Perfecto, nos vemos ahí ✨", time: "20:14", unread: 1,
    drinkName: "Pisco Sour Clásico", confirmed: true,
    messages: [
      { id: "m1", from: "them", text: "¡Hola! Acepté tu invitación 🍸", time: "19:45" },
      { id: "m2", from: "me", text: "Genial, ¿te parece bien este viernes en Ayahuasca Bar?", time: "19:47" },
      { id: "m3", from: "them", text: "Sí, ahí es un clásico. ¿A las 9?", time: "19:50" },
      { id: "m4", from: "me", text: "9:30 mejor. Confirmemos con la app.", time: "19:55" },
      { id: "m5", from: "them", text: "Perfecto, nos vemos ahí ✨", time: "20:14" },
    ],
  },
  {
    id: "c2", otherName: "Sebastián R.", otherPhoto: FRIENDS[2].photo, otherLevel: "diamante",
    lastMessage: "Confirmado. Llevo mi cuaderno.", time: "Ayer", unread: 0,
    drinkName: "Amazonía Salvaje", confirmed: true,
    messages: [
      { id: "m1", from: "them", text: "Acepto. Toco en El Cachivache los jueves.", time: "Ayer" },
      { id: "m2", from: "me", text: "Vamos ahí entonces. Después del set.", time: "Ayer" },
      { id: "m3", from: "them", text: "Confirmado. Llevo mi cuaderno.", time: "Ayer" },
    ],
  },
  {
    id: "c3", otherName: "Camila R.", otherPhoto: FRIENDS[1].photo, otherLevel: "oro",
    lastMessage: "Hola! Cuéntame más de la idea 👀", time: "Mar", unread: 2,
    drinkName: "Coca Sour Élite", confirmed: false,
    messages: [
      { id: "m1", from: "me", text: "Hola Cami, te invité un Coca Sour Élite.", time: "Mar" },
      { id: "m2", from: "them", text: "Hola! Cuéntame más de la idea 👀", time: "Mar" },
    ],
  },
];

export const MY_BAR: Array<{ drink: Drink; stock: number }> = [
  { drink: DRINKS[5], stock: 2 },
  { drink: DRINKS[2], stock: 1 },
  { drink: DRINKS[0], stock: 4 },
  { drink: DRINKS[8], stock: 1 },
];

export const CURRENT_USER = {
  name: "Tú",
  alias: "tuvide",
  level: "oro" as Level,
  balance: 420,
  spent: 1240,
  raised: 0,
  premium: false,
  role: "rentador" as Role,
};

export function levelForAmount(amount: number): Level {
  if (amount >= 8000) return "elite";
  if (amount >= 3000) return "diamante";
  if (amount >= 1000) return "oro";
  if (amount >= 300) return "plata";
  return "bronce";
}

export function nextLevelProgress(amount: number): { current: Level; next: Level | null; percent: number; toNext: number } {
  const current = levelForAmount(amount);
  const order: Level[] = ["bronce", "plata", "oro", "diamante", "elite"];
  const idx = order.indexOf(current);
  const next = idx < order.length - 1 ? order[idx + 1] : null;
  if (!next) return { current, next: null, percent: 100, toNext: 0 };
  const meta = LEVEL_META[current];
  const percent = Math.min(100, ((amount - meta.min) / (meta.max - meta.min)) * 100);
  return { current, next, percent, toNext: meta.max - amount };
}

// Calculation for renter total when buying a drink
export const RENTER_FEE_PERCENT = 0.20; // 15% service + 5% processing
export function calcTotalWithFees(price: number): { drink: number; service: number; processing: number; total: number } {
  return {
    drink: price,
    service: Math.round(price * 0.15 * 100) / 100,
    processing: Math.round(price * 0.05 * 100) / 100,
    total: Math.round(price * (1 + RENTER_FEE_PERCENT) * 100) / 100,
  };
}
