import { useSyncExternalStore } from "react";
import type {
  CommunityAlbums,
  LibraryStatus,
} from "../hooks/useCommunityAlbums";
import type { CommunityAlbum } from "../types";

/**
 * Stateful fake for the `useCommunityAlbums` seam, built like `leaderboardFake`.
 *
 * It defaults to **ready and empty**, which is what the rest of the suite wants:
 * a test about guessing should not have to know this read exists. The states
 * that matter — still loading, and failed — are what a test opts into, and they
 * are the whole of why Competition is gated.
 */

let snapshot: CommunityAlbums = { albums: [], status: "ready" };
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): CommunityAlbums {
  return snapshot;
}

const set = (albums: CommunityAlbum[], status: LibraryStatus) => {
  snapshot = { albums, status };
  notify();
};

export const communityAlbumsControl = {
  /** The read has landed, with these albums (none by default). */
  ready: (albums: CommunityAlbum[] = []) => set(albums, "ready"),
  /** The read has not come back yet — Competition must stay shut. */
  loading: () => set([], "loading"),
  /** The read failed. Competition must stay shut rather than seed short. */
  failed: () => set([], "failed"),
  reset: () => set([], "ready"),
};

// Mock implementation swapped in for the default export of useCommunityAlbums.
export default function useCommunityAlbumsFake(): CommunityAlbums {
  return useSyncExternalStore(subscribe, getSnapshot);
}
