function colorToRGB(tint) {
    return "#" + ((1 << 24) + (tint.r << 16) + (tint.g << 8) + tint.b).toString(16).slice(1);
}

function argbToColor(argb) {
    var result = /^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(argb);
    return {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    }
}

class SceneryEditor {
    constructor() {

    }

    init() {

    }

    setObjects(references) {
        this.scenery = references;
    }

    setUniques(references) {
        this.uniques = references;
    }

    selectScenery(id) {
        this.selected_id = id;
        let definition = this.scenery[id].instance;

        document.getElementById('tools-detail-scenery-id').innerText = id;
        document.getElementById('tools-detail-scenery-model').innerText = definition.object;
        document.getElementById('tools-detail-scenery-rotation').innerText = definition.rotation || 0;

        if (definition.tint) {
            document.getElementById('tools-detail-scenery-tint-enabled').checked = true;
            document.getElementById('tools-detail-scenery-tint-color').value = colorToRGB(definition.tint);
        } else {
            document.getElementById('tools-detail-scenery-tint-enabled').checked = false;
        }
    }

    copyModel() {

    }

    rotateModel(deg) {

    }

    tintChange() {

    }

    deleteModel() {

    }
}

var SCENERY_EDITOR = new SceneryEditor();