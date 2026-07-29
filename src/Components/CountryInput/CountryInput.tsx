import React, { useState, useRef, useEffect, forwardRef } from "react";
import {
  Box,
  TextField,
  Button,
  Paper,
  Popper,
  List,
  ListItemButton,
  ListItemText,
  InputAdornment,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import SendIcon from "@mui/icons-material/Send";
import countriesJSON from "../../countries.json";

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

const allCountries = countriesJSON.map((country) => country.name);

const CountryInput = forwardRef<HTMLInputElement, CountryInputProps>(
  (props, ref) => {
    const [inputValue, setInputValue] = useState("");
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
      setInputValue(value);
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
      setInputValue(value);
      setSuggestions([]);
      setShowSuggestions(false);
      setActiveIndex(-1);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!showSuggestions || suggestions.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((prev) =>
          prev >= suggestions.length - 1 ? 0 : prev + 1,
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((prev) =>
          prev <= 0 ? suggestions.length - 1 : prev - 1,
        );
      } else if (e.key === "Enter" && activeIndex > -1) {
        e.preventDefault();
        const active = suggestions[activeIndex];
        if (active !== undefined) {
          selectSuggestion(active);
        }
      } else if (e.key === "Escape") {
        setShowSuggestions(false);
      }
    };

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
      props.onFormSubmit(e);
      setInputValue("");
      setSuggestions([]);
      setShowSuggestions(false);
      setActiveIndex(-1);
    };

    return (
      <form autoComplete="off" onSubmit={handleSubmit}>
        <Box
          ref={wrapperRef}
          sx={{ position: "relative", maxWidth: 360, mx: "auto" }}
        >
          <Box sx={{ display: "flex", gap: 1 }}>
            <TextField
              inputRef={ref}
              name="myCountry"
              placeholder="Country"
              disabled={props.disabled}
              value={inputValue}
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
              }}
              sx={{
                "& .MuiOutlinedInput-root": {
                  bgcolor: "background.paper",
                },
              }}
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

          {/* Portalled, not absolutely positioned inside the wrapper: on mobile
              this input sits in a short scrolling tray, which would otherwise
              clip the list. Floating it free lets it open over the map. */}
          <Popper
            open={showSuggestions && suggestions.length > 0}
            anchorEl={wrapperRef.current}
            placement="bottom-start"
            sx={{
              zIndex: (theme) => theme.zIndex.modal,
              width: wrapperRef.current
                ? wrapperRef.current.offsetWidth - 56
                : undefined,
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
                    // On click, not mousedown: the list now floats over the
                    // map, and closing it on mousedown would let the click
                    // land on whatever country is underneath.
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
                            {suggestion.substring(0, inputValue.length)}
                          </strong>
                          {suggestion.substring(inputValue.length)}
                        </>
                      }
                    />
                  </ListItemButton>
                ))}
              </List>
            </Paper>
          </Popper>
        </Box>
      </form>
    );
  },
);

CountryInput.displayName = "CountryInput";

export default CountryInput;
