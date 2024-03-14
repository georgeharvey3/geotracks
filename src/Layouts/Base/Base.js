import HomeIcon from "../../assets/home-icon.png";

const base = (props) => (
  <div className="App">
    <h1>GeoTracks</h1>
    {props.showMenuButton ? (
      <button className="menu-button" onClick={props.onMenuClicked}>
        <img src={HomeIcon} alt="menu" />
      </button>
    ) : null}
    {props.children}
  </div>
);

export default base;
