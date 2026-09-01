import { isProfileComplete, type OwnProfile } from '@/lib/profile-complete';

describe('isProfileComplete', () => {
  const base: OwnProfile = {
    rol: 'amigo',
    nombre: 'Ana',
    alias: 'Ani',
    fecha_nacimiento: '2000-01-01',
    genero: 'femenino',
    profesion: 'Diseñadora',
    foto_url: 'user-1/foto.jpg',
    hobbies: ['cine'],
    tipo_salida: ['Conversar / café'],
    kyc_estado: 'pendiente',
  };

  it('returns true when all required fields are present', () => {
    expect(isProfileComplete(base)).toBe(true);
  });

  it('returns false when null', () => {
    expect(isProfileComplete(null)).toBe(false);
  });

  it.each(['nombre', 'alias', 'fecha_nacimiento', 'genero', 'foto_url'] as const)(
    'returns false when %s is missing',
    (field) => {
      expect(isProfileComplete({ ...base, [field]: null })).toBe(false);
    },
  );

  it('considera completo un perfil sin profesion', () => {
    expect(
      isProfileComplete({
        rol: 'amigo',
        nombre: 'Ana',
        alias: 'ana',
        fecha_nacimiento: '2000-01-01',
        genero: 'Mujer',
        profesion: null,
        foto_url: 'perfil/ana.jpg',
        hobbies: ['Cine'],
        tipo_salida: ['Conversar / café'],
        kyc_estado: 'verificado',
      }),
    ).toBe(true);
  });

  it('considera incompleto un perfil sin fecha de nacimiento', () => {
    expect(
      isProfileComplete({
        rol: 'amigo',
        nombre: 'Ana',
        alias: 'ana',
        fecha_nacimiento: null,
        genero: 'Mujer',
        profesion: null,
        foto_url: 'perfil/ana.jpg',
        hobbies: ['Cine'],
        tipo_salida: ['Conversar / café'],
        kyc_estado: 'verificado',
      }),
    ).toBe(false);
  });
});
