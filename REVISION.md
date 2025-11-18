Below is the requirements for the simplification and overhaul.

The purpose of this browser based UI is to provide means for users to interactively generate input for arbitrary network-based models.

The types of nodes make sense only in the context of the network model the user is going to use, therefore we need to make our user interface generic.

The program will load following from a JSON file,

- Types of nodes
- For each node type, associated parameters and their types (e.g. string, integer, bool, or float)
- Optionally, for each node, a list of names containing the allowed types of neighbouring nodes. This can be left empty to omit.
- Parameters associated with edges

The above file is going to be used to represent a wide range of network-based problems.


The UI should behave very similar to what we currently have, e.g. resizing behaviour, autosize, left and right panes.

When an edge or node is selected, the right pane will appear showing all parameters associated with the node.
This includes the custom parameters defined in the JSON file, with input boxes created properly according to their type, and the default parameters that we will assign for all nodes. These will be defined in the parameters section below.

## Parameters and parameter management

- You will create the adequate framework/object, e.g. a list of objects, or whatever you see fit to store the parameters of all nodes and edges.
- Each parameter is going to have the following attributes,
    - **name**: Human-readable name of this parameter. (string).
    - **value**: Value of this parameter, its type is one of float, int, str or bool. Null upon creation unless specified.
    - **isEditable**: This is a boolean flag indicating if this parameter is modifiable by the user. By default it is True.
- You will create two containers, e.g. edgeParameters and nodeParameters to store them.
- The right pane will become visible whenever user selects and edge or a node, and it will display the values of all parameters associated with the item.
- The parameters that are not editable will have non-editable display boxes.
- Editable parameters will have editable input boxes, and depending on their type, false input is not accepted. As example, user can not type text into an input field expecting numerical data.
- Boolean parameters should be displayed as check boxes, editable or not depending on isEditable parameters.
- All parameters read from the JSON file are by default editable.

We will have two type of parameters, one is context-dependent, dynamic set of parameters that can be different for each node type, and a set of default parameters for all node types, and a set of default parameters for edges.
These are defined below.

### Context-dependent parameters

The context dependent parameters are associated with node types.
These are defined in a file, that could be a JSON or YAML.
Consider the following example, shown in a YAML file,
```yaml
nodes:
    inlet:
        ports:
            in: 1
            out: 0
        parameters:
            - my_float_parameter:
                float
            - my_int_parameter:
                int
            - my_str_parameter:
                str
            - my_bool_parameter:
                bool
    outlet:
        parameters:
            - my_float_parameter:
                float
            - my_other_float_parameter:
                float
edges:
    parameters:
        - my_float_parameter: float
        - my_str_parameter: str
```
This snippet should illustrate what I am trying to describe. Each key in the nodes mapping defines a node type, and the parameters are contained under them. The edges are of a single type and the parameters defined here apply to all edges.
All context-dependent parameters are editable by default, unless otherwise specified.

### Default parameters

Nodes have the following parameters assigned to them regardless of their custom types,

- An editable label (string)
- Editable width and height (integers)
- Index, non-editable (integer). The default value is -1, indicating the user has not yet run the indexing algorithm.

Edges have the following parameters assigned to them, regardless of the additional context-dependent parameters assigned to them.

- Index, non-editable (integer). The default value is -1, indicating the user has not yet run the indexing algorithm.

The file 

Besides the ones read from the JSON file, each node, by default, is going to have a default parameter set. 
First one is the user-editable node label. The default label is going to be NodeTypeN, e.g. Inlet1, where the count is incremented dynamically for that node type. Second one is the node index

## Notes on ReactFlow usage

- Keep things simple.
- We do not need a custom node type or a custom edge type. From the functionality point of view of the UI, these are merely strings that do not affect anything.
- Keep the port-connection logic simple. We only distinguish between input/output type of ports. Input ports connect to output ports, 