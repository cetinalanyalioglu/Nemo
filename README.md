# _Nemo_ - Network Modeler

Nemo is a generic user interface to interactively build network models for numerical methods and visualize the produced results.

The console pane carries a [Python prompt](docs/python-console.md) with the drawn network in reach: `nemo.case()` reads it, `nemo.show(...)` colours it, and with Nefes installed `nemo.publish(net, solution=net.solve())` sends a solve straight back onto the canvas.
It runs in the browser, so there is nothing to install.
