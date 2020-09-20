class Workspace {
    constructor(args, mesh) {
        this.loadedArgs = args;
        this.terrain = mesh.terrain;
    }
}

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

            let workspace = new Workspace(map, mesh);
            callback(workspace);
        });
    }
}

var MAPLOADER = new MapLoader();