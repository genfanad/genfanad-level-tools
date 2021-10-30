const TOOL_DEFINITIONS = {
    'default': {
        'move': {
            hotkey: 'shift-M',
            name: 'Move',
            select: 'tile',
            on_select: (tile) => {}
        },
        'overhead': {
            hotkey: 'shift-O',
            name: 'Camera Overhead',
            instant: () => {
                cameraLookAt(SCENE.camera, 64, 96, 68, 0,1,0, 64,0,64);

                SCENE.controls.target.set(64,20,64);
                SCENE.controls.update();
            }
        },
        'hotkeys': {
            onClose(callback) {
                this.onCloseCallback = callback;
            },
            instant() {
                /*
                * Using setTimeout to handle this code asynchronously.
                * Without this, the alert would block the UI so the button state wouldn't update.
                *
                * todo: implement non-blocking modal, re-usable for the whole project.
                *           see: https://sweetalert2.github.io/
                * */
                setTimeout(() => {
                    TOOLS.printHotkeys();
                    if (this.onCloseCallback) {
                        this.onCloseCallback();
                    }
                }, 10);
            }
        },
        'model_editor': {
            hotkey: 'shift-@',
            name: "Open Model Editor",
            onClose(callback) {
                this.onCloseCallback = callback;
            },
            instant() {
                MODEL_EDITOR.openModelEditor(this.onCloseCallback);
            }
        },
        'model_visual': {
            hotkey: 'shift-!',
            name: "Visual Model Editor",
            instant: () => {
                MODEL_VISUAL.showDialog();
            }
        },
    },
    'camera-projection': {
        'perspective': {
            name: 'Perspective Projection',
            select: 'tile',
            instant: () => SCENE.changeCameraProjectionMode('perspective')
        },
        'orthographic': {
            name: 'Orthographic Projection',
            select: 'tile',
            instant: () => SCENE.changeCameraProjectionMode('orthographic')
        },
    },
    'editor': {
        'undo': {
            hotkey: 'ctrl-',
            hotkey_human: 'ctrl+Z',
            name: "Undo",
            instant: () => {
                get('api/tools/undo/undo/' + WORKSPACES.opened, () => {
                    WORKSPACES.reload();
                });
            }
        },
        'redo': {
            hotkey: 'ctrl-',
            hotkey_human: 'ctrl+Y',
            name: "Redo",
            instant: () => {
                get('api/tools/undo/redo/' + WORKSPACES.opened, () => {
                    WORKSPACES.reload();
                });
            }
        },

        'save-clipboard': {
            hotkey: "ctrl-shift-C",
            name: "Save copy buffer to clipboard",
            instant: () => {
                get('api/tools/editor/selection/' + WORKSPACES.opened, (buffer) => {
                    navigator.clipboard.writeText(JSON.stringify(buffer));
                });
            }
        },
        'load-clipboard': {
            hotkey: "ctrl-shift-V",
            name: "Load copy buffer from clipboard",
            instant: () => {
                navigator.clipboard.readText().then(clipText => {
                    post('api/tools/editor/selection/' + WORKSPACES.opened, {
                        selection: JSON.parse(clipText)
                    }, () => {
                        console.log("Loaded selection");
                    });
                });
                /*post('api/tools/editor/copy-buffer' + WORKSPACES.opened, () => {
                    console.log("Loaded.");
                });*/
            }
        },

        'copy': {
            'tool-config': {
                'tools-copy-choices': true,
            },
            name: 'Copy',
            select: 'area',
            hotkey: 'ctrl-C',
            on_select: (tile) => {
                let layers = {};
                for (let type of ['color', 'height', 'buildings', 'scenery']) {
                    if (document.getElementById('tools-copy-' + type).checked)
                        layers[type] = true;
                }
                post('api/tools/editor/copy/' + WORKSPACES.opened,{
                    selection: tile,
                    layers: layers,
                }, () => {
                    WORKSPACES.reload();
                });
            }
        },
        'cut': {
            'tool-config': {
                'tools-copy-choices': true,
            },
            name: 'Cut',
            select: 'area',
            hotkey: 'ctrl-X',
            on_select: (tile) => {
                let layers = {};
                for (let type of ['color', 'height', 'buildings', 'scenery']) {
                    if (document.getElementById('tools-copy-' + type).checked)
                        layers[type] = true;
                }
                post('api/tools/editor/cut/' + WORKSPACES.opened,{
                    selection: tile,
                    layers: layers,
                }, () => {
                    WORKSPACES.reload();
                });
            }
        },
        'paste': {
            'tool-config': {
                'tools-copy-choices': true,
            },
            name: 'Paste',
            select: 'fixed-area',
            hotkey: 'ctrl-V',
            init: () => {
                get('api/tools/editor/selection/' + WORKSPACES.opened, (data) => {
                    if (!data) {
                        TOOLS.pickTool('default','move');
                        return;
                    }
                    SELECTION.cursor.setDimensions(data.w, data.h);
                    //console.log("Selected: " + JSON.stringify(data));
                });
            },
            on_select: (tile) => {
                let layers = {};
                for (let type of ['color', 'height', 'buildings', 'scenery']) {
                    if (document.getElementById('tools-copy-' + type).checked)
                        layers[type] = true;
                }
                post('api/tools/editor/paste/' + WORKSPACES.opened,{
                    selection: tile,
                    layers: layers,
                }, () => {
                    WORKSPACES.reload();
                });
            }
        },
        'paste-rotated': {
            'tool-config': {
                'tools-copy-choices': true,
            },
            name: 'Paste Rotated',
            select: 'fixed-area',
            init: () => {
                get('api/tools/editor/selection/' + WORKSPACES.opened, (data) => {
                    if (!data) {
                        TOOLS.pickTool('default','move');
                        return;
                    }
                    SELECTION.cursor.setDimensions(data.h, data.w);
                });
            },
            on_select: (tile) => {
                let layers = {};
                for (let type of ['color', 'height', 'buildings', 'scenery']) {
                    if (document.getElementById('tools-copy-' + type).checked)
                        layers[type] = true;
                }
                post('api/tools/editor/paste-rotated/' + WORKSPACES.opened,{
                    selection: tile,
                    layers: layers,
                }, () => {
                    WORKSPACES.reload();
                });
            }
        },
    },
    'mesh': {
        'clear': {
            instant: () => {
                get('api/tools/mesh/clear/' + WORKSPACES.opened);
            }
        },
    },
    'color': {
        'save': {
            instant: () => {
                get('api/tools/mesh/color/save/' + WORKSPACES.opened);
            }
        },
        'load': {
            instant: () => {
                get('api/tools/mesh/color/load/' + WORKSPACES.opened, () => {
                    WORKSPACES.reload();
                });
            }
        },
    },
    'blend_mask': {
        'save': {
            instant: () => {
                get('api/tools/mesh/blend_mask/save/' + WORKSPACES.opened);
            }
        },
        'load': {
            instant: () => {
                get('api/tools/mesh/blend_mask/load/' + WORKSPACES.opened, () => {
                    WORKSPACES.reload();
                });
            }
        },
        'toggle': {
            'tool-config': {},
            name: 'Toggle Blend Mode',
            select: 'tile',
            hotkey: 'shift-1',
            on_select: (tile) => {
                post('api/tools/mesh/blend_mask/toggle/' + WORKSPACES.opened, tile, () => {
                    WORKSPACES.reload();
                });
            }
        },
    },
    'collision_mask': {
        'save': {
            instant: () => {
                get('api/tools/mesh/collision_mask/save/' + WORKSPACES.opened);
            }
        },
        'load': {
            instant: () => {
                get('api/tools/mesh/collision_mask/load/' + WORKSPACES.opened, () => {
                    WORKSPACES.reload();
                });
            }
        },
        'toggle': {
            'tool-config': {},
            name: 'Toggle Collision',
            select: 'tile',
            hotkey: 'shift-J',
            on_select: (tile) => {
                post('api/tools/mesh/collision_mask/toggle/' + WORKSPACES.opened, tile, () => {
                    WORKSPACES.reload();
                });
            }
        },
    },
    'orientation': {
        'save': {
            instant: () => {
                get('api/tools/mesh/orientation/save/' + WORKSPACES.opened);
            }
        },
        'load': {
            instant: () => {
                get('api/tools/mesh/orientation/load/' + WORKSPACES.opened, () => {
                    WORKSPACES.reload();
                });
            }
        },
        'toggle': {
            'tool-config': {},
            name: 'Toggle Orientation',
            select: 'tile',
            on_select: (tile) => {
                post('api/tools/mesh/orientation/toggle/' + WORKSPACES.opened, tile, () => {
                    WORKSPACES.reload();
                });
            }
        },
    },
    'render_mask': {
        'save': {
            instant: () => {
                get('api/tools/mesh/render_mask/save/' + WORKSPACES.opened);
            }
        },
        'load': {
            instant: () => {
                get('api/tools/mesh/render_mask/load/' + WORKSPACES.opened, () => {
                    WORKSPACES.reload();
                });
            }
        },
        'toggle': {
            'tool-config': {},
            name: 'Toggle Rendering',
            select: 'tile',
            on_select: (tile) => {
                post('api/tools/mesh/render_mask/toggle/' + WORKSPACES.opened, tile, () => {
                    WORKSPACES.reload();
                });
            }
        },
    },
    'height': {
        'image': {
            'tool-config': {
                'tools-detail-height-mesh': true,
            },
            name: "Height Load/Save",
            select: 'tile',
            on_select: (tile) => {
            },
        },
        'brush': {
            'tool-config': {
                'tools-detail-height': true,
            },
            name: 'Height Brush',
            select: 'fixed-area',
            hotkey: 'shift-H',
            init: () => {
                updateHeightBrush();
            },
            on_select: (tile) => {
                let size = document.getElementById('tools-detail-height-size').value;
                let step = document.getElementById('tools-detail-height-step').value;
                let min = document.getElementById('tools-detail-height-min').value;
                let max = document.getElementById('tools-detail-height-max').value;

                let options = {
                    selection: tile,
                    size: Number(size),
                    step: Number(step),
                }
                if (min) options.min = min;
                if (max) options.max = max;

                console.log(JSON.stringify(options));

                post('api/tools/mesh/height/brush/' + WORKSPACES.opened, options, () => {
                    WORKSPACES.reload();
                });
            }
        },
    },
    'building': {
        'batch': {
            'tool-config': {
                'tools-detail-buildings-floors': true,
                'tools-detail-ground-batch': true,
            },
            name: 'Floors - Batch Edit',
            select: 'tile',
            on_select: (tile) => {
            },
        },
        'floor-tile': {
            'tool-config': {
                'tools-detail-buildings': true,
                'tools-detail-buildings-shape': true,
                'tools-detail-buildings-floors': true
            },
            name: 'Floors - Draw Tile',
            select: 'tile',
            hotkey: 'shift-F',
            init: () => {
                SELECTION.swapCursorShape(document.getElementById('tools-detail-buildings-shape-list').value)
            },
            on_select: (tile) => {
                let level = document.getElementById('tools-detail-buildings-level').value;
                let shape = document.getElementById('tools-detail-buildings-shape-list').value;
                let type = document.getElementById('tools-detail-buildings-floor-list').value;

                post('api/tools/buildings/draw-floor/' + WORKSPACES.opened,{
                    selection: tile,
                    level: level,
                    shape: shape,
                    type: type
                }, () => {
                    WORKSPACES.reloadMesh();
                });
            }
        },
        'floor-tile-select': {
            name: "Floors - Select Texture",
            hotkey: 'shift-#',
            instant: () => {
                TEXTURE_SELECTION.openBuildingSelection('tools-detail-buildings-floor-list');
            }
        },
        /*'floor-line': {
            'tool-config': {
                'tools-detail-buildings': true,
                'tools-detail-buildings-shape': true,
                'tools-detail-buildings-floors': true
            },
            name: 'Floors - Draw Line',
            select: 'line-tile',
            init: () => {
                SELECTION.showAdditionalCursor();
                SELECTION.swapCursorShape(document.getElementById('tools-detail-buildings-shape-list').value)
            },
            on_select: (tile) => {
                let level = document.getElementById('tools-detail-buildings-level').value;
                let shape = document.getElementById('tools-detail-buildings-shape-list').value;
                let type = document.getElementById('tools-detail-buildings-floor-list').value;

                post('api/tools/buildings/draw-floor/' + WORKSPACES.opened,{
                    selection: tile,
                    level: level, 
                    shape: shape,
                    type: type
                }, () => {
                    WORKSPACES.reload();
                });
            }
        },*/
        'floor-area': {
            'tool-config': {
                'tools-detail-buildings': true,
                'tools-detail-buildings-shape': true,
                'tools-detail-buildings-floors': true
            },
            name: 'Floors - Draw Area',
            select: 'area',
            hotkey: 'alt-F',
            on_select: (tile) => {
                let level = document.getElementById('tools-detail-buildings-level').value;
                let shape = document.getElementById('tools-detail-buildings-shape-list').value;
                let type = document.getElementById('tools-detail-buildings-floor-list').value;

                post('api/tools/buildings/draw-floor/' + WORKSPACES.opened,{
                    selection: tile,
                    level: level,
                    shape: shape,
                    type: type
                }, () => {
                    WORKSPACES.reloadMesh();
                });
            }
        },
        'wall-line': {
            'tool-config': {
                'tools-detail-buildings': true,
                'tools-detail-buildings-walls': true
            },
            name: 'Walls - Draw Line',
            select: 'line',
            hotkey: 'shift-W',
            on_select: (tile) => {
                let level = document.getElementById('tools-detail-buildings-level').value;
                let type = document.getElementById('tools-detail-buildings-wall-list').value;

                post('api/tools/buildings/draw-wall/' + WORKSPACES.opened,{
                    selection: tile,
                    level: level,
                    type: type
                }, () => {
                    WORKSPACES.reloadMesh();
                });
            }
        },
        'wall-area': {
            'tool-config': {
                'tools-detail-buildings': true,
                'tools-detail-buildings-walls': true
            },
            name: 'Walls - Draw Square',
            select: 'area',
            hotkey: 'alt-W',
            on_select: (tile) => {
                let level = document.getElementById('tools-detail-buildings-level').value;
                let type = document.getElementById('tools-detail-buildings-wall-list').value;

                post('api/tools/buildings/draw-wall/' + WORKSPACES.opened,{
                    selection: tile,
                    level: level,
                    type: type
                }, () => {
                    WORKSPACES.reloadMesh();
                });
            }
        },
        'wall-texture-select': {
            name: "Walls - Select Texture",
            hotkey: 'shift-$',
            instant: () => {
                TEXTURE_SELECTION.openBuildingSelection('tools-detail-buildings-wall-list');
            }
        },
        'roof-tile': {
            'tool-config': {
                'tools-detail-buildings': true,
                'tools-detail-buildings-shape': true,
                'tools-detail-buildings-roofs': true
            },
            name: 'Floors - Draw Roof',
            select: 'tile',
            hotkey: 'shift-R',
            init: () => {
                SELECTION.swapCursorShape(document.getElementById('tools-detail-buildings-shape-list').value)
            },
            on_select: (tile) => {
                let level = document.getElementById('tools-detail-buildings-level').value;
                let shape = document.getElementById('tools-detail-buildings-shape-list').value;
                let type = document.getElementById('tools-detail-buildings-roof-list').value;

                post('api/tools/buildings/draw-roof/' + WORKSPACES.opened,{
                    selection: tile,
                    level: level,
                    shape: shape,
                    type: type
                }, () => {
                    WORKSPACES.reloadMesh();
                });
            }
        },
        'roof-texture-select': {
            name: "Roof - Select Texture",
            hotkey: 'shift-%',
            instant: () => {
                TEXTURE_SELECTION.openBuildingSelection('tools-detail-buildings-roof-list');
            }
        },
        /*'roof-line': {
            'tool-config': {
                'tools-detail-buildings': true,
                'tools-detail-buildings-shape': true,
                'tools-detail-buildings-roofs': true
            },
            name: 'Roof - Draw Line',
            select: 'line-tile',
            init: () => {
                SELECTION.showAdditionalCursor();
                SELECTION.swapCursorShape(document.getElementById('tools-detail-buildings-shape-list').value)
            },
            on_select: (tile) => {
                let level = document.getElementById('tools-detail-buildings-level').value;
                let shape = document.getElementById('tools-detail-buildings-shape-list').value;
                let type = document.getElementById('tools-detail-buildings-roof-list').value;

                post('api/tools/buildings/draw-roof/' + WORKSPACES.opened,{
                    selection: tile,
                    level: level, 
                    shape: shape,
                    type: type
                }, () => {
                    WORKSPACES.reload();
                });
            }
        },*/
        'roof-area': {
            'tool-config': {
                'tools-detail-buildings': true,
                'tools-detail-buildings-shape': true,
                'tools-detail-buildings-roofs': true
            },
            name: 'Roofs - Draw Area',
            select: 'area',
            hotkey: 'alt-R',
            on_select: (tile) => {
                let level = document.getElementById('tools-detail-buildings-level').value;
                let shape = document.getElementById('tools-detail-buildings-shape-list').value;
                let type = document.getElementById('tools-detail-buildings-roof-list').value;

                post('api/tools/buildings/draw-roof/' + WORKSPACES.opened,{
                    selection: tile,
                    level: level,
                    shape: shape,
                    type: type
                }, () => {
                    WORKSPACES.reloadMesh();
                });
            }
        },
        'clear-area': {
            'tool-config': {},
            name: 'Clear Area of Buildings',
            select: 'area',
            hotkey: 'shift-Q',
            on_select: (tile) => {
                post('api/tools/buildings/clear-area/' + WORKSPACES.opened,{
                    selection: tile,
                }, () => {
                    WORKSPACES.reloadMesh();
                });
            }
        },
        'raise-area': {
            'tool-config': {},
            name: 'Raise buildings up a floor',
            select: 'area',
            on_select: (tile) => {
                post('api/tools/buildings/raise-area/' + WORKSPACES.opened,{
                    selection: tile,
                }, () => {
                    WORKSPACES.reloadMesh();
                });
            }
        },
        'lower-area': {
            'tool-config': {},
            name: 'Lower buildings up a floor',
            select: 'area',
            on_select: (tile) => {
                post('api/tools/buildings/lower-area/' + WORKSPACES.opened,{
                    selection: tile,
                }, () => {
                    WORKSPACES.reloadMesh();
                });
            }
        },
        'flatten-area': {
            'tool-config': {},
            name: 'Flatten Area',
            select: 'area',
            hotkey: 'T',
            on_select: (tile) => {
                post('api/tools/buildings/flatten-area/' + WORKSPACES.opened,{
                    selection: tile,
                }, () => {
                    WORKSPACES.reloadMesh();
                });
            }
        },
    },
    'scenery': {
        'select': {
            'tool-config': {
                'tools-detail-scenery-selected': true,
                'tools-detail-scenery-models': true,
            },
            name: 'Scenery - Select',
            select: 'scenery',
            hotkey: 'S',
            on_select: (scenery, cursor) => {
                if (!scenery) {
                    SCENERY_EDITOR.unselect();
                } else if (scenery.type === 'scenery') {
                    SCENERY_EDITOR.selectScenery(scenery.id, cursor);
                } else if (scenery.type === 'unique') {
                    SCENERY_EDITOR.selectUniqueScenery(scenery.id, cursor);
                } else {
                    console.log("Clicked on " + JSON.stringify(scenery));
                }
            },
            dispose: () => SELECTION.removeSceneryCursor()
        },
        'place': {
            'tool-config': {
                'tools-detail-scenery-models': true,
                'tools-detail-scenery-customize': true,
            },
            name: 'Scenery - Place',
            select: 'tile',
            hotkey: 'P',
            init: () => {
                SCENERY_EDITOR.openPlacementTool();
                document.getElementById('tools-detail-scenery-rotation').innerText = 0;
            },
            dispose: () => {
                SCENERY_EDITOR.closePlacementTool();
            },
            on_select: (tile) => {
                SCENERY_EDITOR.placeModel(tile);
            }
        },
        'place-unique': {
            'tool-config': {
                'tools-detail-scenery-models': true,
            },
            name: 'Scenery - Place Unique',
            select: 'tile',
            init: () => {
            },
            dispose: () => {
            },
            on_select: (tile) => {
                SCENERY_EDITOR.placeUnique(tile);
            }
        },
        'batch': {
            'tool-config': {
                'tools-detail-scenery-batch': true,
            },
            name: 'Scenery - Batch Edit',
            select: 'tile',
            on_select: (tile) => {
            },
        },
        'center': {
            name: 'Scenery - Center camera',
            hotkey: '.',
            instant: () => {
                SCENERY_EDITOR.centerCamera();
            }
        },
    },
    'item': {
        'select': {
            'tool-config': {
                'tools-detail-item-selected': true,
            },
            name: 'Item - Select',
            select: 'item',
            on_select: (item, cursor) => {
                if (!item) {
                } else {
                    let html = `<p><b>NPC</b>: ${item.item.item}</p> <p><b>Spawn Rate</b>: ${item.spawnRate}</p>`

                    document.getElementById('tools-detail-item-selected-text').innerHTML = html;

                }
            },
            dispose: () => SELECTION.removeSceneryCursor()
        },
        'place': {
            'tool-config': {
                'tools-detail-item-place': true,
            },
            name: 'Place Item',
            select: 'tile',
            on_select: (tile) => {
                let item = document.getElementById('tools-detail-item-place-list').value;
                let spawn_rate = document.getElementById('tools-detail-item-place-spawn_rate').value;
                let count = document.getElementById('tools-detail-item-place-count').value;

                let def = {
                    item: item,
                    layer: WORKSPACES.attached_args.layer,
                    spawn_rate: spawn_rate,
                    count: count
                };

                def.gx = tile.x + WORKSPACES.attached_args.x * 128;
                def.gy = tile.y + WORKSPACES.attached_args.y * 128;

                post('http://localhost:7780/api/cli/place_item.js', def, (r) => {
                    WORKSPACES.reloadMesh();
                });
            }
        },
    },
    'npc': {
        'select': {
            'tool-config': {
                'tools-detail-npc-selected': true,
            },
            name: 'NPC - Select',
            select: 'npc',
            on_select: (npc, cursor) => {
                if (!npc) {
                } else {
                    console.log("Clicked on " + JSON.stringify(npc));

                    let html = `<p><b>NPC</b>: ${npc.npc}</p> <p><b>Count</b>: ${npc.capacity}</p>`

                    document.getElementById('tools-detail-npc-selected-text').innerHTML = html;

                }
            },
            dispose: () => SELECTION.removeSceneryCursor()
        },
        'place': {
            'tool-config': {
                'tools-detail-npc-place': true,
            },
            name: 'Place NPC',
            select: 'area',
            on_select: (area) => {
                let npc = document.getElementById('tools-detail-npc-place-list').value;
                let type = document.getElementById('tools-detail-npc-place-wander').value;
                let count = document.getElementById('tools-detail-npc-place-count').value;

                let def = {
                    npc: npc,
                    layer: WORKSPACES.attached_args.layer,
                    wander: type,
                    spawn_rate: 60,
                    count: count,
                };

                if (type == 'circle') {
                    def.gx = Math.floor((area.maxx - area.minx) / 2.0) + area.minx;
                    def.gy = Math.floor((area.maxy - area.miny) / 2.0) + area.miny;
                    def.w = Math.floor((area.maxy - area.miny) / 2.0);
                } else {
                    def.gx = area.minx;
                    def.gy = area.miny;
                    def.w = area.maxx - area.minx;
                    def.h = area.maxy - area.miny;
                }

                def.gx += WORKSPACES.attached_args.x * 128;
                def.gy += WORKSPACES.attached_args.y * 128;

                post('http://localhost:7780/api/cli/place_npc.js', def, (r) => {
                    WORKSPACES.reloadMesh();
                });
            }
        },
    }
}

