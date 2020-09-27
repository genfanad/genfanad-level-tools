var TOOL_DEFINITIONS = {
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
        }
    },
    'height': {
        'save': {
            instant: () => {
                get('api/tools/mesh/height/save/' + WORKSPACES.opened);
            }
        },
        'load': {
            instant: () => {
                get('api/tools/mesh/height/load/' + WORKSPACES.opened, () => {
                    WORKSPACES.reload();
                });
            }
        }
    },
    'building': {
        'floor-tile': {
            'tool-config': {
                'tools-detail-buildings': true,
                'tools-detail-buildings-shape': true,
                'tools-detail-buildings-floors': true
            },
            name: 'Floors - Draw Tile',
            select: 'tile',
            on_select: (tile) => {
                let level = document.getElementById('tools-detail-buildings-level').value;
                let shape = document.getElementById('tools-detail-buildings-shape-list').value;
                let type = document.getElementById('tools-detail-buildings-floor-list').value;

                console.log(JSON.stringify({
                    selection: tile,
                    level: level, 
                    shape: shape,
                    type: type
                }))
            }
        },
        'floor-line': {
            'tool-config': {
                'tools-detail-buildings': true,
                'tools-detail-buildings-shape': true,
                'tools-detail-buildings-floors': true
            },
            name: 'Floors - Draw Line',
            select: 'line',
            on_select: (tile) => {
                let level = document.getElementById('tools-detail-buildings-level').value;
                let shape = document.getElementById('tools-detail-buildings-shape-list').value;
                let type = document.getElementById('tools-detail-buildings-floor-list').value;

                console.log(JSON.stringify({
                    selection: tile,
                    level: level, 
                    shape: shape,
                    type: type
                }))
            }
        },
        'floor-area': {
            'tool-config': {
                'tools-detail-buildings': true,
                'tools-detail-buildings-shape': true,
                'tools-detail-buildings-floors': true
            },
            name: 'Floors - Draw Area',
            select: 'area',
            on_select: (tile) => {
                let level = document.getElementById('tools-detail-buildings-level').value;
                let shape = document.getElementById('tools-detail-buildings-shape-list').value;
                let type = document.getElementById('tools-detail-buildings-floor-list').value;

                console.log(JSON.stringify({
                    selection: tile,
                    level: level, 
                    shape: shape,
                    type: type
                }))
            }
        },
    }
}

class Tools {
    constructor() {
        this.selected = undefined;
    }

    pickTool(type, tool) {
        if (!TOOL_DEFINITIONS[type]) throw "Invalid tool type: " + type;
        if (!TOOL_DEFINITIONS[type][tool]) throw "Invalid tool " + tool + " for type " + type;

        let t = TOOL_DEFINITIONS[type][tool];

        if (t.instant) {
            t.instant();
            return;
        }

        this.selected = t;
        document.getElementById('tool-selected').innerText = this.selected.name;

        for (let i of document.getElementById('tools-detail').childNodes) {
            if (i.id) {
                i.style.display = t['tool-config'][i.id] ? 'block' : 'none';
            }
        }

        if (t.select == 'tile') {
            SELECTION.setTileMode(t.on_select);
        } else if (t.select == 'line') {
            SELECTION.setLineMode(t.on_select);
        } else if (t.select == 'area') {
            SELECTION.setAreaMode(t.on_select);
        }
    }

    init() {
    }
}

var TOOLS = new Tools();