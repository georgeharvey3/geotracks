/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_DB_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface SpotifyPlaybackData {
  isPaused: boolean;
  isBuffering: boolean;
  position: number;
  duration: number;
}

interface SpotifyPlaybackEvent {
  data: SpotifyPlaybackData;
}

interface SpotifyEmbedController {
  togglePlay(): void;
  seek(position: number): void;
  loadUri(uri: string): void;
  addListener(event: 'ready', callback: () => void): void;
  addListener(event: 'playback_started', callback: () => void): void;
  addListener(event: 'playback_update', callback: (e: SpotifyPlaybackEvent) => void): void;
  destroy(): void;
}

interface SpotifyIFrameAPIOptions {
  uri: string;
  width?: string | number;
  height?: string | number;
}

interface SpotifyIFrameAPI {
  createController(
    element: HTMLElement,
    options: SpotifyIFrameAPIOptions,
    callback: (controller: SpotifyEmbedController) => void,
  ): void;
}

interface Window {
  onSpotifyIframeApiReady?: (IFrameAPI: SpotifyIFrameAPI) => void;
}
