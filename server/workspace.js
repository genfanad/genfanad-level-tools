var fs = require('fs-extra');
var dir = require('./directory.js');
const path = require('path');
const { exec } = require("child_process");

const root_dir = './tmp/';

/**
 * The level editor can be run in two modes
 * 
 * Standalone: This mode runs out-of-the-box and each 'workspace'
 * is completely independent.
 * 
 * Attached: If you have access to the Genfanad content repository,
 * this mode uses the maps, models, and buildings directly from the
 * game content.
 */
var MODE = 'standalone';
var attached_root;
var assets_root;

var enable_model_cache = true;

exports.enableAttachedMode = (root, asset_root, disable_model_cache = false) => {
    if (disable_model_cache) {
        console.log("Disabling model cache.");
        enable_model_cache = false;
    }
    console.log("Enabling workspace mode: " + root);
    MODE = 'attached';
    attached_root = root + '/';
    assets_root = asset_root + '/';
}


function listWorkspaces() {
    if (MODE == 'attached') {
        return { attached: true }
    } else {
        let workspaces = fs.readdirSync(root_dir);
        let result = workspaces.filter(f => fs.statSync(root_dir + f).isDirectory());
        return { attached: false, workspaces: result };
    }
}

function createNewWorkspace(name) {
    let base = root_dir + name + '/';
    if (fs.existsSync(base)) return false;

    fs.ensureDirSync(base);
    fs.ensureDirSync(base + 'models/');
    fs.ensureDirSync(base + 'buildings/');

    fs.writeFileSync(base + 'metadata.json', json({
        layer: "debug", x: 0, y: 0,
        "wSIZE": 128,
        "MIN_MX": 0, "MAX_MX": 0,
        "MIN_X": 0, "MAX_X": 127,
        "MIN_MY": 0, "MAX_MY": 0,
        "MIN_Y": 0, "MAX_Y": 127,
    }));

    fs.copySync('./empty_workspace/', base);

    // generate empty mesh
    let mesh = [];
    for (let x = 0; x <= 128; x++)
    {
        mesh[x] = [];
        for (let y = 0; y <= 128; y++) {
            let tile = {
                elevation: 20,
                orientation: "diagb",
                color: {r: 255, g: 255, b: 255}
            }
            mesh[x][y] = tile;
        }
    }
    fs.writeFileSync(base + 'mesh.json', json(mesh))

    return true;
}

function json(content) {
    return JSON.stringify(content, null, 2);
}

function stripDirectory(dir, prefix) {
    let f = dir.indexOf(prefix);
    if (f < 0) return dir;
    return dir.substring(f + prefix.length);
}

exports.getBasePath = (workspace) => {
    if (MODE == 'attached') {
        return attachedPath(workspace);
    } else {
        return root_dir + workspace + '/';
    }
}
exports.getAssetsPath = () => {
    return './assets/';
}
exports.getModelDefinitionPath = (workspace) => {
    if (MODE == 'attached') {
        return assets_root + '/models/definitions/';
    }
    return root_dir + workspace + '/models/definitions/';
}
exports.getAliasLogFile = (workspace) => {
    if (MODE == 'attached') {
        return assets_root + '/models/aliases.json';
    } else {
        return root_dir + workspace + '/models/aliases.json';
    }
}
exports.getModelTexturePath = (workspace) => {
    if (MODE == 'attached') {
        return assets_root + '/models/shared-textures/';
    }
    return root_dir + workspace + '/models/shared-textures/';
}
exports.getModelPreviewPath = (workspace) => {
    if (MODE == 'attached') {
        return assets_root + '/models/preview/';
    }
    return root_dir + workspace + '/models/preview/';
}

// Separate from readJSON as selection should be shared across workspaces
exports.getSelection = (workspace) => {
    let path = root_dir + workspace + '/selection.json';
    if (MODE == 'attached') path = attached_root + '/tmp/selection.json';

    if (!fs.existsSync(path)) {
        return false;
    }
    let selection = JSON.parse(fs.readFileSync(path));
    return selection;
}
exports.writeSelection = (workspace, selection) => {
    let path = root_dir + workspace + '/selection.json';
    if (MODE == 'attached') path = attached_root + '/tmp/selection.json';

    fs.ensureFileSync(path);
    fs.writeFileSync(path, json(selection));
}

