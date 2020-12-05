var fs = require('fs-extra');
var dir = require('./directory.js');
const { exec } = require("child_process");
const { formatWithOptions } = require('util');

const root_dir = './tmp/';

function listWorkspaces() {
    let workspaces = fs.readdirSync(root_dir);
    return workspaces.filter(f => fs.statSync(root_dir + f).isDirectory());
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

    app.get('/read/:name/models', (req,res) => {
        let models = {};
        dir.traverseSubdirectory([], [], `./tmp/${req.params.name}/models/definitions`, (k,v,meta) => {
            models[k] = processModel(k,v,meta);
        });
        res.send(models);
    });

    app.get('/read/:name/model-textures', (req,res) => {
        let textures = {};
        for (let t of fs.readdirSync(`./tmp/${req.params.name}/models/shared-textures`)) {
            textures[t] = true;
        }
        res.send(textures);
    });

    app.get('/read/:name/floors', (req,res) => {
        let floors = {};

        for (let tex of fs.readdirSync(`./tmp/${req.params.name}/buildings/floors/`)) {
            floors[tex] = {
                texture: tex
            }
        }
        res.send(floors);
    });

    app.get('/read/:name/walls', (req,res) => {
        let rawWalls = JSON.parse(fs.readFileSync(`./tmp/${req.params.name}/buildings/walls/definitions.json`));

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

        res.send(rawWalls);
    });

    app.get('/open/:name', (req,res) => {
        exec(`start "" "tmp\\${req.params.name}"`, (error, stdout, stderr) => {
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
        res.send(true);
    })

    return app;
}