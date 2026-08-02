import { describe, it, expect } from "vitest";

import { authorizeUrl, challengeFor, randomString, readCallback } from "./pkce";

describe("randomString", () => {
  it("is long enough to be a verifier, and uses only unreserved characters", () => {
    // RFC 7636 wants 43–128 characters, all from the unreserved set, so that
    // nothing in it needs escaping in the form body it is posted in.
    const verifier = randomString();

    expect(verifier).toHaveLength(64);
    expect(verifier).toMatch(/^[A-Za-z0-9\-._~]+$/);
  });

  it("does not repeat itself", () => {
    expect(randomString()).not.toBe(randomString());
  });
});

describe("challengeFor", () => {
  it("is the base64url SHA-256 of the verifier, with no padding", async () => {
    // The worked example from RFC 7636 appendix B, which is what makes this a
    // test of the encoding rather than of itself.
    const challenge = await challengeFor(
      "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk",
    );

    expect(challenge).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });
});

describe("authorizeUrl", () => {
  const url = new URL(
    authorizeUrl({
      clientId: "a-client-id",
      redirectUri: "https://example.test/geotracks/",
      state: "a-state",
      challenge: "a-challenge",
    }),
  );

  it("asks for a code, hashed, at Spotify's account service", () => {
    expect(url.origin + url.pathname).toBe(
      "https://accounts.spotify.com/authorize",
    );
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBe("a-challenge");
  });

  it("asks for no scopes at all", () => {
    // Reading the catalogue needs a valid token and nothing more, so this grants
    // no access to the reviewer's account — and their consent screen says so.
    expect(url.searchParams.get("scope")).toBe("");
  });

  it("carries no client secret, which is the whole point of PKCE", () => {
    expect(url.searchParams.has("client_secret")).toBe(false);
  });
});

describe("readCallback", () => {
  it("reads a code and the state it belongs to", () => {
    expect(readCallback("?code=abc123&state=xyz")).toEqual({
      ok: true,
      code: "abc123",
      state: "xyz",
    });
  });

  it("reads a refusal", () => {
    expect(readCallback("?error=access_denied&state=xyz")).toEqual({
      ok: false,
      error: "access_denied",
      state: "xyz",
    });
  });

  it("finds nothing in an ordinary load of the app", () => {
    // Which is every load but one, so this has to be silent rather than an error.
    expect(readCallback("")).toBeNull();
    expect(readCallback("?utm_source=somewhere")).toBeNull();
  });

  it("finds nothing in a reply with no state, which is not a reply to us", () => {
    expect(readCallback("?code=abc123")).toBeNull();
  });
});
