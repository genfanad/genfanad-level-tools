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

    addNewObject(object){
        let object_id = object.x + ',' + object.y;
            
        this.current_map.sceneryLoader.createScenery(object, (model, definition) => {
            let m = createSceneryMesh(object_id, object, this.current_map.terrain, model, definition);
            m.original_id = { type: 'scenery', id: object_id };
            this.current_map.scenery_groups['trees'].add(m);
            this.current_map.scenery_references[object_id] = {
                instance: object,
                definition: definition,
                threeObject: m
            }
        })
    }

    editObject(object){
        let newObject = this.current_map.scenery_references[object.object].instance;
            
        if (object.id == 'tint'){
            this.removeObject(object.object, true);
            newObject.tint = object.value;
            this.addNewObject(newObject);
        }
        if (object.id == 'rotation'){
            this.removeObject(object.object, true);
            newObject.rotation = object.value;
            this.addNewObject(newObject);
        }
    }

    removeObject(object){
        if (object.object == "delete") object = object.x + ',' + object.y;

        for (let x of this.current_map.scenery_groups['trees']['children']){
            if (x.name == object){
                this.current_map.scenery_groups['trees'].remove(x);
            }
        }
        delete this.current_map.scenery_references[object];
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

    save() {
        console.log('TODO: save');
    }

    load_attached() {
        let layer = document.getElementById('file-attached-layer').value;
        let x = document.getElementById('file-attached-x').value;
        let y = document.getElementById('file-attached-y').value;

        this.openWorkspace(layer + ':' + x + '_' + y);
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