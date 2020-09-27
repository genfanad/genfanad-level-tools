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
        
        let len = Math.max(Math.abs(selection.to.x - selection.from.x), Math.abs(selection.to.y - selection.from.y));

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

function drawWall(workspace, body) {
    let metadata = JSON.parse(fs.readFileSync(root_dir + workspace + '/metadata.json'));
    let mesh = JSON.parse(fs.readFileSync(root_dir + workspace + '/mesh.json'));

    // body.selection
    // body.level
    // body.shape
    // body.type 'delete' or wall type

    let selection = body.selection;
    let dx = Math.sign(selection.to.x - selection.from.x);
    let dy = Math.sign(selection.to.y - selection.from.y);
        
    let len = Math.max(Math.abs(selection.to.x - selection.from.x), Math.abs(selection.to.y - selection.from.y));

    // dx dy behaviour
    // 1  0  x y plusx
    // 1  1  x y diaga
    // 0  1  x y plusy
    // -1 1  x-1 y diagb
    // -1 0  x-1 y plusx
    // -1 -1 x-1 y-1 diaga
    // 0 -1 x y-1 plusy
    // 1 -1 x y-1 diagb

    let ox = 0, oy = 0, wall = 'plusx';

    if (dx == 1 && dy == 0) { wall = 'plusx' }
    else if (dx == 1 && dy == 1) { wall = 'diaga'}
    else if (dx == 0 && dy == 1) { wall = 'plusy'}
    else if (dx == -1 && dy == 1) { ox = -1; wall='diagb'; }
    else if (dx == -1 && dy == 0) { ox = -1; wall='plusx'; }
    else if (dx == -1 && dy == -1) { ox = -1; oy = -1; wall = 'diaga'; }
    else if (dx == 0 && dy == -1) { oy = -1; wall = 'plusy'}
    else if (dx == 1 && dy == -1) { oy = -1; wall = 'diagb' }

    for (let t = 0; t < len; t++) {
        let x = selection.from.x + t * dx;
        let y = selection.from.y + t * dy;
        
        let tile = mesh[x + ox][y + oy];

        if (!tile.buildings) tile.buildings = {};
        if (!tile.buildings['level' + body.level]) tile.buildings['level' + body.level] = {};
        if (!tile.buildings['level' + body.level].walls) tile.buildings['level' + body.level].walls = [];

        let walls = [];
        for (let i of tile.buildings['level' + body.level].walls) {
            if (i.position != wall) {
                walls.push(i);
            }
        }

        if (body.type != 'delete') {
            walls.push({position: wall, type: body.type})
        }

        tile.buildings['level' + body.level].walls = walls;
    }

    fs.writeFileSync(root_dir + workspace + '/mesh.json', json(mesh));
}

function drawRoof(workspace, body) {
    let metadata = JSON.parse(fs.readFileSync(root_dir + workspace + '/metadata.json'));
    let mesh = JSON.parse(fs.readFileSync(root_dir + workspace + '/mesh.json'));

    // body.selection
    // body.level
    // body.shape
    // body.type 'delete' or wall type

    // adjust level upwards so 'ground floor roof' ends up in level 1
    let level = Number(body.level) + 1;

    forEachTile(metadata, mesh, body.selection, (x,y,tile) => {
        if (body.type=='delete') {
            if (!tile.buildings) return;
            if (!tile.buildings["level" + level]) return;
            if (tile.buildings["level" + level].roof) delete tile.buildings["level" + level].roof;
            return;
        } else {
            if (!tile.buildings) tile.buildings = {};
            if (!tile.buildings["level" + level]) tile.buildings["level" + level] = {};
            tile.buildings["level" + level].roof = {
                position: body.shape,
                type: body.type
            }
        }
    })

    fs.writeFileSync(root_dir + workspace + '/mesh.json', json(mesh));
}

function clearArea(workspace, body) {
    let metadata = JSON.parse(fs.readFileSync(root_dir + workspace + '/metadata.json'));
    let mesh = JSON.parse(fs.readFileSync(root_dir + workspace + '/mesh.json'));

    forEachTile(metadata, mesh, body.selection, (x,y,tile) => {
        if (tile.buildings) delete tile.buildings;
        if (tile.texture1) delete tile.texture1;
        if (tile.texture2) delete tile.texture2;
    });

    fs.writeFileSync(root_dir + workspace + '/mesh.json', json(mesh));
}

exports.init = (app) => {
    app.post('/draw-floor/:workspace', (req, res) => {
        res.send(drawFloor(req.params.workspace, req.body));
    })
    app.post('/draw-wall/:workspace', (req, res) => {
        res.send(drawWall(req.params.workspace, req.body));
    })
    app.post('/draw-roof/:workspace', (req, res) => {
        res.send(drawRoof(req.params.workspace, req.body));
    })
    app.post('/clear-area/:workspace', (req, res) => {
        res.send(clearArea(req.params.workspace, req.body));
    })
    return app;
}