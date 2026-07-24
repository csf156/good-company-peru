import { detectarFuga } from '../../supabase/functions/_shared/moderacion';

describe('detectarFuga — patrones anti-fuga', () => {
  describe('teléfonos peruanos', () => {
    it('marca un celular de 9 dígitos que empieza en 9', () => {
      expect(detectarFuga('mi numero es 987654321')).toBe(true);
    });

    it('marca un celular con guiones', () => {
      expect(detectarFuga('llamame al 987-654-321')).toBe(true);
    });

    it('marca un celular con espacios', () => {
      expect(detectarFuga('987 654 321 es mi cel')).toBe(true);
    });

    it('marca un celular con prefijo +51', () => {
      expect(detectarFuga('escribeme a +51 987654321')).toBe(true);
    });

    it('marca un celular con prefijo 51 pegado', () => {
      expect(detectarFuga('51987654321')).toBe(true);
    });
  });

  describe('secuencias largas de dígitos (cuenta / CCI)', () => {
    it('marca una CCI de 20 dígitos', () => {
      expect(detectarFuga('mi cci 00212345678901234567')).toBe(true);
    });

    it('marca una cuenta de 14 dígitos con guiones', () => {
      expect(detectarFuga('cuenta 191-2345678-0-12')).toBe(true);
    });
  });

  describe('palabras clave de pago externo', () => {
    it('marca "yape"', () => {
      expect(detectarFuga('mejor pagame por yape')).toBe(true);
    });

    it('marca "yapeame" (variante)', () => {
      expect(detectarFuga('yapeame nomas')).toBe(true);
    });

    it('marca "plin"', () => {
      expect(detectarFuga('te paso mi plin')).toBe(true);
    });

    it('marca "transferencia"', () => {
      expect(detectarFuga('hacemos una transferencia')).toBe(true);
    });

    it('marca "cci" como palabra', () => {
      expect(detectarFuga('te doy mi CCI')).toBe(true);
    });

    it('marca bancos (bcp, interbank, bbva)', () => {
      expect(detectarFuga('tengo cuenta en el BCP')).toBe(true);
      expect(detectarFuga('mi banco es interbank')).toBe(true);
      expect(detectarFuga('uso BBVA')).toBe(true);
    });

    it('es insensible a mayúsculas', () => {
      expect(detectarFuga('YAPE porfa')).toBe(true);
    });
  });

  describe('texto inocuo (sin falsos positivos)', () => {
    it('no marca un saludo normal', () => {
      expect(detectarFuga('Hola, nos vemos mañana en el bar')).toBe(false);
    });

    it('no marca un número de casa de 3 dígitos', () => {
      expect(detectarFuga('vivo en la casa 123')).toBe(false);
    });

    it('no marca una hora como "8pm"', () => {
      expect(detectarFuga('nos vemos 8pm')).toBe(false);
    });

    it('no marca "cuéntame" (acento, no es "cuenta")', () => {
      expect(detectarFuga('cuéntame algo de ti')).toBe(false);
    });

    it('no marca un precio de 2 dígitos', () => {
      expect(detectarFuga('la bebida cuesta 40 soles')).toBe(false);
    });

    it('no marca una cadena vacía', () => {
      expect(detectarFuga('')).toBe(false);
    });
  });
});
