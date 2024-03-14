const scoreboard = (props) => {
  return (
    <div>
      <h2>Top Scores</h2>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Score</th>
          </tr>
        </thead>
        <tbody>
          {props.scores.map(score => (
            <tr key={score.name}>
              <td>{score.name}</td>
              <td>{score.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default scoreboard;
