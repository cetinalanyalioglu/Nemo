import React from 'react';
import Markdown from 'react-markdown';

interface MarkdownContentProps {
  /** Raw Markdown source. Rendered without raw HTML, so it is safe by default. */
  text: string;
}

/**
 * Renders a Markdown string for the parameter info modal. Lives in its own
 * module so it (and the comparatively heavy `react-markdown` dependency) can be
 * code-split and only loaded when a user actually opens a modal description.
 *
 * Raw HTML is intentionally not enabled: authors get headings, lists, links,
 * code and images (the "media" use case) while untrusted model files cannot
 * inject markup.
 */
const MarkdownContent: React.FC<MarkdownContentProps> = ({ text }) => {
  return <Markdown>{text}</Markdown>;
};

export default MarkdownContent;
