/**
 * Tools for editing the scenery definitions and instances in the map.
 */

var Jimp = require("jimp");
var fs = require('fs-extra');

const root_dir = './tmp/';

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
    let metadata = JSON.parse(fs.readFileSync(root_dir + workspace + '/metadata.json'));
    let objects = JSON.parse(fs.readFileSync(root_dir + workspace + '/objects.json'));

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

    fs.writeFileSync(root_dir + workspace + '/objects.json', json(objects));

    return true;
}

function modifyModel(workspace, body) {
    console.log("Modify: " + workspace + ": " + json(body));
    return false;
}

function deleteModel(workspace, body) {
    let metadata = JSON.parse(fs.readFileSync(root_dir + workspace + '/metadata.json'));
    let objects = JSON.parse(fs.readFileSync(root_dir + workspace + '/objects.json'));

    let x = Number(body.x), y = Number(body.y);
    let gx = x + Number(metadata.MIN_X), gy = y + Number(metadata.MIN_Y);

    // find existing model to delete
    let key = undefined;
    for (let i in objects) {
        let o = objects[i];
        if (o.x == x && o.y == y) {
            key = i;
        }
    }

    if (!key) {
        console.log("Object does not exist at " + x + "," + y);
        return false;
    }
    delete objects[key];
    fs.writeFileSync(root_dir + workspace + '/objects.json', json(objects));

    return true;
}

function createDefinition(workspace, body) { 
    const workspacePath = root_dir + workspace;
    const assetPath = "./assets/" + body.pack + "/" + body.model;
    const definitionPath = "/models/definitions/";

    const assetTexturePath = "./assets/" + body.pack + "/" + body.sharedTexture;
    const sharedTexturePath = workspacePath + "/models/shared-textures/" + body.sharedTexture;

    let pieces = body.id.split('-');
    let name = pieces.pop();
    let path = pieces.join('/') + "/";

    body.model = name + ".obj";

    fs.ensureDirSync(workspacePath + definitionPath + path);

    const changes = body.changes;

    const def = {
        sharedTexture: body.sharedTexture,
        model: body.model
    }

    fs.writeFileSync(workspacePath + definitionPath + path + name + ".json", json(merge(def, changes)));

    fs.copyFileSync(assetPath, workspacePath + definitionPath + path + body.model, () =>{
        console.log(body.model + " could not be copied");
    })

    fs.copyFileSync(assetTexturePath, sharedTexturePath, () =>{
        console.log(body.sharedTexture + " could not be copied");
    })

    return true;
}

function modifyDefinition(workspace, body) {

    const definitionsPath = root_dir + workspace + "/models/definitions/";

    let pieces = body.id.split('-');
    let name = pieces.pop();
    let path = pieces.join('/') + "/";


    let original = JSON.parse(fs.readFileSync(definitionsPath + path + name + ".json"));
    fs.writeFileSync(definitionsPath + path + name + ".json", json(merge(original, body.changes)));
    return true;
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

    app.post('/definition/create/:workspace', async (req, res) => {
        res.send(createDefinition(req.params.workspace, req.body));
    })
    app.post('/definition/modify/:workspace', async (req, res) => {
        res.send(modifyDefinition(req.params.workspace, req.body));
    })
    return app;
}