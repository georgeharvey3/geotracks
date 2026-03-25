import React from 'react';

interface FinalScoreProps {
  score: number;
  setGameMode: (mode: string) => void;
  nameInputValue: string;
  onNameInputChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onScoreFormSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}

const FinalScore = (props: FinalScoreProps) => (
  <div>
    <h2>You scored {props.score} points</h2>
    <form onSubmit={props.onScoreFormSubmit}>
      <input placeholder="Name..." className="name-input" name="score" value={props.nameInputValue} onChange={props.onNameInputChange}/>
      <input type="submit" value="Save Score" />
    </form>
  </div>
);

export default FinalScore;
