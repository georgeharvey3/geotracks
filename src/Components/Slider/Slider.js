import './Slider.css';

const Slider = (props) => {

  return (
    <label className="slider-label">
      Geo Hints
      <input className="slider" type="checkbox" onChange={props.onCheck} checked={props.checked}/>
    </label>
  );
}

export default Slider;