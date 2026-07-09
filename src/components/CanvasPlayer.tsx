import { memo, useEffect } from 'react';
import { Panel } from 'reactflow';
import {
  IoPause,
  IoPlay,
  IoPlaySkipBack,
  IoPlaySkipForward,
  IoRepeat,
  IoStop,
} from 'react-icons/io5';
import '../styles/canvas-player.css';
import {
  PLAYBACK_BASE_FPS,
  PLAYBACK_SPEEDS,
  selectActiveAnimation,
  useDataStore,
} from '../store/dataStore';
import MathLabel from './MathLabel';

/** Compact formatter for the frame variable's current value. */
const formatFrameValue = (value: number): string => {
  if (!Number.isFinite(value)) return '—';
  if (Number.isInteger(value)) return String(value);
  return String(parseFloat(value.toPrecision(5)));
};

/**
 * Canvas overlay player for animated datasets. Appears when a displayed item
 * belongs to a dataset with a frame axis, and offers play/pause/stop, frame
 * stepping, a scrubber, speed and loop controls. Shows the frame variable's
 * current value and the frame index alongside — all read from the data, so the
 * player stays agnostic to what the frames mean (phase, frequency, ...).
 */
const CanvasPlayer = memo(() => {
  const animation = useDataStore(selectActiveAnimation);
  const playback = useDataStore((s) => s.playback);
  const setFrame = useDataStore((s) => s.setFrame);
  const stepFrame = useDataStore((s) => s.stepFrame);
  const startPlayback = useDataStore((s) => s.startPlayback);
  const pausePlayback = useDataStore((s) => s.pausePlayback);
  const stopPlayback = useDataStore((s) => s.stopPlayback);
  const setPlaybackSpeed = useDataStore((s) => s.setPlaybackSpeed);
  const togglePlaybackLoop = useDataStore((s) => s.togglePlaybackLoop);

  // Drive frame advancement while playing; the interval follows the speed.
  const { isPlaying, speed } = playback;
  const hasAnimation = Boolean(animation);
  useEffect(() => {
    if (!isPlaying || !hasAnimation) return;
    const interval = window.setInterval(
      () => useDataStore.getState().advanceFrame(),
      1000 / (PLAYBACK_BASE_FPS * speed)
    );
    return () => window.clearInterval(interval);
  }, [isPlaying, speed, hasAnimation]);

  const frames = animation?.frames;
  if (!animation || !frames || frames.values.length === 0) return null;

  const count = frames.values.length;
  const index = Math.max(0, Math.min(count - 1, playback.frameIndex));
  const value = frames.values[index];

  return (
    <Panel position="bottom-center" className="canvas-player" data-testid="canvas-player">
      <div className="canvas-player-info" title={animation.name}>
        <span className="canvas-player-variable">
          <MathLabel text={frames.variable} />
          {': '}
          {formatFrameValue(value)}
          {frames.unit ? ` ${frames.unit}` : ''}
        </span>
        <span className="canvas-player-frame">
          {index + 1} / {count}
        </span>
      </div>
      <input
        type="range"
        className="canvas-player-scrubber"
        min={0}
        max={count - 1}
        step={1}
        value={index}
        onChange={(e) => setFrame(parseInt(e.target.value, 10))}
        aria-label="Frame"
      />
      <div className="canvas-player-controls">
        <button
          type="button"
          className="canvas-player-button"
          onClick={() => stepFrame(-1)}
          title="Previous frame"
          aria-label="Previous frame"
        >
          <IoPlaySkipBack />
        </button>
        {playback.isPlaying ? (
          <button
            type="button"
            className="canvas-player-button"
            onClick={pausePlayback}
            title="Pause"
            aria-label="Pause"
          >
            <IoPause />
          </button>
        ) : (
          <button
            type="button"
            className="canvas-player-button"
            onClick={startPlayback}
            title="Play"
            aria-label="Play"
          >
            <IoPlay />
          </button>
        )}
        <button
          type="button"
          className="canvas-player-button"
          onClick={stopPlayback}
          title="Stop (rewind to first frame)"
          aria-label="Stop"
        >
          <IoStop />
        </button>
        <button
          type="button"
          className="canvas-player-button"
          onClick={() => stepFrame(1)}
          title="Next frame"
          aria-label="Next frame"
        >
          <IoPlaySkipForward />
        </button>
        <select
          className="canvas-player-speed"
          value={String(playback.speed)}
          onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
          title="Playback speed"
          aria-label="Playback speed"
        >
          {PLAYBACK_SPEEDS.map((s) => (
            <option key={s} value={String(s)}>
              {s}×
            </option>
          ))}
        </select>
        <button
          type="button"
          className={`canvas-player-button ${playback.loop ? 'active' : ''}`}
          onClick={togglePlaybackLoop}
          title={playback.loop ? 'Looping (click to play once)' : 'Play once (click to loop)'}
          aria-label="Loop"
          aria-pressed={playback.loop}
        >
          <IoRepeat />
        </button>
      </div>
    </Panel>
  );
});

CanvasPlayer.displayName = 'CanvasPlayer';

export default CanvasPlayer;
