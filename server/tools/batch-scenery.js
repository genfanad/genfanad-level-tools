/**
 * Tools for editing larger swaths of scenery at the same time.
 */

var Jimp = require("jimp");
var fs = require('fs-extra');

const root_dir = './tmp/';
const EMPTY = Jimp.rgbaToInt(0,0,0,0);
const WHITE = Jimp.rgbaToInt(255,255,255,255);

function json(content) {
    return JSON.stringify(content, null, 2);
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

async function readImage(workspace, image) {
    let filename = root_dir + workspace + '/' + image + '.png';

    let colors = {};
    if (fs.existsSync(filename)) {
        console.log('reading ' + filename);
        let buffer = fs.readFileSync(filename);
        let image = await new Jimp(buffer, (err, image) => {});

        for (let x = 0; x < image.bitmap.width; x++) {
            for (let y = 0; y < image.bitmap.height; y++) {
                colors[KEY(x,y)] = Jimp.intToRGBA(image.getPixelColor(x,y));
            }
        }
    }

    return colors;
}

function KEY(x,y) { return x + ',' + y }

function scenerySave(workspace, body) {
    
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
            case 'tint-save':
                res.send(tintSave(workspace, body));
                return;
            case 'tint-load':
                res.send(await tintLoad(workspace, body));
                return;
            default:
                throw "Invalid batch verb: " + verb;
        }
    })
    return app;
}