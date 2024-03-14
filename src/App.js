import "./App.css";
import { useEffect, useState } from "react";

import Base from "./Layouts/Base/Base";

import Game from "./Components/Game/Game";
import Menu from "./Components/Menu/Menu";
import FinalScore from "./Components/FinalScore/FinalScore";
import Scoreboard from "./Components/ScoreBoard/ScoreBoard";

import albumsJSON from "./albums.json";
import countriesJSON from "./countries.json";

import getDistance from "./helpers/getDistance";
import getBearing from "./helpers/getBearing";

const GAME_MODES = {
  infinite: "infinite",
  competition: "competition",
};

const SCORE_VALUES = {
  1: 150,
  2: 80,
  3: 60,
  4: 40,
  5: 20,
};

const NUM_COMPETITION_TURNS = 10;

function App() {
  const [embedHtml, setEmbedHtml] = useState("");

  const [albums, setAlbums] = useState(albumsJSON);
  const [song, setSong] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [correct, setCorrect] = useState(false);

  const [songFinished, setSongFinished] = useState(false);

  const [guesses, setGuesses] = useState([]);

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
  const [scores, setScores] = useState([]);
  const [nameInputValue, setNameInputValue] = useState("");
  const [showFinalScore, setShowFinalScore] = useState(false);

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
  }, [songReady, questionIndex]);

  useEffect(() => {
    const inputSelector = "#myInput";
    const input = document.querySelector(inputSelector);

    document.addEventListener("keypress", (e) => {
      if (!e.target.matches(inputSelector)) {
        if (e.key === " ") {
          toggleSong();
          return;
        }

        if (e.key === "Enter") {
          onNextSongClicked();
          return;
        }

        if (input) {
          input.focus();
        }
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        input.blur();
        return;
      }
    });

    window.addEventListener("message", (e) => {
      if (e.origin === "https://open.spotify.com") {
        if (e.data?.type === "ready") {
          setSongReady(true);
          setSongFinished(false);
        } else if (e.data?.type === "playback_update") {
          if (e.data?.payload?.isPaused === false) {
            if (
              e.data?.payload?.position === 0 ||
              e.data?.payload?.position !== e.data?.payload?.duration
            ) {
              setSongPlaying(true);
              setSongFinished(false);
            } else {
              setSongFinished(true);
            }
          } else {
            setSongPlaying(false);
          }
        }
      }
    });
    selectSong();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (song && song.link) {
      setSongReady(false);
      fetchEmbed();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const songObj = {
      country: albumChoice.country,
      link: songChoice,
      album: albumChoice.album_name,
    };
    setSong(songObj);

    const newAlbums = albums.filter((_, index) => index !== albumIndexChoice);

    setAlbums(newAlbums);
  };

  const fetchScores = async () => {
    const res = await fetch(
      "https://geotracks-d9b5c-default-rtdb.europe-west1.firebasedatabase.app/scores.json"
    );
    const json = await res.json();

    const scoresArray = Object.entries(json).map((entry) => ({
      name: entry[0],
      score: entry[1],
    }));
    const scoresArraySorted = scoresArray.sort(
      (score1, score2) => score2.score - score1.score
    );

    return scoresArraySorted;
  };

  const fetchEmbed = () => {
    fetch(`https://open.spotify.com/oembed?url=${song.link}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.html) {
          setEmbedHtml(data.html);
        }
      });
  };

  const onPlayClicked = (e) => {
    toggleSong();
  };

  const toggleSong = () => {
    const iframe = document.querySelector("#embed-iframe iframe");

    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage({ command: "toggle" }, "*");
    }
  };

  const onFormSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);

    const countryAnswer = formData.get("myCountry");

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
          );

          const distance = getDistance(
            guessedCountry.lat,
            guessedCountry.lon,
            correctCountry.lat,
            correctCountry.lon
          );
          const direction = getBearing(
            guessedCountry.lat,
            guessedCountry.lon,
            correctCountry.lat,
            correctCountry.lon
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

    e.target.reset();
  };

  const onCheck = (e) => {
    if (e.target.checked) {
      setShowGeoHints(true);
      setGeoHintsEnabled(true);
    } else {
      setShowGeoHints(false);
    }
  };

  const onNextSongClicked = () => {
    if (!finished) {
      return;
    }

    setSubmitted(false);
    setFinished(false);
    setCorrect(false);
    setSongFinished(false);
    setGuesses([]);
    setErrorMessage("");
    setQuestionIndex(questionIndex + 1);

    if (gameMode === GAME_MODES.competition) {
      setGeoHintsEnabled(false);
      setShowGeoHints(false);
      setTurnIndex(turnIndex + 1);

      if (turnIndex === NUM_COMPETITION_TURNS) {
        setShowFinalScore(true);
      }
    }

    if (songPlaying) {
      const iframe = document.querySelector("#embed-iframe iframe");

      if (iframe?.contentWindow && songPlaying) {
        iframe.contentWindow.postMessage({ command: "toggle" }, "*");
      }
    }

    selectSong();
  };

  const onNameInputChange = (event) => {
    if (event.target.value.length <= 10) {
      setNameInputValue(event.target.value);
    }
  };

  const onScoreFormSubmit = async (event) => {
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
    setShowScoreboard("");
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
        embedHtml={embedHtml}
        isCompetition={gameMode === GAME_MODES.competition}
        turnsRemaining={NUM_COMPETITION_TURNS - turnIndex}
        score={score}
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
