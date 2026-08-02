import { Box, Typography } from "@mui/material";
import LibraryMusicIcon from "@mui/icons-material/LibraryMusic";

import Suggest from "../Suggest/Suggest";
import { useGame } from "../../context/GameContext";
import useSuggestions from "../../hooks/useSuggestions";
import { countryNameByCode } from "../../map/geography";
import { COLORS } from "../../tokens";

/**
 * Container for the Suggestion screen: the write seam wired to the form, and the
 * country the router opened it on turned back into a name for the picker.
 *
 * A sixth screen rather than a modal. The app contains no `Dialog`, `Modal` or
 * `Snackbar` anywhere and `design.md` is locked, so a modal would mean designing
 * one — scrim, focus trap, dismissal, and its argument with the lockup's flight.
 * The system already has exactly one shape for "a page you go to from the menu
 * that isn't the map", and the scoreboard is it.
 */
const SuggestScreen = () => {
  const { state } = useGame();
  const { submitSuggestion } = useSuggestions();

  const initialCountry =
    (state.suggestCountryCode && countryNameByCode(state.suggestCountryCode)) ||
    "";

  return (
    <Box sx={{ mt: 2 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 1,
          mb: 1,
        }}
      >
        {/* Inherits the page's foreground: this heading stands on the night
            backdrop, unlike the card below it, which is its own cream surface. */}
        <LibraryMusicIcon sx={{ color: "inherit" }} />
        <Typography variant="h2">Suggest an album</Typography>
      </Box>
      {/* Secondary copy on the night backdrop is `paperMuted`, the mirror of
          the app pages' `inkMuted` — not the page's paper at reduced opacity. */}
      <Typography variant="body2" sx={{ mb: 2, color: COLORS.paperMuted }}>
        Music the app is missing, from anywhere in the world.
      </Typography>

      <Suggest initialCountry={initialCountry} onSubmit={submitSuggestion} />
    </Box>
  );
};

export default SuggestScreen;
