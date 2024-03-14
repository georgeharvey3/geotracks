import './Slider.css';

const Slider = (props) => {

  return (
    <label className="slider-label">
      GeoHints
      <input className="slider" type="checkbox" onChange={props.onCheck} checked={props.checked}/>
    </label>
  );
}

export default Slider;