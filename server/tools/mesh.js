/**
 * Tools for editing the level mesh (heightmap + colormap)
 */

var Jimp = require("jimp");
var fs = require('fs-extra');
var undo = require('./undo.js');

var WORKSPACE = require('../workspace.js');

const EMPTY = Jimp.rgbaToInt(0,0,0,0);
const RED = Jimp.rgbaToInt(255,0,0,255);
const BLACK = Jimp.rgbaToInt(0,0,0,255);

function elevationToColor(e, params) {
    let min = -10.0;
    if (params.hasOwnProperty('low') && params.low != '') min = Number(params.low);
    let max = 30.0;
    if (params.hasOwnProperty('high') && params.high != '') max = Number(params.high);

    let w = max - min;
    let p = ((e || 0.0) - min) / w;
    let c = Math.round(p * 255.0);

    if (c < 0) {
        console.log("Elevation out of bound: " + e)
        c = 0;
    }
    if (c > 255) {
        console.log("Elevation out of bound: " + e);
        c = 255;
    }
    return c;
}

function colorToElevation(r, params) {
    let min = -10.0;
    if (params.hasOwnProperty('low') && params.low != '') min = Number(params.low);
    let max = 30.0;
    if (params.hasOwnProperty('high') && params.high != '') max = Number(params.high);

    let w = max - min;
    let e = Number((r / 255.0) * w) + Number(min);

    return Number(e.toFixed(2));
}

function writeImage(workspace, filename, func) {
    let metadata = WORKSPACE.getMetadata(workspace);
    let mesh = WORKSPACE.readMesh(workspace);

    let size = metadata.wSIZE;

    let img = new Jimp(size, size);
    for (let x = 0; x < size; x++) {
        for (let y = 0; y < size; y++) {
            let color = func(mesh[x][y])
            img.setPixelColor(
                color,
                x, y);
        }
    }
    img.write(WORKSPACE.getBasePath(workspace) + '/' + filename + '.png');
    return true;
}

function writeColors(workspace) {
    writeImage(workspace, 'color', (tile) => {
        return tile.color ? 
            Jimp.rgbaToInt(tile.color.r,tile.color.g,tile.color.b,255) :
            EMPTY;
    })
}

function writeHeight(workspace, params) {

    let min = -10.0;
    if (params.hasOwnProperty('low') && params.low != '') min = Number(params.low);
    let max = 30.0;
    if (params.hasOwnProperty('high') && params.high != '') max = Number(params.high);

    WORKSPACE.writeJSON(workspace, 'height_metadata.json', {min, max});

    writeImage(workspace, 'height', (tile) => {
        let e = elevationToColor(tile.elevation, params);
        return Jimp.rgbaToInt(e,e,e,255);
    })
}

function writeBlendMask(workspace, params) {
    writeImage(workspace, 'blend_mask', (tile) => {
        return tile.blend_colors ? RED : BLACK;
    })
}

function writeCollisionMask(workspace, params) {
    writeImage(workspace, 'collision_mask', (tile) => {
        return tile.walkabilityOverriden ? RED : BLACK;
    })
}

function writeRenderMask(workspace, params) {
    writeImage(workspace, 'render_mask', (tile) => {
        return tile.draw == 'none' ? RED : BLACK;
    })
}

function writeOrientation(workspace, params) {
    writeImage(workspace, 'orientation', (tile) => {
        return tile.orientation == 'diaga' ? RED : BLACK;
    })
}

async function readImage(workspace, image, func) {
    let metadata = WORKSPACE.getMetadata(workspace);
    let mesh = WORKSPACE.readMesh(workspace);

    undo.commandPerformed(workspace,{
        command: "Load " + image,
        files: {'/mesh.json': mesh},
    })

    let filename = WORKSPACE.getBasePath(workspace) + '/' + image + '.png';
    if (fs.existsSync(filename)) {
        console.log('reading ' + filename);
        let buffer = fs.readFileSync(filename);
        let image = await new Jimp(buffer, (err, image) => {});

        let size = metadata.wSIZE;

        let img = new Jimp(size, size);
        for (let x = 0; x < size; x++) {
            for (let y = 0; y < size; y++) {
                let rgba = Jimp.intToRGBA(image.getPixelColor(x,y));
                func(mesh, x, y, rgba);
            }
        }
    }

    WORKSPACE.writeMesh(workspace, mesh);
    return true;
}

