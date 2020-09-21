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
        };
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

function createSceneryMesh(key, scenery, terrain, mesh, definition) {
    let globalMesh = new THREE.Group();
    globalMesh.name = key;

    let rotationMesh = new THREE.Group();
    rotationMesh.add(mesh);
    globalMesh.add(rotationMesh);

    if(scenery.rotation) {
        let offset = definition.dimensions == '2x2' ? 1.0 : 0.5;
        rotationMesh.translateX(offset);
        rotationMesh.translateZ(offset);
        rotationMesh.rotateY(THREE.Math.degToRad(N(scenery.rotation)));
        rotationMesh.translateZ(-offset);
        rotationMesh.translateX(-offset);
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
        pending.push(get(`/workspaces/${name}/buildings/roofs/definitions.json`, (m) => {map.roofs = m;}));
        pending.push(get(`/workspaces/${name}/buildings/walls/definitions.json`, (m) => {map.walls = m;}));
        pending.push(get(`/workspaces/${name}/mesh.json`, (m) => { map.mesh = m; }));
        pending.push(get(`/workspaces/${name}/objects.json`, (m) => { map.objects = m; }));
        pending.push(get(`/workspaces/${name}/unique.json`, (m) => { map.unique = m; }));
        //pending.push(get(`/workspaces/${name}/buildings/floors/definitions.json`, (m) => {map.floors = m;}));
        Promise.allSettled(pending).then( () => {
            if (!map.models) map.models = {};
            if (!map.roofs) map.roofs = {};
            if (!map.walls) map.walls = {};
            if (!map.mesh) map.mesh = {};
            if (!map.objects) map.objects = {};
            if (!map.unique) map.unique = {};

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
                    workspace.scenery_groups['trees'].add(m);
                })
            }

            callback(workspace);
        });
    }
}

var MAPLOADER = new MapLoader();