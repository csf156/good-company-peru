import { render } from '@testing-library/react-native';
import RootLayout from '@/app/_layout';
import { useAuthSession } from '@/hooks/useAuthSession';

jest.mock('@/hooks/useAuthSession', () => ({
  useAuthSession: jest.fn(),
}));
jest.mock('@/lib/profile', () => ({
  getOwnProfile: jest.fn(),
  isProfileComplete: jest.fn(),
}));

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  Stack: () => null,
  useRouter: () => ({ replace: mockReplace }),
  useSegments: () => ['index'],
}));

const mockedUseAuthSession = useAuthSession as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('RootLayout auth guard', () => {
  it('redirects to sign-in when there is no session', async () => {
    mockedUseAuthSession.mockReturnValue({ session: null, loading: false });

    await render(<RootLayout />);

    expect(mockReplace).toHaveBeenCalledWith('/(auth)/sign-in');
  });
});
