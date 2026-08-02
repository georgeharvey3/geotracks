import { useEffect, useState } from "react";
import { onValue, ref } from "firebase/database";

import { db } from "../firebase";
import { CommunityAlbum } from "../types";

export type LibraryStatus = "loading" | "ready" | "failed";

export interface CommunityAlbums {
  /** Every accepted Community album, ordered by push key. Empty until ready. */
  albums: CommunityAlbum[];
  status: LibraryStatus;
}

/**
 * The live half of the Library: Community albums, read from `communityAlbums/`.
 *
 * **Order is part of the contract, not presentation.** The daily seed draws by
 * index into the Library, so every player is owed the same albums in the same
 * sequence. RTDB returns children in key order and push keys are chronological
 * and sort lexicographically, so that order already exists — this sorts anyway,
 * because relying on it silently would make a correctness property look like an
 * implementation detail of the SDK.
 *
 * The node is world-readable and has no client write at all: it is app content,
 * like `scores`, and the only thing that writes it is the accept script running
 * under the owner's Firebase CLI, which bypasses rules entirely.
 *
 * `status` is what Competition is gated on. A read that half-arrives is the one
 * way this feature can silently corrupt a Run — see `useDailyRun` and ADR-0007
 * — so the failure is reported rather than smoothed over into an empty list.
 */
export default function useCommunityAlbums(): CommunityAlbums {
  const [albums, setAlbums] = useState<CommunityAlbum[]>([]);
  const [status, setStatus] = useState<LibraryStatus>("loading");

  useEffect(() => {
    const unsubscribe = onValue(
      ref(db, "communityAlbums"),
      (snapshot) => {
        const entries: { key: string; album: CommunityAlbum }[] = [];
        snapshot.forEach((child) => {
          if (child.key) entries.push({ key: child.key, album: child.val() });
        });
        entries.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
        setAlbums(entries.map((entry) => entry.album));
        setStatus("ready");
      },
      () => {
        // An empty node reads back as `null` and still lands in the callback
        // above, so this is a real failure — offline, or the rules refusing.
        setStatus("failed");
      },
    );

    return () => unsubscribe();
  }, []);

  return { albums, status };
}
