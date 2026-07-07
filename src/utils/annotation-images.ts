/**
 * Helpers for image annotations: reading an uploaded file into a data URI ready
 * to store on the annotation layer. Raster formats with alpha (PNG, WebP) keep
 * their transparency, and SVG works as a scalable vector (rendered via an <img>
 * element, so embedded scripts never execute). PDF is not an image format the
 * browser can place in an <img>; it is deliberately not accepted.
 */

/** File-picker accept list for image annotations. */
export const ANNOTATION_IMAGE_ACCEPT = 'image/png,image/jpeg,image/gif,image/webp,image/svg+xml';

/** Initial display width cap (px) so a huge upload doesn't swallow the canvas. */
const INITIAL_WIDTH_CAP = 360;

/** Fallback width when the image reports no intrinsic size (some SVGs). */
const FALLBACK_WIDTH = 240;

/**
 * Reads an image file into a data URI and probes its natural size, returning
 * the source plus a sensible initial display width.
 */
export const readAnnotationImage = (file: File): Promise<{ src: string; width: number }> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Could not read "${file.name}".`));
    reader.onload = () => {
      const src = String(reader.result);
      const probe = new Image();
      probe.onload = () =>
        resolve({ src, width: Math.min(probe.naturalWidth || FALLBACK_WIDTH, INITIAL_WIDTH_CAP) });
      probe.onerror = () => reject(new Error(`"${file.name}" is not a supported image.`));
      probe.src = src;
    };
    reader.readAsDataURL(file);
  });
