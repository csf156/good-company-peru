// Mock de react-native-safe-area-context: en tests no hay SafeAreaProvider
// nativo, así que se usa el mock oficial de la librería (insets en 0). Permite
// renderizar el primitivo Screen y cualquier pantalla que lo use sin envolver
// cada test en un provider.
jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);
