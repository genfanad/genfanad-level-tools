class Map {
    constructor() {

    }
}

class MapLoader {
    constructor() {

    }

    load(name, callback) {
        let map = new Map();
        get(`/workspaces/${name}/metadata.json`, (m) => {
            console.log(m);
            map.metadata = m;
        });
        get(`/api/workspaces/read/${name}/models`, (m) => {
            console.log(m);
            map.models = m;
        });
        get(`/workspaces/${name}/buildings/roofs/definitions.json`, (m) => {
            console.log(m);
            map.roofs = m;
        });
        get(`/workspaces/${name}/buildings/walls/definitions.json`, (m) => {
            console.log(m);
            map.walls = m;
        });
        get(`/workspaces/${name}/buildings/floors/definitions.json`, (m) => {
            console.log(m);
            map.floors = m;
        });
        callback(map);
    }
}

var MAPLOADER = new MapLoader();