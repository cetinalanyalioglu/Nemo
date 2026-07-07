# Canvas annotations

Annotations are free-floating notes and images on the canvas, entirely separate from the solver model: they have no ports, no parameters, no index, and never appear in the `model` section of a save file.
They form their own presentation layer, designed to grow (shapes, further media) under the same save-file section.

## Interaction

- The **Annotations** pane (pencil icon in the navigation rail) is the home of the layer: drag the _Text_ chip onto the canvas (or click it to drop a note at the viewport centre), upload a picture via the _Image_ chip, and use the _Notes_ list to select/centre or delete existing annotations.
- Double-click a note to edit its **Markdown** source (headings, emphasis, lists, links, images; raw HTML is intentionally not rendered).
  Blur or `Ctrl+Enter` commits; `Escape` cancels.
  The note keeps its rendered size while the editor is open.
- Selecting a note opens a floating toolbar above it with the style controls: font family, size (stepper), bold/italic, alignment, text and background colors (with a reset to the theme defaults), layer (front/back), border, and a fixed width (clear for automatic).
- **Images**: PNG (transparency preserved), JPEG, GIF, WebP and SVG, added via the pane chip or by dropping a file from the OS straight onto the canvas.
  Stored as a data URI inside the save file, so documents stay self-contained.
  Scale with the corner grip or the width stepper; combine with the _back_ layer to use a picture as a background under the network.
  SVG scales losslessly (it is rendered through an `<img>` element, so embedded scripts never execute); PDF is not a browser-image format and is not supported — export the page as SVG or PNG instead.
- The **layer** buttons stack an annotation above (`front`, the default) or below (`back`) the model elements and edges.
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
  - id: annotation-def456
    kind: image
    position: { x: 60, y: 200 }
    src: data:image/png;base64,iVBORw0...
    layer: back
    style: { width: 320 }
```

`kind` is `text` or `image` and namespaces future annotation kinds; `layer` appears only when `back`.
`style` holds only the fields the user explicitly set; unset fields fall back to the defaults in `src/types/annotations.ts` (and to the active theme for colors), so notes without explicit colors remain readable in both themes.

## Example

`examples/element-gallery.yaml` is a generated showcase: every element of the flow-network model laid out by category, each group titled with a text annotation.