// Reads a file as JSON.
//  if default value is set, will return it on error, otherwise throws
exports.readJSON = (workspace, file, def_value) => {
    try {
        return JSON.parse(fs.readFileSync(exports.getBasePath(workspace) + file));
    } catch (e) {
        if (def_value) return def_value;
        throw e;
    }
}
exports.writeJSON = (workspace, filename, contents) => {
    let path = exports.getBasePath(workspace) + filename;
    _write(path, contents);
}

function _write(path, contents) {
    fs.ensureFileSync(path);
    fs.writeFileSync(path, json(contents));
}

exports.getMetadata = (workspace) => {
    if (MODE == 'attached') {
        let [layer, mx, my] = parseWorkspace(workspace);
        return {
            "layer": layer,
            "x": mx,
            "y": my,
            "wSIZE": 128,
            "MIN_MX": mx,
            "MAX_MX": mx,
            "MIN_X": mx * 128,
            "MAX_X": (mx + 1) * 128 - 1,
            "MIN_MY": my,
            "MAX_MY": my,
            "MIN_Y": my * 128,
            "MAX_Y": (my + 1) * 128 -1
          }
    } else {
        return JSON.parse(fs.readFileSync(root_dir + workspace + '/metadata.json'));
    }
}

function parseWorkspace(workspace) {
    let [layer, coords] = workspace.split(':');
    let [mx, my] = coords.split('_');
    return [layer, Number(mx), Number(my)];
}

function attachedPath(workspace) {
    let [layer, mx, my] = parseWorkspace(workspace);
    return attached_root + '/maps/' + layer + '/' + mx + "_" + my + '/';
}

exports.readMesh = (workspace) => {
    if (MODE == 'attached') {
        return JSON.parse(fs.readFileSync(attachedPath(workspace) + 'new_mesh/mesh.json'));
    }
    return exports.readJSON(workspace, 'mesh.json');
}
exports.writeMesh = (workspace, contents) => {
    if (MODE == 'attached') {
        _write(attachedPath(workspace) + 'new_mesh/mesh.json', contents);
    } else {
        exports.writeJSON(workspace, 'mesh.json', contents);
    }
}

exports.readObjects = (workspace) => {
    if (MODE == 'attached') {
        // This is copied from genfanad-content-tools/scripts/world/formats/json.js.
        // TODO: How to make this cleaner?

        function loadObjects(folder) {
            let objects = {};
                
            let objectRoot = folder  + 'objects/';
            if (fs.existsSync(objectRoot)) {
                dir.traverseSubdirectory([], [], objectRoot, (k,v,meta) => {
                    let actualKey = v.gx + "," + v.gy;
                    objects[actualKey] = v;
                })
            }
        
            if (fs.existsSync(folder + 'batch_objects/')) {
                for (let file of fs.readdirSync(folder + 'batch_objects/')) {
                    let batch = JSON.parse(fs.readFileSync(folder + 'batch_objects/' + file));
                    for (let k in batch) {
                        objects[k] = batch[k];
                    }
                }
            }
        
            return objects;
        }

        let base = attachedPath(workspace);
        return loadObjects(base);
    } else {
        return exports.readJSON(workspace, 'objects.json');
    }
}

function chooseBatch(key) {
    if (key.startsWith('skill-tree')) {
        return 'trees';
    }
    return false;
}

exports.writeObjects = (workspace, contents) => {
    if (MODE == 'attached') {
        // This is copied from genfanad-content-raw convert_trees.js.
        // TODO: How to make this cleaner?
        let remainder = {};
        let batches = {};
        for (let i in contents) {
            let o = contents[i];
            let batch = chooseBatch(o.object);
            if (batch) {
                if (!batches[batch]) batches[batch] = {};
                batches[batch][i] = o;
            } else {
                remainder[i] = o;
            }
        }

        let base = attachedPath(workspace);
        for (let i in batches) {
            let key = base + '/batch_objects/' + i + '.json';
            fs.ensureFileSync(key);
            fs.writeFileSync(key, json(batches[i]));
        }

        fs.emptyDirSync(base + "/objects/");
        for (let i in remainder) {
            let o = remainder[i];
            let category = o.object.split('-')[0];
    
            let filename = base + "/objects/" + category + '/' + i + "," + o.object + ".json";
            fs.ensureFileSync(filename);
            fs.writeFileSync(filename, json(o));
        }

    } else {
        exports.writeJSON(workspace, 'objects.json', contents);
    }
}

