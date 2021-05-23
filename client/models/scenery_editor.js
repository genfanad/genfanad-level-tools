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
            if (model && model != 'delete') {
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
            
                    this.cursorGroup.add(this.cursorModel);
                });
            }
        }
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

    unselect() {
        this.selected_type = null;
        this.selected_id = null;
        this.selected_cursor = null;
        for (let detailElement of document.getElementById('tools-detail').childNodes) {
            if (detailElement.id) {
                detailElement.style.display = 'none';
            }
        }
    }

    selectScenery(id, cursor) {
        this.selected_type = 'scenery';
        this.selected_id = id;
        this.selected_cursor = cursor;
        const definition = this.scenery[id].instance;

        // Show tile-specific controls, hide unique-specific controls
        document.getElementById('tools-detail-scenery-selected').style.display = 'block';
        document.getElementById('tools-detail-scenery-customize').style.display = 'block';
        document.getElementById('tools-detail-scenery-unique').style.display = 'none';
        document.getElementById('tools-detail-scenery-delete').style.display = 'block';

        document.getElementById('tools-detail-scenery-id').innerText = id;
        document.getElementById('tools-detail-scenery-model').innerText = definition.object;
        document.getElementById('tools-detail-scenery-rotation').innerText = definition.rotation || '0';

        if (definition.tint) {
            document.getElementById('tools-detail-scenery-tint-enabled').checked = true;
            document.getElementById('tools-detail-scenery-tint-color').value = colorToRGB(definition.tint);
        } else {
            document.getElementById('tools-detail-scenery-tint-enabled').checked = false;
        }
    }

    selectUniqueScenery(id, cursor) {
        if (this.selected_type === 'unique' && this.selected_id === id) return;

        this.selected_type = 'unique';
        this.selected_id = id;
        this.selected_cursor = cursor;

        // Show unique-specific controls, hide tile-specific controls
        document.getElementById('tools-detail-scenery-selected').style.display = 'block';
        document.getElementById('tools-detail-scenery-customize').style.display = 'none';
        document.getElementById('tools-detail-scenery-unique').style.display = 'block';
        document.getElementById('tools-detail-scenery-delete').style.display = 'block';

        document.getElementById('tools-detail-scenery-id').innerText = id;

        this.resetUnique();
    }

    resetUnique() {
        let instance = this.uniques[this.selected_id]?.instance;
        document.getElementById('tools-detail-scenery-unique-position-x').value = instance?.position?.x || 0;
        document.getElementById('tools-detail-scenery-unique-position-y').value = instance?.position?.y || 0;
        document.getElementById('tools-detail-scenery-unique-position-z').value = instance?.position?.z || 0;

        document.getElementById('tools-detail-scenery-unique-scale-x').value = instance?.scale?.x || 1.0;
        document.getElementById('tools-detail-scenery-unique-scale-y').value = instance?.scale?.y || 1.0;
        document.getElementById('tools-detail-scenery-unique-scale-z').value = instance?.scale?.z || 1.0;

        document.getElementById('tools-detail-scenery-unique-rotate-x').value = instance?.rotation?.x || 0;
        document.getElementById('tools-detail-scenery-unique-rotate-y').value = instance?.rotation?.y || 0;
        document.getElementById('tools-detail-scenery-unique-rotate-z').value = instance?.rotation?.z || 0;

        this.updateUnique();
    }

    updateUnique() {
        let threeObject = this.uniques[this.selected_id]?.threeObject;
        if (!threeObject) return;

        threeObject.position.x = document.getElementById('tools-detail-scenery-unique-position-x').value || 0.0;
        threeObject.position.y = document.getElementById('tools-detail-scenery-unique-position-y').value || 0.0;
        threeObject.position.z = document.getElementById('tools-detail-scenery-unique-position-z').value || 0.0;

        threeObject.scale.x = document.getElementById('tools-detail-scenery-unique-scale-x').value || 1.0;
        threeObject.scale.y = document.getElementById('tools-detail-scenery-unique-scale-y').value || 1.0;
        threeObject.scale.z = document.getElementById('tools-detail-scenery-unique-scale-z').value || 1.0;

        let rotationMesh = threeObject.children[0];
        rotationMesh.rotation.x = 
            THREE.Math.degToRad(
                document.getElementById('tools-detail-scenery-unique-rotate-x').value || 0.0
            );
        rotationMesh.rotation.y = 
            THREE.Math.degToRad(
                document.getElementById('tools-detail-scenery-unique-rotate-y').value || 0.0
            );
        rotationMesh.rotation.z = 
            THREE.Math.degToRad(
                document.getElementById('tools-detail-scenery-unique-rotate-z').value || 0.0
            );

        threeObject.updateMatrix();
    }

    saveUnique() {
        let instance = this.uniques[this.selected_id]?.instance;
        let changes = {};
        compareAndSet(changes, ['position','x'], document.getElementById('tools-detail-scenery-unique-position-x').value, instance?.position?.x || 0.0);
        compareAndSet(changes, ['position','y'], document.getElementById('tools-detail-scenery-unique-position-y').value, instance?.position?.y || 0.0);
        compareAndSet(changes, ['position','z'], document.getElementById('tools-detail-scenery-unique-position-z').value, instance?.position?.z || 0.0);

        compareAndSet(changes, ['scale','x'], document.getElementById('tools-detail-scenery-unique-scale-x').value, instance?.scale?.x || 1.0);
        compareAndSet(changes, ['scale','y'], document.getElementById('tools-detail-scenery-unique-scale-y').value, instance?.scale?.y || 1.0);
        compareAndSet(changes, ['scale','z'], document.getElementById('tools-detail-scenery-unique-scale-z').value, instance?.scale?.z || 1.0);

        compareAndSet(changes, ['rotation','x'], document.getElementById('tools-detail-scenery-unique-rotate-x').value, instance?.rotation?.x || 0.0);
        compareAndSet(changes, ['rotation','y'], document.getElementById('tools-detail-scenery-unique-rotate-y').value, instance?.rotation?.y || 0.0);
        compareAndSet(changes, ['rotation','z'], document.getElementById('tools-detail-scenery-unique-rotate-z').value, instance?.rotation?.z || 0.0);

        post('api/tools/scenery/unique/modify/' + WORKSPACES.opened, {
            id: this.selected_id,
            changes: changes
        }, () => {
            WORKSPACES.reloadUniques();
        });
    }

    placeUnique(tile) {
        let object = {
            object: document.getElementById('tools-detail-scenery-model-list').value,
            x: tile.x,
            elevation: tile.elevation,
            z: tile.y,
        }
        if (object.object && object.object != 'delete') {
            if (MODEL_VISUAL) MODEL_VISUAL.updateRecent(object.object);
            post('api/tools/scenery/unique/place/' + WORKSPACES.opened, object, () => {
                WORKSPACES.reloadUniques();
            });
        }
    }

    placeModel(tile) {
        let object = {
            object: document.getElementById('tools-detail-scenery-model-list').value,
            x: tile.x,
            y: tile.y,
            rotation: Number(document.getElementById('tools-detail-scenery-rotation').innerText)
        }

        if (document.getElementById('tools-detail-scenery-tint-enabled').checked) {
            object.tint = argbToColor(document.getElementById('tools-detail-scenery-tint-color').value);
        }

        if (object.object == 'delete') {
            post('api/tools/scenery/instance/delete/' + WORKSPACES.opened, object, () => {
                this.removeObject(object.x + ',' + object.y);
            });
        } else {
            if (MODEL_VISUAL) MODEL_VISUAL.updateRecent(object.object);
            post('api/tools/scenery/instance/place/' + WORKSPACES.opened, object, () => {
                this.addObject(object);
            });
        }
    }

    copyModel() {
        document.getElementById('tools-detail-scenery-model-list').value = 
            document.getElementById('tools-detail-scenery-model').innerText;
        this.modelListChange();
    }

    tintChange() {

    }

    modelSaveObject() {
        if (this.selected_type === 'scenery') {
            post('api/tools/scenery/instance/modify/' + WORKSPACES.opened, {
                id: document.getElementById('tools-detail-scenery-id').innerText,
                object: document.getElementById('tools-detail-scenery-model-list').value,
            }, () => {
                WORKSPACES.reloadObjects();
            });
        }
    }

    modelSaveRotation() {
        if (this.selected_type === 'scenery') {
            let request = {
                id: document.getElementById('tools-detail-scenery-id').innerText,
                rotation: Number(document.getElementById('tools-detail-scenery-rotation').innerText)
            }
            post('api/tools/scenery/instance/modify/' + WORKSPACES.opened, request, () => {
                this.editObjectRotation(request);
            });
        }
    }

    modelSaveTint() {
        if (this.selected_type === 'scenery') {

            let request = {
                id: document.getElementById('tools-detail-scenery-id').innerText,
            }

            if (document.getElementById('tools-detail-scenery-tint-enabled').checked) {
                request.tint = argbToColor(document.getElementById('tools-detail-scenery-tint-color').value);
            } else {
                request.remove_tint = true;
            }

            post('api/tools/scenery/instance/modify/' + WORKSPACES.opened, request, () => {
                this.editObjectTint(request);
            });
        }
    }

    editDefinition() {
        MODEL_EDITOR.openModelEditor();
        MODEL_EDITOR.selectModel(document.getElementById('tools-detail-scenery-model').innerText);
    }

    centerCamera() {
        if (!this.selected_cursor.selectedThreeObject) return;
        let box = new THREE.Box3().setFromObject(this.selected_cursor.selectedThreeObject);
        SCENE.centerCameraOn(box.getCenter());
    }

    deleteModel() {
        if (this.selected_type === 'scenery') {
            post('api/tools/scenery/instance/delete/' + WORKSPACES.opened, {
                id: document.getElementById('tools-detail-scenery-id').innerText
            }, () => {
                this.removeObject(document.getElementById('tools-detail-scenery-id').innerText);
            });
        } else if (this.selected_type === 'unique') {
            post('api/tools/scenery/unique/delete/' + WORKSPACES.opened, {
                id: document.getElementById('tools-detail-scenery-id').innerText
            }, () => {
                this.removeUnique(document.getElementById('tools-detail-scenery-id').innerText);
            });
        }
    }

    addObject(object){
        let object_id = object.x + ',' + object.y;
            
        WORKSPACES.current_map.sceneryLoader.createScenery(object, (model, definition) => {
            let m = createSceneryMesh(object_id, object, WORKSPACES.current_map.terrain, model, definition);
            m.original_id = { type: 'scenery', id: object_id };
            WORKSPACES.current_map.scenery_groups['trees'].add(m);
            WORKSPACES.current_map.scenery_references[object_id] = {
                instance: object,
                definition: definition,
                threeObject: m
            }
        })
    }

    editObjectTint(object){
        let group = WORKSPACES.current_map.scenery_groups['trees'];
        let targetObject = group.getObjectByName(object.id)
        let color = object.tint ? new THREE.Color(object.tint.r / 255.0, object.tint.g / 255.0, object.tint.b / 255.0) : THREE.Color();
        
        targetObject.traverse( (n) => {
            if (n.isMesh){
                n.material.color = color;
            }
        })
    }

    editObjectRotation(object){
        let group = WORKSPACES.current_map.scenery_groups['trees'];
        let globalMesh = group.getObjectByName(object.id)
        let rotationMesh = globalMesh.children[0]
        let offset = WORKSPACES.current_map.scenery_references[object.id].definition.offset

        if (typeof(object.rotation) == 'number'){
            rotationMesh.translateX(offset.x);
            rotationMesh.translateZ(offset.z);
            rotationMesh.rotation.set(0, 0, 0)
            rotationMesh.rotateY(THREE.Math.degToRad(object.rotation));
            rotationMesh.translateZ(-offset.z);
            rotationMesh.translateX(-offset.x);
        }
    }

    removeUnique(objectName){
        let group = WORKSPACES.current_map.scenery_groups['unique'];
        let uniqueToRemove = group.getObjectByName(objectName)

        if (uniqueToRemove){
            group.remove(uniqueToRemove);
            delete WORKSPACES.current_map.unique_references[objectName];
        }
    }

    removeObject(objectName){
        let group = WORKSPACES.current_map.scenery_groups['trees'];
        let objectToRemove = group.getObjectByName(objectName);

        if (objectToRemove){
            group.remove(objectToRemove);
            delete WORKSPACES.current_map.scenery_references[objectName];
        }
    }
}

const SCENERY_EDITOR = new SceneryEditor();