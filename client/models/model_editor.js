// Sets a value in o iff it is not equal to defaultValue
// cas({}, ['foo'], 1, 1) -> {}
// cas({}, ['bar'], 1, 2) -> { bar: 1 }
function compareAndSet(o, path, newValue, defaultValue) {
    if (!newValue) return;
    if (!Array.isArray(path)) path = [path];

    if (newValue != defaultValue) {
        let last = path.pop();
        let cur = o;
        for (let i of path) {
            if (!cur[i]) cur[i] = {};
            cur = cur[i];
        }
        cur[last] = newValue;
    }
}

function merge(original, changelist) {
    if (!original) original = {};
    if (typeof(changelist) === 'object') {
        let copy = JSON.parse(JSON.stringify(original));
        for (let i in changelist) {
            copy[i] = merge(original[i], changelist[i]);
        }
        return copy;
    } else {
        return changelist;
    }
}

class Models {
    constructor() {
        this.selected_type = 'scenery';
        this.selected_model = undefined;
        this.model_mesh = undefined;
        this.open = false;
        this.local_changes = {};

        this.mouse_mode = 'camera';
    }

    controlCamera() {
        if (this.mouse_mode == 'camera') return;
        this.mouse_mode = 'camera';
        this.controls.enabled = true;
        this.transform_controls.detach();
        this.scene.remove(this.transform_controls);
    }

    controlScale() {
        if (this.mouse_mode == 'scale') return;
        this.mouse_mode = 'scale';
        this.controls.enabled = false;

        if (this.model_mesh) {
            this.model_mesh.matrixAutoUpdate = true;
            this.transform_controls.attach(this.model_mesh);
        } 
        this.transform_controls.setMode('scale');
        this.scene.add(this.transform_controls);
    }

    controlTranslate() {
        if (this.mouse_mode == 'translate') return;
        this.mouse_mode = 'translate';
        this.controls.enabled = false;

        if (this.model_mesh) {
            this.model_mesh.matrixAutoUpdate = true;
            this.transform_controls.attach(this.model_mesh);
        } 
        this.transform_controls.setMode('translate');
        this.scene.add(this.transform_controls);
    }

    controlRotate() {
        if (this.mouse_mode == 'rotate') return;
        this.mouse_mode = 'rotate';
        this.controls.enabled = false;

        if (this.model_mesh) {
            this.model_mesh.matrixAutoUpdate = true;
            this.transform_controls.attach(this.model_mesh);
        } 
        this.transform_controls.setMode('rotate');
        this.scene.add(this.transform_controls);
    }    

    loadWorkspace(sceneryLoader, textureLoader, models) {
        this.sceneryLoader = sceneryLoader;
        this.textureLoader = textureLoader;
        this.models = models;
    }

    setOutline(dim) {
        let targetX = 1.0;
        let targetZ = 1.0;
        if (dim == "1x1") {
            
        } else if (dim == "2x1") {
            targetX = 2.0;
        } else if (dim == "3x1") {
            targetX = 3.0;
        } else if (dim == "1x2") {
            targetZ = 2.0;
        } else if (dim == "1x3") {
            targetZ = 3.0;
        } else if (dim == "2x2") {
            targetX = 2.0;
            targetZ = 2.0;
        } else if (dim == "2x3") {
            targetX = 2.0;
            targetZ = 3.0;
        } else if (dim == "3x2") {
            targetX = 3.0;
            targetZ = 2.0;
        } else if (dim == "2x4") {
            targetX = 2.0;
            targetZ = 4.0;
        } else if (dim == "4x2") {
            targetX = 4.0;
            targetZ = 2.0;
        } else if (dim == "3x3") {
            targetX = 3.0;
            targetZ = 3.0;
        } else if (dim == "4x1") {
            targetX = 4.0;
        } else if (dim == "1x4") {
            targetZ = 4.0;
        } else if (dim == "5x1") {
            targetX = 5.0;
        } else if (dim == "1x5") {
            targetZ = 5.0;
        } else if (dim == "3x4") {
            targetX = 3.0;
            targetZ = 4.0;
        } else if (dim == "4x3") {
            targetX = 4.0;
            targetZ = 3.0;
        }
    
        this.outline.scale.set(targetX, 1.6, targetZ);
        this.outline.position.set(targetX / 2.0,0.8,targetZ / 2.0);
    }