exports.readUnique = (workspace) => {
    if (MODE == 'attached') {
        let objects = {};
        let objectRoot = attachedPath(workspace)  + '/unique/';
        if (fs.existsSync(objectRoot)) {
            dir.traverseSubdirectory([], [], objectRoot, (k,v,meta) => {
                objects[k] = v;
            })
        }
        return objects;
    } else {
        return exports.readJSON(workspace, 'unique.json');
    }
}
exports.writeUnique = (workspace, contents) => {
    if (MODE == 'attached') {
        let base = attachedPath(workspace) + '/unique/';
        fs.ensureDirSync(base);
        fs.emptyDirSync(base);
        for (let i in contents) {
            fs.writeFileSync(base + i + ".json",
                JSON.stringify(contents[i], null, 2));
        }
    } else {
        exports.writeJSON(workspace, 'unique.json', contents);
    }
}

exports.readItems = (workspace) => {
    if (MODE == 'attached') {
        let items = {};
        let objectRoot = attachedPath(workspace)  + '/items/';
        if (fs.existsSync(objectRoot)) {
            dir.traverseSubdirectory([], [], objectRoot, (k,v,meta) => {
                items[k] = v;
            })
        }
        return items;
    } else {
        return exports.readJSON(workspace, 'items.json');
    }
}
exports.writeItems = (workspace, contents) => {
    if (MODE == 'attached') {
        let base = attachedPath(workspace) + '/items/';
        fs.ensureDirSync(base);
        fs.emptyDirSync(base);
        for (let i in contents) {
            fs.writeFileSync(base + i + ".json",
                JSON.stringify(contents[i], null, 2));
        }
    } else {
        exports.writeJSON(workspace, 'items.json', contents);
    }
}

exports.readNPCs = (workspace) => {
    if (MODE == 'attached') {
        let npcs = {};
        let objectRoot = attachedPath(workspace)  + '/npcs/';
        if (fs.existsSync(objectRoot)) {
            dir.traverseSubdirectory([], [], objectRoot, (k,v,meta) => {
                npcs[k] = v;
            })
        }
        return npcs;
    } else {
        return exports.readJSON(workspace, 'npcs.json');
    }
}
exports.writeNPCs = (workspace, contents) => {
    if (MODE == 'attached') {
        let base = attachedPath(workspace) + '/npcs/';
        fs.ensureDirSync(base);
        fs.emptyDirSync(base);
        for (let i in contents) {
            fs.writeFileSync(base + i + ".json",
                JSON.stringify(contents[i], null, 2));
        }
    } else {
        exports.writeJSON(workspace, 'npcs.json', contents);
    }
}

function readByKey(workspace, type) {
    if (type == 'metadata') {
        return exports.getMetadata(workspace);
    } else if (type == 'mesh') {
        return exports.readMesh(workspace);
    } else if (type == 'objects') {
        return exports.readObjects(workspace);
    } else if (type == 'unique') {
        return exports.readUnique(workspace);
    } else if (type == 'items') {
        return exports.readItems(workspace);
    } else if (type == 'npcs') {
        return exports.readNPCs(workspace);
    }
    return exports.readJSON(workspace, type + '.json');
}

exports.readByKey = readByKey;

exports.writeByKey = (workspace, type, value) => {
    if (type == 'metadata') {
        throw "Can't write metadata like this.";
    } else if (type == 'mesh') {
        return exports.writeMesh(workspace, value);
    } else if (type == 'objects') {
        return exports.writeObjects(workspace, value);
    } else if (type == 'unique') {
        return exports.writeUnique(workspace, value);
    } else if (type == 'items') {
        return exports.writeItems(workspace, value);
    } else if (type == 'npcs') {
        return exports.writeNPCs(workpsace, value);
    }
    return exports.writeJSON(workspace, type + '.json', value);
}

function processModel(k,v,meta) {
    let derivedModel = Object.assign({}, v);

    let directory = meta.pathList.join('/');

    if (v.model == 'polygon' || v.model == 'fishing-spot') {
        derivedModel.model = v.model;
    } else {
        derivedModel.model = directory + "/" + v.model;
    }

    if (v.sharedTexture) {
        derivedModel.texture = "models/shared-textures/" + v.sharedTexture;
    } else {
        derivedModel.texture = "models/definitions/" + directory + '/' + v.texture;
    }

    if (v.multitexture) {
        let c = {};
        for (let i in v.multitexture) {
            c[i] = {
                texture: 'models/' + v.multitexture[i].texture
            }
        }
        derivedModel.multitexture = c;
    }

    return derivedModel;
}

