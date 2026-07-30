import "./App.css";
import "./index.css";

import Base from "./Layouts/Base/Base";
import Menu from "./Components/Menu/Menu";
import RunSummaryScreen from "./Components/RunSummaryScreen/RunSummaryScreen";
import Scoreboard from "./Components/ScoreBoard/ScoreBoard";
import GameScreen from "./Components/GameScreen/GameScreen";
import ExploreScreen from "./Components/ExploreScreen/ExploreScreen";

import { GameProvider, useGame, useLeaderboard } from "./context/GameContext";
import { ExploreProvider } from "./context/ExploreContext";
import { GAME_MODES } from "./state/gameReducer";

// Screen router: reads the current screen from the game reducer and renders the
// matching view. All game logic lives in the reducer/hooks behind the context.
function AppContent() {
  const { state, dispatch } = useGame();
  const leaderboard = useLeaderboard();

  let content;
  switch (state.screen) {
    case "scoreboard":
      content = <Scoreboard scores={leaderboard.scores.slice(0, 10)} />;
      break;
    case "runSummary":
      content = <RunSummaryScreen />;
      break;
    case "playing":
      content = <GameScreen />;
      break;
    case "explore":
      content = <ExploreScreen />;
      break;
    case "menu":
    default:
      content = (
        <Menu
          gameModes={GAME_MODES}
          setGameMode={(mode) => dispatch({ type: "SET_MODE", mode })}
          setShowScoreboard={() => dispatch({ type: "SHOW_SCOREBOARD" })}
          setShowExplore={() => dispatch({ type: "SHOW_EXPLORE" })}
        />
      );
  }

  // Every map surface is full-bleed: the map is the screen, and the title and
  // home button float over it as chrome.
  const isMapSurface =
    state.screen === "playing" ||
    state.screen === "explore" ||
    state.screen === "runSummary";

  return (
    <Base
      showMenuButton={state.screen !== "menu"}
      fullBleed={isMapSurface}
      onMenuClicked={() => dispatch({ type: "RESET_TO_MENU" })}
    >
      {content}
    </Base>
  );
}

// The two providers are siblings, not a hierarchy: neither reads the other
// (ADR-0003). Explore's queues live here so a trip to the menu and back within
// a visit keeps the player's place; nothing survives a reload.
function App() {
  return (
    <GameProvider>
      <ExploreProvider>
        <AppContent />
      </ExploreProvider>
    </GameProvider>
  );
}

export default App;
