import React from "react";
import { Box, FormControlLabel, Switch } from "@mui/material";

interface SliderProps {
  checked: boolean;
  onCheck: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const Slider = (props: SliderProps) => {
  return (
    <Box sx={{ display: "flex", justifyContent: "center" }}>
      <FormControlLabel
        control={
          <Switch
            checked={props.checked}
            onChange={props.onCheck}
            color="primary"
          />
        }
        label="GeoHints"
        sx={{ color: "text.secondary" }}
      />
    </Box>
  );
};

export default Slider;