function readModels(workspace) {
    if (MODE == 'attached' && enable_model_cache) {
        if (fs.existsSync(attached_root + '/tmp/cached_models.json')) {
            console.log("Using cached models.");
            return JSON.parse(fs.readFileSync(attached_root + '/tmp/cached_models.json'));
        }
    }
    let models = {};
    dir.traverseSubdirectory([], [], exports.getModelDefinitionPath(workspace), (k,v,meta) => {
        models[k] = processModel(k,v,meta);
    });

    if (MODE == 'attached' && enable_model_cache) {
        console.log("Caching models file.");
        fs.writeFileSync(attached_root + '/tmp/cached_models.json', json(models));
    }

    return models;
}

exports.readModels = readModels;

function readModelTextures(workspace) {
    let textures = {};
    for (let t of fs.readdirSync(exports.getModelTexturePath(workspace))) {
        textures[t] = true;
    }
    return textures;
}

function readFloors(workspace) {
    let floors = {};

    let path = root_dir + `${workspace}/buildings/floors/`;
    if (MODE == 'attached') path = assets_root + '/ground-textures/'

    for (let tex of fs.readdirSync(path)) {
        floors[tex] = {
            texture: tex
        }
    }
    return floors;
}

function readRoofs(workspace) {
    if (MODE == 'attached') {
        let roofs = {};
        dir.traverseSubdirectory([], [], assets_root + '/roofs/definitions/', (k,v,m) => {
            roofs[k] = v;
        });
        return roofs;
    } else {
        return exports.readJSON(workspace, '/buildings/roofs/definitions.json');
    }
}

function readWalls(workspace) {
    let rawWalls;
    if (MODE == 'attached') {
        let walls = {};
        dir.traverseSubdirectory([], [], assets_root + '/walls/definitions/', (k,v,meta) => {
            walls[k] = {
                type: v.type,
                texture: meta.pathList.join('/') + '/' + v.texture,
            };
        });
        rawWalls = walls;
    } else {
        rawWalls = JSON.parse(fs.readFileSync(root_dir + `${workspace}/buildings/walls/definitions.json`));
    }

    // Hack to add 'capped' walls automatically
    let prefixes = {};
    for (let w in rawWalls) {
        if (!w.endsWith('-base')) continue;
        
        let all = w.split('-');
        all.pop();
        prefixes[all.join('-')] = true;
    }

    for (let prefix in prefixes) {
        if (rawWalls[prefix + '-base'] && rawWalls[prefix + '-left'] && rawWalls[prefix + '-right']) {
            rawWalls[prefix + '-$capped'] = rawWalls[prefix + '-base'];
        }
    }

    return rawWalls;
}

function openWorkspace(workspace) {
    if (MODE == 'attached') {
        let normalized = path.normalize(exports.getBasePath(workspace));
        exec(`start "" "${normalized}"`, (error, stdout, stderr) => {} );
    } else {
        exec(`start "" "tmp\\${workspace}"`, (error, stdout, stderr) => {} );
    }
}

exports.init = (app) => {
    app.get('/create/:name', (req, res) => {
        let name = req.params.name;
        if (createNewWorkspace(name)) {
            res.send({});
        } else {
            throw "Invalid name: " + name;
        }
    })
    app.get('/list', (req, res) => {
        res.send(listWorkspaces())
    })

    app.get('/json/:name/:file', (req,res) => {
        res.send(readByKey(req.params.name, req.params.file));
    });

    app.get('/read/:name/walls', (req,res) => {
        res.send(readWalls(req.params.name));
    });

    app.get('/read/:name/models', (req,res) => {
        res.send(readModels(req.params.name));
    });
    app.get('/read/:name/model-textures', (req,res) => {
        res.send(readModelTextures(req.params.name));
    });

    app.get('/read/:name/floors', (req,res) => {
        res.send(readFloors(req.params.name));
    });
    app.get('/read/:name/walls', (req,res) => {
        res.send(readWalls(req.params.name));
    });
    app.get('/read/:name/roofs', (req,res) => {
        res.send(readRoofs(req.params.name));
    });

    app.get('/open/:name', (req,res) => {
        openWorkspace(req.params.name);
        res.send(true);
    })

    return app;
}