# genfanad-level-tools
This is a set of tools for editing Genfanad maps.

Genfanad is a brand new game based on classic games of the past. http://genfanad.com/ If you're interested in playing or developing for it, please come join our discord at https://discord.gg/uN3Vvsv

# Startup Guide
* Install Node (and npm). (https://nodejs.org/en/)
* Run the editor.
  * If you are on Windows, run (double-click) the 'start-windows.bat' file.
  * If you are on another OS, run 'node ./server/editor.js' in a terminal.
* Open the map editing tools in your browser. It defaults to http://localhost:7781/maps.html

# Feature Requests
* Currently tracked in this document: https://docs.google.com/document/d/1AWn1rXQP8D2rTjHtYPCMLJZhatd8wtkC0cmxE2kikh8/edit?usp=sharing
* Feel free to send PRs or bugs to the github as well.

# Editing Guide
## Workspaces
A workspace is a folder that is created under /tmp that contains all the information necessary for editing and using the map.

You can get started by extracting one of the sample ZIP files into the /tmp directory.

## Assets
Assets are model packs that are reusable across multiple workspaces. The format of an asset pack is a folder with:
* One or more shared textures as PNG files in the base asset directory.
* An OBJ folder that contains any number of OBJ-format models.

## General Editing
You can see a list of all current hotkeys using the 'Hotkeys' button.

Undo/Redo works on most commands.

## Layer selection
Different parts of the map can be toggled as layers.
* Grid: Overlays the map with a simple grid for easier positioning.
* Terrain: The terrain mesh (height+color).
* Buildings: Walls and second floors of any buildings.
* Buildings - Roofs: Allows you to look at interiors independently.
* Scenery: Models added to the map.
* NPC spawns / Item Spawns / Water: Not yet implemented.

## Tool Selection
The currently opened tool is visible in the toolbar at the top of the page.

The tools page is grouped by the type of operation that is being done. Editing the heightmap and colors are in the Mesh tab, while placing and editing models is in the 'scenery' tab.

## Tool Reference
### Mesh
Mesh editing is provided by editing PNG files that represent that color and height maps.

"Save Color" will create 'color.png' in the workspace folder (The 'Open Editor' button will jump to it) and "Load Color" will replace the map with the contents of that file.

Height maps work similarly.

### Buildings
#### Floor/Wall/Roof
These tools edit the texture of the ground. Tile/Line/Area let you choose whether drawing a specific tile, drawing a line on the map, or selecting a square. Building floor represents whether you're editing the ground, first floor, or second floor. Tile shape allows you to make half-tile segments (great for diagonal roads or houses). The actual dropdown allows you to choose which type of tile to draw.

#### Clear Area
This will delete all buildings in the selected area.

### Scenery
This allows you to modify the 3D models in the map.

#### Select
Choose this tool and you can click on existing scenery in the map. When you click on it, you can rotate the individual models, change the tint, or delete the scenery entirely.

You can click "Copy" to enter placement mode with the same model that is selected.

#### Place
Placement mode allows you to click a tile to place the selected model in that tile.

'Randomize Rotation' will automatically randomize the direction the model faces. This is useful for placing multiple copies of a model near each other.

#### Batch Edit
This tool allows you to edit many models at once, but converting a subset of scenery back and forth between image/JSON files. The tools will only apply to scenery where the ID matches the prefix.

Scenery is saved to 'batch-scenery.png' and 'batch-scenery.json'. Each scenery type will get a unique color (specified in batch-scenery.json) and a PNG will be generated with a pixel for each color. You can draw more of existing pieces of scenery and they will be added to the map with the 'load' tool. Similarly, deleting scenery in bulk can be done as well.

Tints are saved to 'tints.png' and can be used to recolor large parts of the map, like the dark forest.

Random rotation will rotate all scenery that matches the prefix randomly, exactly as it says.

## Model Editor
When you choose the model placement tool, you can click '...' to enter the model editor.

The model editor has a file selection on the left that allows you to browse asset packs and existing model definitions. The workflow is to pick an asset, make sure it's positioned to fit within a map tile, then save it as a model definition.

The scale/translate/rotate buttons will change what the mouse does and pop up controls to visually transform the model. The camera button will revert the mouse back to moving the camera.

The other buttons in the editing page will try to reposition and stretch the model based on parameters. Resize 'fit' will scale it so that the model is fully contained with the tile box. ABS will set the scale to the number chosen. % will multiply the current scale by the number chosen. Reposition origin will move the model back to the default location. Reposition tile center will try to compute a bounding box and move the model to the center of the tile. X and Z will try to align the model with the X and Z axes.

You can hit 'close and select' to go back to the placement page with the currently selected model being chosen to place.

## Miscellanea
* "Open Folder..." will open the currently opened workspace in your OS file editor. This is a convenience for copying files back and forth.

# License
MIT on the code. Assets provided in example maps are owned by their original creator.