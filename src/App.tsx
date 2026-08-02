import { useEffect, useRef } from "react";

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
  useLibraryStatus,
} from "./context/GameContext";
import { ExploreProvider } from "./context/ExploreContext";
import { GAME_MODES } from "./state/gameReducer";

// Screen router: reads the current screen from the game reducer and renders the
// matching view. All game logic lives in the reducer/hooks behind the context.
function AppContent() {
  const { state, dispatch } = useGame();
  const leaderboard = useLeaderboard();
  const dailyRun = useDailyRun();
  const libraryStatus = useLibraryStatus();

  // The app's only piece of URL awareness, and it exists because the review
  // screen must be reachable without being advertised: no control anywhere leads
  // to it.
  //
  // Watched, not read once at mount. Adding `#admin` to the address bar of a tab
  // that is already open changes nothing else about the page — no navigation, no
  // remount — so a mount-only read does nothing at all, and that is the most
  // likely way anybody arrives here.
  useEffect(() => {
    const openIfAsked = () => {
      if (window.location.hash === "#admin") dispatch({ type: "SHOW_ADMIN" });
    };
    openIfAsked();
    window.addEventListener("hashchange", openIfAsked);
    return () => window.removeEventListener("hashchange", openIfAsked);
  }, [dispatch]);

  // Leaving by any of the ordinary exits takes the hash with it, so a reload
  // lands on the menu rather than straight back here.
  //
  // It clears on the way *out* and never on the way in, which is why it needs a
  // ref: on mount both effects run in the same commit, and this one would see
  // the hash beside a `screen` still reading "menu" — the dispatch above is
  // queued, not applied — and strip the URL the moment it worked. `replaceState`
  // fires no `hashchange`, so nothing here can loop.
  const hasBeenAdmin = useRef(false);
  useEffect(() => {
    if (state.screen === "admin") {
      hasBeenAdmin.current = true;
    } else if (hasBeenAdmin.current) {
      hasBeenAdmin.current = false;
      if (window.location.hash === "#admin") {
        window.history.replaceState(
          null,
          "",
          window.location.pathname + window.location.search,
        );
      }
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
          libraryStatus={libraryStatus}
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