    replaceMesh(mesh,definition) {
        this.raw_mesh = mesh.clone();

        if (this.model_mesh) {
            this.scene.remove(this.model_mesh);
        }
        this.scene.add(mesh);
        this.model_mesh = mesh;

        if (this.mouse_mode != 'camera') {
            this.transform_controls.attach(mesh);
        }
    }

    selectModel(model) {
        if (!model) return;
        if (model == this.selected_model) return;

        this.local_changes = {};
        this.selected_type = 'model';
        this.selected_model = model;

        this.textureSelect();
        this.resetUI();
    }
    
    loadAsset(id) {
        if (!id) return;
        if (this.selected_model == id) return;
        
        let pack = this.loaded_asset_pack;
        
        this.selected_type = 'asset';
        this.selected_model = id;
        this.asset_definition = {
            model: 'OBJ/' + id,
            texture: Object.keys(this.asset_packs[pack].textures)[0]
        }
        
        this.needs_resize = true;
        
        this.textureSelect();
        this.resetUI();
    }

    textureSelect(){
        let select = document.getElementById("model-dialog-controls-texture");
        select.options.length = 0;

        this.selected_type === 'asset'
            ? createList(select, this.asset_packs[this.loaded_asset_pack].textures, true)
            : createList(select, WORKSPACES.current_map.loadedArgs.model_textures, true);
    }

    textureChange(){
        let selectVal = document.getElementById("model-dialog-controls-texture").value;
        
        let original = this.getCurrentModel();

        this.selected_type === 'asset'
            ? this.local_changes.texture = selectVal
            : this.local_changes.texture = "models/shared-textures/" + selectVal;

        let merged = merge(original, this.local_changes);
        
        this.reloadModel(merged);
    }

    // Modification buttons
    scaleAbsolute(refresh = true) {
        let value = document.getElementById('model-dialog-controls-scale').value;
        document.getElementById('model-dialog-controls-scale-x').value = value;
        document.getElementById('model-dialog-controls-scale-y').value = value;
        document.getElementById('model-dialog-controls-scale-z').value = value;
        if (refresh) this.uiChange();
    }

    scalePercent(refresh = true) {
        let value = document.getElementById('model-dialog-controls-scale').value;
        document.getElementById('model-dialog-controls-scale-x').value = Number(document.getElementById('model-dialog-controls-scale-x').value) * value;
        document.getElementById('model-dialog-controls-scale-y').value = Number(document.getElementById('model-dialog-controls-scale-x').value) * value;
        document.getElementById('model-dialog-controls-scale-z').value = Number(document.getElementById('model-dialog-controls-scale-x').value) * value;
        if (refresh) this.uiChange();
    }

    scaleFit(refresh = true) {
        // TODO: Fit into target dimensions, not just one tile
        
        let w = this.original_bounds.max.x - this.original_bounds.min.x;
        let h = this.original_bounds.max.y - this.original_bounds.min.y;
        let d = this.original_bounds.max.z - this.original_bounds.min.z;

        let scale = 1.0 / Math.max(w,h,d);
        document.getElementById('model-dialog-controls-scale-x').value = scale;
        document.getElementById('model-dialog-controls-scale-y').value = scale;
        document.getElementById('model-dialog-controls-scale-z').value = scale;

        if (refresh) this.uiChange();
    }

    repositionCenter(refresh = true) {
        let w = this.original_bounds.max.x - this.original_bounds.min.x;
        let h = this.original_bounds.max.y - this.original_bounds.min.y;
        let d = this.original_bounds.max.z - this.original_bounds.min.z;

        let cx = this.original_bounds.min.x + w / 2.0;
        let cz = this.original_bounds.min.z + d / 2.0;
        let tx = 0.5, ty = 0, tz = 0.5;

        document.getElementById('model-dialog-controls-offset-x').value = -Number(cx) + tx;
        document.getElementById('model-dialog-controls-offset-y').value = 0.0;
        document.getElementById('model-dialog-controls-offset-z').value = -Number(cz) + tz;

        if (refresh) this.uiChange();
    }

