import { render, screen } from '../../test-utils';
import userEvent from '@testing-library/user-event';
import FinalScore from './FinalScore';

describe('FinalScore', () => {
  const defaultProps = {
    score: 750,
    setGameMode: vi.fn(),
    nameInputValue: '',
    onNameInputChange: vi.fn(),
    onScoreFormSubmit: vi.fn(),
  };

  it('displays the score', () => {
    render(<FinalScore {...defaultProps} />);
    expect(screen.getByText('750 points')).toBeInTheDocument();
  });

  it('displays the leaderboard prompt', () => {
    render(<FinalScore {...defaultProps} />);
    expect(screen.getByText('Submit your name to the leaderboard')).toBeInTheDocument();
  });

  it('renders the name input with placeholder', () => {
    render(<FinalScore {...defaultProps} />);
    expect(screen.getByPlaceholderText('Name...')).toBeInTheDocument();
  });

  it('shows the current name input value', () => {
    render(<FinalScore {...defaultProps} nameInputValue="Player1" />);
    expect(screen.getByDisplayValue('Player1')).toBeInTheDocument();
  });

  it('calls onNameInputChange when typing', async () => {
    const onNameInputChange = vi.fn();
    render(<FinalScore {...defaultProps} onNameInputChange={onNameInputChange} />);
    await userEvent.type(screen.getByPlaceholderText('Name...'), 'A');
    expect(onNameInputChange).toHaveBeenCalled();
  });

  it('disables Save button when name is empty', () => {
    render(<FinalScore {...defaultProps} nameInputValue="" />);
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
  });

  it('enables Save button when name has content', () => {
    render(<FinalScore {...defaultProps} nameInputValue="Test" />);
    expect(screen.getByRole('button', { name: /save/i })).toBeEnabled();
  });
});
