/**
 * Tools for editing the level mesh (heightmap + colormap)
 */

var Jimp = require("jimp");
var fs = require('fs-extra');

const root_dir = './tmp/';
const EMPTY = Jimp.rgbaToInt(0,0,0,0);

function json(content) {
    return JSON.stringify(content, null, 2);
}

function writeColors(workspace) {
    let metadata = JSON.parse(fs.readFileSync(root_dir + workspace + '/metadata.json'));
    let mesh = JSON.parse(fs.readFileSync(root_dir + workspace + '/mesh.json'));

    let size = metadata.wSIZE;

    let img = new Jimp(size, size);
    for (let x = 0; x < size; x++) {
        for (let y = 0; y < size; y++) {
            let tile = mesh[x][y];

            let color = tile.color ? 
                Jimp.rgbaToInt(tile.color.r,tile.color.g,tile.color.b,255) :
                EMPTY;
            img.setPixelColor(
                color,
                x, y);
        }
    }
    img.write(root_dir + workspace + '/color.png');
    return true;
}

async function readColors(workspace) {
    let metadata = JSON.parse(fs.readFileSync(root_dir + workspace + '/metadata.json'));
    let mesh = JSON.parse(fs.readFileSync(root_dir + workspace + '/mesh.json'));

    let filename = root_dir + workspace + '/color.png';
    if (fs.existsSync(filename)) {
        let buffer = fs.readFileSync(filename);
        let image = await new Jimp(buffer, (err, image) => {});

        let size = metadata.wSIZE;

        let img = new Jimp(size, size);
        for (let x = 0; x < size; x++) {
            for (let y = 0; y < size; y++) {
                let rgba = Jimp.intToRGBA(image.getPixelColor(x,y));
                
                if (rgba.a == 0) {
                    mesh[x][y].draw = false;
                } else {
                    mesh[x][y].color.r = rgba.r;
                    mesh[x][y].color.g = rgba.g;
                    mesh[x][y].color.b = rgba.b;
                }
            }
        }
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
    return app;
}