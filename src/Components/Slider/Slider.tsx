import React from 'react';
import './Slider.css';

interface SliderProps {
  checked: boolean;
  onCheck: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const Slider = (props: SliderProps) => {

  return (
    <label className="slider-label">
      GeoHints
      <input className="slider" type="checkbox" onChange={props.onCheck} checked={props.checked}/>
    </label>
  );
}

export default Slider;
