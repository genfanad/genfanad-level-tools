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

        if (t.select == 'tile') {
            SELECTION.setTileMode(t.on_select);
        }
    }

    init() {
    }
}

var TOOLS = new Tools();