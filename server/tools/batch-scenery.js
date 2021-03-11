/**
 * Tools for editing larger swaths of scenery at the same time.
 */

var Jimp = require("jimp");
var fs = require('fs-extra');
var undo = require('./undo.js');

var WORKSPACE = require('../workspace.js');

const EMPTY = Jimp.rgbaToInt(0,0,0,0);
const WHITE = Jimp.rgbaToInt(255,255,255,255);

// Color map to make more readable image serializations
var COLORS = [
    Jimp.rgbaToInt(0,0,0,0),

    Jimp.rgbaToInt(0,0,0,255),
    Jimp.rgbaToInt(255,255,255,255),
];

const lightness = [50,70,30,60,80,40];
function generateColors() {
    for (let s = 90; s > 10; s -= 10) {
        for (let l = 0; l < lightness.length; l++) {
            for (let hue = 0; hue < 360; hue += 15) {
                let color = "hsl(" + hue + ", " + s + "%, " + lightness[l] + "%)";
                let hex = Jimp.cssColorToHex(color);
                COLORS.push(hex);
            }
        }
    }
}
generateColors();

function randInt(max) {
    return Math.floor(Math.random() * max);
}

// TODO: Factor this into a common library rather than copying in mesh.js and here
function writeImage(workspace, filename, func) {
    let metadata = WORKSPACE.getMetadata(workspace);

    let size = metadata.wSIZE;

    let img = new Jimp(size, size);
    for (let x = 0; x < size; x++) {
        for (let y = 0; y < size; y++) {
            let color = func(x,y)
            img.setPixelColor(
                color,
                x, y);
        }
    }
    img.write(WORKSPACE.getBasePath(workspace) + filename + '.png');
    return true;
}

async function readImage(workspace, image, rawPixels = false) {
    let filename = WORKSPACE.getBasePath(workspace) + image + '.png';

    let colors = {};
    if (fs.existsSync(filename)) {
        console.log('reading ' + filename);
        let buffer = fs.readFileSync(filename);
        let image = await new Jimp(buffer, (err, image) => {});

        for (let x = 0; x < image.bitmap.width; x++) {
            for (let y = 0; y < image.bitmap.height; y++) {
                if (!rawPixels) {
                    colors[KEY(x,y)] = Jimp.intToRGBA(image.getPixelColor(x,y));
                } else {
                    colors[KEY(x,y)] = image.getPixelColor(x,y);
                }
            }
        }
    }

    return colors;
}

function KEY(x,y) { return x + ',' + y }

function scenerySave(workspace, body) {
    let objects = WORKSPACE.readJSON(workspace, 'objects.json');

    // index objects by x/y and filter out non-matching
    let indexed_objects = {};
    for (let i in objects) {
        if (!objects[i].object.startsWith(body.prefix)) continue;
        indexed_objects[ KEY(objects[i].x,objects[i].y) ] = objects[i];
    }

    let nextIndex = 1;
    let metadata = {
        lookup: {

        },
        reverse_lookup: {

        }
    };

    writeImage(workspace, 'batch-scenery', (x,y) => {
        let o = indexed_objects[ KEY(x,y) ];
        if (o) {
            let color = metadata.lookup[o.object];
            if (!color) {
                color = COLORS[nextIndex++];
                metadata.lookup[o.object] = color;
                metadata.reverse_lookup[color] = o.object;
            }
            return color;
        }
        return COLORS[0];
    })

    WORKSPACE.writeJSON(workspace, 'batch-scenery.json', metadata);
    return true;
}

