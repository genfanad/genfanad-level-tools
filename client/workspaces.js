function option(value, text) {
    let opt = document.createElement('option');
    opt.value = value;
    opt.innerText = text;
    return opt;
}

function createList(dom, defs) {
    dom.innerHTML = '';
    dom.appendChild(option('delete',"(Delete)"));
    for (let i in defs) {
        dom.appendChild(option(i,i));
    }
}

function initUI(defs) {
    createList(
        document.getElementById('tools-detail-buildings-floor-list'),
        defs.floors
    );
    createList(
        document.getElementById('tools-detail-buildings-wall-list'),
        defs.walls
    );
    createList(
        document.getElementById('tools-detail-buildings-roof-list'),
        defs.roofs
    );
    createList(
        document.getElementById('tools-detail-scenery-model-list'),
        defs.models
    );
}

class Workspaces {
    constructor() {
        this.opened = undefined;
    }

    closeWorkspace() {
        if (!this.opened) return;
        this.opened = undefined;
    }

    openWorkspace(name) {
        if (this.opened == name) return;
        this._openWorkspace(name, (map) => {
            initUI(map.loadedArgs);
        });
    }

    _openWorkspace(name, oncomplete) {
        this.closeWorkspace();
        MAPLOADER.load(name, (map) => {
            this.current_map = map;
            SCENE.setTerrain(map.terrain);
            SCENE.setObjects(map.scenery_groups);
            SELECTION.setTerrain(map.terrain);
            if (oncomplete) oncomplete(map);
        });
        this.opened = name;
        document.getElementById('currently-open').innerText = name;
    }

    systemOpen() {
        if (!this.opened) return;
        get('api/workspaces/open/' + this.opened);
    }

    create() {
        console.log('TODO: new');
    }

    open() {
        console.log('TODO: open');
    }

    reload() {
        this._openWorkspace(this.opened);
    }

    save() {
        console.log('TODO: save');
    }

    init() {
        get('/api/workspaces/list', (data) => {
            let list = document.getElementById('file-workspaces');
            list.innerHTML = "";
            for (let workspace of data) {
                let e = document.createElement('li');
                e.innerText = workspace;
                list.appendChild(e);
            }
            $('#file-workspaces').datalist({
                onSelect: (n,r) => this.openWorkspace(r.value)
            });
        });
    }
}

var WORKSPACES = new Workspaces();