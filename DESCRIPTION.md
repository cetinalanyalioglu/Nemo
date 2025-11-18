# Interactive user interface for network-based approaches

In this document, the description and specifications for the interactive user interface for network-based approaches software is described, which will be referred to as the software from hereon.

## Purpose and overall specifications

The purpose of this UI is to provide means for users to interactively generate input files for arbitrary network-based models, which at least contains node names, node indices, edge indices, connectivity information and parameters associated with nodes and edges.

The software shall be a web based UI made using ReactFlow. Please report if you decide any other library is more adequate for the task. I am a scientific programmer, hence do not know much about JS. Keep this in mind.

## Overall appearance and visual features

You can use the standard canvas provided by ReactFlow or anything equivalent.
It should offer capabilities to easily zoom and pan.
While zooming in/out, the current zoom level should be displayed near the bottom of the UI.
In addition to the canvas area, where the user will generate their graph (e.g. network), the UI will contain dynamically opening/closing left and right panes.
Left pane is called the context pane and the right pane is called the info pane.
The info pane is only opened up when a node or edge is selected.
The left side of the screen contains an array of vertically placed icons by default.
We will refer to this as the control panel.
Depending on the function of the icon, interacting with them may lead to opening up the context pane on the left side of the  canvas, which has same sort of appearance and size as the info pane.
When context pane is closed, which can be done by the user by means of a control icon/button, the control panel is visible again.
Each button in the control panel has tooltips which appear when hovered upon.

### Control panel

It contains icons for the following functions:

- Display the "elements pane" as the context pane,
- A save button to save the current state of the canvas and the software as a JSON file,
- A load button to loads the state of the canvas and the software from a JSON file,
- A button to turn on/off snapping to canvas grid lines,
- A button to execute an auto layout on the canvas,
- And an export button which will bring up the "export pane" as the context pane.
- A "renumber" button which wil lbring up the "renumbering pane" as the context pane.

### Context pane

Context pane is the pane that dynamically appears on the left side of the canvas when a function is triggered by the user.
It does not refer to a concrete entity, but rather different panes that would look/behave similar and provide context dependent tools for the user to interact with depending on the functionality triggered by the user.

We will describe the contents of these context panes later on.

### Info pane

Info pane appears when an edge or node is selected by the user.
It display all parameters associated with the selected item and allows editing if editing is allowed for that parameter.
The parameters and their handling are described later.

## Software design considerations and requirements

I am suggesting here what is the state-of-art approach to my perspective.
If you have suggestions, I am open to it.

The software is meant to be "generalized", e.g. not specific to a certain network model.
This implies that the types of the nodes and the parameters associated with nodes and edges can be changed and the software should perfectly handle this.
There should be a single JSON file containing this information, which will be referred as network model.
The software launches without a network model loaded.
When user opens up the elements pane, it will initially contain a button to load a network model from the JSON file to intiliaze the software.