    repositionOrigin(refresh = true) {
        document.getElementById('model-dialog-controls-offset-x').value = 0.0;
        document.getElementById('model-dialog-controls-offset-y').value = 0.0;
        document.getElementById('model-dialog-controls-offset-z').value = 0.0;

        if (refresh) this.uiChange();
    }

    repositionX(refresh = true) {
        let w = this.original_bounds.max.x - this.original_bounds.min.x;
        let h = this.original_bounds.max.y - this.original_bounds.min.y;
        let d = this.original_bounds.max.z - this.original_bounds.min.z;

        let cx = this.original_bounds.min.x + w / 2.0;
        let cz = this.original_bounds.min.z + d / 2.0;
        let tx = 0.0, ty = 0, tz = 0.5;

        document.getElementById('model-dialog-controls-offset-x').value = -Number(cx) + tx;
        document.getElementById('model-dialog-controls-offset-y').value = -this.original_bounds.min.y;
        document.getElementById('model-dialog-controls-offset-z').value = -Number(cz) + tz;

        if (refresh) this.uiChange();
    }

    repositionZ(refresh = true) {
        let w = this.original_bounds.max.x - this.original_bounds.min.x;
        let h = this.original_bounds.max.y - this.original_bounds.min.y;
        let d = this.original_bounds.max.z - this.original_bounds.min.z;

        let cx = this.original_bounds.min.x + w / 2.0;
        let cz = this.original_bounds.min.z + d / 2.0;
        let tx = 0.5, ty = 0, tz = 0.0;

        document.getElementById('model-dialog-controls-offset-x').value = -Number(cx) + tx;
        document.getElementById('model-dialog-controls-offset-y').value = -this.original_bounds.min.y;
        document.getElementById('model-dialog-controls-offset-z').value = -Number(cz) + tz;

        if (refresh) this.uiChange();
    }

    openModelEditor(onCloseCallback) {
        this.opened = true;
        this.onCloseCallback = onCloseCallback;
        $('#model-dialog').dialog('open');
    }

    closeWithoutSelecting() {
        this.opened = false;
        $('#model-dialog').dialog('close');
    }

    selectAndClose() {
        this.opened = false;
        document.getElementById('tools-detail-scenery-model-list').value = this.selected_model;
        $('#model-dialog').dialog('close');
        SCENERY_EDITOR.modelListChange();
    }

    getCurrentModel() {
        if (this.selected_type == 'model') {
            return this.models[this.selected_model];
        } else if (this.selected_type == 'asset') {
            return this.asset_definition;
        }
    }

    reparent(category) {
        this.uiChange();
        let id = this.selected_model;
        let new_id = document.getElementById('model-dialog-controls-new-id').value || "";
        if (new_id.trim().length == 0) new_id = undefined;
        let changes = this.local_changes;

        document.getElementById('model-dialog-controls-reparent').innerText = 'reparenting...';
        post('api/tools/scenery/definition/reparent/' + WORKSPACES.opened, {
            id: id,
            category: category,
            changes: changes,
            new_id: new_id
        }, (r) => {
            document.getElementById('model-dialog-controls-reparent').innerText = 'done ' + r;
        });
    }

    saveChanges() {
        let changes = this.local_changes;
        if (this.selected_type == 'model') {
            let id = this.selected_model;
            console.log("Changes for " + id + ": " + JSON.stringify(changes));

            post('api/tools/scenery/definition/modify/' + WORKSPACES.opened, {
                id: id,
                changes: changes
            }, () => {
                console.log("Modify complete.")
                WORKSPACES.reload();
            });

        } else {
            let id = prompt("Please enter the id for the model (such as 'environment-rocks-rock3')");
            if (!id) return;

            let model = this.asset_definition.model;
            let texture = this.asset_definition.texture;
            let pack = this.loaded_asset_pack

            post('api/tools/scenery/definition/create/' + WORKSPACES.opened, {
                id: id,
                model: model,
                sharedTexture: texture,
                changes: changes,
                pack: pack,
            }, () => {
                console.log("Asset import complete.")
                WORKSPACES.reload();
            });

            console.log("Creating model from asset " + id + ": " + JSON.stringify(changes));
        }
    }

