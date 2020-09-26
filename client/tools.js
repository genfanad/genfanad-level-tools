function colorToRGB(tint) {
    return "#" + ((1 << 24) + (tint.r << 16) + (tint.g << 8) + tint.b).toString(16).slice(1);
}

function rgbToColor(argb) {
    var result = /^#ff([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(argb);
    return {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    }
}

class Colors {
    constructor() {
    }

    init() {
        const colors = ["#FF0000", "#00FF00", "#0000FF"]

        this.dom = document.getElementById('tools-detail-color-color');
        let preselects = document.getElementById('tools-detail-color-preselects');

        for (let c of colors) {
            let s = document.createElement('input');
            s.type = 'button';
            s.value = ' ';
            s.style['background-color'] = c;
            s.onclick = () => {
                this.dom.value = c;
            }
            preselects.appendChild(s);
        }
    }
}

var TOOL_DEFINITIONS = {
    'color': {
        'pick': {
            name: 'Color Picker',
            local: true,

            select: 'tile',
            on_select: (tile) => {
                if (tile.color) {
                    document.getElementById('tools-detail-color-color').value =
                        colorToRGB(tile.color);
                }
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
        this.selected = t;
        document.getElementById('tool-selected').innerText = this.selected.name;

        if (t.select == 'tile') {
            SELECTION.setTileMode(t.on_select);
        }
    }

    init() {
        COLORS.init();
    }
}

var COLORS = new Colors();
var TOOLS = new Tools();