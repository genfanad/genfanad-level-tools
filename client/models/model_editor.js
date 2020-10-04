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
        this.selected_model = undefined;
        this.model_mesh = undefined;
        this.open = false;
        this.local_changes = {};
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
        } else if (dim == "2x2") {
            targetX = 2.0;
            targetZ = 2.0;
        } else if (dim == "2x3") {
            targetX = 2.0;
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
    }

    selectModel(model) {
        if (!model) return;
        if (model == this.selected_model) return;

        this.local_changes = {};
        this.selected_model = model;

        this.resetUI();
    }

    openModelEditor() {
        $('#model-dialog').dialog('open');
    }

    selectAndClose() {
        document.getElementById('tools-detail-scenery-model-list').value = this.selected_model;
        $('#model-dialog').dialog('close');
    }

    resetUI() {
        let m = this.models[this.selected_model];
        document.getElementById('model-dialog-controls-name').value = m.nick || m.name;
        document.getElementById('model-dialog-controls-examine').value = m.examine;

        document.getElementById('model-dialog-controls-texture').value = m.sharedTexture;
        document.getElementById('model-dialog-controls-dimensions').value = m.dimensions;
        this.setOutline(m.dimensions);

        document.getElementById('model-dialog-controls-scale-x').value = m?.scale?.x || 1.0;
        document.getElementById('model-dialog-controls-scale-y').value = m?.scale?.y || 1.0;
        document.getElementById('model-dialog-controls-scale-z').value = m?.scale?.z || 1.0;

        document.getElementById('model-dialog-controls-offset-x').value = m?.offset?.x || 0.0;
        document.getElementById('model-dialog-controls-offset-y').value = m?.offset?.y || 0.0;
        document.getElementById('model-dialog-controls-offset-z').value = m?.offset?.z || 0.0;

        this.uiChange();
    }

    uiChange() {
        let m = this.models[this.selected_model];

        this.local_changes = {};

        compareAndSet(this.local_changes, 'name', document.getElementById('model-dialog-controls-name').value, m.nick || m.name);
        compareAndSet(this.local_changes, 'examine', document.getElementById('model-dialog-controls-examine').value, m.examine);

        compareAndSet(this.local_changes, 'sharedTexture', document.getElementById('model-dialog-controls-texture').value, m.sharedTexture);
        compareAndSet(this.local_changes, 'dimensions', document.getElementById('model-dialog-controls-dimensions').value, m.dimensions);

        compareAndSet(this.local_changes, ['scale','x'], document.getElementById('model-dialog-controls-scale-x').value, m?.scale?.x || 1.0);
        compareAndSet(this.local_changes, ['scale','x'], document.getElementById('model-dialog-controls-scale-y').value, m?.scale?.y || 1.0);
        compareAndSet(this.local_changes, ['scale','z'], document.getElementById('model-dialog-controls-scale-z').value, m?.scale?.z || 1.0);

        compareAndSet(this.local_changes, ['offset','x'], document.getElementById('model-dialog-controls-offset-x').value, m?.offset?.x || 0.0);
        compareAndSet(this.local_changes, ['offset','y'], document.getElementById('model-dialog-controls-offset-y').value, m?.offset?.y || 0.0);
        compareAndSet(this.local_changes, ['offset','z'], document.getElementById('model-dialog-controls-offset-z').value, m?.offset?.z || 0.0);

        let merged = merge(m, this.local_changes);
        this.sceneryLoader.createCustomScenery(
            merged,
            (mesh, definition) => {
                this.replaceMesh(mesh, definition);
        });
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

        animate_modeleditor();

        $('#model-dialog').dialog({
            title: "Model Editor",
            modal: true,
            closed: true,
        });
    }

    frame() {
        this.renderer.render( this.scene, this.camera );
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