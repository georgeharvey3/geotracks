// The map's palette, shared by every surface that draws on it.
//
// Land sits well above the sea in lightness so the coastline reads at a glance,
// and the hover highlight goes near-white — a colour nothing else on the map
// uses — so the country under the pointer is unmistakable against its
// neighbours. `inertLand` is what a shape gets when it can't be chosen at all:
// a disputed territory in the game, a country with no music in Explore.
export const MAP_FILLS = {
  sea: "#0b1a30",
  land: "#7d9cbb",
  inertLand: "#4c5f75",
  highlight: "#eaf4ff",
  border: "#0b1a30",
} as const;
