var fs = require('fs-extra');
var dir = require('./directory.js');

var WORKSPACE = require('./workspace.js');

const root_dir = WORKSPACE.getAssetsPath();

function listAssets() {
    let folders = fs
        .readdirSync(root_dir)
        .filter(f => fs.statSync(root_dir + f).isDirectory());

    let assets = {
    };

    for (let f of folders) {
        let asset = {
            objs: {},
            textures: {}
        };

        let textures = fs.readdirSync(root_dir + f);
        for (let j of textures) {
            if (j.endsWith('.png')) asset.textures[j] = true;
        }

        if (fs.existsSync(root_dir + f + '/OBJ/')) {
            for (let obj of fs.readdirSync(root_dir + f + '/OBJ/')) {
                asset.objs[obj] = true;
            }
        }

        assets[f] = asset;
    }

    return assets;
}

exports.init = (app) => {
    app.get('/list', (req, res) => {
        res.send(listAssets())
    })
    return app;
}