async function sceneryLoad(workspace, body) {
    let objects = WORKSPACE.readJSON(workspace, 'objects.json');
    let metadata = WORKSPACE.getMetadata(workspace);

    let batch_metadata = WORKSPACE.readJSON(workspace, 'batch-scenery.json');
    let modded_objects = await readImage(workspace, 'batch-scenery', true);

    undo.commandPerformed(workspace,{
        command: "Batch Scenery",
        files: {'/objects.json': objects},
    })

    let indexed_objects = {};
    let original_keys = {};
    for (let i in objects) {
        if (!objects[i].object.startsWith(body.prefix)) continue;
        indexed_objects[ KEY(objects[i].x,objects[i].y) ] = objects[i];
        original_keys[KEY(objects[i].x,objects[i].y)] = i;
    }

    let size = metadata.wSIZE;
    for (let x = 0; x < size; x++) {
        for (let y = 0; y < size; y++) {
            let c = modded_objects[ KEY(x,y) ];

            let lookup = batch_metadata.reverse_lookup[c];
            let existing = indexed_objects[ KEY(x,y) ];

            // Hack: Bright blue pixels turn into random trees.
            if (c == Jimp.rgbaToInt(0,0,255,255)) {
                let r = Math.floor(Math.random() * 9) + 1;
                lookup = 'skill-tree-regular' + r;
            }

            if (!lookup && existing) {
                delete objects[ original_keys[KEY(x,y)] ];
            } else if (!existing && lookup) {
                let gx = x + Number(metadata.MIN_X), gy = y + Number(metadata.MIN_Y);
                objects[KEY(x,y)] = {
                    object: lookup,
                    x: x, y: y,
                    gx: gx, gy: gy,
                }
        } else if (existing && lookup && existing.object != lookup) {
                objects[ original_keys[KEY(x,y)] ].object = lookup;
            }
        }
    }

    WORKSPACE.writeJSON(workspace, 'objects.json', objects);
    return true;
}

function tintSave(workspace, body) {
    let objects = WORKSPACE.readJSON(workspace, 'objects.json');

    // index objects by x/y
    let indexed_objects = {};
    for (let i in objects) {
        if (!objects[i].object.startsWith(body.prefix)) continue;
        indexed_objects[ KEY(objects[i].x,objects[i].y) ] = objects[i];
    }

    writeImage(workspace, 'tints', (x,y) => {
        let o = indexed_objects[ KEY(x,y) ];
        if (o && o.tint) {
            return Jimp.rgbaToInt(o.tint.r, o.tint.g, o.tint.b, 255);
        }
        return WHITE;
    })

    return true;
}

async function tintLoad(workspace, body) {
    let objects = WORKSPACE.readJSON(workspace, 'objects.json');

    undo.commandPerformed(workspace,{
        command: "Batch Tint",
        files: {'/objects.json': objects},
    })

    let tints = await readImage(workspace, 'tints');

    for (let i in objects) {
        let o = objects[i];
        if (!o.object.startsWith(body.prefix)) continue;

        let tint = tints[KEY(o.x,o.y)];
        if (tint.r == 255 && tint.g == 255 && tint.b == 255) {
            delete o.tint;
        } else {
            o.tint = { r: tint.r, g: tint.g, b: tint.b };
        }
    }

    WORKSPACE.writeJSON(workspace, 'objects.json', objects);
    return true;
}

function rotateRandomly(workspace, body) {
    let objects = WORKSPACE.readJSON(workspace, 'objects.json');

    undo.commandPerformed(workspace,{
        command: "Rotate Randomly",
        files: {'/objects.json': objects},
    })

    for (let i in objects) {
        let o = objects[i];
        if (!o.object.startsWith(body.prefix)) continue;

        let r = randInt(4) * 90;
        if (r) {
            o.rotation = r;
        } else {
            delete o.rotation;
        }
    }

    WORKSPACE.writeJSON(workspace, 'objects.json', objects)
    return true;
}

function generateLargeColorMap(workspace, mesh, metadata) {
    let size = metadata.wSIZE;
    
    let img = new Jimp(size * 16, size * 16);
    for (let x = 0; x < size; x++) {
        for (let y = 0; y < size; y++) {
            let tile = mesh[x][y];
            let color = tile.color ? 
                Jimp.rgbaToInt(tile.color.r,tile.color.g,tile.color.b,255) :
                EMPTY;
            for (let xx = 0; xx < 16; xx++)
            for (let yy = 0; yy < 16; yy++)
                img.setPixelColor(
                    color,
                    x * 16 + xx, y * 16 + yy);
        }
    }
    img.write(WORKSPACE.getBasePath(workspace) + 'color-large' + '.png');
}

