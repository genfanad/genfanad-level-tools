class Terrain {
    constructor() {

    }
}

class MapLoader {
    constructor() {

    }

    load(name, callback) {
        let pending = [];
        let map = new Terrain();
        pending.push(get(`/workspaces/${name}/metadata.json`, (m) => { map.metadata = m; }));
        pending.push(get(`/api/workspaces/read/${name}/models`, (m) => {map.models = m;}));
        pending.push(get(`/workspaces/${name}/buildings/roofs/definitions.json`, (m) => {map.roofs = m;}));
        pending.push(get(`/workspaces/${name}/buildings/walls/definitions.json`, (m) => {map.walls = m;}));
        //pending.push(get(`/workspaces/${name}/buildings/floors/definitions.json`, (m) => {map.floors = m;}));
        Promise.allSettled(pending).then( () => callback(map));
    }
}

var MAPLOADER = new MapLoader();