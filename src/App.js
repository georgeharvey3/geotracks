import "./App.css";
import { useEffect, useState } from "react";

import CountryInput from "./Components/CountryInput/CountryInput";
import Guesses from "./Components/Guesses/Guesses";
import Slider from "./Components/Slider/Slider";
import Spinner from "./Components/Spinner/Spinner";

import Pause from "../src/assets/pause.png";
import Play from "../src/assets/play.png";
import Replay from "../src/assets/replay.png";

import albumsJSON from "./albums.json";
import countriesJSON from "./countries.json";

import getDistance from "./helpers/getDistance";
import getBearing from "./helpers/getBearing";

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

  const [showGeoHints, setShowGeoHints] = useState(true);

  const [questionIndex, setQuestionIndex] = useState(0);

  const [logs, setLogs] = useState([]);

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
          // setSongReady(true);
          // setSongFinished(false);
        } else if (e.data?.type === "playback_update") {
          if (e.data?.payload?.isPaused === false) {
            if (e.data?.payload?.position !== e.data?.payload?.duration) {
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

  const log = (message) => {
    setLogs([...logs, JSON.stringify(message)]);
  };

  const fetchEmbed = () => {
    fetch(`https://open.spotify.com/oembed?url=${song.link}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.html) {
          setEmbedHtml(data.html);
          setSongReady(true);
          setSongFinished(false);
        }
      })
      .catch((err) => console.error(err));
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

    if (songPlaying) {
      const iframe = document.querySelector("#embed-iframe iframe");

      if (iframe?.contentWindow && songPlaying) {
        iframe.contentWindow.postMessage({ command: "toggle" }, "*");
      }
    }

    selectSong();
  };

  return (
    <div className="App">
      <h1>GeoTracks</h1>
      <button
        className="pause-play-button"
        disabled={!songReady}
        onClick={onPlayClicked}
      >
        {songReady ? (
          songFinished && window.innerWidth > 1024 ? (
            <img src={Replay} alt="Replay" />
          ) : songPlaying ? (
            <img src={Play} alt="Play" />
          ) : (
            <img src={Pause} alt="Pause" />
          )
        ) : (
          <Spinner />
        )}
      </button>
      <span className="prompt">
        Which country does this song originate from?
      </span>
      <CountryInput
        onFormSubmit={onFormSubmit}
        disabled={finished}
        countries={countriesJSON}
      />
      <Slider checked={showGeoHints} onCheck={onCheck} />
      {errorMessage ? <p>{errorMessage}</p> : null}
      {submitted ? (
        <Guesses guesses={guesses} showGeoHints={showGeoHints} />
      ) : null}
      {finished ? (
        <button className="next-song-button" onClick={onNextSongClicked}>
          Next Song
        </button>
      ) : null}
      <div className="iframe-wrapper">
        {finished ? (
          <span>
            <strong>Album: </strong>
            {song.album}
          </span>
        ) : null}
        <div
          id="embed-iframe"
          style={{
            top: finished ? "4rem" : "-100rem",
            opacity: finished ? 1 : 0,
          }}
          dangerouslySetInnerHTML={{ __html: embedHtml }}
        ></div>
      </div>
      {logs.map((message, index) => (
        <p key={index}>{message}</p>
      ))}
    </div>
  );
}

export default App;