function batchAction(action) {
    post('api/tools/batch-scenery/' + action + '/' + WORKSPACES.opened,{
        prefix: document.getElementById('tools-detail-scenery-batch-prefix').value,
        randomize: document.getElementById('tools-detail-scenery-batch-prefix-randomize').value
    }, () => {
        WORKSPACES.reload();
    });
}

function batchFloorAction(action) {
    post('api/tools/batch-scenery/' + action + '/' + WORKSPACES.opened,{
        floor: document.getElementById('tools-detail-buildings-floor-list').value
    }, () => {
        WORKSPACES.reload();
    });
}

function updateHeightBrush() {
    if (TOOLS.selected.name != 'Height Brush') return;

    let s = document.getElementById('tools-detail-height-size').value;
    SELECTION.cursor.setDimensions(s,s, true);
}

function clearOption(id) {
    let dom = document.getElementById(id);
    dom.value = 'delete';
    dom.dispatchEvent(new Event("change"));
}

function copyCheck(b) {
    for (let type of ['color', 'height', 'buildings', 'scenery']) {
        document.getElementById('tools-copy-' + type).checked = b;
    }
}

function saveHeight() {
    let low = document.getElementById('tools-detail-height-low').value;
    let high = document.getElementById('tools-detail-height-high').value;
    post('api/tools/mesh/height/save/' + WORKSPACES.opened,{
        low: low,
        high: high,
    }, () => {
    });
}

