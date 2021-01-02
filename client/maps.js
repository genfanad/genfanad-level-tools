class Workspace {
    constructor(args, textures, meshLoader, modelLoader, sceneryLoader, mesh) {
        this.loadedArgs = args;
        this.terrain = mesh.terrain;

        this.textureLoader = textures;
        this.meshLoader = meshLoader;
        this.modelLoader = modelLoader;
        this.sceneryLoader = sceneryLoader;

        this.scenery_groups = {
            'trees': new THREE.Group(),
            'skills': new THREE.Group(),
            'decoration': new THREE.Group(),
            'misc': new THREE.Group(),
            'unique': new THREE.Group(),
        };
        this.scenery_references = {};
        this.unique_references = {};

        this.npcs = {};
        this.items = {};
    }
}

var uniforms = {
    u_time: { type: "f", value: 1.0 }
};

class TextureManager {
    constructor(root) {
        this.loader = new THREE.TextureLoader();
        this.cache = {};
        this.root = root || '/static/textures/';
    }

    get(name) {
        return this.getUri(this.root + name);
    }

    getUri(name) {
        if (this.cache[name]) {
            return this.cache[name];
        } else {
            let tex = this.loader.load(name);
            this.cache[name] = tex;
            return tex;
        }
    }
}

function tintMesh(tint, mesh) {
    let color = tint.hasOwnProperty('r') ? 
        new THREE.Color(tint.r / 255.0, tint.g / 255.0, tint.b / 255.0) : 
        new THREE.Color(tint);

    mesh.traverse( (n) => {
        if (n.isMesh) {
            n.material.color = color;
        }
    });
}

function createSceneryMesh(key, scenery, terrain, mesh, definition) {
    let globalMesh = new THREE.Group();
    globalMesh.name = key;

    let rotationMesh = new THREE.Group();
    rotationMesh.add(mesh);
    globalMesh.add(rotationMesh);

    if(typeof(scenery?.rotation) == 'number') {
        let offset = definition.dimensions == '2x2' ? 1.0 : 0.5;
        rotationMesh.translateX(offset);
        rotationMesh.translateZ(offset);
        rotationMesh.rotateY(THREE.Math.degToRad(N(scenery.rotation)));
        rotationMesh.translateZ(-offset);
        rotationMesh.translateX(-offset);
    } else if (scenery ?. rotation ?. x) {
        rotationMesh.rotation.set(
            THREE.Math.degToRad(scenery ?. rotation ?. x || 0.0),
            THREE.Math.degToRad(scenery ?. rotation ?. y || 0.0),
            THREE.Math.degToRad(scenery ?. rotation ?. z || 0.0),
        )
    }

    if (scenery.tint) {
        tintMesh(scenery.tint, mesh);
    }

    let height = terrain.heightAt(scenery.x, scenery.y);
    globalMesh.position.set(
        scenery.x,
        height || 0.0,
        scenery.y
    )

    return globalMesh;
}

class MapLoader {
    constructor() {

    }

