/**
 * Tools for editing the scenery definitions and instances in the map.
 */
var fs = require('fs-extra');
var undo = require('./undo.js');
var imageDataURI = require('image-data-uri');

var WORKSPACE = require('../workspace.js');

function json(content) {
    return JSON.stringify(content, null, 2);
}

function merge(original, changelist) {
    if (!original) original = {};
    if (typeof(changelist) === 'object') {
        let copy = JSON.parse(JSON.stringify(original));
        for (let i in changelist) {
            copy[i] = merge(original[i], changelist[i]);
        }
        return copy;
    } else {
        return changelist;
    }
}

function placeModel(workspace, body) {
    let metadata = WORKSPACE.getMetadata(workspace);
    let objects = WORKSPACE.readObjects(workspace);

    undo.commandPerformed(workspace,{
        command: "Place Model",
        files: {'/objects.json': objects},
    })

    let x = Number(body.x), y = Number(body.y);
    let gx = x + Number(metadata.MIN_X), gy = y + Number(metadata.MIN_Y);

    // validate no model exists already
    /*for (let i in objects) {
        let o = objects[i];
        if (o.x == x && o.y == y) {
            console.log("Object already exists at " + x + "," + y);
            return false;
        }
    }*/

    let object = {
        x: x, y: y,
        gx: gx, gy: gy,
        object: body.object,
    }
    if (body.rotation) object.rotation = Number(body.rotation);
    if (body.tint) object.tint = body.tint;

    let key = gx + "," + gy;
    objects[key] = object;

    WORKSPACE.writeObjects(workspace, objects);

    return true;
}

function modifyModel(workspace, body) {
    let objects = WORKSPACE.readObjects(workspace);

    undo.commandPerformed(workspace,{
        command: "Modify Model",
        files: {'/objects.json': objects},
    })

    let id = body.id;
    if (!id && body.hasOwnProperty('x')) {
        let x = Number(body.x), y = Number(body.y);

        // find existing model to delete
        for (let i in objects) {
            let o = objects[i];
            if (o.x == x && o.y == y) {
                id = i;
            }
        }
    }

    if (!id || !objects[id]) {
        console.log("Object does not exist.");
        return false;
    }

    if (body.object) {
        objects[id].object = body.object;   
    }
    if (body.hasOwnProperty('rotation')) {
        objects[id].rotation = Number(body.rotation);   
    }
    if (body.tint) {
        objects[id].tint = body.tint;
    }
    if (body.remove_tint) {
        delete objects[id].tint;
    }

    WORKSPACE.writeObjects(workspace, objects);
    return true;
}

function deleteModel(workspace, body) {
    let objects = WORKSPACE.readObjects(workspace);
    
    undo.commandPerformed(workspace,{
        command: "Delete Model",
        files: {'/objects.json': objects},
    })

    let id = body.id;

    if (!id && body.hasOwnProperty('x')) {
        let x = Number(body.x), y = Number(body.y);

        // find existing model to delete
        for (let i in objects) {
            let o = objects[i];
            if (o.x == x && o.y == y) {
                id = i;
            }
        }
    }

    if (!id) {
        console.log("Object does not exist.");
        return false;
    }
    delete objects[id];

    WORKSPACE.writeObjects(workspace, objects);
    return true;
}

function createDefinition(workspace, body) { 
    const assetPath = WORKSPACE.getAssetsPath() + body.pack + "/" + body.model;
    const definitionPath = WORKSPACE.getModelDefinitionPath(workspace);

    const assetTexturePath = WORKSPACE.getAssetsPath() + body.pack + "/" + body.sharedTexture;
    const sharedTexturePath = WORKSPACE.getModelTexturePath(workspace) + body.sharedTexture;

    let pieces = body.id.split('-');
    let name = pieces.pop();
    let path = pieces.join('/') + "/";

    body.model = name + ".obj";

    fs.ensureDirSync(WORKSPACE.getBasePath(workspace) + definitionPath + path);

    const changes = body.changes;

    const def = {
        sharedTexture: body.sharedTexture,
        model: body.model
    }

    fs.writeFileSync(definitionPath + path + name + ".json", json(merge(def, changes)));

    fs.copyFileSync(assetPath, definitionPath + path + body.model);
    fs.copyFileSync(assetTexturePath, sharedTexturePath);

    return true;
}

function modifyDefinition(workspace, body) {
    const definitionPath = WORKSPACE.getModelDefinitionPath(workspace);

    let pieces = body.id.split('-');
    let name = pieces.pop();
    let path = pieces.join('/') + "/";

    let original = JSON.parse(fs.readFileSync(definitionPath + path + name + ".json"));
    fs.writeFileSync(definitionPath + path + name + ".json", json(merge(original, body.changes)));
    return true;
}

const categories = { ground_decoration: true, pillar: true, tile: true, unique: true, wall_decoration: true, wall_structure: true };

