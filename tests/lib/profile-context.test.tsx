import { renderHook } from '@testing-library/react-native';
import { ProfileRefreshContext, useProfileRefresh } from '@/lib/profile-context';

describe('useProfileRefresh', () => {
  it('devuelve una función no-op por defecto (sin Provider)', async () => {
    const { result } = await renderHook(() => useProfileRefresh());
    expect(() => result.current()).not.toThrow();
  });

  it('devuelve el valor provisto por el contexto', async () => {
    const spy = jest.fn();
    const { result } = await renderHook(() => useProfileRefresh(), {
      wrapper: ({ children }) => (
        <ProfileRefreshContext.Provider value={spy}>{children}</ProfileRefreshContext.Provider>
      ),
    });

    result.current();

    expect(spy).toHaveBeenCalledTimes(1);
  });
});
