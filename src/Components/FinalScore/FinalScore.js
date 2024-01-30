const finalScore = (props) => (
  <div>
    <h2>You scored {props.score} points</h2>
    <form onSubmit={props.onScoreFormSubmit}>
      <input name="score" value={props.nameInputValue} onChange={props.onNameInputChange}/>
      <input type="submit" value="Save Score" />
    </form>
  </div>
);

export default finalScore;