function loadHeight() {
    let low = document.getElementById('tools-detail-height-low').value;
    let high = document.getElementById('tools-detail-height-high').value;
    post('api/tools/mesh/height/load/' + WORKSPACES.opened,{
        low: low,
        high: high,
    }, () => {
        WORKSPACES.reload();
    });
}

class Tools {
    constructor() {
        this.selected = undefined;

        this.hotkeys = {};
        for (let type in TOOL_DEFINITIONS) {
            for (let tool in TOOL_DEFINITIONS[type]) {
                let t = TOOL_DEFINITIONS[type][tool];
                if (t.hotkey) {
                    this.hotkeys[t.hotkey] = [type, tool];
                }
            }
        }
    }

    handleButtonState(clickedButton, toolDefinition) {
        const buttonClasses = [...clickedButton.classList];

        if (buttonClasses.includes('button-group')) {
            this.handleButtonGroup(clickedButton);
        } else if (buttonClasses.includes('button-single')) {
            this.handleSingleButton(clickedButton, toolDefinition);
        } else if (buttonClasses.includes('button-click')) {
            this.handleClickableButton(clickedButton);
        } else if (buttonClasses.find(buttonClass => buttonClass.startsWith('button-group-'))) {
            this.handleSpecificButtonGroup(clickedButton);
        }
    }

