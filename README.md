# FNetLibUI

Node-graph user interface for the [Nefes](../Nefes) compressible flow-network solver.
Networks drawn here are saved as YAML cases that `nefes.io.load_case` reads directly, and Nefes writes its results back into the same file for visualization (`nefes.io.save_case` / `solution.to_yaml`).

Element schematic artwork follows the glyph spec in [docs/glyphs.md](docs/glyphs.md); review the full set at `/?glyphs` on a dev server.
