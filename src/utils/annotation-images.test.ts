/**
 * Taking a picture off the user's disc and onto the canvas.
 *
 * The file is read into a data URI rather than an object URL, because an annotation is
 * saved with the canvas and has to survive being reopened in another session — an object
 * URL is dead the moment the page that made it goes away.
 *
 * The width matters more than it looks. It is the display width the annotation is created
 * at, and a photograph is several thousand pixels across, which on a canvas measured in
 * tens of units is not a large picture but a wall the drawing is behind.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ANNOTATION_IMAGE_ACCEPT, readAnnotationImage } from './annotation-images';

const RealImage = globalThis.Image;

/**
 * Stands in for the browser's image decoder, which jsdom does not have.
 *
 * Reports `naturalWidth` for anything given to it, or fails the load when `naturalWidth`
 * is null — which is what an unsupported or corrupt file does.
 */
const decodesAs = (naturalWidth: number | null): void => {
  class FakeImage {
    naturalWidth = naturalWidth ?? 0;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(_value: string) {
      queueMicrotask(() => (naturalWidth === null ? this.onerror?.() : this.onload?.()));
    }
  }
  globalThis.Image = FakeImage as unknown as typeof Image;
};

/** A file whose bytes are `content`, as the file picker would hand one over. */
const file = (name: string, content = 'data'): File => new File([content], name);

beforeEach(() => {
  decodesAs(120);
});

afterEach(() => {
  globalThis.Image = RealImage;
  vi.restoreAllMocks();
});

describe('the picture an annotation is given', () => {
  it('arrives as a data URI, which outlives the session that read it', () => {
    // An annotation is written into the save file. A blob URL there would reopen as a
    // broken picture in every later session.
    return expect(readAnnotationImage(file('logo.png'))).resolves.toMatchObject({
      src: expect.stringMatching(/^data:/),
    });
  });

  it('is placed at its own width when that is a reasonable size', async () => {
    const { width } = await readAnnotationImage(file('small.png'));
    expect(width).toBe(120);
  });

  it('is held back to a width the canvas can hold', async () => {
    // A photograph off a phone is several thousand pixels across; placed at that width it
    // covers the whole drawing, and the handle to resize it is off screen.
    decodesAs(4032);
    const { width } = await readAnnotationImage(file('photo.jpg'));
    expect(width).toBe(360);
  });

  it('is given a workable width when it will not say how wide it is', async () => {
    // An SVG with no intrinsic size reports zero, and an annotation zero units wide
    // cannot be seen or grabbed.
    decodesAs(0);
    const { width } = await readAnnotationImage(file('drawing.svg'));
    expect(width).toBe(240);
  });
});

describe('a file that will not do', () => {
  it('is refused by name when the browser cannot decode it', async () => {
    // The message goes in front of the user, so it has to say which file failed — a
    // multi-file drop reports one failure among several successes.
    decodesAs(null);
    await expect(readAnnotationImage(file('notes.pdf'))).rejects.toThrow('"notes.pdf"');
  });

  it('is refused by name when it cannot be read off the disc', async () => {
    vi.spyOn(FileReader.prototype, 'readAsDataURL').mockImplementation(function (this: FileReader) {
      queueMicrotask(() => this.onerror?.(new ProgressEvent('error') as ProgressEvent<FileReader>));
    });
    await expect(readAnnotationImage(file('gone.png'))).rejects.toThrow('"gone.png"');
  });
});

describe('what the file picker will offer', () => {
  it('offers the formats that survive being placed in an img element', () => {
    // SVG is placed through `<img>` precisely because that never runs script the file
    // carries; the list is what the annotation layer can actually draw.
    expect(ANNOTATION_IMAGE_ACCEPT.split(',')).toEqual([
      'image/png',
      'image/jpeg',
      'image/gif',
      'image/webp',
      'image/svg+xml',
    ]);
  });

  it('does not offer PDF, which no browser will place as a picture', () => {
    expect(ANNOTATION_IMAGE_ACCEPT).not.toContain('pdf');
  });
});