    load(name, callback) {
        let pending = [];
        let map = {};
        pending.push(get(`/workspaces/${name}/metadata.json`, (m) => { map.metadata = m; }));
        pending.push(get(`/api/workspaces/read/${name}/models`, (m) => {map.models = m;}));
        pending.push(get(`/api/workspaces/read/${name}/model-textures`, (m) => {map.model_textures = m;}));
        pending.push(get(`/workspaces/${name}/buildings/roofs/definitions.json`, (m) => {map.roofs = m;}));
        pending.push(get(`/api/workspaces/read/${name}/walls`, (m) => {map.walls = m;}));
        pending.push(get(`/api/workspaces/read/${name}/floors`, (m) => {map.floors = m;}));
        pending.push(get(`/workspaces/${name}/mesh.json`, (m) => { map.mesh = m; }));
        pending.push(get(`/workspaces/${name}/objects.json`, (m) => { map.objects = m; }));
        pending.push(get(`/workspaces/${name}/unique.json`, (m) => { map.unique = m; }));
        pending.push(get(`/workspaces/${name}/npcs.json`, (m) => { map.npcs = m; }));
        pending.push(get(`/workspaces/${name}/items.json`, (m) => { map.items = m; }));
        //pending.push(get(`/workspaces/${name}/buildings/floors/definitions.json`, (m) => {map.floors = m;}));
        Promise.allSettled(pending).then( () => {
            if (!map.models) map.models = {};
            if (!map.model_textures) map.model_textures = {};
            if (!map.floors) map.floors = {};
            if (!map.roofs) map.roofs = {};
            if (!map.walls) map.walls = {};
            if (!map.mesh) map.mesh = {};
            if (!map.objects) map.objects = {};
            if (!map.unique) map.unique = {};
            if (!map.npcs) map.npcs = {};
            if (!map.items) map.items = {};

            let textures = new TextureManager(`/workspaces/${name}/`);
            let meshLoader = new MeshLoader();
            meshLoader.useTextureManager(textures);
            meshLoader.useMetadata(map.metadata);
            meshLoader.useWallDefinitions(map.walls);
            meshLoader.useRoofDefinitions(map.roofs);

            let mesh = meshLoader.createMesh({ layer: map.metadata.layer, x: map.metadata.x, y: map.metadata.y }, map.mesh);

            let modelLoader = new ModelLoader(`/workspaces/${name}/models/definitions/`);
            modelLoader.useTextureManager(textures);
            modelLoader.useShaderUniforms(uniforms);

            let sceneryLoader = new SceneryLoader();
            sceneryLoader.useModelLoader(modelLoader);
            sceneryLoader.useSceneryDefinitions(map.models);

            let workspace = new Workspace(
                map,
                textures,
                meshLoader,
                modelLoader,
                sceneryLoader,
                mesh);

            for (let k in map.objects) {
                sceneryLoader.createScenery(map.objects[k], (model, definition) => {
                    let m = createSceneryMesh(k, map.objects[k], mesh.terrain, model, definition);
                    m.original_id = { type: 'scenery', id: k };
                    workspace.scenery_groups['trees'].add(m);
                    workspace.scenery_references[k] = {
                        instance: map.objects[k],
                        definition: definition,
                        threeObject: m
                    }
                })
            }

            for (let k in map.unique) {
                let m = map.unique[k];
                
                // TODO: This is a bit hacky.
                let stripImport = m.model.substring(m.model.indexOf('/') + 1);
                m.model = stripImport.replaceAll(/-/g, '/');
                m.texture = 'models/' + m.texture;

                modelLoader.loadModel(m, (mesh) => {
                    let globalMesh = new THREE.Group();
                    globalMesh.name = k;
                    
                    globalMesh.scale.set(m.scale.x, m.scale.y, m.scale.z);
                    globalMesh.position.set(N(m.position.x) , N(m.position.y), N(m.position.z));
                    
                    let rotationMesh = new THREE.Group();
                    rotationMesh.add(mesh);
                    globalMesh.add(rotationMesh);

                    // TODO: This doesn't quite work properly.
                    if(typeof(m?.rotation) == 'number') {
                        rotationMesh.rotateY(THREE.Math.degToRad(N(m.rotation)));
                    } else if (m ?. rotation ?. x || m ?. rotation ?. y || m ?. rotation ?. z) {
                        rotationMesh.rotation.set(
                            THREE.Math.degToRad(m ?. rotation ?. x || 0.0),
                            THREE.Math.degToRad(m ?. rotation ?. y || 0.0),
                            THREE.Math.degToRad(m ?. rotation ?. z || 0.0),
                        )
                    }

                    rotationMesh.updateMatrix();
                    globalMesh.updateMatrix();
    
                    workspace.scenery_groups['unique'].add(globalMesh);
                    globalMesh.original_id = { type: 'unique', id: k };

                    workspace.unique_references[k] = {
                        instance: m,
                        threeObject: globalMesh
                    }
                });
            }

            for (let k in map.npcs) {
                //console.log(map.npcs[k]);
            }

            for (let k in map.items) {
                /*let path = map.items[k]?.item?.item;
                if (path) path = path.replaceAll('-', '/');
                let full_path = 'http://localhost:7778/static/items/' + path + '.png';*/
                /*let full_path = 'unknown.png';

                let material = new THREE.SpriteMaterial( { map: new THREE.TextureLoader().load( full_path ) } );
                let sprite = new THREE.Sprite( material );

                workspace.items[k] = {
                    instance: map.items[k],
                    threeObject: sprite
                }
                workspace.item_group.add(sprite);*/
            }

            callback(workspace);
        });
    }
}

var MAPLOADER = new MapLoader();