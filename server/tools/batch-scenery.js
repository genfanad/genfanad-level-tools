/**
 * Tools for editing larger swaths of scenery at the same time.
 */

var Jimp = require("jimp");
var fs = require('fs-extra');

const root_dir = './tmp/';
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

function json(content) {
    return JSON.stringify(content, null, 2);
}

function randInt(max) {
    return Math.floor(Math.random() * max);
}

// TODO: Factor this into a common library rather than copying in mesh.js and here
function writeImage(workspace, filename, func) {
    let metadata = JSON.parse(fs.readFileSync(root_dir + workspace + '/metadata.json'));

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
    img.write(root_dir + workspace + '/' + filename + '.png');
    return true;
}

async function readImage(workspace, image, rawPixels = false) {
    let filename = root_dir + workspace + '/' + image + '.png';

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
    let objects = JSON.parse(fs.readFileSync(root_dir + workspace + '/objects.json'));

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

    fs.writeFileSync(root_dir + workspace + '/batch-scenery.json', json(metadata));
    return true;
}

async function sceneryLoad(workspace, body) {
    let objects = JSON.parse(fs.readFileSync(root_dir + workspace + '/objects.json'));
    let metadata = JSON.parse(fs.readFileSync(root_dir + workspace + '/metadata.json'));

    let batch_metadata = JSON.parse(fs.readFileSync(root_dir + workspace + '/batch-scenery.json'));
    let modded_objects = await readImage(workspace, 'batch-scenery', true);

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

    fs.writeFileSync(root_dir + workspace + '/objects.json', json(objects));
    return true;
}

function tintSave(workspace, body) {
    let objects = JSON.parse(fs.readFileSync(root_dir + workspace + '/objects.json'));

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
    let objects = JSON.parse(fs.readFileSync(root_dir + workspace + '/objects.json'));

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

    fs.writeFileSync(root_dir + workspace + '/objects.json', json(objects));
    return true;
}

function rotateRandomly(workspace, body) {
    let objects = JSON.parse(fs.readFileSync(root_dir + workspace + '/objects.json'));

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

    fs.writeFileSync(root_dir + workspace + '/objects.json', json(objects));
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
            default:
                throw "Invalid batch verb: " + verb;
        }
    })
    return app;
}