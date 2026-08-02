import React, { useState, forwardRef } from "react";
import { Box, Button } from "@mui/material";
import SendIcon from "@mui/icons-material/Send";

import CountryAutocomplete from "../CountryAutocomplete/CountryAutocomplete";

interface CountryInputProps {
  onFormSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  disabled: boolean;
  /**
   * The countries to suggest. Defaults to every country, so guessing is
   * unrestricted; Explore narrows it to the Playable ones, where a suggestion
   * the player cannot choose would be a dead end.
   */
  countries?: string[];
}

/**
 * The guess submitter: the country picker with a form and a Send button around
 * it, clearing itself once the guess is committed. The picking is all
 * `CountryAutocomplete`'s (which the Suggestion form uses on its own, where a
 * nested form would be invalid HTML); what is left here is the commit.
 */
const CountryInput = forwardRef<HTMLInputElement, CountryInputProps>(
  (props, ref) => {
    const [inputValue, setInputValue] = useState("");

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
      props.onFormSubmit(e);
      setInputValue("");
    };

    return (
      <form autoComplete="off" onSubmit={handleSubmit}>
        <Box sx={{ position: "relative", maxWidth: 360, mx: "auto" }}>
          <Box sx={{ display: "flex", gap: 1 }}>
            <CountryAutocomplete
              ref={ref}
              name="myCountry"
              value={inputValue}
              onChange={setInputValue}
              disabled={props.disabled}
              countries={props.countries}
            />
            <Button
              type="submit"
              variant="contained"
              disabled={props.disabled}
              sx={{ minWidth: 48, px: 2 }}
            >
              <SendIcon fontSize="small" />
            </Button>
          </Box>
        </Box>
      </form>
    );
  },
);

CountryInput.displayName = "CountryInput";

export default CountryInput;
