import { render, screen } from '@testing-library/react-native';
import { SideTexture } from '@/components/SideTexture';

describe('SideTexture', () => {
  it('es decorativa para lectores de pantalla', async () => {
    await render(<SideTexture height={400} />);
    const panel = screen.getByTestId('side-texture', { hidden: true });
    expect(panel.props.accessibilityElementsHidden).toBe(true);
    expect(panel.props.importantForAccessibility).toBe('no-hide-descendants');
  });

  it('mantiene el total de puntos en el orden de cientos, no miles, para una altura de escritorio típica', async () => {
    await render(<SideTexture height={900} />);
    const panel = screen.getByTestId('side-texture', { hidden: true });
    expect(panel.children.length).toBeGreaterThan(0);
    expect(panel.children.length).toBeLessThan(1000);
  });
});
