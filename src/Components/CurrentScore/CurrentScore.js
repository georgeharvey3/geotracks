const currentScore = (props) => (
  <div>
    <p>Turns Remaining: {props.turnsRemaining}</p>
    <p>Score: {props.score}</p>
  </div>
);

export default currentScore;