    handleButtonGroup(clickedButton) {
        const allButtonsInGroup = [...document.getElementsByClassName('button-group')];

        allButtonsInGroup.forEach(htmlElement => this.setButtonActive(htmlElement, false));
        this.setButtonActive(clickedButton, true);
    }

    handleSingleButton(button, toolDefinition) {
        button.classList.add('active');

        if (toolDefinition.onClose) {
            toolDefinition.onClose(() => button.classList.remove('active'));
        }
    }

    handleClickableButton(button) {
        button.classList.add('active');
        setTimeout(() => button.classList.remove('active'), 100);
    }

    handleSpecificButtonGroup(clickedButton) {
        const buttonClasses = [...clickedButton.classList];
        const buttonGroupClassName = buttonClasses.find(buttonClass => buttonClass.startsWith('button-group-'));

        const allButtonsInGroup = [...document.getElementsByClassName(buttonGroupClassName)];

        allButtonsInGroup.forEach(htmlElement => this.setButtonActive(htmlElement, false));
        this.setButtonActive(clickedButton, true);
    }

    setButtonActive(button, active) {
        button.classList.remove(active ? 'inactive' : 'active');
        button.classList.add(active ? 'active' : 'inactive');
    }

    pickTool(type, tool, element) {
        if (!TOOL_DEFINITIONS[type]) throw "Invalid tool type: " + type;
        if (!TOOL_DEFINITIONS[type][tool]) throw "Invalid tool " + tool + " for type " + type;

        const toolDefinition = TOOL_DEFINITIONS[type][tool];

        if (element) {
            this.handleButtonState(element, toolDefinition);
        }

        if (toolDefinition.instant) {
            toolDefinition.instant();
            return;
        }

        if (this.selected && this.selected.dispose) {
            this.selected.dispose();
        }

        this.selected = toolDefinition;
        document.getElementById('tool-selected').innerText = this.selected.name;

        for (let i of document.getElementById('tools-detail').childNodes) {
            if (i.id) {
                if (toolDefinition['tool-config']) {
                    i.style.display = toolDefinition['tool-config'][i.id] ? 'block' : 'none';
                } else {
                    i.style.display = 'none';
                }
            }
        }

        if (toolDefinition.select === 'tile') {
            SELECTION.setTileMode(toolDefinition.on_select);
        } else if (toolDefinition.select === 'line') {
            SELECTION.setLineMode(toolDefinition.on_select);
        } else if (toolDefinition.select === 'area') {
            SELECTION.setAreaMode(toolDefinition.on_select);
        } else if (toolDefinition.select === 'fixed-area') {
            SELECTION.setFixedAreaMode(toolDefinition.on_select);
        } else if (toolDefinition.select === 'scenery') {
            SELECTION.setSceneryMode(toolDefinition.on_select);
        } else if (toolDefinition.select === 'npc') {
            SELECTION.setNPCMode(toolDefinition.on_select);
        } else if (toolDefinition.select === 'item') {
            SELECTION.setItemMode(toolDefinition.on_select);
        }

        if (toolDefinition.init) toolDefinition.init();
    }

    init() {
    }

    keyPress(event) {
        if (!event.key) return;
        let letter = event.key.toUpperCase();
        if (event.shiftKey) letter = 'shift-' + letter;
        if (event.altKey) letter = 'alt-' + letter;
        if (event.ctrlKey) letter = 'ctrl-' + letter;

        console.log("Pressed " + letter);
        if (this.hotkeys[letter]) {
            this.pickTool(...this.hotkeys[letter]);
        }
    }

    printHotkeys() {
        let message = "";
        for (let i in this.hotkeys) {
            let key = TOOL_DEFINITIONS[this.hotkeys[i][0]][this.hotkeys[i][1]].hotkey_human || i;
            message += key + ": " +  TOOL_DEFINITIONS[this.hotkeys[i][0]][this.hotkeys[i][1]].name + "\n";
        }
        alert(message);
    }
}

const TOOLS = new Tools();