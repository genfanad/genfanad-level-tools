class Models {
    constructor() {

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