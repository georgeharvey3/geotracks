import { render, screen } from '../../test-utils';
import CurrentScore from './CurrentScore';

describe('CurrentScore', () => {
  it('displays turns remaining', () => {
    render(<CurrentScore turnsRemaining={7} score={0} />);
    expect(screen.getByText('Turns: 7')).toBeInTheDocument();
  });

  it('displays the current score', () => {
    render(<CurrentScore turnsRemaining={5} score={310} />);
    expect(screen.getByText('Score: 310')).toBeInTheDocument();
  });

  it('updates when props change', () => {
    const { rerender } = render(<CurrentScore turnsRemaining={10} score={0} />);
    expect(screen.getByText('Turns: 10')).toBeInTheDocument();
    expect(screen.getByText('Score: 0')).toBeInTheDocument();

    rerender(<CurrentScore turnsRemaining={3} score={450} />);
    expect(screen.getByText('Turns: 3')).toBeInTheDocument();
    expect(screen.getByText('Score: 450')).toBeInTheDocument();
  });
});
