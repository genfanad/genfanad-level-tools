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
        // The transformcontrols don't play nicely with this version of orbitcontrols
        //this.controls = new THREE.TransformControls(SCENE.camera, SCENE.renderer.domElement);
        
        this.cursorGroup = new THREE.Group();
        this.cursorModel = undefined;

        $('#floor-dialog').dialog({
            title: "Floor Selection",
            modal: true,
            closed: true,
        });
        $('#wall-dialog').dialog({
            title: "Wall Selection",
            modal: true,
            closed: true,
        });
        $('#roof-dialog').dialog({
            title: "Roof Selection",
            modal: true,
            closed: true,
        });

    }

    rotateModel(value) {
        let rotation = N(document.getElementById('tools-detail-scenery-rotation').innerText) || 0;
        rotation += value;
        while (rotation < 0) rotation += 360;
        while (rotation >= 360) rotation -= 360;
        document.getElementById('tools-detail-scenery-rotation').innerText = rotation;

        // TODO: Rotating a model probably doesn't need to reload it, but why not.
        this.modelListChange();
    }

    modelListChange() {
        if (this.placing) {
            let model = document.getElementById('tools-detail-scenery-model-list').value;
            if (this.cursorModel) {
                this.cursorGroup.remove(this.cursorModel);
            }
            if (model != 'delete') {
                let def = { object: model, x: 0, y: 0 };
                let rotation = N(document.getElementById('tools-detail-scenery-rotation').innerText) || 0.0;

                this.sceneryLoader.createScenery(def, (mesh, info) => {
                    let globalMesh = new THREE.Group();
                    let rotationMesh = new THREE.Group();
                    rotationMesh.add(mesh);
                    globalMesh.add(rotationMesh);
            
                    if (rotation) {
                        rotationMesh.translateX(0.5);
                        rotationMesh.translateZ(0.5);
                        rotationMesh.rotateY(THREE.Math.degToRad(rotation));
                        rotationMesh.translateZ(-0.5);
                        rotationMesh.translateX(-0.5);
                    }
            
                    this.cursorModel = globalMesh;
            
                    /*this.cursorModel.position.set(
                         cursor.position.x - 0.5,
                         cursor.position.y - 0.5,
                         cursor.position.z - 0.5);*/
            
                    this.cursorGroup.add(this.cursorModel);
                });
            }
        }
    }

    openTexturePreviewModal(id) {
        let type = id.split("-").slice(-2, -1)[0];
        let name = document.getElementById(id).value.split(".")[0] + ".png";

        if(name !== "delete.png"){
            $("#" + type + "-dialog").dialog('open');
            $("#" + type + "-dialog").window('center');
        }

        this.displayTexturePreview(type, name);
    }

    displayTexturePreview(type, name){
        let modal = document.getElementById(type + "-dialog");

        let image = document.createElement("img");

        image.style.maxHeight = '100%'
        image.style.display = 'block';
        image.style.margin =  'auto';

        image.src = image.src = '/workspaces/' + WORKSPACES.opened + '/buildings/' + type + 's/' + name;

        modal.removeChild(modal.lastChild);
        modal.appendChild(image);
    }

    openPlacementTool() {
        console.log("Model place tool opened.");
        this.placing = true;
        SELECTION.cursor.threeObject.add(this.cursorGroup);
    }

    closePlacementTool() {
        console.log("Model place tool closed.");
        this.placing = false;
        SELECTION.cursor.threeObject.remove(this.cursorGroup);
    }

    setObjects(references) {
        this.scenery = references;
    }

    setUniques(references) {
        this.uniques = references;
    }

    setSceneryLoader(loader) {
        this.sceneryLoader = loader;
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

    placeModel(tile) {
        let object = {
            object: document.getElementById('tools-detail-scenery-model-list').value,
            x: tile.x,
            y: tile.y,
            rotation: document.getElementById('tools-detail-scenery-rotation').innerText
        }

        if (document.getElementById('tools-detail-scenery-tint-enabled').checked) {
            object.tint = argbToColor(document.getElementById('tools-detail-scenery-tint-color').value);
        }

        console.log(JSON.stringify(object));

        if (object.object == 'delete') {
            post('api/tools/scenery/instance/delete/' + WORKSPACES.opened, object, () => {
                WORKSPACES.reload();
            });
        } else {
            post('api/tools/scenery/instance/place/' + WORKSPACES.opened, object, () => {
                WORKSPACES.reload();
            });
        }
    }

    copyModel() {
        document.getElementById('tools-detail-scenery-model-list').value = 
            document.getElementById('tools-detail-scenery-model').innerText;
        TOOLS.pickTool('scenery', 'place');
        this.modelListChange();
    }

    tintChange() {

    }

    deleteModel() {
        post('api/tools/scenery/instance/delete/' + WORKSPACES.opened, {
            id: document.getElementById('tools-detail-scenery-id').innerText
        }, () => {
            WORKSPACES.reload();
        });
    }
}

var SCENERY_EDITOR = new SceneryEditor();