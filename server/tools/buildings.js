/**
 * Tools for editing the level mesh (heightmap + colormap)
 */
var undo = require('./undo.js');

var WORKSPACE = require('../workspace.js');

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
    let metadata = WORKSPACE.getMetadata(workspace);
    let mesh = WORKSPACE.readMesh(workspace);

    undo.commandPerformed(workspace,{
        command: "Draw Floor",
        files: {'/mesh.json': mesh},
    })

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
        forEachTile(metadata, mesh, body.selection, (x,y,tile) => {
            if (body.type === 'delete') {
                if (tile.buildings) {
                    const levelName = 'level' + body.level;
                    const tileAtLevel = tile.buildings[levelName];

                    if (tileAtLevel && tileAtLevel.floor) {
                        delete tileAtLevel.floor;
                        if (tileAtLevel === {}) {
                            delete tile.buildings[levelName];
                            if (tile.buildings === {}) {
                                delete tile.buildings;
                            }
                        }
                    }
                }

                return;
            }

            if (!tile.buildings) tile.buildings = {};
            if (!tile.buildings['level' + body.level]) tile.buildings['level' + body.level] = {};

            let floor = {};
            if (body.shape == 'full') {
                floor.texture1 = body.type;
                floor.texture2 = body.type;
            } else if (body.shape == 'tl') {
                floor.orientation = 'diagb';
                floor.texture1 = body.type;
            } else if (body.shape == 'tr') {
                floor.orientation = 'diaga';
                floor.texture2 = body.type;
            } else if (body.shape == 'bl') {
                floor.orientation = 'diaga';
                floor.texture1 = body.type;
            } else if (body.shape == 'br') {
                floor.orientation = 'diagb'
                floor.texture2 = body.type;
            }
            tile.buildings['level' + body.level].floor = floor;
        })
    }

    WORKSPACE.writeMesh(workspace, mesh);
}

function drawWallSegment(mesh, level, type, fx, fy, tx, ty) {
    let dx = Math.sign(tx - fx);
    let dy = Math.sign(ty - fy);

    let len = Math.max(Math.abs(tx - fx), Math.abs(ty - fy));

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
    let invert = false;

    if (dx == 1 && dy == 0) { wall = 'plusx' }
    else if (dx == 1 && dy == 1) { wall = 'diaga'}
    else if (dx == 0 && dy == 1) { wall = 'plusy'}
    else if (dx == -1 && dy == 1) { ox = -1; wall='diagb'; }
    else if (dx == -1 && dy == 0) { ox = -1; wall='plusx'; invert = true; }
    else if (dx == -1 && dy == -1) { ox = -1; oy = -1; wall = 'diaga'; invert = true; }
    else if (dx == 0 && dy == -1) { oy = -1; wall = 'plusy'; invert = true;}
    else if (dx == 1 && dy == -1) { oy = -1; wall = 'diagb'; invert = true; }

    for (let t = 0; t < len; t++) {
        let x = fx + t * dx;
        let y = fy + t * dy;
        
        let tile = mesh[x + ox][y + oy];

        if (!tile.buildings) tile.buildings = {};
        if (!tile.buildings['level' + level]) tile.buildings['level' + level] = {};
        if (!tile.buildings['level' + level].walls) tile.buildings['level' + level].walls = [];

        // Copy any non-replaced walls.
        let walls = [];
        for (let i of tile.buildings['level' + level].walls) {
            if (i.position != wall) {
                walls.push(i);
            }
        }

        let tile_type;
        if (type.endsWith('$capped')) {
            let replace = 'base';
            if (t == 0) {
                replace = 'left';
            } else if (t + 1 == len) {
                replace = 'right';
            }
            tile_type = type.replace('$capped', replace);
        } else {
            tile_type = type;
        }

        let newWall = {position: wall, type: tile_type};

        if (invert) newWall.invert = true;

        if (type != 'delete') {
            walls.push(newWall);
        }

        tile.buildings['level' + level].walls = walls;
    }
}

function drawWall(workspace, body) {
    let mesh = WORKSPACE.readMesh(workspace);

    undo.commandPerformed(workspace,{
        command: "Draw Wall",
        files: {'/mesh.json': mesh},
    })

    // body.selection
    // body.level
    // body.shape
    // body.type 'delete' or wall type

    if (body.selection.type == 'line') {
        drawWallSegment(mesh, body.level, body.type, 
            body.selection.from.x, body.selection.from.y,
            body.selection.to.x, body.selection.to.y);
    } else if (body.selection.type == 'area') {
        let s = body.selection;
        console.log(s);
        drawWallSegment(mesh, body.level, body.type,
            s.minx, s.miny, s.minx, s.maxy);
        drawWallSegment(mesh, body.level, body.type,
            s.minx, s.maxy, s.maxx, s.maxy);
        drawWallSegment(mesh, body.level, body.type,
            s.maxx, s.maxy, s.maxx, s.miny);
        drawWallSegment(mesh, body.level, body.type,
            s.maxx, s.miny, s.minx, s.miny);
    }

    WORKSPACE.writeMesh(workspace, mesh);
}

