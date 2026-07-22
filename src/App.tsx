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
import getDailySongs from "./helpers/getDailySongs";

import { Album, Song, Guess, ScoreEntry } from "./types";
import { SCORES_URL } from "./config";

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
  const [dailySongs] = useState<Song[]>(() => getDailySongs(albumsJSON));
  const dailySongIndexRef = useRef(0);
  const [albums, setAlbums] = useState<Album[]>(albumsJSON);
  const [song, setSong] = useState<Song>({} as Song);
  const [submitted, setSubmitted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [correct, setCorrect] = useState(false);

  const [songFinished, setSongFinished] = useState(false);

  const [guesses, setGuesses] = useState<Guess[]>([]);

  const [songPlaying, setSongPlaying] = useState(false);
  const [songReady, setSongReady] = useState(false);
  const [songLoadFailed, setSongLoadFailed] = useState(false);

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
  const songLoadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);
  const replayPendingRef = useRef(false);
  const MAX_AUTO_RETRIES = 3;
  const LOAD_TIMEOUT_MS = 10000;

  // Refs to hold latest callback values so global event listeners avoid stale closures
  const onNextSongClickedRef = useRef<() => void>(() => {});
  const onPlayClickedRef = useRef<() => void>(() => {});

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
          onPlayClickedRef.current();
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

  const destroyController = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.destroy();
      controllerRef.current = null;
    }
    if (embedRef.current) {
      embedRef.current.innerHTML = '';
    }
  }, []);

  // Initialize the Spotify IFrame API controller once the API is ready and the DOM element exists
  const initController = useCallback((IFrameAPI: SpotifyIFrameAPI) => {
    iframeApiRef.current = IFrameAPI;
    console.log('[initController] controllerRef exists:', !!controllerRef.current, 'embedRef exists:', !!embedRef.current);
    if (controllerRef.current || !embedRef.current) {
      console.log('[initController] bailing out early');
      return;
    }
    if (!pendingSongRef.current) {
      console.log('[initController] no pending song, bailing out');
      return;
    }

    const initialUri = toSpotifyUri(pendingSongRef.current);
    console.log('[initController] creating controller with URI:', initialUri);
    pendingSongRef.current = null;

    IFrameAPI.createController(embedRef.current, { uri: initialUri, width: '100%', height: 152 }, (controller) => {
      console.log('[initController] controller callback fired');
      controllerRef.current = controller;
      controller.addListener('ready', () => {
        console.log('[initController] ready event fired');
        if (songLoadTimerRef.current) {
          clearTimeout(songLoadTimerRef.current);
          songLoadTimerRef.current = null;
        }
        retryCountRef.current = 0;
        setSongLoadFailed(false);
        setSongReady(true);
        setSongFinished(false);
        if (replayPendingRef.current) {
          replayPendingRef.current = false;
          controller.togglePlay();
        }
      });
      controller.addListener('playback_update', (e) => {
        const { isPaused, position, duration } = e.data;
        const CLIP_DURATION_MS = 30000;
        const isClipFinished = duration > 0 && position >= CLIP_DURATION_MS;
        const isFinished = duration > 0 && (position >= duration || isClipFinished);
        if (isClipFinished && !isPaused) {
          controller.togglePlay();
        }
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

  // Listen for Spotify embed messages as a fallback ready detection
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== 'https://open.spotify.com') return;
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        console.log('[postMessage] from Spotify:', data.type || data);
      } catch {
        // ignore non-JSON messages
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const attemptLoad = useCallback((songLink: string) => {
    console.log('[attemptLoad] loading song:', songLink, 'retry:', retryCountRef.current, 'controller exists:', !!controllerRef.current);
    setSongReady(false);
    setSongPlaying(false);
    setSongLoadFailed(false);
    if (songLoadTimerRef.current) clearTimeout(songLoadTimerRef.current);

    songLoadTimerRef.current = setTimeout(() => {
      if (retryCountRef.current < MAX_AUTO_RETRIES) {
        retryCountRef.current += 1;
        console.log('[attemptLoad] auto-retrying, attempt:', retryCountRef.current);
        destroyController();
        attemptLoad(songLink);
      } else {
        console.warn('[attemptLoad] all retries exhausted, marking load as failed');
        setSongLoadFailed(true);
      }
    }, LOAD_TIMEOUT_MS);

    if (controllerRef.current) {
      controllerRef.current.loadUri(toSpotifyUri(songLink));
    } else {
      pendingSongRef.current = songLink;
      if (iframeApiRef.current) {
        initController(iframeApiRef.current);
      }
    }
  }, [destroyController, initController]);

  // Load new track URI when song changes
  useEffect(() => {
    if (song && song.link) {
      retryCountRef.current = 0;
      attemptLoad(song.link);
    }
    return () => {
      if (songLoadTimerRef.current) clearTimeout(songLoadTimerRef.current);
    };
  }, [song, attemptLoad]);

  useEffect(() => {
    if (guesses.length > 4 && !correct) {
      setFinished(true);
      setErrorMessage(`Answer was: ${song.country}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guesses]);

  const selectSong = () => {
    let songObj: Song;
    let albumIndexToRemove = -1;

    if (dailySongIndexRef.current < dailySongs.length) {
      songObj = dailySongs[dailySongIndexRef.current];
      dailySongIndexRef.current += 1;
      albumIndexToRemove = albums.findIndex(
        (a) => a.album_name === songObj.album
      );
    } else {
      albumIndexToRemove = Math.floor(Math.random() * albums.length);
      const albumChoice = albums[albumIndexToRemove];
      const songIndexChoice = Math.floor(
        Math.random() * albumChoice.tracks.length
      );
      songObj = {
        country: albumChoice.country,
        link: albumChoice.tracks[songIndexChoice],
        album: albumChoice.album_name,
      };
    }

    setSong(songObj);

    // Fetch track metadata from Spotify oEmbed API
    const songLink = songObj.link;
    const fetchOembed = (url: string, attempt = 0, maxRetries = 3, delay = 1000) => {
      const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`;
      console.log(`[fetchOembed] attempt: ${attempt}, url: ${url}`);
      fetch(oembedUrl)
        .then((res) => {
          console.log(`[fetchOembed] response status: ${res.status}`);
          return res.json();
        })
        .then((data) => {
          console.log(`[fetchOembed] success, title: ${data.title}`);
          setSong((prev) => {
            if (prev.link !== songLink) return prev;
            return {
              ...prev,
              trackTitle: data.title,
              artistName: data.author_name,
              thumbnailUrl: data.thumbnail_url,
            };
          });
        })
        .catch((err) => {
          console.error(`[fetchOembed] failed, attempt: ${attempt}, error:`, err.message || err);
          if (attempt < maxRetries) {
            console.log(`[fetchOembed] scheduling retry ${attempt + 1} in ${delay}ms`);
            setTimeout(() => fetchOembed(url, attempt + 1, maxRetries, delay), delay);
          } else {
            console.warn(`[fetchOembed] all retries exhausted`);
          }
        });
    };
    fetchOembed(songObj.link);

    if (albumIndexToRemove >= 0) {
      const newAlbums = albums.filter((_, index) => index !== albumIndexToRemove);
      setAlbums(newAlbums);
    }
  };

  const fetchScores = async (): Promise<ScoreEntry[]> => {
    const res = await fetch(SCORES_URL);
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

  const onRetryLoad = () => {
    console.log('[onRetryLoad] song:', song?.link);
    if (!song || !song.link) return;
    destroyController();
    retryCountRef.current = 0;
    attemptLoad(song.link);
  };

  const onPlayClicked = useCallback(() => {
    if (songFinished && controllerRef.current && song?.link) {
      replayPendingRef.current = true;
      controllerRef.current.loadUri(toSpotifyUri(song.link));
      setSongFinished(false);
      return;
    }
    toggleSong();
  }, [songFinished, song, toggleSong]);

  useEffect(() => {
    onPlayClickedRef.current = onPlayClicked;
  }, [onPlayClicked]);

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
    setSongReady(false);
    setSongPlaying(false);
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

    const scoresRes = await fetch(SCORES_URL);
    const scoresJson = await scoresRes.json();

    await fetch(SCORES_URL, {
      method: "PUT",
      body: JSON.stringify({ ...scoresJson, [nameInputValue]: score }),
    });

    window.location.reload();
  };

  const onMenuClicked = () => {
    destroyController();
    if (songLoadTimerRef.current) {
      clearTimeout(songLoadTimerRef.current);
      songLoadTimerRef.current = null;
    }
    setSong({} as Song);
    setSongReady(false);
    setSongPlaying(false);
    setSongFinished(false);
    setSongLoadFailed(false);
    setSubmitted(false);
    setFinished(false);
    setCorrect(false);
    setGuesses([]);
    setErrorMessage("");
    setGeoHintsEnabled(false);
    setShowGeoHints(false);
    setQuestionIndex(0);
    setTurnIndex(0);
    setScore(0);
    setShowFinalScore(false);
    setGameMode("");
    setShowScoreboard(false);
    selectSong();
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
        songLoadFailed={songLoadFailed}
        onRetryLoad={onRetryLoad}
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