async function readColors(workspace) {
    await readImage(workspace, 'color', (mesh, x, y, rgba) => {
        if (rgba.a == 0) {
            mesh[x][y].draw = false;
        } else {
            mesh[x][y].color.r = rgba.r;
            mesh[x][y].color.g = rgba.g;
            mesh[x][y].color.b = rgba.b;
        }
    });
    return true;
}

function clearMesh(workspace) {
    try {
        let old_mesh = WORKSPACE.readMesh(workspace);
        undo.commandPerformed(workspace,{
            command: "Clear Mesh",
            files: {'/mesh.json': old_mesh},
        })
    } catch (e) {

    }
    
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
    WORKSPACE.writeMesh(workspace, mesh);
}

async function readHeight(workspace, params) {
    await readImage(workspace, 'height', (mesh, x,y, rgba) => {
        mesh[x][y].elevation = colorToElevation(rgba.r, params);
    });
    return true;
}

async function readBlendMask(workspace, params) {
    await readImage(workspace, 'blend_mask', (mesh, x,y, rgba) => {
        if (rgba.r > 127) {
            mesh[x][y].blend_colors = true;
        } else {
            delete mesh[x][y].blend_colors;
        }
    });
    return true;
}

async function readCollisionMask(workspace, params) {
    await readImage(workspace, 'collision_mask', (mesh, x,y, rgba) => {
        if (rgba.r > 127) {
            mesh[x][y].walkabilityOverriden = true;
        } else {
            delete mesh[x][y].walkabilityOverriden;
        }
    });
    return true;
}

async function readRenderMask(workspace, params) {
    await readImage(workspace, 'render_mask', (mesh, x,y, rgba) => {
        if (rgba.r > 127) {
            mesh[x][y].draw = none;
        } else {
            delete mesh[x][y].draw;
        }
    });
    return true;
}

async function readOrientation(workspace, params) {
    await readImage(workspace, 'orientation', (mesh, x,y, rgba) => {
        if (rgba.r > 127) {
            mesh[x][y].orientation = 'diaga';
        } else {
            mesh[x][y].orientation = 'diagb';
        }
    });
    return true;
}

function toggleBlendMask(workspace, body) {
    let mesh = WORKSPACE.readMesh(workspace);

    // This eats too much memory in the log.
    // TODO: Only use which tile was toggled.
    /*undo.commandPerformed(workspace,{
        command: "Toggle Walkability",
        files: {'/mesh.json': mesh},
    })*/

    let x = body.x, y = body.y;

    if (mesh[x][y].blend_colors) {
        delete mesh[x][y].blend_colors;
    } else {
        mesh[x][y].blend_colors = true;
    }

    WORKSPACE.writeMesh(workspace, mesh);
    return true;
}

function toggleCollisionMask(workspace, body) {
    let mesh = WORKSPACE.readMesh(workspace);

    // This eats too much memory in the log.
    // TODO: Only use which tile was toggled.
    /*undo.commandPerformed(workspace,{
        command: "Toggle Walkability",
        files: {'/mesh.json': mesh},
    })*/

    let x = body.x, y = body.y;

    if (mesh[x][y].walkabilityOverriden) {
        delete mesh[x][y].walkabilityOverriden;
    } else {
        mesh[x][y].walkabilityOverriden = true;
    }

    WORKSPACE.writeMesh(workspace, mesh);
    return true;
}

function toggleRenderMask(workspace, body) {
    let mesh = WORKSPACE.readMesh(workspace);

    // This eats too much memory in the log.
    // TODO: Only use which tile was toggled.
    /*undo.commandPerformed(workspace,{
        command: "Toggle Walkability",
        files: {'/mesh.json': mesh},
    })*/

    let x = body.x, y = body.y;

    if (mesh[x][y].draw == 'none') {
        delete mesh[x][y].draw;
    } else {
        mesh[x][y].draw = 'none';
    }

    WORKSPACE.writeMesh(workspace, mesh);
    return true;
}

function toggleOrientation(workspace, body) {
    let mesh = WORKSPACE.readMesh(workspace);

    // This eats too much memory in the log.
    // TODO: Only use which tile was toggled.
    /*undo.commandPerformed(workspace,{
        command: "Toggle Walkability",
        files: {'/mesh.json': mesh},
    })*/

    let x = body.x, y = body.y;

    if (mesh[x][y].orientation == 'diaga') {
        mesh[x][y].orientation = 'diagb';
    } else {
        mesh[x][y].orientation = 'diaga';
    }

    WORKSPACE.writeMesh(workspace, mesh);
    return true;
}

