import { render, screen } from '../../test-utils';
import Scoreboard from './ScoreBoard';

describe('Scoreboard', () => {
  const scores = [
    { name: 'Alice', score: 1200 },
    { name: 'Bob', score: 950 },
    { name: 'Charlie', score: 800 },
  ];

  it('renders the Top Scores heading', () => {
    render(<Scoreboard scores={scores} />);
    expect(screen.getByText('Top Scores')).toBeInTheDocument();
  });

  it('renders table headers', () => {
    render(<Scoreboard scores={scores} />);
    expect(screen.getByText('#')).toBeInTheDocument();
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Score')).toBeInTheDocument();
  });

  it('renders all score entries', () => {
    render(<Scoreboard scores={scores} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('1200')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('950')).toBeInTheDocument();
    expect(screen.getByText('Charlie')).toBeInTheDocument();
    expect(screen.getByText('800')).toBeInTheDocument();
  });

  it('renders rank numbers', () => {
    render(<Scoreboard scores={scores} />);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders empty table with no scores', () => {
    render(<Scoreboard scores={[]} />);
    expect(screen.getByText('Top Scores')).toBeInTheDocument();
    // Table headers should still render
    expect(screen.getByText('Name')).toBeInTheDocument();
  });
});
