import { Direction } from "../types";

// Converts from degrees to radians.
function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

// Converts from radians to degrees.
function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

function direction(
  startLat: number,
  startLng: number,
  destLat: number,
  destLng: number,
): Direction {
  startLat = toRadians(startLat);
  startLng = toRadians(startLng);
  destLat = toRadians(destLat);
  destLng = toRadians(destLng);

  const y = Math.sin(destLng - startLng) * Math.cos(destLat);
  const x =
    Math.cos(startLat) * Math.sin(destLat) -
    Math.sin(startLat) * Math.cos(destLat) * Math.cos(destLng - startLng);
  let brng = Math.atan2(y, x);
  brng = toDegrees(brng);
  brng = (brng + 360) % 360;

  let dir: Direction;

  if (brng > 337.5) {
    dir = "N";
  } else if (brng > 292.5) {
    dir = "NW";
  } else if (brng > 247.5) {
    dir = "W";
  } else if (brng > 202.5) {
    dir = "SW";
  } else if (brng > 157.5) {
    dir = "S";
  } else if (brng > 112.5) {
    dir = "SE";
  } else if (brng > 67.5) {
    dir = "E";
  } else if (brng > 22.5) {
    dir = "NE";
  } else {
    dir = "N";
  }

  return dir;
}

export default direction;