    resetUI() {
        let m = this.getCurrentModel();
        document.getElementById('model-dialog-controls-name').value = m.nick || m.name;
        document.getElementById('model-dialog-controls-examine').value = m.examine;

        document.getElementById('model-dialog-controls-texture').value = m.sharedTexture || m.texture;
        document.getElementById('model-dialog-controls-dimensions').value = m.dimensions || '1x1';

        document.getElementById('model-dialog-controls-scale-x').value = m?.scale?.x || 1.0;
        document.getElementById('model-dialog-controls-scale-y').value = m?.scale?.y || 1.0;
        document.getElementById('model-dialog-controls-scale-z').value = m?.scale?.z || 1.0;

        document.getElementById('model-dialog-controls-offset-x').value = m?.offset?.x || 0.0;
        document.getElementById('model-dialog-controls-offset-y').value = m?.offset?.y || 0.0;
        document.getElementById('model-dialog-controls-offset-z').value = m?.offset?.z || 0.0;

        this.uiChange();
    }

    uiChange() {
        let m = this.getCurrentModel();

        this.local_changes = {};

        compareAndSet(this.local_changes, 'name', document.getElementById('model-dialog-controls-name').value, m.nick || m.name);
        compareAndSet(this.local_changes, 'examine', document.getElementById('model-dialog-controls-examine').value, m.examine);

        compareAndSet(this.local_changes, 'sharedTexture', document.getElementById('model-dialog-controls-texture').value, m.sharedTexture);
        compareAndSet(this.local_changes, 'dimensions', document.getElementById('model-dialog-controls-dimensions').value, m.dimensions);

        compareAndSet(this.local_changes, ['scale','x'], document.getElementById('model-dialog-controls-scale-x').value, m?.scale?.x || 1.0);
        compareAndSet(this.local_changes, ['scale','y'], document.getElementById('model-dialog-controls-scale-y').value, m?.scale?.y || 1.0);
        compareAndSet(this.local_changes, ['scale','z'], document.getElementById('model-dialog-controls-scale-z').value, m?.scale?.z || 1.0);

        compareAndSet(this.local_changes, ['offset','x'], document.getElementById('model-dialog-controls-offset-x').value, m?.offset?.x || 0.0);
        compareAndSet(this.local_changes, ['offset','y'], document.getElementById('model-dialog-controls-offset-y').value, m?.offset?.y || 0.0);
        compareAndSet(this.local_changes, ['offset','z'], document.getElementById('model-dialog-controls-offset-z').value, m?.offset?.z || 0.0);

        let merged = merge(m, this.local_changes);

        this.setOutline(merged.dimensions);

        this.reloadModel(merged);
    }

    reloadModel(merged) {
        let loader = this.selected_type == 'asset' ?
            this.asset_scenery_loader :
            this.sceneryLoader;

        loader.createCustomScenery(
            merged,
            (mesh, definition, original_mesh) => {
                let box = new THREE.Box3().setFromObject(original_mesh);
                this.original_bounds = box;

                if (this.needs_resize) {
                    delete this.needs_resize;
                    this.scaleFit(false);
                    this.repositionCenter(false);
                    this.uiChange();
                } else {
                    this.replaceMesh(mesh, definition);
                }
        });
    }

    loadAssetPack() {
        let pack = document.getElementById('model-dialog-asset-pack-list').value;
        if (this.loaded_asset_pack == pack) return;
        this.loaded_asset_pack = pack;

        let d = document.getElementById('model-dialog-asset-list-container');
        d.innerHTML = '';

        let tree = groupHeirarchy(this.asset_packs[pack].objs, 
            (k,v) => { return { type: 'model', id: k }},
            '_');

        tree.id = 'model-dialog-asset-list';

        $(tree).tree({
            onBeforeSelect: (n) => {
                this.loadAsset(n.id);
            },
            filter: (q, node) => {
                if (!q) return true;
                if (!node.id) return false;
                return node.id.toLowerCase().indexOf(q.toLowerCase()) >= 0;
            }
        });
        $(tree).tree('doFilter', $('#model-dialog-asset-filter').value);
        d.appendChild(tree);

        let textures = new TextureManager(`/assets/` + pack + '/');
        let modelLoader = new ModelLoader(`/assets/` + pack + '/');
        modelLoader.useTextureManager(textures);
        modelLoader.useShaderUniforms(uniforms);
        let sceneryLoader = new SceneryLoader();
        sceneryLoader.useModelLoader(modelLoader);
        this.asset_scenery_loader = sceneryLoader;
    }