function reparentDefinition(workspace, body) {
    const definitionPath = WORKSPACE.getModelDefinitionPath(workspace);

    let old_id = body.id;
    let category = body.category;

    let old_pieces = old_id.split('-');
    let old_name = old_pieces.pop();
    let old_path = old_pieces.join('/') + "/";

    // $verified-<foo-bar-baz>  -> $new-tile-<foo-bar-baz>
    // $new-tile-<foo> -> $new-unique-<foo>

    // shift off all $pieces
    // shift off category if exists
    // unshift category
    // unshift $new

    let new_id;

    if (body.new_id) {
        new_id = "$new-" + category + '-' + body.new_id;
    } else {
        let piece_array = old_id.split('-');
        while (piece_array[0].startsWith('$')) piece_array.shift();
        if (categories[piece_array[0]]) piece_array.shift();
        piece_array.unshift(category);
        piece_array.unshift('$new');
    
        new_id = piece_array.join('-');
    }
    let new_pieces = new_id.split('-');
    let new_name = new_pieces.pop();
    let new_path = new_pieces.join('/') + '/';

    let original_def = JSON.parse(fs.readFileSync(definitionPath + old_path + old_name + ".json"));
    let new_def = merge(original_def, body.changes);

    let model_path, model_name;
    if (fs.existsSync(definitionPath + old_path + old_name + ".obj")) {
        model_path = definitionPath + old_path + old_name + ".obj";
        model_name = new_name + ".obj";
        new_def.model = model_name;
    }
    else if (fs.existsSync(definitionPath + old_path + old_name + ".fbx")) {
        model_path = definitionPath + old_path + old_name + ".fbx";
        model_name = new_name + ".fbx";
        new_def.model = model_name;
    } 
    else if (fs.existsSync(definitionPath + old_path + original_def.model)) {
        model_path = definitionPath + old_path + original_def.model;
        let ext = original_def.model.split('.')[1];
        model_name = new_name + '.' + ext;
        new_def.model = model_name;
    }

    if (!model_path) throw "Invalid model: " + old_id;

    if (fs.existsSync(definitionPath + new_path + new_name + ".json")) throw "Target model already exists.";

    let aliases_path = WORKSPACE.getAliasLogFile(workspace);
    let aliases = {};
    try {
        aliases = JSON.parse(fs.readFileSync(aliases_path));
    } catch (e) {
        //
    }

    aliases[old_id] = new_id;

    fs.ensureFileSync(aliases_path);
    fs.writeFileSync(aliases_path, json(aliases));

    fs.ensureDirSync(definitionPath + new_path);
    fs.moveSync(model_path, definitionPath + new_path + model_name);
    fs.writeFileSync(definitionPath + new_path + new_name + '.json', json(new_def));
    fs.rmSync(definitionPath + old_path + old_name + '.json');
    
    return `${old_id} -> ${new_id} done`;
}

function placeUnique(workspace, body) {
    let uniques = WORKSPACE.readUnique(workspace);

    undo.commandPerformed(workspace,{
        command: "Place Unique",
        files: {'/unique.json': uniques},
    })

    // This will throw an approximation of this object as a unique model into the map.
    let position = {
        x: body.x || 0.0,
        y: body.elevation || 0.0,
        z: body.z || 0.0
    };

    let pieces = body.object.split('-');
    let name = pieces.pop();
    let path = pieces.join('/') + "/";

    let definition = JSON.parse(
        fs.readFileSync(
            WORKSPACE.getModelDefinitionPath(workspace) + path + name + ".json"));

    let key = body.x + "," + body.z + "," + name;

    if (uniques[key]) throw "Unique " + key + ' already exists.';

    uniques[key] = {
        name: definition.name,
        examine: definition.examine,
        scale: definition.scale,
        position: position,
        model: 'imported/' + pieces.join('-') + '-' + definition.model,
        texture: 'shared-textures/' + definition.sharedTexture,
    }

    WORKSPACE.writeUnique(workspace, uniques);
}

function modifyUnique(workspace, body) {
    let id = body.id;

    let uniques = WORKSPACE.readUnique(workspace);

    undo.commandPerformed(workspace,{
        command: "Modify Unique",
        files: {'/unique.json': uniques},
    })

    let u = uniques[id];
    if (!u) {
        throw "Invalid unique: " + id;
    }
    uniques[id] = merge(u, body.changes);

    WORKSPACE.writeUnique(workspace, uniques);
}

function deleteUnique(workspace, body) {
    let id = body.id;

    let uniques = WORKSPACE.readUnique(workspace);

    undo.commandPerformed(workspace,{
        command: "Delete Unique",
        files: {'/unique.json': uniques},
    })

    if (!uniques[id]) throw "Invalid unique: " + id;
    delete uniques[id];

    WORKSPACE.writeUnique(workspace, uniques);
}

function saveModelPreview(workspace, body) {
    let path = WORKSPACE.getModelPreviewPath(workspace);
    fs.ensureDirSync(path);

    let filename = body.filename;
    let dataURI = body.dataURI;
    
    imageDataURI.outputFile(dataURI, path + filename);
}

exports.init = (app) => {
    app.post('/instance/place/:workspace', (req, res) => {
        res.send(placeModel(req.params.workspace, req.body));
    })
    app.post('/instance/modify/:workspace', async (req, res) => {
        res.send(modifyModel(req.params.workspace, req.body));
    })
    app.post('/instance/delete/:workspace', async (req, res) => {
        res.send(deleteModel(req.params.workspace, req.body));
    })

    app.post('/unique/place/:workspace', (req, res) => {
        res.send(placeUnique(req.params.workspace, req.body));
    })
    app.post('/unique/modify/:workspace', (req, res) => {
        res.send(modifyUnique(req.params.workspace, req.body));
    })
    app.post('/unique/delete/:workspace', (req, res) => {
        res.send(deleteUnique(req.params.workspace, req.body));
    })

    app.post('/definition/create/:workspace', async (req, res) => {
        res.send(createDefinition(req.params.workspace, req.body));
    })
    app.post('/definition/modify/:workspace', async (req, res) => {
        res.send(modifyDefinition(req.params.workspace, req.body));
    })
    app.post('/definition/reparent/:workspace', async (req, res) => {
        try {
            res.send(reparentDefinition(req.params.workspace, req.body));
        } catch (e) {
            res.send("Error: " + e);
        }
    })
    app.post('/definition/save_preview/:workspace', async (req, res) => {
        res.send(saveModelPreview(req.params.workspace, req.body));
    })
    return app;
}