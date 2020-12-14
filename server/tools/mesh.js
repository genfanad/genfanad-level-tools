/**
 * Tools for editing the level mesh (heightmap + colormap)
 */

var Jimp = require("jimp");
var fs = require('fs-extra');
var undo = require('./undo.js');

const root_dir = './tmp/';
const EMPTY = Jimp.rgbaToInt(0,0,0,0);

function json(content) {
    return JSON.stringify(content, null, 2);
}

function elevationToColor(e) {
    e = e || 0.0;
    let c = Math.round((e * 255.0 + 10.0) / 30.0);

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

function colorToElevation(r) {
    return (r * 30.0 - 10.0) / 255;
}

function writeImage(workspace, filename, func) {
    let metadata = JSON.parse(fs.readFileSync(root_dir + workspace + '/metadata.json'));
    let mesh = JSON.parse(fs.readFileSync(root_dir + workspace + '/mesh.json'));

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
    img.write(root_dir + workspace + '/' + filename + '.png');
    return true;
}

function writeColors(workspace) {
    writeImage(workspace, 'color', (tile) => {
        return tile.color ? 
            Jimp.rgbaToInt(tile.color.r,tile.color.g,tile.color.b,255) :
            EMPTY;
    })
}

function writeHeight(workspace) {
    writeImage(workspace, 'height', (tile) => {
        let e = elevationToColor(tile.elevation);
        return Jimp.rgbaToInt(e,e,e,255);
    })
}

async function readImage(workspace, image, func) {
    let metadata = JSON.parse(fs.readFileSync(root_dir + workspace + '/metadata.json'));
    let mesh = JSON.parse(fs.readFileSync(root_dir + workspace + '/mesh.json'));

    undo.commandPerformed(workspace,{
        command: "Load " + image,
        files: {'/mesh.json': mesh},
    })

    let filename = root_dir + workspace + '/' + image + '.png';
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

    fs.writeFileSync(root_dir + workspace + '/mesh.json', json(mesh));
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

async function readHeight(workspace) {
    await readImage(workspace, 'height', (mesh, x,y, rgba) => {
        mesh[x][y].elevation = colorToElevation(rgba.r);
    });
    return true;
}

function heightBrush(workspace, body) {
    // {"selection":{"type":"fixed-area","x":68,"y":69,"elevation":20.3137},"size":"1","step":"0.5"}

    let mesh = JSON.parse(fs.readFileSync(root_dir + workspace + '/mesh.json'));
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

    fs.writeFileSync(root_dir + workspace + '/mesh.json', json(mesh));

    return true;
}

exports.init = (app) => {
    app.get('/color/save/:workspace', (req, res) => {
        res.send(writeColors(req.params.workspace));
    })
    app.get('/color/load/:workspace', async (req, res) => {
        res.send(await readColors(req.params.workspace));
    })
    app.get('/height/save/:workspace', (req, res) => {
        res.send(writeHeight(req.params.workspace));
    })
    app.get('/height/load/:workspace', async (req, res) => {
        res.send(await readHeight(req.params.workspace));
    })
    app.post('/height/brush/:workspace', (req, res) => {
        res.send(heightBrush(req.params.workspace, req.body));
    })
    return app;
}