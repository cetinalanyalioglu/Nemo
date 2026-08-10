/**
 * Handing a file to the browser.
 *
 * There is no API for "save this". What there is is a link pointing at an object URL and
 * a click on it, which is what everything that saves anything here was doing a copy of.
 *
 * Written once for the detail in it that is easy to leave out and hard to notice
 * missing: the URL is released on a timer rather than in the same turn as the click. A
 * click *starts* a download, it does not finish one, and a URL revoked immediately is a
 * download that may find nothing left to fetch. Browsers disagree about how much grace
 * they give, which is the worst way for it to be wrong — it works everywhere it is
 * written and fails on somebody else's machine.
 */

/** How long the object URL is left alive for the download to get hold of it. */
const RELEASE_AFTER_MS = 1000;

/** Saves `blob` as `filename`, through the only mechanism a page has for it. */
export const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  // Appended rather than clicked where it stands: a link that is not in the document
  // does not reliably do anything when it is clicked.
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), RELEASE_AFTER_MS);
};
