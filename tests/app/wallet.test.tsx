import { render, screen } from '@testing-library/react-native';
import WalletScreen from '@/app/wallet';
import { getBalance } from '@/lib/bar';

jest.mock('@/lib/bar', () => ({
  getBalance: jest.fn(),
}));

const mockedGetBalance = getBalance as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('WalletScreen', () => {
  it('shows the calculated balance from the ledger', async () => {
    mockedGetBalance.mockResolvedValue(420.5);
    await render(<WalletScreen />);

    expect(await screen.findByText('S/ 420.50')).toBeTruthy();
  });

  it('shows S/ 0.00 while there is no ledger activity yet', async () => {
    mockedGetBalance.mockResolvedValue(0);
    await render(<WalletScreen />);

    expect(await screen.findByText('S/ 0.00')).toBeTruthy();
  });
});
