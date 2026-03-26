import { render, screen } from '../../test-utils';
import Guesses from './Guesses';
import { Guess } from '../../types';

describe('Guesses', () => {
  it('renders a correct guess with country name', () => {
    const guesses: Guess[] = [{ country: 'France', correct: true }];
    render(<Guesses guesses={guesses} showGeoHints={false} />);
    expect(screen.getByText('France')).toBeInTheDocument();
    expect(screen.getByTestId('CheckCircleIcon')).toBeInTheDocument();
  });

  it('renders an incorrect guess with cross icon', () => {
    const guesses: Guess[] = [
      { country: 'Germany', correct: false, distance: 500, direction: 'NE' },
    ];
    render(<Guesses guesses={guesses} showGeoHints={false} />);
    expect(screen.getByText('Germany')).toBeInTheDocument();
    expect(screen.getByTestId('CancelIcon')).toBeInTheDocument();
  });

  it('shows distance and direction when showGeoHints is true', () => {
    const guesses: Guess[] = [
      { country: 'Spain', correct: false, distance: 1234.56, direction: 'SW' },
    ];
    render(<Guesses guesses={guesses} showGeoHints={true} />);
    expect(screen.getByText('1235 km')).toBeInTheDocument();
    expect(screen.getByTestId('SouthWestIcon')).toBeInTheDocument();
  });

  it('hides distance and direction when showGeoHints is false', () => {
    const guesses: Guess[] = [
      { country: 'Spain', correct: false, distance: 1234, direction: 'SW' },
    ];
    render(<Guesses guesses={guesses} showGeoHints={false} />);
    expect(screen.queryByText(/km/)).not.toBeInTheDocument();
    expect(screen.queryByTestId('SouthWestIcon')).not.toBeInTheDocument();
  });

  it('renders multiple guesses', () => {
    const guesses: Guess[] = [
      { country: 'Brazil', correct: false, distance: 8000, direction: 'S' },
      { country: 'Argentina', correct: false, distance: 3000, direction: 'N' },
      { country: 'Colombia', correct: true },
    ];
    render(<Guesses guesses={guesses} showGeoHints={false} />);
    expect(screen.getByText('Brazil')).toBeInTheDocument();
    expect(screen.getByText('Argentina')).toBeInTheDocument();
    expect(screen.getByText('Colombia')).toBeInTheDocument();
  });
});
