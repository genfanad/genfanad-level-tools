/**
 * Tools for editing the level mesh (heightmap + colormap)
 */

var fs = require('fs-extra');

const root_dir = './tmp/';

function json(content) {
    return JSON.stringify(content, null, 2);
}

function forEachTile(metadata, mesh, selection, f) {
    if (selection.type == 'tile') {
        f(selection.x, selection.y, mesh[selection.x][selection.y]);
    } else if (selection.type == 'line') {
        let dx = Math.sign(selection.to.x - selection.from.x);
        let dy = Math.sign(selection.to.y - selection.from.y);
        
        let len = Math.min(Math.abs(selection.to.x - selection.from.x), Math.abs(selection.to.y - selection.from.y));

        for (let t = 0; t < len; t++) {
            let x = selection.from.x + t * dx;
            let y = selection.from.y + t * dy;
            f(x,y,mesh[x][y]);
        }
    } else if (selection.type == 'area') {
        for (let x = selection.minx; x < selection.maxx; x++)
        for (let y = selection.miny; y < selection.maxy; y++) {
            f(x,y,mesh[x][y]);
        }
    }
}

function drawFloor(workspace, body) {
    let metadata = JSON.parse(fs.readFileSync(root_dir + workspace + '/metadata.json'));
    let mesh = JSON.parse(fs.readFileSync(root_dir + workspace + '/mesh.json'));

    // body.selection
    // body.level
    // body.shape
    // body.type 'delete' or wall type

    // TODO: ground floor is baked into tile
    if (body.level == '0') {
        forEachTile(metadata, mesh, body.selection, (x,y,tile) => {
            if (body.type=='delete') {
                if (tile.texture1) delete tile.texture1;
                if (tile.texture2) delete tile.texture2;
                if (tile.orientation) delete tile.orientation;
            } else  if (body.shape == 'full') {
                tile.texture1 = body.type;
                tile.texture2 = body.type;
            } else if (body.shape == 'tl') {
                tile.orientation = 'diagb';
                tile.texture1 = body.type;
            } else if (body.shape == 'tr') {
                tile.orientation = 'diaga';
                tile.texture2 = body.type;
            } else if (body.shape == 'bl') {
                tile.orientation = 'diaga';
                tile.texture1 = body.type;
            } else if (body.shape == 'br') {
                tile.orientation = 'diagb'
                tile.texture2 = body.type;
            }
        })
    } else {

    }

    fs.writeFileSync(root_dir + workspace + '/mesh.json', json(mesh));
}

exports.init = (app) => {
    app.post('/draw-floor/:workspace', (req, res) => {
        res.send(drawFloor(req.params.workspace, req.body));
    })
    return app;
}