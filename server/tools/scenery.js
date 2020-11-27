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
    let objects = JSON.parse(fs.readFileSync(root_dir + workspace + '/objects.json'));

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

function placeUnique(workspace, body) {
    const file = root_dir + workspace + '/unique.json';
    let uniques = JSON.parse(fs.readFileSync(file));

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

    fs.writeFileSync(file, json(uniques));
}

function modifyUnique(workspace, body) {
    let id = body.id;

    const file = root_dir + workspace + '/unique.json';
    let uniques = JSON.parse(fs.readFileSync(file));

    let u = uniques[id];
    if (!u) {
        throw "Invalid unique: " + id;
    }
    uniques[id] = merge(u, body.changes);

    fs.writeFileSync(file, json(uniques));
}

function deleteUnique(workspace, body) {
    let id = body.id;

    const file = root_dir + workspace + '/unique.json';
    let uniques = JSON.parse(fs.readFileSync(file));

    if (!uniques[id]) throw "Invalid unique: " + id;
    delete uniques[id];

    fs.writeFileSync(file, json(uniques));
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
    return app;
}