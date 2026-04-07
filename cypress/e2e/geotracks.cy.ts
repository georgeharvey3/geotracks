describe("GeoTracks E2E", () => {
  beforeEach(() => {
    cy.visit("/");
  });

  describe("Menu", () => {
    it("displays the app title and menu buttons", () => {
      cy.contains("GeoTracks").should("be.visible");
      cy.contains("button", "Competition Mode").should("be.visible");
      cy.contains("button", "Infinite Mode").should("be.visible");
      cy.contains("button", "Scoreboard").should("be.visible");
    });

    it("opens the scoreboard and returns to menu", () => {
      cy.contains("button", "Scoreboard").click();
      cy.contains("Top Scores").should("be.visible");
      cy.get("table").should("be.visible");

      // Return to menu via home button
      cy.get('button[aria-label="menu"]').click();
      cy.contains("button", "Infinite Mode").should("be.visible");
    });
  });

  describe("Infinite Mode", () => {
    it("starts a game and loads a Spotify embed", () => {
      cy.contains("button", "Infinite Mode").click();

      // Game view should appear
      cy.contains("Which country does this song originate from?").should(
        "be.visible"
      );

      // Country input should be present
      cy.get('input[name="myCountry"]').should("be.visible");

      // GeoHints toggle should be present
      cy.contains("GeoHints").should("be.visible");

      // Spotify embed container should exist
      cy.get("#embed-iframe").should("exist");

      // Wait for the Spotify embed to become ready (play button enabled)
      cy.get("button")
        .filter(":has(svg)")
        .first()
        .should("not.be.disabled", { timeout: 30000 });
    });

    it("plays and pauses via the play button", () => {
      cy.contains("button", "Infinite Mode").click();

      // Wait for song to be ready
      cy.get('[data-testid="PlayArrowIcon"]', { timeout: 30000 }).should(
        "be.visible"
      );

      // Click play
      cy.get('[data-testid="PlayArrowIcon"]').parent("button").click();

      // Should now show pause icon
      cy.get('[data-testid="PauseIcon"]', { timeout: 10000 }).should(
        "be.visible"
      );

      // Click pause
      cy.get('[data-testid="PauseIcon"]').parent("button").click();

      // Should return to play icon
      cy.get('[data-testid="PlayArrowIcon"]', { timeout: 10000 }).should(
        "be.visible"
      );
    });

    it("submits a wrong guess and shows it in the guess list", () => {
      cy.contains("button", "Infinite Mode").click();

      cy.contains("Which country does this song originate from?").should(
        "be.visible"
      );

      // Type a country and select from autocomplete
      cy.get('input[name="myCountry"]').type("Andorra");
      cy.contains("Andorra").click();

      // Submit the guess
      cy.get('[data-testid="SendIcon"]').parent("button").click();

      // The guess should appear in the guesses list (likely wrong)
      cy.contains("Andorra").should("be.visible");
    });

    it("shows geo hints when enabled", () => {
      cy.contains("button", "Infinite Mode").click();

      // Enable GeoHints
      cy.contains("GeoHints")
        .parent()
        .find('input[type="checkbox"]')
        .click({ force: true });

      // Submit a wrong guess
      cy.get('input[name="myCountry"]').type("Andorra");
      cy.contains("Andorra").click();
      cy.get('[data-testid="SendIcon"]').parent("button").click();

      // Should show distance hint (km) if the guess is wrong
      cy.get("body").then(($body) => {
        // If the guess was wrong, we should see km distance
        if ($body.find('[data-testid="CancelIcon"]').length > 0) {
          cy.contains("km").should("be.visible");
        }
      });
    });

    it("uses all 5 guesses and reveals the answer", () => {
      cy.contains("button", "Infinite Mode").click();

      // Use unlikely countries to ensure wrong guesses
      const wrongGuesses = [
        "Andorra",
        "Tuvalu",
        "Nauru",
        "Palau",
        "Monaco",
      ];

      wrongGuesses.forEach((country) => {
        // Check if the round is already finished (correct guess or exhausted)
        cy.get("body").then(($body) => {
          if ($body.find("button:contains('Next Song')").length > 0) {
            return; // Already finished
          }

          cy.get('input[name="myCountry"]').clear().type(country);
          // Wait for and click the autocomplete suggestion
          cy.contains(new RegExp(`^${country}$`)).click();
          cy.get('[data-testid="SendIcon"]').parent("button").click();
        });
      });

      // After 5 wrong guesses, "Answer was:" should appear, or check icon if lucky
      cy.get("body").then(($body) => {
        const hasAnswer = $body.text().includes("Answer was:");
        const hasCorrect =
          $body.find('[data-testid="CheckCircleIcon"]').length > 0;
        expect(hasAnswer || hasCorrect).to.be.true;
      });
    });

    it("navigates to the next song after finishing a round", () => {
      cy.contains("button", "Infinite Mode").click();

      // Make 5 wrong guesses to finish the round
      const wrongGuesses = [
        "Andorra",
        "Tuvalu",
        "Nauru",
        "Palau",
        "Monaco",
      ];

      wrongGuesses.forEach((country) => {
        cy.get("body").then(($body) => {
          if ($body.find("button:contains('Next Song')").length > 0) return;
          cy.get('input[name="myCountry"]').clear().type(country);
          cy.contains(new RegExp(`^${country}$`)).click();
          cy.get('[data-testid="SendIcon"]').parent("button").click();
        });
      });

      // Click Next Song
      cy.contains("button", "Next Song").should("be.visible").click();

      // Should be back to a fresh round
      cy.get('input[name="myCountry"]').should("not.be.disabled");
    });

    it("returns to menu from a game via home button", () => {
      cy.contains("button", "Infinite Mode").click();
      cy.contains("Which country does this song originate from?").should(
        "be.visible"
      );

      cy.get('button[aria-label="menu"]').click();
      cy.contains("button", "Infinite Mode").should("be.visible");
    });
  });

  describe("Competition Mode", () => {
    it("starts competition mode and shows score/turns", () => {
      cy.contains("button", "Competition Mode").click();

      cy.contains("Which country does this song originate from?").should(
        "be.visible"
      );

      // Competition mode shows turns remaining and score
      cy.contains("Turns:").should("be.visible");
      cy.contains("Score:").should("be.visible");

      // Should show the half-points warning
      cy.contains("Enabling GeoHints will score half points").should(
        "be.visible"
      );
    });

    it("tracks score across multiple competition rounds", () => {
      cy.contains("button", "Competition Mode").click();

      // Verify initial state
      cy.contains("Turns: 10").should("be.visible");
      cy.contains("Score: 0").should("be.visible");

      // Exhaust guesses on first round
      const wrongGuesses = [
        "Andorra",
        "Tuvalu",
        "Nauru",
        "Palau",
        "Monaco",
      ];

      wrongGuesses.forEach((country) => {
        cy.get("body").then(($body) => {
          if (
            $body.find("button:contains('Next Song')").length > 0 ||
            $body.find("button:contains('Continue')").length > 0
          )
            return;
          cy.get('input[name="myCountry"]').clear().type(country);
          cy.contains(new RegExp(`^${country}$`)).click();
          cy.get('[data-testid="SendIcon"]').parent("button").click();
        });
      });

      // Move to next round
      cy.get("body").then(($body) => {
        const btn =
          $body.find("button:contains('Next Song')").length > 0
            ? "Next Song"
            : "Continue";
        cy.contains("button", btn).click();
      });

      // Turns should decrement
      cy.contains("Turns: 9").should("be.visible");
    });
  });

  describe("Country Input Autocomplete", () => {
    beforeEach(() => {
      cy.contains("button", "Infinite Mode").click();
    });

    it("shows autocomplete suggestions while typing", () => {
      cy.get('input[name="myCountry"]').type("Uni");

      // Should show matching countries
      cy.contains("United Kingdom").should("be.visible");
      cy.contains("United States").should("be.visible");
    });

    it("navigates suggestions with arrow keys", () => {
      cy.get('input[name="myCountry"]').type("Uni");

      // Arrow down to select first suggestion
      cy.get('input[name="myCountry"]').type("{downarrow}");

      // First item should be highlighted (Mui-selected class)
      cy.get(".Mui-selected").should("exist");

      // Press Enter to select
      cy.get('input[name="myCountry"]').type("{enter}");

      // Input should now contain the selected country
      cy.get('input[name="myCountry"]').should("not.have.value", "Uni");
    });

    it("closes suggestions on Escape", () => {
      cy.get('input[name="myCountry"]').type("Uni");
      cy.contains("United Kingdom").should("be.visible");

      cy.get('input[name="myCountry"]').type("{esc}");
      cy.contains("United Kingdom").should("not.exist");
    });

    it("shows error for unrecognised country", () => {
      cy.get('input[name="myCountry"]').type("Narnia");
      cy.get('[data-testid="SendIcon"]').parent("button").click();

      cy.contains("Unrecognised country").should("be.visible");
    });
  });

  describe("Keyboard Shortcuts", () => {
    it("Space toggles playback when input is not focused", () => {
      cy.contains("button", "Infinite Mode").click();

      // Wait for song ready
      cy.get('[data-testid="PlayArrowIcon"]', { timeout: 30000 }).should(
        "be.visible"
      );

      // Blur any focused element
      cy.get("body").click(0, 0);

      // Press space to play
      cy.get("body").trigger("keypress", { key: " " });

      // Should start playing
      cy.get('[data-testid="PauseIcon"]', { timeout: 10000 }).should(
        "be.visible"
      );
    });

    it("typing auto-focuses the country input", () => {
      cy.contains("button", "Infinite Mode").click();

      // Click away from input
      cy.get("body").click(0, 0);

      // Type a letter - should auto-focus the input
      cy.get("body").trigger("keypress", { key: "a" });
      cy.get('input[name="myCountry"]').should("be.focused");
    });
  });
});
