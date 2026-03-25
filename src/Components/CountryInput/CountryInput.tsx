import React, { useState, useRef, useEffect, forwardRef } from "react";
import countriesJSON from "../../countries.json";
import "./CountryInput.css";

interface CountryInputProps {
  onFormSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  disabled: boolean;
}

const countries = countriesJSON.map(country => country.name);

const CountryInput = forwardRef<HTMLInputElement, CountryInputProps>((props, ref) => {
  const [inputValue, setInputValue] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const activeItemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
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
    const filtered = countries.filter(
      country => country.substring(0, value.length).toUpperCase() === value.toUpperCase()
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
      setActiveIndex(prev => (prev >= suggestions.length - 1 ? 0 : prev + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex(prev => (prev <= 0 ? suggestions.length - 1 : prev - 1));
    } else if (e.key === "Enter" && activeIndex > -1) {
      e.preventDefault();
      selectSuggestion(suggestions[activeIndex]);
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
    <form
      autoComplete="off"
      onSubmit={handleSubmit}
      className="country-input-form"
    >
      <div className="autocomplete" style={{ width: "300px" }} ref={wrapperRef}>
        <input
          ref={ref}
          id="myInput"
          type="text"
          name="myCountry"
          placeholder="Country"
          disabled={props.disabled}
          value={inputValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
        />
        {showSuggestions && suggestions.length > 0 && (
          <div className="autocomplete-items">
            {suggestions.map((suggestion, index) => (
              <div
                key={suggestion}
                ref={index === activeIndex ? activeItemRef : null}
                className={index === activeIndex ? "autocomplete-active" : ""}
                onMouseDown={() => selectSuggestion(suggestion)}
              >
                <strong>{suggestion.substring(0, inputValue.length)}</strong>
                {suggestion.substring(inputValue.length)}
              </div>
            ))}
          </div>
        )}
      </div>
      <input type="submit" disabled={props.disabled} />
    </form>
  );
});

CountryInput.displayName = "CountryInput";

export default CountryInput;
