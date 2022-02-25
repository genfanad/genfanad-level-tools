/**
 * Tools for editing the level mesh (heightmap + colormap)
 */

var Jimp = require("jimp");
var fs = require('fs-extra');
var undo = require('./undo.js');

const { Image } = require('image-js');

var WORKSPACE = require('../workspace.js');

const EMPTY = Jimp.rgbaToInt(0,0,0,0);
const RED = Jimp.rgbaToInt(255,0,0,255);
const BLACK = Jimp.rgbaToInt(0,0,0,255);

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

function heightColorSave(workspace, min_height, max_height, bit_depth = 16) {
    let mesh = WORKSPACE.readMesh(workspace);
    let range = max_height - min_height;
    //let max_value = Math.pow(2, bit_depth);
    return (x,y) => {
        let color = EMPTY;
        let tile = mesh[x][y];
        if (tile) {
            let v = (tile.elevation - min_height) / range;
            color = [Math.floor(v * 65535), Math.floor(v * 65535), Math.floor(v * 65535), 65535];
        }
        return [color];
    }
}

function writeHeight(workspace, params) {
    let metadata = WORKSPACE.getMetadata(workspace);
    let size = metadata.wSIZE;

    let min = params.min_height || 10.0;
    let max = params.max_height || 40.0;

    WORKSPACE.writeJSON(workspace, 'height_metadata.json', {min, max});

    console.log("Writing height map", min, max);

    let file_height = WORKSPACE.getBasePath(workspace) + '/' + 'height' + '.png';
    writeImage16Bit(
        file_height, 
        size,
        size,
        heightColorSave(workspace, min, max),
        1,
        16
    );
}

async function writeImage16Bit(filename, w, h, color_func, scale = 1, bit_depth = 16) {
    fs.ensureFileSync(filename);
    let ww = w * scale;
    let hh = h * scale;

    let img = new Image(ww, hh, {bitDepth: bit_depth} );
    let empty = true;
    for (let x = 0; x < w; x++) {
        for (let y = 0; y < h; y++) {
            let colors = color_func(x,y);

            for (let xx = 0; xx < scale; xx++)
            for (let yy = 0; yy < scale; yy++) {
                let color = colors[yy * scale + xx];
                if (color == undefined) throw `Invalid color at image ${x}, ${y}; ${xx}, ${yy} (${colors})`;
                if (empty && color[3] > 0) empty = false;

                img.setPixelXY(x * scale + xx, y * scale + yy, color);
            }
        }
    }

    if (!empty) img.save(filename);
}

async function readImage16Bit(filename, w, h, callback, scale = 1, bit_depth = 16) {
    let ww = w / scale;
    let hh = h / scale;

    let image = await Image.load(filename);
    if (image.bitDepth != bit_depth) {
        throw "Invalid bit depth: " + image.bitDepth;
    }

    for (let x = 0; x < ww; x++) {
        for (let y = 0; y < hh; y++) {
            let colors = [];
            for (let yy = 0; yy < scale; yy++) {
                for (let xx = 0; xx < scale; xx++) {
                    colors.push(image.getPixelXY(x * scale + xx, y * scale + yy));
                }
            }
            callback(x/scale,y/scale, colors);
        }
    }
}

function heightColorLoad(mesh, min_height, max_height, bit_depth = 16) {
    let range = max_height - min_height;
    let max_value = bit_depth == 16 ? 65535.0 : 255.0;
    return (x,y,color) => {
        let e = Number((color[0][0] / max_value) * range) + Number(min_height);
        mesh[x][y].elevation = Number(e.toFixed(2));
    }
}

async function readHeight(workspace, params) {
    let metadata = WORKSPACE.getMetadata(workspace);
    let size = metadata.wSIZE;
    let file_height = WORKSPACE.getBasePath(workspace) + '/' + 'height' + '.png';

    let min = params.min_height || 10.0;
    let max = params.max_height || 40.0;
    console.log("Reading height map", min, max);

    let mesh = WORKSPACE.readMesh(workspace);

    undo.commandPerformed(workspace,{
        command: "Load " + file_height,
        files: {'/mesh.json': mesh},
    });

    await readImage16Bit(
        file_height,
        size, size,
        heightColorLoad(mesh, min, max, 16), 
        1,
        16
    );

    // avoid edges by copying the edge values in.
    for (let i = 0; i <= size; i++) {
        mesh[size][i].elevation = mesh[size - 1][i].elevation;
        mesh[i][size].elevation = mesh[i][size - 1].elevation;
    }

    WORKSPACE.writeMesh(workspace, mesh);
    return true;
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
        for (let x = 0; x <= size; x++) {
            for (let y = 0; y <= size; y++) {
                let rgba = Jimp.intToRGBA(image.getPixelColor(x == size ? x - 1 : x,y == size ? y - 1 : y));
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
            if (!mesh[x][y].color) mesh[x][y].color = {};
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
            mesh[x][y].draw = 'none';
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