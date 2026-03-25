import React from "react";
import HomeIcon from "../../assets/home-icon.png";

interface BaseProps {
  showMenuButton: boolean;
  onMenuClicked: () => void;
  children: React.ReactNode;
}

const Base = (props: BaseProps) => (
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

export default Base;
