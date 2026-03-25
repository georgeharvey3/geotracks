interface CurrentScoreProps {
  turnsRemaining: number;
  score: number;
}

const CurrentScore = (props: CurrentScoreProps) => (
  <div>
    <p>Turns Remaining: {props.turnsRemaining}</p>
    <p>Score: {props.score}</p>
  </div>
);

export default CurrentScore;
