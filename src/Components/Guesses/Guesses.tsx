import "./Guesses.css";

import { Guess, Direction } from "../../types";

import Correct from "../../assets/check.png";
import Incorrect from "../../assets/cross.png";

import N from "../../assets/arrows/N.png";
import NE from "../../assets/arrows/NE.png";
import E from "../../assets/arrows/E.png";
import SE from "../../assets/arrows/SE.png";
import S from "../../assets/arrows/S.png";
import SW from "../../assets/arrows/SW.png";
import W from "../../assets/arrows/W.png";
import NW from "../../assets/arrows/NW.png";

const directionMap: Record<Direction, string> = {
    N,
    NE,
    E,
    SE,
    S,
    SW,
    W,
    NW,
};

interface GuessesProps {
  guesses: Guess[];
  showGeoHints: boolean;
}

const Guesses = (props: GuessesProps) => {
    return (
        <ul className="guesses">
            {props.guesses.map((guess, index) => (
                <li className="guesses__guess" key={index}>
                    <span className="guesses__guess-text">{guess.country}</span>
                    <div className="guesses__guess-result">
                        {guess.correct ? (
                            <img
                                className="guesses__guess-icon"
                                src={Correct}
                                alt="Correct"
                            />
                        ) : (
                            <>
                                {props.showGeoHints ? (
                                    <>
                                        <span className="guesses__guess-distance">
                                            {guess.distance!.toFixed()}km
                                        </span>
                                        <img
                                            className="guesses__guess-direction"
                                            src={directionMap[guess.direction as Direction]}
                                            alt={guess.direction}
                                        />
                                    </>
                                ) : null}
                                <img
                                    className="guesses__guess-icon"
                                    src={Incorrect}
                                    alt="Incorrect"
                                />
                            </>
                        )}
                    </div>
                </li>
            ))}
        </ul>
    );
};

export default Guesses;
