import { useSyncExternalStore } from "react";
import { vi } from "vitest";
import type {
  SpotifyPlayer,
  SpotifyPlayerOptions,
} from "../hooks/useSpotifyPlayer";
import type { Song, SongMetadata } from "../types";

/**
 * Stateful fake for the `useSpotifyPlayer` seam used by the integration suite.
 *
 * The real hook owns the imperative Spotify IFrame integration; here we replace
 * it with an in-memory store the test drives through `emit*` helpers
 * (ready/playing/paused/finished/load-failure). The player commands
 * (`onPlayClicked`, `togglePlay`, `onRetryLoad`, `embedRef`) are `vi.fn` spies
 * so wiring can be asserted, and the default play/toggle behaviour flips the
 * playing/finished flags so the UI reacts the way it would in the real app.
 */

interface Snapshot {
  songReady: boolean;
  songPlaying: boolean;
  songFinished: boolean;
  songLoadFailed: boolean;
  metadata: SongMetadata;
  metadataLink: string | undefined;
}

const INITIAL: Snapshot = {
  songReady: false,
  songPlaying: false,
  songFinished: false,
  songLoadFailed: false,
  metadata: {},
  metadataLink: undefined,
};

// The Song the fake is currently loaded with. Metadata a test emits is filed
// against it, the way a real oEmbed fetch resolves for the Song it was made for.
// Written during render, which is safe only because one screen — and therefore
// one instance of this hook — is mounted at a time.
let loadedLink: string | undefined;

let snapshot: Snapshot = INITIAL;
const listeners = new Set<() => void>();

function emit(patch: Partial<Snapshot>): void {
  snapshot = { ...snapshot, ...patch };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): Snapshot {
  return snapshot;
}

const onPlayClicked = vi.fn(() => {
  // Replay from the top when the clip has finished, otherwise toggle playback.
  if (snapshot.songFinished) {
    emit({ songFinished: false, songPlaying: true });
  } else {
    emit({ songPlaying: !snapshot.songPlaying });
  }
});

const togglePlay = vi.fn(() => {
  emit({ songPlaying: !snapshot.songPlaying });
});

const onRetryLoad = vi.fn(() => {
  emit({ songLoadFailed: false, songReady: false, songPlaying: false });
});

const embedRef = vi.fn();

export const spotifyPlayerControl = {
  /**
   * The link of the Song the player is currently loaded with. Outside
   * Competition the app draws at random (issue #49), so this is the only place
   * a test can learn which Song the player was actually handed.
   */
  loadedLink: () => loadedLink,
  emitReady: () =>
    emit({ songReady: true, songLoadFailed: false, songFinished: false }),
  emitPlaying: () =>
    emit({
      songReady: true,
      songPlaying: true,
      songFinished: false,
      songLoadFailed: false,
    }),
  emitPaused: () => emit({ songPlaying: false }),
  emitFinished: () => emit({ songPlaying: false, songFinished: true }),
  emitLoadFailure: () =>
    emit({ songReady: false, songPlaying: false, songLoadFailed: true }),
  setMetadata: (metadata: SongMetadata) =>
    emit({ metadata, metadataLink: loadedLink }),
  onPlayClicked,
  togglePlay,
  onRetryLoad,
  embedRef,
  reset: () => {
    snapshot = INITIAL;
    loadedLink = undefined;
    listeners.forEach((listener) => listener());
    onPlayClicked.mockClear();
    togglePlay.mockClear();
    onRetryLoad.mockClear();
    embedRef.mockClear();
  },
};

// Mock implementation swapped in for the default export of useSpotifyPlayer.
export default function useSpotifyPlayerFake(
  song: Song | undefined,
  _options: SpotifyPlayerOptions = {},
): SpotifyPlayer {
  const snap = useSyncExternalStore(subscribe, getSnapshot);
  loadedLink = song?.link;
  return {
    embedRef,
    songReady: snap.songReady,
    songPlaying: snap.songPlaying,
    songFinished: snap.songFinished,
    songLoadFailed: snap.songLoadFailed,
    metadata: snap.metadata,
    metadataLink: snap.metadataLink,
    onPlayClicked,
    togglePlay,
    onRetryLoad,
  };
}
