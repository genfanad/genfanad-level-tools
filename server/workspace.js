var fs = require('fs-extra');

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

    return true;
}

function json(content) {
    return JSON.stringify(content, null, 2);
}

exports.init = (app) => {
    app.get('/create/:name', (req, res) => {
        let name = req.params.name;
        if (createNewWorkspace(name)) {
            res.send('{}');
        } else {
            throw "Invalid name: " + name;
        }
    })
    app.get('/list', (req, res) => {
        res.send(json(listWorkspaces()))
    })
    return app;
}