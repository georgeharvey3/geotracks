import { GameModes } from '../../types';

interface MenuProps {
  gameModes: GameModes;
  setGameMode: (mode: string) => void;
  setShowScoreboard: (show: boolean) => void;
}

const Menu = (props: MenuProps) => (
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

export default Menu;
