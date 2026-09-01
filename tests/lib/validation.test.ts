import { isValidEmail, toE164Peru, isMayorDeEdad, parseListInput } from '@/lib/validation';

describe('isValidEmail', () => {
  it('accepts a standard email', () => {
    expect(isValidEmail('ana@example.com')).toBe(true);
  });

  it('rejects a string without @', () => {
    expect(isValidEmail('ana.example.com')).toBe(false);
  });

  it('rejects an email without a domain', () => {
    expect(isValidEmail('ana@')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidEmail('')).toBe(false);
  });
});

describe('toE164Peru', () => {
  it('converts a 9-digit mobile number to E.164', () => {
    expect(toE164Peru('987654321')).toBe('+51987654321');
  });

  it('accepts a number already prefixed with +51', () => {
    expect(toE164Peru('+51987654321')).toBe('+51987654321');
  });

  it('strips spaces and dashes before validating', () => {
    expect(toE164Peru('987 654 321')).toBe('+51987654321');
    expect(toE164Peru('987-654-321')).toBe('+51987654321');
  });

  it('rejects a number that does not start with 9', () => {
    expect(toE164Peru('123456789')).toBeNull();
  });

  it('rejects a number with the wrong length', () => {
    expect(toE164Peru('98765')).toBeNull();
    expect(toE164Peru('9876543210')).toBeNull();
  });

  it('rejects non-numeric input', () => {
    expect(toE164Peru('abcdefghi')).toBeNull();
  });
});

describe('isMayorDeEdad', () => {
  // Fecha fija para que el test no dependa del día en que corre.
  const HOY = new Date('2026-08-25T12:00:00Z');

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(HOY);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('acepta a quien cumple exactamente 18 hoy', () => {
    expect(isMayorDeEdad('2008-08-25')).toBe(true);
  });

  it('rechaza a quien cumple 18 mañana', () => {
    expect(isMayorDeEdad('2008-08-26')).toBe(false);
  });

  it('rechaza 17 años y 11 meses', () => {
    expect(isMayorDeEdad('2008-09-25')).toBe(false);
  });

  it('rechaza una fecha inválida', () => {
    expect(isMayorDeEdad('no-es-fecha')).toBe(false);
  });

  it('rechaza una fecha futura', () => {
    expect(isMayorDeEdad('2030-01-01')).toBe(false);
  });
});

describe('parseListInput', () => {
  it('splits a comma-separated string into trimmed items', () => {
    expect(parseListInput('viajar, cine,  música')).toEqual(['viajar', 'cine', 'música']);
  });

  it('drops empty entries from stray commas', () => {
    expect(parseListInput('viajar,, cine,')).toEqual(['viajar', 'cine']);
  });

  it('returns an empty array for blank input', () => {
    expect(parseListInput('   ')).toEqual([]);
  });
});
