## General

- [ ] Better state and context management
- [ ] Testing

## Feature

- [ ] At least some simple automatic layout functionality
- [ ] Capability to add a resizable, movable background image(s) to the canvas
- [x] Custom edge type to display information on the edges
- [x] Edge properties panel
- [x] Individual connection validation functions for each node type to be called alongside global connection validation logic
- [x] Individual `onConnect` handling for each node type
    - [x] Best, we may come up with a structure where we can assign custom triggers on parameter change individually for each parameter.
- [ ] Edges should be able to display information using a label
- [ ] Management of edge and node based data
- [ ] Rendering edge and node based data
- [ ] Settings panel triggered from navigation controls
    - [ ] Automatic layout customization

## Extensibility

- [ ] Instead of having a file for each element type, build NodeLibrary in runtime using JSON based element definitions
- [ ] The set of elements displayed in NodeLibrary should be replacable via providing a different set of JSON files

## Minor
- [ ] Solver index does not get displayed instantly when it is generated
- [x] Properties panel displays empty categories when all sub-parameters have ```visible: false```