# _Nemo_ - Network Modeler

Nemo is a generic user interface to interactively build network models for numerical methods and visualize the produced results.

Beside the canvas, or in place of it, is a [Results notebook](docs/python-console.md) about the drawn network, opening and saving real `.ipynb` files, with a Python prompt in the console pane below sharing its names.
`nemo.case()` reads the canvas, `nemo.show(...)` colours it, and where the model brings a solver `nemo.publish(net, solution=net.solve())` sends a solve straight back onto it.
A figure can be pinned to the canvas, where it exports with the drawing.
It runs in the browser, so there is nothing to install — or on your own machine, for full speed.
