// Converts from degrees to radians.
function toRadians(degrees) {
  return degrees * Math.PI / 180;
};
 
// Converts from radians to degrees.
function toDegrees(radians) {
  return radians * 180 / Math.PI;
}


function direction(startLat, startLng, destLat, destLng){
  startLat = toRadians(startLat);
  startLng = toRadians(startLng);
  destLat = toRadians(destLat);
  destLng = toRadians(destLng);

  const y = Math.sin(destLng - startLng) * Math.cos(destLat);
  const x = Math.cos(startLat) * Math.sin(destLat) -
        Math.sin(startLat) * Math.cos(destLat) * Math.cos(destLng - startLng);
  let brng = Math.atan2(y, x);
  brng = toDegrees(brng);
  brng = (brng + 360) % 360;

  let direction;
  
  if (brng > 337.5) {
    direction = 'N';
  } else if (brng > 292.5) {
    direction = 'NW';
  } else if (brng > 247.5) {
    direction = 'W';
  } else if (brng > 202.5) {
    direction = 'SW';
  } else if (brng > 157.5) {
    direction = 'S';
  } else if (brng > 112.5) {
    direction = 'SE';
  } else if (brng > 67.5) {
    direction = 'E';
  } else if (brng > 22.5) {
    direction = 'NE';
  } else {
    direction = 'N';
  }

  return direction
}


export default direction;