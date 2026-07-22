import { render, screen } from '../../test-utils';
import userEvent from '@testing-library/user-event';
import Slider from './Slider';

describe('Slider', () => {
  it('renders the GeoHints label', () => {
    render(<Slider checked={false} onCheck={vi.fn()} />);
    expect(screen.getByText('GeoHints')).toBeInTheDocument();
  });

  it('renders unchecked when checked prop is false', () => {
    render(<Slider checked={false} onCheck={vi.fn()} />);
    const toggle = screen.getByRole('switch');
    expect(toggle).not.toBeChecked();
  });

  it('renders checked when checked prop is true', () => {
    render(<Slider checked={true} onCheck={vi.fn()} />);
    const toggle = screen.getByRole('switch');
    expect(toggle).toBeChecked();
  });

  it('calls onCheck when toggled', async () => {
    const onCheck = vi.fn();
    render(<Slider checked={false} onCheck={onCheck} />);
    await userEvent.click(screen.getByRole('switch'));
    expect(onCheck).toHaveBeenCalledTimes(1);
  });
});