function groundSave(workspace, body) {
    let metadata = WORKSPACE.getMetadata(workspace);
    let mesh = WORKSPACE.readJSON(workspace, 'mesh.json');

    // generate the background for the tiled map
    generateLargeColorMap(workspace, mesh, metadata);

    // copy the tilesets
    fs.copyFileSync('./tiled/ground-tileset.png', WORKSPACE.getBasePath(workspace) + '/ground-tileset.png');
    fs.copyFileSync('./tiled/ground-tileset.json', WORKSPACE.getBasePath(workspace) + '/ground-tileset.json');

    let size = metadata.wSIZE;

    let exported = {
            "type":"tilelayer",
            "height":size, "width":size,
            "id": 1,
            "name":'Exported Tiles',
            "opacity":1, "visible": true,
            "x":0, "y":0,
            data: []
        }

    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        let id = 0;

        let tile = mesh[x][y];
        let a = tile.texture1 == body.floor;
        let b = tile.texture2 == body.floor;

        if (a && b) id = 1;
        else if (tile.orientation == 'diagb') {
            if (a) id = 2;
            if (b) id = 5;
        } else {
            if (a) id = 4;
            if (b) id = 3;
        }

        exported.data.push(id);
    }

    let tiled = {
        type: "map", version: "1.2",

        infinite: false,
        width: size, height: size,
        tileheight: 16, tilewidth: 16,

        nextlayerid: 2, nextobjectid: 0,

        orientation: "orthogonal",
        properties:[],
        renderorder: "right-down",
        tiledversion: "2020.04.10",

        tilesets: [
            { "firstgid":1,"source":"ground-tileset.json"},
        ],
        layers: [{
            "image":'color-large.png', "name":'background',
            "type":"imagelayer", 
            "opacity":1, "visible":true, 
            "x":0, "y":0 
        }, exported],
    };

    WORKSPACE.writeJSON(workspace, 'batch-ground.json', tiled);

    return true;
}

function groundLoad(workspace, body) {
    let metadata = WORKSPACE.getMetadata(workspace);
    let mesh = WORKSPACE.readJSON(workspace, 'mesh.json');

    undo.commandPerformed(workspace,{
        command: "Batch Edit Floor",
        files: {'/mesh.json': mesh},
    })

    let map = WORKSPACE.readJSON(workspace, 'batch-ground.json');

    let size = metadata.wSIZE;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        let tile = mesh[x][y];

        // TODO: Fragile
        let input = map.layers[1].data[y * size + x];

        if (tile.texture1 == body.floor) delete tile.texture1;
        if (tile.texture2 == body.floor) delete tile.texture1;

        if (input == 1) {
            tile.texture1 = body.floor;
            tile.texture2 = body.floor;
        } else if (input == 2) {
            tile.orientation = 'diagb';
            tile.texture1 = body.floor;
        } else if (input == 3) {
            tile.orientation = 'diaga';
            tile.texture2 = body.floor;
        } else if (input == 4) {
            tile.orientation = 'diaga';
            tile.texture1 = body.floor;
        } else if (input == 5) {
            tile.orientation = 'diagb';
            tile.texture2 = body.floor;
        }
    }

    WORKSPACE.writeJSON(workspace, 'mesh.json', mesh);
    return true;
}

exports.init = (app) => {
    app.post('/:verb/:workspace', async (req, res) => {
        let workspace = req.params.workspace;
        let verb = req.params.verb;
        let body = req.body;
        //console.log(JSON.stringify(req.body));

        switch (verb) {
            case 'scenery-save':
                res.send(scenerySave(workspace, body));
                return;
            case 'scenery-load':
                res.send(await sceneryLoad(workspace, body));
                return;
            case 'tint-save':
                res.send(tintSave(workspace, body));
                return;
            case 'tint-load':
                res.send(await tintLoad(workspace, body));
                return;
            case 'rotate-randomly':
                res.send(rotateRandomly(workspace, body));
                return;
            case 'ground-save': 
                res.send(groundSave(workspace, body));
                return;
            case 'ground-load':
                res.send(groundLoad(workspace, body));
                return;
            default:
                throw "Invalid batch verb: " + verb;
        }
    })
    return app;
}