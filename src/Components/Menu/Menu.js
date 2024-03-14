const menu = (props) => (
  <>
    <div className="buttons">
      <button className="button" onClick={() => props.setGameMode(props.gameModes.competition)}>
        Competition Mode
      </button>
      <button className="button" onClick={() => props.setGameMode(props.gameModes.infinite)}>
        Infinite Mode
      </button>
      <button className="button" onClick={() => props.setShowScoreboard(true)}>
        Scoreboard
      </button>
    </div>
  </>
);

export default menu;
