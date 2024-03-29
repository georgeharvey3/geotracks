import Spinner from "../Spinner/Spinner";
import CountryInput from "../CountryInput/CountryInput";
import Slider from "../Slider/Slider";
import Guesses from "../Guesses/Guesses";
import CurrentScore from "../CurrentScore/CurrentScore";

import Replay from "../../assets/replay.png";
import Play from "../../assets/play.png";
import Pause from "../../assets/pause.png";

const game = (props) => {
  let buttonContent = <Spinner />;

  if (props.songReady) {
    if (props.songFinished) {
      buttonContent = <img src={Replay} alt="Replay" />;
    } else if (props.songPlaying) {
      buttonContent = <img src={Pause} alt="Pause" />;
    } else {
      buttonContent = <img src={Play} alt="Play" />;
    }
  }

  return (
    <>
      {props.isCompetition ? (
        <CurrentScore
          score={props.score}
          turnsRemaining={props.turnsRemaining}
        />
      ) : null}
      <button
        className="pause-play-button"
        disabled={!props.songReady}
        onClick={props.onPlayClicked}
      >
        {buttonContent}
      </button>
      <span className="prompt">
        Which country does this song originate from?
      </span>
      <CountryInput
        onFormSubmit={props.onFormSubmit}
        disabled={props.finished}
      />
      {props.isCompetition ? (
        <p>Enabling GeoHints will score half points</p>
      ) : null}
      <Slider checked={props.showGeoHints} onCheck={props.onCheck} />
      {props.errorMessage ? <p>{props.errorMessage}</p> : null}
      {props.submitted ? (
        <Guesses guesses={props.guesses} showGeoHints={props.showGeoHints} />
      ) : null}
      {props.finished ? (
        <button className="button" onClick={props.onNextSongClicked}>
          {props.turnsRemaining === 0 ? "Continue" : "Next Song"}
        </button>
      ) : null}
      <div className="iframe-wrapper">
        {props.finished ? (
          <span>
            <strong>Album: </strong>
            {props.song.album}
          </span>
        ) : null}
        <div
          id="embed-iframe"
          style={{
            transition: 'none',
            opacity: props.finished ? 1 : 0,
          }}
          dangerouslySetInnerHTML={{ __html: props.embedHtml }}
        ></div>
      </div>
    </>
  );
};

export default game;
