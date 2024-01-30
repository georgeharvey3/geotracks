const menu = (props) => (
  <div>
    <button onClick={() => props.setGameMode(props.gameModes.competition)}>
      Competition Mode
    </button>
    <button onClick={() => props.setGameMode(props.gameModes.infinite)}>
      Infinite Mode
    </button>
  </div>
);

export default menu;
