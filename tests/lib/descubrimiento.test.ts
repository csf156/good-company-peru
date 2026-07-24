import { getPerfilesDescubrir } from '@/lib/descubrimiento';
import { getOwnProfile } from '@/lib/profile';
import { supabase } from '@/lib/supabase';

jest.mock('@/lib/profile', () => ({
  getOwnProfile: jest.fn(),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

const mockedGetOwnProfile = getOwnProfile as jest.Mock;
const mockedSupabase = supabase as unknown as { from: jest.Mock };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getPerfilesDescubrir', () => {
  it('returns null when the caller has no profile yet', async () => {
    mockedGetOwnProfile.mockResolvedValue(null);

    const result = await getPerfilesDescubrir();

    expect(result).toBeNull();
    expect(mockedSupabase.from).not.toHaveBeenCalled();
  });

  it('queries verified perfiles of the OPPOSITE rol for a rentador', async () => {
    mockedGetOwnProfile.mockResolvedValue({ rol: 'rentador' });
    const eqKyc = jest.fn().mockResolvedValue({
      data: [{ id: 'p1', rol: 'amigo', alias: 'Beto', kyc_estado: 'verificado' }],
      error: null,
    });
    const eqRol = jest.fn().mockReturnValue({ eq: eqKyc });
    const select = jest.fn().mockReturnValue({ eq: eqRol });
    mockedSupabase.from.mockReturnValue({ select });

    const result = await getPerfilesDescubrir();

    expect(mockedSupabase.from).toHaveBeenCalledWith('perfiles_publicos');
    expect(eqRol).toHaveBeenCalledWith('rol', 'amigo');
    expect(eqKyc).toHaveBeenCalledWith('kyc_estado', 'verificado');
    expect(result).toEqual({
      rolPropio: 'rentador',
      perfiles: [{ id: 'p1', rol: 'amigo', alias: 'Beto', kyc_estado: 'verificado' }],
    });
  });

  it('queries verified perfiles of the OPPOSITE rol for an amigo', async () => {
    mockedGetOwnProfile.mockResolvedValue({ rol: 'amigo' });
    const eqKyc = jest.fn().mockResolvedValue({ data: [], error: null });
    const eqRol = jest.fn().mockReturnValue({ eq: eqKyc });
    const select = jest.fn().mockReturnValue({ eq: eqRol });
    mockedSupabase.from.mockReturnValue({ select });

    await getPerfilesDescubrir();

    expect(eqRol).toHaveBeenCalledWith('rol', 'rentador');
  });

  it('returns an empty perfiles array on query error instead of throwing', async () => {
    mockedGetOwnProfile.mockResolvedValue({ rol: 'amigo' });
    const eqKyc = jest.fn().mockResolvedValue({ data: null, error: { message: 'boom' } });
    const eqRol = jest.fn().mockReturnValue({ eq: eqKyc });
    const select = jest.fn().mockReturnValue({ eq: eqRol });
    mockedSupabase.from.mockReturnValue({ select });

    const result = await getPerfilesDescubrir();

    expect(result).toEqual({ rolPropio: 'amigo', perfiles: [] });
  });
});