function heightBrush(workspace, body) {
    // {"selection":{"type":"fixed-area","x":68,"y":69,"elevation":20.3137},"size":"1","step":"0.5"}

    let mesh = WORKSPACE.readMesh(workspace);
    undo.commandPerformed(workspace,{
        command: "Height Brush",
        files: {'/mesh.json': mesh},
    })

    // Generate the brush
    /*let center = body.size / 2.0;
    let radius = Math.round(body.size / 2.0);
    let brush = [];
    for (let i = 0; i < body.size; i++) {
        let row = [];
        for (let j = 0; j < body.size; j++) {
            let percent = 1.0 - Math.sqrt((center - i) * (center - i) + (center - j) * (center - j)) / radius;
            let max = Math.max(0,percent);
            row.push(max.toFixed(2));
        }
        brush.push(row);
    }*/

    let center_x = body.selection.x;
    let center_y = body.selection.y;

    let n = Math.floor(body.size / 2.0);
    for (let xd = 0; xd < body.size; xd++)
    for (let yd = 0; yd < body.size; yd++) {
        let x = center_x + xd - n;
        let y = center_y + yd - n;
        if (!mesh[x] || !mesh[x][y]) continue;

        let percent = 1.0 - Math.sqrt((x - center_x) * (x - center_x) + (y - center_y) * (y - center_y)) / n;
        if (percent < 0) continue;

        let change = Number(body.step) * percent;

        let e = Number(mesh[x][y].elevation) + change;

        if (body.max && e > body.max) e = body.max;
        if (body.min && e < body.min) e = body.min;

        mesh[x][y].elevation = e;
    }

    WORKSPACE.writeMesh(workspace, mesh);

    return true;
}

exports.init = (app) => {
    app.get('/clear/:workspace', (req, res) => {
        res.send(clearMesh(req.params.workspace));
    })

    app.get('/color/save/:workspace', (req, res) => {
        res.send(writeColors(req.params.workspace));
    })
    app.get('/color/load/:workspace', async (req, res) => {
        res.send(await readColors(req.params.workspace));
    })
    app.get('/blend_mask/save/:workspace', (req, res) => {
        res.send(writeBlendMask(req.params.workspace));
    })
    app.get('/blend_mask/load/:workspace', async (req, res) => {
        res.send(await readBlendMask(req.params.workspace));
    })
    app.post('/blend_mask/toggle/:workspace', (req, res) => {
        res.send(toggleBlendMask(req.params.workspace, req.body));
    })

    app.get('/render_mask/save/:workspace', (req, res) => {
        res.send(writeRenderMask(req.params.workspace));
    })
    app.get('/render_mask/load/:workspace', async (req, res) => {
        res.send(await readRenderMask(req.params.workspace));
    })
    app.post('/render_mask/toggle/:workspace', (req, res) => {
        res.send(toggleRenderMask(req.params.workspace, req.body));
    })

    app.get('/orientation/save/:workspace', (req, res) => {
        res.send(writeOrientation(req.params.workspace));
    })
    app.get('/orientation/load/:workspace', async (req, res) => {
        res.send(await readOrientation(req.params.workspace));
    })
    app.post('/orientation/toggle/:workspace', (req, res) => {
        res.send(toggleOrientation(req.params.workspace, req.body));
    })

    app.get('/collision_mask/save/:workspace', (req, res) => {
        res.send(writeCollisionMask(req.params.workspace));
    })
    app.get('/collision_mask/load/:workspace', async (req, res) => {
        res.send(await readCollisionMask(req.params.workspace));
    })
    app.post('/collision_mask/toggle/:workspace', (req, res) => {
        res.send(toggleCollisionMask(req.params.workspace, req.body));
    })

    app.post('/height/save/:workspace', (req, res) => {
        res.send(writeHeight(req.params.workspace, req.body));
    })
    app.post('/height/load/:workspace', async (req, res) => {
        res.send(await readHeight(req.params.workspace, req.body));
    })
    app.post('/height/brush/:workspace', (req, res) => {
        res.send(heightBrush(req.params.workspace, req.body));
    })
    return app;
}