function drawRoof(workspace, body) {
    let metadata = WORKSPACE.getMetadata(workspace);
    let mesh = WORKSPACE.readMesh(workspace);

    undo.commandPerformed(workspace,{
        command: "Draw Roof",
        files: {'/mesh.json': mesh},
    })

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

    WORKSPACE.writeMesh(workspace, mesh);
}

function clearArea(workspace, body) {
    let metadata = WORKSPACE.getMetadata(workspace);
    let mesh = WORKSPACE.readMesh(workspace);

    undo.commandPerformed(workspace,{
        command: "Clear Area",
        files: {'/mesh.json': mesh},
    })

    forEachTile(metadata, mesh, body.selection, (x,y,tile) => {
        if (tile.buildings) delete tile.buildings;
        if (tile.texture1) delete tile.texture1;
        if (tile.texture2) delete tile.texture2;
    });

    WORKSPACE.writeMesh(workspace, mesh);
}

function flattenArea(workspace, body) {
    let metadata = WORKSPACE.getMetadata(workspace);
    let mesh = WORKSPACE.readMesh(workspace);

    undo.commandPerformed(workspace,{
        command: "Flatten Area",
        files: {'/mesh.json': mesh},
    })

    let sum = 0;
    let count = 0;
    forEachTile(metadata, mesh, body.selection, (x,y,tile) => {
        sum += tile.elevation;
        count++;
    });

    let newElevation = sum / count;
    forEachTile(metadata, mesh, body.selection, (x,y,tile) => {
        tile.elevation = newElevation;
    });

    WORKSPACE.writeMesh(workspace, mesh);
}

function raiseArea(workspace, body) {
    let metadata = WORKSPACE.getMetadata(workspace);
    let mesh = WORKSPACE.readMesh(workspace);
    undo.commandPerformed(workspace,{
        command: "Raise Area",
        files: {'/mesh.json': mesh},
    })
    forEachTile(metadata, mesh, body.selection, (x,y,tile) => {
        if (!tile.buildings) return;
        tile.buildings['level3'] = tile.buildings['level2'];
        tile.buildings['level2'] = tile.buildings['level1'];
        tile.buildings['level1'] = tile.buildings['level0'];
        
        if (tile.buildings['level0']) {
            delete tile.buildings['level0'];
        }
        // floor handling is wonky
        if (tile.texture1 || tile.texture2) {
            let floor = {};
            floor.texture1 = tile.texture1;
            floor.texture2 = tile.texture2;
            floor.orientation = tile.orientation;

            if (!tile.buildings['level1']) tile.buildings['level1'] = {};
            tile.buildings['level1'].floor = floor;
        }
    });
    WORKSPACE.writeMesh(workspace, mesh);
}

function lowerArea(workspace, body) {
    let metadata = WORKSPACE.getMetadata(workspace);
    let mesh = WORKSPACE.readMesh(workspace);
    undo.commandPerformed(workspace,{
        command: "Lower Area",
        files: {'/mesh.json': mesh},
    })
    forEachTile(metadata, mesh, body.selection, (x,y,tile) => {
        if (!tile.buildings) return;

        delete tile.texture1;
        delete tile.texture2;
        delete tile.buildings['level0'];

        if (tile.buildings['level1']) {
            let f = tile.buildings['level1'].floor;
            if (f) {
                tile.texture1 = f.texture1;
                tile.texture2 = f.texture2;
                tile.orientation = f.orientation;
                delete tile.buildings['level1'].floor;
            }

            tile.buildings['level0'] = tile.buildings['level1'];
        } else {
            delete tile.buildings['level0'];
        }

        tile.buildings['level1'] = tile.buildings['level2'];
        tile.buildings['level2'] = tile.buildings['level3'];
        if (tile.buildings['level3']) {
            delete tile.buildings['level3'];
        }
    });
    WORKSPACE.writeMesh(workspace, mesh);
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
    app.post('/flatten-area/:workspace', (req, res) => {
        res.send(flattenArea(req.params.workspace, req.body));
    })
    app.post('/raise-area/:workspace', (req, res) => {
        res.send(raiseArea(req.params.workspace, req.body));
    })
    app.post('/lower-area/:workspace', (req, res) => {
        res.send(lowerArea(req.params.workspace, req.body));
    })
    return app;
}
