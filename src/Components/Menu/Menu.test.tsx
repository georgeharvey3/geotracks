import { render, screen } from '../../test-utils';
import userEvent from '@testing-library/user-event';
import Menu from './Menu';

const gameModes = { infinite: 'infinite', competition: 'competition' };

describe('Menu', () => {
  it('renders all three buttons', () => {
    render(
      <Menu gameModes={gameModes} setGameMode={jest.fn()} setShowScoreboard={jest.fn()} />
    );
    expect(screen.getByText('Competition Mode')).toBeInTheDocument();
    expect(screen.getByText('Infinite Mode')).toBeInTheDocument();
    expect(screen.getByText('Scoreboard')).toBeInTheDocument();
  });

  it('calls setGameMode with competition when Competition button clicked', async () => {
    const setGameMode = jest.fn();
    render(
      <Menu gameModes={gameModes} setGameMode={setGameMode} setShowScoreboard={jest.fn()} />
    );
    await userEvent.click(screen.getByText('Competition Mode'));
    expect(setGameMode).toHaveBeenCalledWith('competition');
  });

  it('calls setGameMode with infinite when Infinite button clicked', async () => {
    const setGameMode = jest.fn();
    render(
      <Menu gameModes={gameModes} setGameMode={setGameMode} setShowScoreboard={jest.fn()} />
    );
    await userEvent.click(screen.getByText('Infinite Mode'));
    expect(setGameMode).toHaveBeenCalledWith('infinite');
  });

  it('calls setShowScoreboard when Scoreboard button clicked', async () => {
    const setShowScoreboard = jest.fn();
    render(
      <Menu gameModes={gameModes} setGameMode={jest.fn()} setShowScoreboard={setShowScoreboard} />
    );
    await userEvent.click(screen.getByText('Scoreboard'));
    expect(setShowScoreboard).toHaveBeenCalledWith(true);
  });
});
