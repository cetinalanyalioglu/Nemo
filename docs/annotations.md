# Canvas annotations

Annotations are free-floating notes on the canvas, entirely separate from the solver model: they have no ports, no parameters, no index, and never appear in the `model` section of a save file.
They form their own presentation layer that today holds text notes and is designed to grow (shapes, imported images) under the same save-file section.

## Interaction

- The **Annotations** pane (pencil icon in the navigation rail) is the home of the layer: drag the *Text* chip onto the canvas (or click it to drop a note at the viewport centre), and use the *Notes* list to select/centre or delete existing notes.
- Double-click a note to edit its **Markdown** source (headings, emphasis, lists, links, images; raw HTML is intentionally not rendered).
  Blur or `Ctrl+Enter` commits; `Escape` cancels.
- Selecting a note opens a floating toolbar above it with the style controls: font family, size, bold/italic, alignment, text and background colors (with a reset to the theme defaults), border, and a fixed width (clear for automatic).
- Annotations participate in undo/redo and are movable, editable and deletable even while the canvas is locked — the lock only guards the model graph (indices).
- Auto-layout ignores annotations; they stay where the user put them.

## Persistence

Annotations are saved under a top-level `annotations` section, seamlessly with the rest of the document:

```yaml
annotations:
  - id: annotation-abc123
    kind: text
    position: { x: 60, y: 0 }
    text: |-
      # Title
      Body in *Markdown*.
    style: { fontSize: 20, bold: true }
```

`kind` is `text` today and namespaces future annotation kinds.
`style` holds only the fields the user explicitly set; unset fields fall back to the defaults in `src/types/annotations.ts` (and to the active theme for colors), so notes without explicit colors remain readable in both themes.

## Example

`examples/element-gallery.yaml` is a generated showcase: every element of the flow-network model laid out by category, each group titled with a text annotation.
