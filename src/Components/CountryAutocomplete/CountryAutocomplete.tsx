import React, { useState, useRef, useEffect, forwardRef } from "react";
import {
  Box,
  TextField,
  Paper,
  Popper,
  List,
  ListItemButton,
  ListItemText,
  InputAdornment,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import countriesJSON from "../../countries.json";

interface CountryAutocompleteProps {
  /** The text in the box. Controlled: the caller owns it. */
  value: string;
  onChange: (value: string) => void;
  /**
   * The countries to suggest. Defaults to every country, so guessing is
   * unrestricted; Explore narrows it to the Playable ones, where a suggestion
   * the player cannot choose would be a dead end.
   */
  countries?: string[];
  disabled?: boolean;
  placeholder?: string;
  /** Id of the input, for a caller that labels it with a `<label htmlFor>`. */
  id?: string;
  /** The input's accessible name, where it carries no label of its own. */
  label?: string;
  /** Form field name, for callers that read the value back off a submit event. */
  name?: string;
}

const allCountries = countriesJSON.map((country) => country.name);

/**
 * The app's one country picker: a text box that suggests country names by
 * prefix, navigable by arrow keys, closing on Escape or a click outside.
 *
 * It is a **controlled field and nothing more** — no form, no submit button, no
 * clearing itself. That is what lets it serve both the guess box it grew out of
 * (`CountryInput`, which wraps it) and the Suggestion form, where a nested
 * `<form>` would be invalid HTML and there is a second field to submit
 * alongside. Free-text country entry is the easiest way to break the join
 * between an Album's country and `countries.json` ("Ivory Coast", "USA"), which
 * is why the picker is not optional in either place.
 *
 * Written by hand rather than reached for from a library, as it always has been:
 * one picker, one set of arrow-key semantics.
 */
const CountryAutocomplete = forwardRef<
  HTMLInputElement,
  CountryAutocompleteProps
>((props, ref) => {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const activeItemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  useEffect(() => {
    activeItemRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    props.onChange(value);
    if (!value) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const filtered = (props.countries ?? allCountries).filter(
      (country) =>
        country.substring(0, value.length).toUpperCase() ===
        value.toUpperCase(),
    );
    setSuggestions(filtered);
    setActiveIndex(-1);
    setShowSuggestions(true);
  };

  const selectSuggestion = (value: string) => {
    props.onChange(value);
    setSuggestions([]);
    setShowSuggestions(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev >= suggestions.length - 1 ? 0 : prev + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
    } else if (e.key === "Enter" && activeIndex > -1) {
      // Only when a suggestion is highlighted: otherwise Enter is left to the
      // enclosing form, which is how the guess box commits.
      e.preventDefault();
      const active = suggestions[activeIndex];
      if (active !== undefined) {
        selectSuggestion(active);
      }
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  return (
    <Box ref={wrapperRef} sx={{ position: "relative", width: "100%" }}>
      <TextField
        inputRef={ref}
        id={props.id}
        name={props.name}
        placeholder={props.placeholder ?? "Country"}
        disabled={props.disabled}
        value={props.value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        size="small"
        fullWidth
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: "text.secondary" }} />
              </InputAdornment>
            ),
          },
          htmlInput: props.label ? { "aria-label": props.label } : undefined,
        }}
        sx={{
          "& .MuiOutlinedInput-root": {
            bgcolor: "background.paper",
          },
        }}
      />

      {/* Portalled, not absolutely positioned inside the wrapper: in the game
          this input sits in a short scrolling tray, which would otherwise clip
          the list. Floating it free lets it open over the map. */}
      <Popper
        open={showSuggestions && suggestions.length > 0}
        anchorEl={wrapperRef.current}
        placement="bottom-start"
        sx={{
          zIndex: (theme) => theme.zIndex.modal,
          width: wrapperRef.current?.offsetWidth,
        }}
      >
        <Paper
          elevation={8}
          sx={{
            maxHeight: 240,
            overflow: "auto",
            mt: 0.5,
          }}
        >
          <List dense disablePadding>
            {suggestions.map((suggestion, index) => (
              <ListItemButton
                key={suggestion}
                ref={index === activeIndex ? activeItemRef : null}
                selected={index === activeIndex}
                // On click, not mousedown: the list floats over the map, and
                // closing it on mousedown would let the click land on whatever
                // country is underneath.
                onClick={() => selectSuggestion(suggestion)}
                sx={{
                  "&.Mui-selected": {
                    bgcolor: "primary.main",
                    color: "primary.contrastText",
                    "&:hover": {
                      bgcolor: "primary.dark",
                    },
                  },
                }}
              >
                <ListItemText
                  primary={
                    <>
                      <strong>
                        {suggestion.substring(0, props.value.length)}
                      </strong>
                      {suggestion.substring(props.value.length)}
                    </>
                  }
                />
              </ListItemButton>
            ))}
          </List>
        </Paper>
      </Popper>
    </Box>
  );
});

CountryAutocomplete.displayName = "CountryAutocomplete";

export default CountryAutocomplete;
