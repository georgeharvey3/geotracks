import React from "react";
import { Box, Container, IconButton, Typography } from "@mui/material";
import HomeIcon from "@mui/icons-material/Home";

interface BaseProps {
  showMenuButton: boolean;
  onMenuClicked: () => void;
  children: React.ReactNode;
}

const Base = (props: BaseProps) => (
  <Container
    maxWidth="sm"
    sx={{
      textAlign: "center",
      position: "relative",
      py: 2,
      px: 2,
    }}
  >
    <Box sx={{ position: "relative", mb: 1 }}>
      {props.showMenuButton && (
        <IconButton
          onClick={props.onMenuClicked}
          sx={{
            position: "absolute",
            left: 0,
            top: "50%",
            transform: "translateY(-50%)",
            color: "text.secondary",
            "&:hover": { color: "text.primary" },
          }}
        >
          <HomeIcon />
        </IconButton>
      )}
      <Typography
        variant="h1"
        sx={{
          background: "linear-gradient(135deg, #1e88e5 0%, #66bb6a 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          py: 1,
        }}
      >
        GeoTracks
      </Typography>
    </Box>
    {props.children}
  </Container>
);

export default Base;
