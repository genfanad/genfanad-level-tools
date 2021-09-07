function option(value, text) {
    let opt = document.createElement('option');
    opt.value = value;
    opt.innerText = text;
    return opt;
}

function createList(dom, defs, skip_delete = false) {
    dom.innerHTML = '';
    if (!skip_delete) dom.appendChild(option('delete',"(Delete)"));
    for (let i in defs) {
        dom.appendChild(option(i,i));
    }
}

function createFileDOM(path, info, shortnames = false) {
    let dom = document.createElement('ul');
    for (let e in info) {
        if (e == 'type') continue;
        let li = document.createElement('li');
        let s = document.createElement('span');
        li.appendChild(s);
        if (info[e].type == 'folder') {
            s.innerText = e;
            let newPath = [...path, e];
            li.appendChild(createFileDOM(newPath, info[e]));
        } else {
            li.appendChild(s)
            s.innerText = shortnames ? e : info[e].id;
            li.id = info[e].id;
        }
        dom.appendChild(li);
    }
    return dom;
}

function groupHeirarchy(flatList, elementF, splitKey = '-', shortnames = false) {
    let groups = {};
    for (let key in flatList) {
        let components = key.split(splitKey);
        let name = components.pop();
        let cur = groups;
        for (let i of components) {
            if (!cur[i]) cur[i] = { type: 'folder' };
            cur = cur[i];
        }
        cur[name] = elementF(key, flatList[key]);
    }

    return createFileDOM([], groups, shortnames);
}

function createModelTree(dom, models) {
    dom.innerHTML = "";

    let tree = groupHeirarchy(models, 
        (k,v) => { return Object.assign({type: 'model', id: k }, v) });
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
    createModelTree(document.getElementById('model-dialog-list-container'), defs.models);
}

class Workspaces {
    constructor() {
        this.opened = undefined;
    }

    closeWorkspace() {
        if (!this.opened) return;
        this.opened = undefined;
    }

    openWorkspace(name, attached_args) {
        if (this.opened == name) return;
        if (attached_args) {
            this.attached_args = attached_args;
        } else {
            delete this.attached_args;
        }
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
            SCENE.setNPCs(map.npc_group);
            SCENE.setItemSpawns(map.item_group);
            SELECTION.setTerrain(map.terrain);
            MODEL_EDITOR.loadWorkspace(
                map.sceneryLoader,
                map.textureLoader,
                map.loadedArgs.models
            );
            MODEL_VISUAL.loadWorkspace(name, map.loadedArgs.models, map.sceneryLoader);
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
        let name = prompt('Workspace name?');
        if (name) {
            get('api/workspaces/create/' + name, () => {
                let list = document.getElementById('file-workspaces');
                let e = document.createElement('li');
                e.innerText = name;
                list.appendChild(e);
                $('#file-workspaces').datalist();
                this.openWorkspace(name);
            });
        } else {
            console.log("Cancelled.");
        }
    }

    open() {
        console.log('TODO: open');
    }

    reload(bypass_global = false) {
        if (!RELOAD_ENABLED && !bypass_global) return;
        this._openWorkspace(this.opened);
    }

    reloadMesh(){
        MAPLOADER.getMesh((mesh) => {
            let currentMesh = this.current_map.terrain
            currentMesh = mesh
            
            SCENE.setTerrain(currentMesh)
        })
    }

    reloadUniques(){
        MAPLOADER.getUniques((uniques) => {
            let currentGroups = this.current_map.scenery_groups;
            let currentRef = this.current_map.unique_references;

            currentGroups['unique'] = uniques.group;
            currentRef = uniques.references;
            
            SCENE.setObjects(currentGroups)
            SCENERY_EDITOR.uniques = uniques.references;
        })
    }

    reloadObjects(){
        MAPLOADER.getObjects((objects) =>{
            let currentGroups = WORKSPACES.current_map.scenery_groups;
            let currentRef = WORKSPACES.current_map.scenery_references;

            currentGroups['trees'] = objects.group;
            currentRef = objects.references;
            SCENE.setObjects(currentGroups)
        });
    }

    save() {
        console.log('TODO: save');
    }

    load_attached() {
        let layer = document.getElementById('file-attached-layer').value;
        let x = Number(document.getElementById('file-attached-x').value);
        let y = Number(document.getElementById('file-attached-y').value);

        this.openWorkspace(layer + ':' + x + '_' + y, {layer, x, y});
    }

    move(dir) {
        let x = document.getElementById('file-attached-x').value;
        let y = document.getElementById('file-attached-y').value;

        if (dir == 'N') {
            document.getElementById('file-attached-y').value = Number(y) - 1;
        }
        if (dir == 'S') {
            document.getElementById('file-attached-y').value = Number(y) + 1;
        }
        if (dir == 'E') {
            document.getElementById('file-attached-x').value = Number(x) + 1;
        }
        if (dir == 'W') {
            document.getElementById('file-attached-x').value = Number(x) - 1;
        }

        this.load_attached();
    }

    init() {
        get('/api/workspaces/list', (data) => {
            if (data.attached) {
                this.attached = true;
                document.getElementById('file-attached-view').style.display = 'block';
                document.getElementById('file-workspaces-view').style.display = 'none';

                initAttachedMode();
            } else {
                this.attached = false;
                let list = document.getElementById('file-workspaces');
                list.innerHTML = "";
                for (let workspace of data.workspaces) {
                    let e = document.createElement('li');
                    e.innerText = workspace;
                    list.appendChild(e);
                }
                $('#file-workspaces').datalist({
                    onSelect: (n,r) => this.openWorkspace(r.value)
                });                
            }
        });
    }
}

var WORKSPACES = new Workspaces();