    init() {
        let dom = document.getElementById('model-dialog-preview');
        let w = Math.floor(dom.clientWidth);
        let h = Math.floor(dom.clientHeight);

        let scene = new THREE.Scene();
        let camera = new THREE.PerspectiveCamera( 75, w / h, 0.1, 1000 );

        let directionalLight = new THREE.DirectionalLight( 0xffffff, 1.0 );
        scene.add( directionalLight );
        scene.add(new THREE.AmbientLight( 0x888888 ));

        let floor = createFloor(6,6);
        floor.rotateX(THREE.Math.degToRad(90));
        scene.add(floor);

        let bounds = createCube(0xff0000);
        bounds.position.set(0.5,0.5,0.5);
        scene.add(bounds);
        this.outline = bounds;

        var axesHelper = new THREE.AxesHelper( 3 );
        scene.add( axesHelper );

        let renderer = new THREE.WebGLRenderer();
        renderer.setSize( w, h );
        dom.appendChild( renderer.domElement );
        
        cameraLookAt(camera, 2,2,2, 0,1,0, 0.5,0,0.5);

        var controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.target.set(0.5,0,0.5);
        controls.update();
        
        let obs = new ResizeObserver(() => {
            renderer.setSize(dom.clientWidth, dom.clientHeight);
        });
        obs.observe(dom);

        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.controls = controls;

        this.transform_controls = new THREE.TransformControls(camera, renderer.domElement);

        animate_modeleditor();

        get(`/api/assets/list`, (m) => { 
            this.asset_packs = m;
            createList(document.getElementById('model-dialog-asset-pack-list'), m, true);
        });

        $('#model-dialog').dialog({
            title: "Model Editor",
            modal: true,
            closed: true,
            onClose: () => {
                MODEL_EDITOR.opened = false;
                if (this.onCloseCallback) {
                    this.onCloseCallback();
                }
            }
        });
    }

    resetCamera() {
        cameraLookAt(this.camera, 2,2,2, 0,1,0, 0.5,0,0.5);
        this.controls.target.set(0.5,0,0.5);
        this.controls.update();
    }

    frame() {
        this.renderer.render( this.scene, this.camera );
    }

    keyPress(event) {
        if (!event.key) return;
        let letter = event.key.toUpperCase();
        if (event.shiftKey) letter = 'shift-' + letter;
        if (event.altKey) letter = 'alt-' + letter;
        if (event.ctrlKey) letter = 'ctrl-' + letter;

        console.log("Model editor " + letter);

        if (letter == 'shift-ENTER') {
            this.selectAndClose();
            event.preventDefault();
        }
    }

    keyDown(event) {
        if (event.key == 'Escape') {
            this.closeWithoutSelecting();
        }
    }
}

function createFloor(width, segments) {
    let geo = new THREE.PlaneGeometry(width, width, segments, segments);
    let materialA = new THREE.MeshBasicMaterial( { side: THREE.DoubleSide, color: 0x333333 });
    let materialB = new THREE.MeshBasicMaterial( { side: THREE.DoubleSide, color: 0x555555 });
    let materials = [materialA, materialB];
    for (let x = 0; x < segments; x++) {
        for (let y = 0; y < segments; y++) {
            let i = x * segments + y;
            let j = 2 * i;
            geo.faces[j].materialIndex = geo.faces[j+1].materialIndex = (x + y) % 2;
        }
    }
    return new THREE.Mesh(geo, materials);
}

var MODEL_EDITOR = new Models();

function animate_modeleditor() {
    requestAnimationFrame( animate_modeleditor );
	MODEL_EDITOR.frame();
}