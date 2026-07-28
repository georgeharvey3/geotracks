import "./App.css";
import "./index.css";
import React from "react";

import Base from "./Layouts/Base/Base";
import Menu from "./Components/Menu/Menu";
import FinalScore from "./Components/FinalScore/FinalScore";
import Scoreboard from "./Components/ScoreBoard/ScoreBoard";
import GameScreen from "./Components/GameScreen/GameScreen";

import { GameProvider, useGame, useLeaderboard } from "./context/GameContext";
import { GAME_MODES } from "./state/gameReducer";

// Screen router: reads the current screen from the game reducer and renders the
// matching view. All game logic lives in the reducer/hooks behind the context.
function AppContent() {
  const { state, dispatch } = useGame();
  const leaderboard = useLeaderboard();

  const onScoreFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await leaderboard.submitScore(state.nameInputValue, state.score);
  };

  let content;
  switch (state.screen) {
    case "scoreboard":
      content = <Scoreboard scores={leaderboard.scores.slice(0, 10)} />;
      break;
    case "finalScore":
      content = (
        <FinalScore
          score={state.score}
          setGameMode={(mode) => dispatch({ type: "SET_MODE", mode })}
          nameInputValue={state.nameInputValue}
          onNameInputChange={(e) =>
            dispatch({ type: "SET_NAME", value: e.target.value })
          }
          onScoreFormSubmit={onScoreFormSubmit}
        />
      );
      break;
    case "playing":
      content = <GameScreen />;
      break;
    case "menu":
    default:
      content = (
        <Menu
          gameModes={GAME_MODES}
          setGameMode={(mode) => dispatch({ type: "SET_MODE", mode })}
          setShowScoreboard={() => dispatch({ type: "SHOW_SCOREBOARD" })}
        />
      );
  }

  return (
    <Base
      showMenuButton={state.screen !== "menu"}
      wide={state.screen === "playing"}
      onMenuClicked={() => dispatch({ type: "RESET_TO_MENU" })}
    >
      {content}
    </Base>
  );
}

function App() {
  return (
    <GameProvider>
      <AppContent />
    </GameProvider>
  );
}

export default App;
