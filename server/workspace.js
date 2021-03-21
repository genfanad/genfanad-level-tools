var fs = require('fs-extra');
var dir = require('./directory.js');
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

exports.enableAttachedMode = (root) => {
    console.log("Enabling workspace mode: " + root);
    MODE = 'attached';
    attached_root = root + '/';
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

function processModel(k,v,meta) {
    let derivedModel = Object.assign({}, v);

    let directory = stripDirectory(meta.directory, 'models/definitions/');

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

    return derivedModel;
}

exports.getBasePath = (workspace) => {
    return root_dir + workspace +  '/';
}
exports.getAssetsPath = () => {
    return './assets/';
}
exports.getModelDefinitionPath = (workspace) => {
    if (MODE == 'attached') {
        return attached_root + '/models/created/';
    }
    return root_dir + workspace + '/models/definitions/';
}
exports.getModelTexturePath = (workspace) => {
    if (MODE == 'attached') {
        return attached_root + '/models/shared-textures/';
    }
    return root_dir + workspace + '/models/shared-textures/';
}
exports.getModelPreviewPath = (workspace) => {
    if (MODE == 'attached') {
        return attached_root + '/models/preview/';
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
        return JSON.parse(fs.readFileSync(workspacePath(workspace) + file));
    } catch (e) {
        if (def_value) return def_value;
        throw e;
    }
}
exports.writeJSON = (workspace, filename, contents) => {
    let path = workspacePath(workspace) + filename;
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
            "MIN_Y": my * 127,
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

function workspacePath(workspace) {
    if (MODE == 'attached') {
        return attachedPath(workspace);
    } else {
        return root_dir + workspace + '/';
    }
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
    return exports.readJSON(workspace, 'objects.json');
}
exports.writeObjects = (workspace, contents) => {
    exports.writeJSON(workspace, 'objects.json', contents);
}

exports.readUnique = (workspace) => {
    return exports.readJSON(workspace, 'unique.json');
}
exports.writeUnique = (workspace, contents) => {
    exports.writeJSON(workspace, 'unique.json', contents);
}

exports.readItems = (workspace) => {
    return exports.readJSON(workspace, 'items.json');
}
exports.writeItems = (workspace, contents) => {
    exports.writeJSON(workspace, 'items.json', contents);
}

exports.readNPCs = (workspace) => {
    return exports.readJSON(workspace, 'npcs.json');
}
exports.writeNPCs = (workspace, contents) => {
    exports.writeJSON(workspace, 'npcs.json', contents);
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

function readModels(workspace) {
    let models = {};
    dir.traverseSubdirectory([], [], exports.getModelDefinitionPath(workspace), (k,v,meta) => {
        models[k] = processModel(k,v,meta);
    });
    return models;
}

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
    if (MODE == 'attached') path = attached_root + '/ground-textures/'

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
        dir.traverseSubdirectory([], [], attached_root + '/roofs/definitions/', (k,v,m) => {
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
        dir.traverseSubdirectory([], [], attached_root + '/walls/definitions/', (k,v,m) => {
            walls[k] = v;
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
    exec(`start "" "tmp\\${workspace}"`, (error, stdout, stderr) => {
        if (error) {
            console.log(`error: ${error.message}`);
            return;
        }
        if (stderr) {
            console.log(`stderr: ${stderr}`);
            return;
        }
        console.log(`stdout: ${stdout}`);
    });
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