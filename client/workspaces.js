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

function createFileDOM(path, info) {
    let dom = document.createElement('ul');
    for (let e in info) {
        if (e == 'type') continue;
        let li = document.createElement('li');
        let s = document.createElement('span');
        s.innerText = e;
        li.appendChild(s);
        if (info[e].type == 'folder') {
            let newPath = [...path, e];
            li.appendChild(createFileDOM(newPath, info[e]));
        } else {
            li.appendChild(s)
            li.id = info[e].id;
        }
        dom.appendChild(li);
    }
    return dom;
}

function createModelTree(models) {
    let dom = document.getElementById('model-dialog-list-container');
    dom.innerHTML = "";

    let groupedModels = {};
    for (let key in models) {
        let components = key.split('-');
        let name = components.pop();
        let cur = groupedModels;
        for (let i of components) {
            if (!cur[i]) cur[i] = { type: 'folder' };
            cur = cur[i];
        }
        cur[name] = Object.assign({type: 'model', id: key }, models[key]);
    }

    let tree = createFileDOM([], groupedModels);
    tree.id = 'model-dialog-list';
    $(tree).tree({
        onBeforeSelect: (n) => {
            MODEL_EDITOR.selectModel(n.id);
        },
        filter: (q, node) => {
            if (!q) return true;
            if (!node.id) return false;
            return node.id.toLowerCase().indexOf(q.toLowerCase()) >= 0;
        }
    });
    $(tree).tree('doFilter', $('#model-dialog-filter').value);
    dom.appendChild(tree);
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
    createList(
        document.getElementById('model-dialog-controls-texture'),
        defs.model_textures
    )
    createModelTree(defs.models);
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
            MODEL_EDITOR.loadWorkspace(
                map.sceneryLoader,
                map.textureLoader,
                map.loadedArgs.models
            );
            SCENERY_EDITOR.setObjects(map.scenery_references);
            SCENERY_EDITOR.setUniques(map.unique_references);
            SCENERY_EDITOR.setSceneryLoader(map.sceneryLoader);
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