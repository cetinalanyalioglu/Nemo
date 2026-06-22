import React, { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface MathLabelProps {
  /** Label text that may contain inline math delimited by `$...$`. */
  text: string;
}

// Splits on inline-math segments delimited by single dollar signs, keeping the
// delimiters so we can tell math from plain text. An escaped `\$` is treated as
// a literal dollar sign rather than a delimiter.
const SEGMENT_PATTERN = /(?<!\\)\$([^$]+)\$/g;

/**
 * Renders a label string, typesetting any inline `$...$` segments with KaTeX
 * and leaving the rest as plain text. The renderer is model-agnostic: it knows
 * how to render math, not what any particular label says, so math notation can
 * live entirely in the model definitions (e.g. `Rigid ($u' = 0$)`).
 */
const MathLabel: React.FC<MathLabelProps> = ({ text }) => {
  const segments = useMemo(() => {
    const parts: Array<{ math: boolean; content: string }> = [];
    const pattern = new RegExp(SEGMENT_PATTERN.source, 'g');
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const start = match.index;
      if (start > lastIndex) {
        parts.push({ math: false, content: text.slice(lastIndex, start) });
      }
      parts.push({ math: true, content: match[1] });
      lastIndex = start + match[0].length;
    }
    if (lastIndex < text.length) {
      parts.push({ math: false, content: text.slice(lastIndex) });
    }
    return parts;
  }, [text]);

  return (
    <>
      {segments.map((segment, index) => {
        if (!segment.math) {
          // Unescape literal dollar signs for display.
          return (
            <React.Fragment key={index}>{segment.content.replace(/\\\$/g, '$')}</React.Fragment>
          );
        }
        let html: string;
        try {
          html = katex.renderToString(segment.content, {
            throwOnError: false,
            displayMode: false,
          });
        } catch {
          // Fall back to the raw source if KaTeX cannot parse it.
          return <React.Fragment key={index}>{`$${segment.content}$`}</React.Fragment>;
        }
        return <span key={index} dangerouslySetInnerHTML={{ __html: html }} />;
      })}
    </>
  );
};

export default MathLabel;
