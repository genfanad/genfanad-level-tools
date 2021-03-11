/**
 * Tools for editing the scenery definitions and instances in the map.
 */
var fs = require('fs-extra');
var undo = require('./undo.js');
var imageDataURI = require('image-data-uri');

var WORKSPACE = require('../workspace.js');

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
    let objects = WORKSPACE.readJSON(workspace, 'objects.json');

    undo.commandPerformed(workspace,{
        command: "Place Model",
        files: {'/objects.json': objects},
    })

    let x = Number(body.x), y = Number(body.y);
    let gx = x + Number(metadata.MIN_X), gy = y + Number(metadata.MIN_Y);

    // validate no model exists already
    for (let i in objects) {
        let o = objects[i];
        if (o.x == x && o.y == y) {
            console.log("Object already exists at " + x + "," + y);
            return false;
        }
    }

    let object = {
        x: x, y: y,
        gx: gx, gy: gy,
        object: body.object,
    }
    if (body.rotation) object.rotation = Number(body.rotation);
    if (body.tint) object.tint = body.tint;

    let key = gx + "," + gy;
    objects[key] = object;

    WORKSPACE.writeJSON(workspace, 'objects.json', objects);

    return true;
}

function modifyModel(workspace, body) {
    console.log("Modify: " + workspace + ": " + json(body));
    return false;
}

function deleteModel(workspace, body) {
    let objects = WORKSPACE.readJSON(workspace, 'objects.json');
    
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

    WORKSPACE.writeJSON(workspace, 'objects.json', objects);
    return true;
}

function createDefinition(workspace, body) { 
    const assetPath = WORKSPACE.getAssetsPath() + body.pack + "/" + body.model;
    const definitionPath = WORKSPACE.getModelDefinitionPath(workspace);

    const assetTexturePath = WORKSPACE.getAssetsPath() + body.pack + "/" + body.sharedTexture;
    const sharedTexturePath = WROKSPACE.getModelTexturePath(workspace) + body.sharedTexture;

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

    fs.copyFileSync(assetPath, definitionPath + path + body.model, () =>{
        console.log(body.model + " could not be copied");
    })

    fs.copyFileSync(assetTexturePath, sharedTexturePath, () =>{
        console.log(body.sharedTexture + " could not be copied");
    })

    return true;
}

function modifyDefinition(workspace, body) {
    const definitionPath = WORKSPACE.getModelDefinitionPath(workspace);

    let pieces = body.id.split('-');
    let name = pieces.pop();
    let path = pieces.join('/') + "/";

    let original = JSON.parse(fs.readFileSync(definitionPath + path + name + ".json"));
    fs.writeFileSync(definitionsPath + path + name + ".json", json(merge(original, body.changes)));
    return true;
}

function placeUnique(workspace, body) {
    let uniques = WORKSPACE.readJSON(workspace, 'unique.json');

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
            root_dir + workspace + "/models/definitions/" + path + name + ".json"));

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

    WORKSPACE.writeJSON(workspace, 'unique.json', uniques);
}

function modifyUnique(workspace, body) {
    let id = body.id;

    let uniques = WORKSPACE.readJSON(workspace, 'unique.json');

    undo.commandPerformed(workspace,{
        command: "Modify Unique",
        files: {'/unique.json': uniques},
    })

    let u = uniques[id];
    if (!u) {
        throw "Invalid unique: " + id;
    }
    uniques[id] = merge(u, body.changes);

    WORKSPACE.writeJSON(workspace, 'unique.json', uniques);
}

function deleteUnique(workspace, body) {
    let id = body.id;

    let uniques = WORKSPACE.readJSON(workspace, 'unique.json');

    undo.commandPerformed(workspace,{
        command: "Delete Unique",
        files: {'/unique.json': uniques},
    })

    if (!uniques[id]) throw "Invalid unique: " + id;
    delete uniques[id];

    WORKSPACE.writeJSON(workspace, 'unique.json', uniques);
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
    app.post('/definition/save_preview/:workspace', async (req, res) => {
        res.send(saveModelPreview(req.params.workspace, req.body));
    })
    return app;
}