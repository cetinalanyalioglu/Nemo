import React from 'react';
import Markdown from 'react-markdown';
import type { Options } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface MarkdownContentProps {
  /** Raw Markdown source. Rendered without raw HTML, so it is safe by default. */
  text: string;
}

/**
 * Plugin set is module-level so the arrays keep a stable identity across
 * renders; a fresh array each time makes react-markdown rebuild its processor
 * on every keystroke of the annotation editor.
 */
const REMARK_PLUGINS: Options['remarkPlugins'] = [remarkGfm, remarkMath];
const REHYPE_PLUGINS: Options['rehypePlugins'] = [[rehypeKatex, { throwOnError: false }]];

/**
 * Renders a Markdown string for the parameter info modal and canvas text
 * annotations. Lives in its own module so it (and the comparatively heavy
 * `react-markdown` dependency) can be code-split and only loaded when a user
 * actually opens a modal description.
 *
 * Raw HTML is intentionally not enabled: authors get headings, lists, links,
 * code and images (the "media" use case) while untrusted model files cannot
 * inject markup.
 *
 * GFM adds tables, strikethrough, task lists and autolinks. Math is delimited
 * `$…$` / `$$…$$` and typeset with KaTeX — the same engine {@link MathLabel}
 * uses for plain-text labels, so a formula reads identically wherever it
 * appears. `throwOnError: false` makes a malformed formula render as
 * highlighted source instead of tearing down the surrounding note.
 */
const MarkdownContent: React.FC<MarkdownContentProps> = ({ text }) => {
  return (
    <Markdown remarkPlugins={REMARK_PLUGINS} rehypePlugins={REHYPE_PLUGINS}>
      {text}
    </Markdown>
  );
};

export default MarkdownContent;
