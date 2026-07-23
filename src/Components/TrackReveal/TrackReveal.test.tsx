import { render, screen, fireEvent } from '../../test-utils';
import TrackReveal from './TrackReveal';
import { Song } from '../../types';

const createSong = (overrides: Partial<Song> = {}): Song => ({
  country: 'France',
  link: 'https://open.spotify.com/track/abc',
  album: 'Test Album',
  trackTitle: 'Test Track',
  artistName: 'Test Artist',
  thumbnailUrl: 'https://example.com/art.jpg',
  ...overrides,
});

describe('TrackReveal', () => {
  it('renders the track title, artist, and album', () => {
    render(<TrackReveal song={createSong()} />);
    expect(screen.getByText('Test Track')).toBeInTheDocument();
    expect(screen.getByText('Test Artist')).toBeInTheDocument();
    expect(screen.getByText('Test Album')).toBeInTheDocument();
  });

  it('links out to the track on Spotify in a new tab', () => {
    render(<TrackReveal song={createSong()} />);
    const link = screen.getByRole('link', { name: /open in spotify/i });
    expect(link).toHaveAttribute('href', 'https://open.spotify.com/track/abc');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders the album artwork when a thumbnail is provided', () => {
    render(<TrackReveal song={createSong()} />);
    const img = screen.getByRole('img', { name: 'Test Album' });
    expect(img).toHaveAttribute('src', 'https://example.com/art.jpg');
  });

  it('falls back to unknown labels when metadata is missing', () => {
    render(
      <TrackReveal
        song={createSong({ trackTitle: undefined, artistName: undefined })}
      />,
    );
    expect(screen.getByText('Unknown Track')).toBeInTheDocument();
    expect(screen.getByText('Unknown Artist')).toBeInTheDocument();
  });

  it('shows the placeholder icon when no thumbnail is provided', () => {
    render(<TrackReveal song={createSong({ thumbnailUrl: undefined })} />);
    expect(screen.queryByRole('img', { name: 'Test Album' })).not.toBeInTheDocument();
    expect(screen.getByTestId('AlbumIcon')).toBeInTheDocument();
  });

  it('falls back to the placeholder icon when the artwork fails to load', () => {
    render(<TrackReveal song={createSong()} />);
    fireEvent.error(screen.getByRole('img', { name: 'Test Album' }));
    expect(screen.queryByRole('img', { name: 'Test Album' })).not.toBeInTheDocument();
    expect(screen.getByTestId('AlbumIcon')).toBeInTheDocument();
  });
});
