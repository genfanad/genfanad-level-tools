# genfanad-level-tools
This is a set of tools for editing Genfanad maps.

# Startup Guide
* Install Node (and npm). (https://nodejs.org/en/)
* Run the editor.
  * If you are on Windows, run (double-click) the 'start-windows.bat' file.
  * If you are on another OS, run 'node ./server/editor.js' in a terminal.
* Open the map editing tools in your browser. It defaults to http://localhost:7781/maps.html

# Editing Guide
## Workspaces
A workspace is a folder that is created under /tmp that contains all the information necessary for editing and using the map.

## Assets
Assets are model packs that are reusable across multiple workspaces. The format of an asset pack is a folder with:
* One or more shared textures as PNG files in the base asset directory.
* An OBJ folder that contains any number of OBJ-format models.

# License
MIT on the code. Assets provided in example maps are owned by their original creator.