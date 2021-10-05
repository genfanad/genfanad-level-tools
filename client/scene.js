class Scene {
    constructor() {

    }

    init() {
        const dom = document.getElementById('center');

        const w = Math.floor(dom.clientWidth);
        const h = Math.floor(dom.clientHeight);

        this.w = w;
        this.h = h;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera( 75, w / h, 0.1, 1000 );

        const directionalLight = new THREE.DirectionalLight( 0xffffff, 0.5 );
        directionalLight.position.set( 10, 10, 0 );
        scene.add( directionalLight );
        scene.add(new THREE.AmbientLight( 0x888888, 0.5 ));

        const renderer = new THREE.WebGLRenderer();
        this.renderer = renderer;

        renderer.setSize( w, h );
        dom.appendChild( renderer.domElement );

        cameraLookAt(camera, 132,77,132, 0,1,0, 64,32,64);

        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.controls = this.createControls(camera, renderer, 64, 20, 64);

        addSprite(scene, 'n.png', 64, 20, -20);
        addSprite(scene, 's.png', 64, 20, 148);
        addSprite(scene, 'w.png', -20, 20, 64);
        addSprite(scene, 'e.png', 148, 20, 64);

        SELECTION.init(renderer.domElement);

        const obs = new ResizeObserver(() => {
            //console.log(dom.clientWidth + " " + dom.clientHeight);
            renderer.setSize(dom.clientWidth, dom.clientHeight);
        });
        obs.observe(dom);

        this.visibleLayers = {};
        this.features = {}; // key: { visible: true, instance: <> }

        this.updateLayerVisibility();
        $('#layers-list').tree({
            onCheck: (e) => {
                this.updateLayerVisibility();
            }
        });

        animate();
    }

    createControls(camera, renderer, x, y, z) {
        const controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.target.set(x, y, z);
        controls.update();
        return controls;
    }

    updateLayerVisibility() {
        let layers = $('#layers-list').tree('getChecked');
        this.visibleLayers = {};
        for (let i of layers) {
            this.visibleLayers[i.id] = true;
        }

        for (let f in this.features) {
            if (this.features[f].visible && !this.visibleLayers[f]) {
                this.scene.remove(this.features[f].instance);
                this.features[f].visible = false;
            }
            if (!this.features[f].visible && this.visibleLayers[f]) {
                this.scene.add(this.features[f].instance);
                this.features[f].visible = true;
            }
        }
    }
    
    setTerrain(terrain) {
        // mesh, wireframe, walls, roofs
        for (let i of ['layer-terrain', 'layer-grid', 'layer-walls', 'layer-roofs', 'layer-collision']) {
            if (this.features[i] && this.features[i].visible) this.scene.remove(this.features[i].instance);
        }

        this.features['layer-terrain'] = { visible: false, instance: terrain.mesh };
        this.features['layer-grid'] = { visible: false, instance: terrain.wireframe };
        this.features['layer-collision'] = { visible: false, instance: terrain.collision };
        this.features['layer-walls'] = { visible: false, instance: terrain.walls };
        this.features['layer-roofs'] = { visible: false, instance: terrain.roofs };

        this.updateLayerVisibility();

        this.loaded_terrain = terrain;
    }

    setObjects(objects) {
        for (let i of ['layer-scenery-trees', 'layer-scenery-skills', 'layer-scenery-decoration', 'layer-scenery-misc', 'layer-scenery-unique']) {
            if (this.features[i] && this.features[i].visible) this.scene.remove(this.features[i].instance);
        }

        this.features['layer-scenery-trees'] = { visible: false, instance: objects.trees };
        this.features['layer-scenery-skills'] = { visible: false, instance: objects.skills };
        this.features['layer-scenery-decoration'] = { visible: false, instance: objects.decoration };
        this.features['layer-scenery-misc'] = { visible: false, instance: objects.misc };
        this.features['layer-scenery-unique'] = { visible: false, instance: objects.unique };

        this.updateLayerVisibility();

        this.loaded_objects = objects;
    }

    setNPCs(npcs) {
        for (let i of ['layer-npc']) {
            if (this.features[i] && this.features[i].visible) this.scene.remove(this.features[i].instance);
        }

        this.features['layer-npc'] = { visible: false, instance: npcs };
        this.updateLayerVisibility();
        this.loaded_npcs = npcs;
    }

    setItemSpawns(items) {
        for (let i of ['layer-item']) {
            if (this.features[i] && this.features[i].visible) this.scene.remove(this.features[i].instance);
        }

        this.features['layer-item'] = { visible: false, instance: items };
        this.updateLayerVisibility();
        this.loaded_items = items;
    }

    getVisibleObjects() {
        let groups = [];
        for (let i of ['layer-scenery-trees', 'layer-scenery-skills', 'layer-scenery-decoration', 'layer-scenery-misc', 'layer-scenery-unique']) {
            if (this.features[i] && this.features[i].visible) groups.push(this.features[i].instance);
        }
        return groups;
    }

    getVisibleNPCs() {
        let f = this.features['layer-npc'];
        if (f && f.visible) return [f.instance];
        return [];
    }

    getVisibleItems() {
        let f = this.features['layer-item'];
        if (f && f.visible) return [f.instance];
        return [];
    }

    frame() {
        this.renderer.render( this.scene, this.camera );
    }

    /* todo: maintain camera properties */
    changeCameraProjectionMode(projectionMode) {
        const {w, h} = this;

        if (projectionMode === 'orthographic') {
            this.camera = new THREE.OrthographicCamera(w / -2, w / 2, h / 2, h / -2, 1, 1000);
        } else if (projectionMode === 'perspective') {
            this.camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 1000);
        }

        cameraLookAt(this.camera, 132,77,132, 0,1,0, 64,32,64);
        this.controls = this.createControls(this.camera, this.renderer, 64, 20, 64);
    }

    centerCameraOn(location, distance = 15) {
        cameraLookAt(this.camera,
            location.x + distance / 3.0, location.y + distance / 3.0, location.z + distance / 3.0,
            0,1,0,
            location.x, location.y, location.z
        );

        this.controls.target.set(location.x, location.y, location.z);
        this.controls.update();
    }
}

function cameraLookAt(camera, px, py, pz, ux, uy, uz, lx, ly, lz) {
    camera.position.set(px, py, pz);
    camera.up = new THREE.Vector3(ux,uy,uz);
    camera.lookAt(lx,ly,lz);
}

function createCube(color) {
    var geometry = new THREE.BoxGeometry( 1, 1, 1 );
    var material = new THREE.MeshBasicMaterial( { wireframe: true, color: color } );
    return new THREE.Mesh( geometry, material );
}

function createSphere(color) {
    var geometry = new THREE.SphereGeometry( 1, 32, 32);
    var material = new THREE.MeshBasicMaterial( { wireframe: true, color: color } );
    return new THREE.Mesh( geometry, material );
}

function createCylinder(color) {
    var geometry = new THREE.CylinderGeometry( 1, 1, 32, 32);
    var material = new THREE.MeshBasicMaterial( { wireframe: true, color: color } );
    return new THREE.Mesh( geometry, material );
}

function addSprite(scene, texture, x,y,z) {
    const map = new THREE.TextureLoader().load( texture );
    const material = new THREE.SpriteMaterial( { map: map } );

    const sprite = new THREE.Sprite( material );
    sprite.position.set(x,y,z);
    sprite.scale.set(10,10,10)
    scene.add( sprite );
}

var SCENE = new Scene();

function animate() {
    requestAnimationFrame( animate );
	SCENE.frame();
}