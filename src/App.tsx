import { useEffect } from "react";

import "./App.css";
import "./index.css";

import Base from "./Layouts/Base/Base";
import Menu from "./Components/Menu/Menu";
import BackdropMap from "./Components/BackdropMap/BackdropMap";
import RunSummaryScreen from "./Components/RunSummaryScreen/RunSummaryScreen";
import Scoreboard from "./Components/ScoreBoard/ScoreBoard";
import GameScreen from "./Components/GameScreen/GameScreen";
import ExploreScreen from "./Components/ExploreScreen/ExploreScreen";
import SuggestScreen from "./Components/SuggestScreen/SuggestScreen";
import AdminScreen from "./Components/AdminScreen/AdminScreen";

import {
  GameProvider,
  useDailyRun,
  useGame,
  useLeaderboard,
} from "./context/GameContext";
import { ExploreProvider } from "./context/ExploreContext";
import { GAME_MODES } from "./state/gameReducer";

// Screen router: reads the current screen from the game reducer and renders the
// matching view. All game logic lives in the reducer/hooks behind the context.
function AppContent() {
  const { state, dispatch } = useGame();
  const leaderboard = useLeaderboard();
  const dailyRun = useDailyRun();

  // The app's only piece of URL awareness, and it exists because the review
  // screen must be reachable without being advertised: no control anywhere leads
  // to it. Read once at mount rather than watched — this is a bookmark, not
  // routing, and the app has none. Leaving the screen by any of the ordinary
  // exits clears the hash, so a reload lands back on the menu.
  useEffect(() => {
    if (window.location.hash === "#admin") dispatch({ type: "SHOW_ADMIN" });
  }, [dispatch]);

  useEffect(() => {
    if (state.screen !== "admin" && window.location.hash === "#admin") {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [state.screen]);

  // One button, three states of the day's record: start today's Run, drop back
  // into the one left unfinished, or reopen the one already played.
  const onDailyRun = () => {
    if (dailyRun.record === null) {
      dispatch({ type: "START_RUN" });
    } else if (dailyRun.record.status === "in-progress") {
      dispatch({ type: "RESUME_RUN", record: dailyRun.record });
    } else {
      dispatch({ type: "SHOW_RUN_SUMMARY", record: dailyRun.record });
    }
  };

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
    case "suggest":
      content = <SuggestScreen />;
      break;
    case "admin":
      content = <AdminScreen />;
      break;
    case "menu":
    default:
      content = (
        <Menu
          gameModes={GAME_MODES}
          setGameMode={(mode) => dispatch({ type: "SET_MODE", mode })}
          dailyRunStatus={dailyRun.status}
          onDailyRun={onDailyRun}
          setShowScoreboard={() => dispatch({ type: "SHOW_SCOREBOARD" })}
          setShowExplore={() => dispatch({ type: "SHOW_EXPLORE" })}
          setShowSuggest={() => dispatch({ type: "SHOW_SUGGEST" })}
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
      screenKey={state.screen}
      // Every content page stands on the map: they are the screens that are
      // about the game without being made of it, and the backdrop is what says
      // so. The map surfaces have no use for it — they *are* the map.
      backdrop={isMapSurface ? undefined : <BackdropMap />}
      onMenuClicked={() => dispatch({ type: "RESET_TO_MENU" })}
    >
      {content}
    </Base>
  );
}

// The two providers are siblings, not a hierarchy: neither reads the other
// (ADR-0003). Explore's queues live here so a country chosen again picks up
// where it left off; the chosen country itself goes with the screen, so a trip
// to the menu and back is silence. Nothing survives a reload.
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
