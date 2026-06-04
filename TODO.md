## General

- [x] Better state and context management
- [ ] Testing

## Feature

- [x] At least some simple automatic layout functionality
- [ ] Capability to add a resizable, movable background image(s) to the canvas
- [x] Custom edge type to display information on the edges
- [x] Edge properties panel
- [x] Individual connection validation functions for each node type to be called alongside global connection validation logic
- [x] Individual `onConnect` handling for each node type
    - [x] Best, we may come up with a structure where we can assign custom triggers on parameter change individually for each parameter.
- [ ] Edges should be able to display information using a label
- [ ] Management of edge and node based data
- [ ] Rendering edge and node based data

## Extensibility

- [x] Instead of having a file for each element type, build NodeLibrary in runtime using JSON based element definitions
- [x] The set of elements displayed in NodeLibrary should be replacable via providing a different set of JSON files

## Minor
- [x] Solver index does not get displayed instantly when it is generated
- [x] Properties panel displays empty categories when all sub-parameters have ```visible: false```

## Save / load

- [ ] Clear deferred file load when target model definition fails to fetch (pending payload can otherwise apply on a later manual model switch)
- [ ] Require `model.id` in save files and reject loads that omit it (today a missing id applies data against whatever model is currently active)
- [ ] After load, validate that every node/edge type in the file exists in the active model definition and surface a clear warning for unknown types
- [ ] Add explicit save-format migration or version-range docs if we ship format changes beyond 2.x

## Recent thoughts
- [x] Updated format for saved data
- [x] Undo/Redo support
- [ ] Ensure style is completely handled in CSS and placed outside functional code
- [x] Theme capability, e.g. dark/light
- [x] Edge lengths are too long in the automatically generated layout
- [x] Minimap should be optional
- [ ] Console
- [ ] Add setting: force unique node labels or not