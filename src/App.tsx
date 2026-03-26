import "./App.css";
import "./index.css";
import React, { useEffect, useRef, useState, useCallback } from "react";

import Base from "./Layouts/Base/Base";

import Game from "./Components/Game/Game";
import Menu from "./Components/Menu/Menu";
import FinalScore from "./Components/FinalScore/FinalScore";
import Scoreboard from "./Components/ScoreBoard/ScoreBoard";

import albumsJSON from "./albums.json";
import countriesJSON from "./countries.json";

import getDistance from "./helpers/getDistance";
import getBearing from "./helpers/getBearing";

import { Album, Song, Guess, ScoreEntry } from "./types";

const GAME_MODES = {
  infinite: "infinite",
  competition: "competition",
};

const SCORE_VALUES: Record<number, number> = {
  1: 150,
  2: 80,
  3: 60,
  4: 40,
  5: 20,
};

const NUM_COMPETITION_TURNS = 10;

function App() {
  const [albums, setAlbums] = useState<Album[]>(albumsJSON);
  const [song, setSong] = useState<Song>({} as Song);
  const [submitted, setSubmitted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [correct, setCorrect] = useState(false);

  const [songFinished, setSongFinished] = useState(false);

  const [guesses, setGuesses] = useState<Guess[]>([]);

  const [songPlaying, setSongPlaying] = useState(false);
  const [songReady, setSongReady] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");

  const [showGeoHints, setShowGeoHints] = useState(false);
  const [geoHintsEnabled, setGeoHintsEnabled] = useState(false);

  const [questionIndex, setQuestionIndex] = useState(0);

  const [gameMode, setGameMode] = useState("");

  const [showScoreboard, setShowScoreboard] = useState(false);

  // COMPETITION
  const [turnIndex, setTurnIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [scores, setScores] = useState<ScoreEntry[]>([]);
  const [nameInputValue, setNameInputValue] = useState("");
  const [showFinalScore, setShowFinalScore] = useState(false);

  const countryInputRef = useRef<HTMLInputElement>(null);
  const embedRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<SpotifyEmbedController | null>(null);
  const iframeApiRef = useRef<SpotifyIFrameAPI | null>(null);
  const pendingSongRef = useRef<string | null>(null);

  // Refs to hold latest callback values so global event listeners avoid stale closures
  const onNextSongClickedRef = useRef<() => void>(() => {});

  const toggleSong = useCallback(() => {
    controllerRef.current?.togglePlay();
  }, []);

  useEffect(() => {
    fetchScores().then((scores) => setScores(scores));
  }, []);

  useEffect(() => {
    if (turnIndex === NUM_COMPETITION_TURNS) {
    }
  }, [turnIndex]);

  useEffect(() => {
    if (questionIndex > 0 && songReady) {
      if (window.innerWidth >= 1024) {
        toggleSong();
      }
    }
  }, [songReady, questionIndex, toggleSong]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      const isInputFocused = document.activeElement === countryInputRef.current;
      if (!isInputFocused) {
        if (e.key === " ") {
          toggleSong();
          return;
        }

        if (e.key === "Enter") {
          onNextSongClickedRef.current();
          return;
        }

        countryInputRef.current?.focus();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        countryInputRef.current?.blur();
      }
    };

    document.addEventListener("keypress", handleKeyPress);
    document.addEventListener("keydown", handleKeyDown);

    selectSong();

    return () => {
      document.removeEventListener("keypress", handleKeyPress);
      document.removeEventListener("keydown", handleKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toggleSong]);

  // Convert Spotify URL to URI: https://open.spotify.com/track/XXX -> spotify:track:XXX
  const toSpotifyUri = (url: string): string => {
    const match = url.match(/open\.spotify\.com\/(track|album|episode)\/([a-zA-Z0-9]+)/);
    if (match) return `spotify:${match[1]}:${match[2]}`;
    return url;
  };

  // Initialize the Spotify IFrame API controller once the API is ready and the DOM element exists
  const initController = useCallback((IFrameAPI: SpotifyIFrameAPI) => {
    iframeApiRef.current = IFrameAPI;
    if (controllerRef.current || !embedRef.current) return;

    const initialUri = pendingSongRef.current
      ? toSpotifyUri(pendingSongRef.current)
      : 'spotify:track:placeholder';
    pendingSongRef.current = null;

    IFrameAPI.createController(embedRef.current, { uri: initialUri, width: '100%', height: 152 }, (controller) => {
      controllerRef.current = controller;
      controller.addListener('ready', () => {
        setSongReady(true);
        setSongFinished(false);
      });
      controller.addListener('playback_update', (e) => {
        const { isPaused, position, duration } = e.data;
        const isFinished = duration > 0 && position >= duration;
        setSongPlaying(!isPaused && !isFinished);
        if (isFinished) {
          setSongFinished(true);
        } else if (!isPaused) {
          setSongFinished(false);
        }
      });
    });
  }, []);

  useEffect(() => {
    // If API already loaded, init now (handles Game mounting after API is ready)
    if (iframeApiRef.current && !controllerRef.current && embedRef.current) {
      initController(iframeApiRef.current);
    }
  }, [gameMode, initController]);

  useEffect(() => {
    window.onSpotifyIframeApiReady = (IFrameAPI) => {
      initController(IFrameAPI);
    };
  }, [initController]);

  // Load new track URI when song changes
  useEffect(() => {
    if (song && song.link) {
      setSongReady(false);
      if (controllerRef.current) {
        controllerRef.current.loadUri(toSpotifyUri(song.link));
      } else {
        // Controller not ready yet — queue the song for when it initializes
        pendingSongRef.current = song.link;
      }
    }
  }, [song]);

  useEffect(() => {
    if (guesses.length > 4 && !correct) {
      setFinished(true);
      setErrorMessage(`Answer was: ${song.country}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guesses]);

  const selectSong = () => {
    const albumIndexChoice = Math.floor(Math.random() * albums.length);
    const albumChoice = albums[albumIndexChoice];
    const songIndexChoice = Math.floor(
      Math.random() * albumChoice.tracks.length
    );
    const songChoice = albumChoice.tracks[songIndexChoice];
    const songObj: Song = {
      country: albumChoice.country,
      link: songChoice,
      album: albumChoice.album_name,
    };
    setSong(songObj);

    const newAlbums = albums.filter((_, index) => index !== albumIndexChoice);

    setAlbums(newAlbums);
  };

  const fetchScores = async (): Promise<ScoreEntry[]> => {
    const res = await fetch(
      "https://geotracks-d9b5c-default-rtdb.europe-west1.firebasedatabase.app/scores.json"
    );
    const json = await res.json();

    const scoresArray: ScoreEntry[] = Object.entries(json).map((entry) => ({
      name: entry[0],
      score: entry[1] as number,
    }));
    const scoresArraySorted = scoresArray.sort(
      (score1, score2) => score2.score - score1.score
    );

    return scoresArraySorted;
  };

  const onPlayClicked = () => {
    toggleSong();
  };

  const onFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);

    const countryAnswer = formData.get("myCountry") as string | null;

    if (countryAnswer) {
      const guessedCountry = countriesJSON.find(
        (country) => country.name.toLowerCase() === countryAnswer.toLowerCase()
      );
      if (guessedCountry) {
        setSubmitted(true);
        setErrorMessage("");

        if (countryAnswer.toLowerCase() === song.country.toLowerCase()) {
          setGuesses([...guesses, { country: countryAnswer, correct: true }]);

          setFinished(true);
          setCorrect(true);
          setScore(
            score +
              SCORE_VALUES[guesses.length + 1] *
                Math.abs(Number(geoHintsEnabled) - 2)
          );
        } else {
          const correctCountry = countriesJSON.find(
            (country) => country.name === song.country
          )!;

          const distance = getDistance(
            parseFloat(guessedCountry.lat),
            parseFloat(guessedCountry.lon),
            parseFloat(correctCountry.lat),
            parseFloat(correctCountry.lon)
          );
          const direction = getBearing(
            parseFloat(guessedCountry.lat),
            parseFloat(guessedCountry.lon),
            parseFloat(correctCountry.lat),
            parseFloat(correctCountry.lon)
          );
          setGuesses([
            ...guesses,
            {
              country: countryAnswer,
              correct: false,
              distance: distance,
              direction: direction,
            },
          ]);
        }
      } else {
        setErrorMessage(`Unrecognised country: '${countryAnswer}'`);
      }
    }
  };

  const onCheck = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setShowGeoHints(true);
      setGeoHintsEnabled(true);
    } else {
      setShowGeoHints(false);
    }
  };

  const onNextSongClicked = useCallback(() => {
    if (!finished) {
      return;
    }

    setSubmitted(false);
    setFinished(false);
    setCorrect(false);
    setSongFinished(false);
    setGuesses([]);
    setErrorMessage("");
    setQuestionIndex(prev => prev + 1);

    if (gameMode === GAME_MODES.competition) {
      setGeoHintsEnabled(false);
      setShowGeoHints(false);
      setTurnIndex(prev => prev + 1);

      if (turnIndex === NUM_COMPETITION_TURNS - 1) {
        setShowFinalScore(true);
      }
    }

    if (songPlaying) {
      toggleSong();
    }

    selectSong();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished, songPlaying, gameMode, turnIndex, toggleSong]);

  // Keep the ref in sync so the global keypress handler always calls the latest version
  useEffect(() => {
    onNextSongClickedRef.current = onNextSongClicked;
  }, [onNextSongClicked]);

  const onNameInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.value.length <= 10) {
      setNameInputValue(event.target.value);
    }
  };

  const onScoreFormSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const scoresRes = await fetch(
      "https://geotracks-d9b5c-default-rtdb.europe-west1.firebasedatabase.app/scores.json"
    );
    const scoresJson = await scoresRes.json();

    await fetch(
      "https://geotracks-d9b5c-default-rtdb.europe-west1.firebasedatabase.app/scores.json",
      {
        method: "PUT",
        body: JSON.stringify({ ...scoresJson, [nameInputValue]: score }),
      }
    );

    window.location.reload();
  };

  const onMenuClicked = () => {
    setGameMode("");
    setShowScoreboard(false);
  };

  let content;

  if (gameMode === "") {
    if (showScoreboard) {
      content = <Scoreboard scores={scores.slice(0, 10)} />;
    } else {
      content = (
        <Menu
          gameModes={GAME_MODES}
          setGameMode={setGameMode}
          setShowScoreboard={setShowScoreboard}
        />
      );
    }
  } else if (showFinalScore) {
    content = (
      <FinalScore
        score={score}
        setGameMode={setGameMode}
        nameInputValue={nameInputValue}
        onNameInputChange={onNameInputChange}
        onScoreFormSubmit={onScoreFormSubmit}
      />
    );
  } else {
    content = (
      <Game
        setGameMode={setGameMode}
        songReady={songReady}
        songFinished={songFinished}
        onPlayClicked={onPlayClicked}
        songPlaying={songPlaying}
        onFormSubmit={onFormSubmit}
        finished={finished}
        showGeoHints={showGeoHints}
        onCheck={onCheck}
        errorMessage={errorMessage}
        submitted={submitted}
        guesses={guesses}
        onNextSongClicked={onNextSongClicked}
        song={song}
        embedRef={embedRef}
        isCompetition={gameMode === GAME_MODES.competition}
        turnsRemaining={NUM_COMPETITION_TURNS - turnIndex}
        score={score}
        countryInputRef={countryInputRef}
      />
    );
  }

  return (
    <Base
      showMenuButton={gameMode !== "" || showScoreboard}
      onMenuClicked={onMenuClicked}
    >
      {content}
    </Base>
  );
}

export default App;
