/**
 * General purpose tools (cut/copy/paste)
 */
var fs = require('fs-extra');
var undo = require('./undo.js');

const root_dir = './tmp/';

function json(content) {
    return JSON.stringify(content, null, 2);
}

function selection(workspace, params) {
    if (!fs.existsSync(root_dir + workspace + '/selection.json')) {
        return false;
    }
    let selection = JSON.parse(fs.readFileSync(root_dir + workspace + '/selection.json'));
    return selection;
}

function saveSelection(workspace, params) {
    let old_selection = {};
    if (fs.existsSync(root_dir + workspace + '/selection.json')) {
        old_selection = JSON.parse(fs.readFileSync(root_dir + workspace + '/selection.json'));
    }
    undo.commandPerformed(workspace,{
        command: "Load from clipboard",
        files: {
            '/selection.json': old_selection
        },
    })

    let selection = params.selection;
    if (!selection || !selection.mesh) return;

    fs.writeFileSync(root_dir + workspace + '/selection.json', json(selection));
}

function KEY(x,y) { return x + ',' + y }

function copy(workspace, params, remove_existing = false) {
    let mesh = JSON.parse(fs.readFileSync(root_dir + workspace + '/mesh.json'));
    let objects = JSON.parse(fs.readFileSync(root_dir + workspace + '/objects.json'));
    let old_selection = {};
    if (fs.existsSync(root_dir + workspace + '/selection.json')) {
        old_selection = JSON.parse(fs.readFileSync(root_dir + workspace + '/selection.json'));
    }

    undo.commandPerformed(workspace,{
        command: remove_existing ? 'Cut Area' : 'Copy Area',
        files: {
            '/mesh.json': mesh,
            '/objects.json': objects,
            '/selection.json': old_selection
        },
    })

    let selection = {
        mesh: []
    };

    selection.w = params.selection.maxx - params.selection.minx;
    selection.h = params.selection.maxy - params.selection.miny;

    let minx = params.selection.minx;
    let miny = params.selection.miny;

    let indexed_objects = {};
    let original_keys = {};
    for (let i in objects) {
        indexed_objects[ KEY(objects[i].x,objects[i].y) ] = objects[i];
        original_keys[KEY(objects[i].x,objects[i].y)] = i;
    }

    for (let x = 0; x < selection.w; x++) {
        let row = [];
        for (let y = 0; y < selection.h; y++) {
            let contents = {};
            let tile = mesh[x + minx][y + miny];
            if (params.layers['color']) {
                contents.color = tile.color;
                if (remove_existing) tile.color = { r: 255, g: 255, b: 255};
            }
            if (params.layers['height']) {
                contents.elevation = tile.elevation;
                if (remove_existing) tile.elevation = 0;
            }
            if (params.layers['buildings']) {
                contents.texture1 = tile.texture1;
                contents.texture2 = tile.texture2;
                contents.buildings = tile.buildings;

                if (remove_existing) {
                    delete tile.texture1;
                    delete tile.texture2;
                    delete tile.buildings;
                }
            }
            if (params.layers['scenery']) {
                let key = KEY(x + minx, y + miny);
                if (indexed_objects[key]) {
                    let o = indexed_objects[key];
                    if (remove_existing) {
                        delete objects[original_keys[key]];
                    }

                    o.x = x;
                    o.y = y;
                    o.gx = x;
                    o.gy = y;

                    contents.object = o;
                }
            }

            row.push(contents);
        }
        selection.mesh.push(row);
    }

    if (remove_existing) {
        fs.writeFileSync(root_dir + workspace + '/objects.json', json(objects));
        fs.writeFileSync(root_dir + workspace + '/mesh.json', json(mesh));
    }

    fs.writeFileSync(root_dir + workspace + '/selection.json', json(selection));
}

function paste(workspace, params) {
    if (!fs.existsSync(root_dir + workspace + '/selection.json')) {
        return false;
    }
    let selection = JSON.parse(fs.readFileSync(root_dir + workspace + '/selection.json'));

    let mesh = JSON.parse(fs.readFileSync(root_dir + workspace + '/mesh.json'));
    let objects = JSON.parse(fs.readFileSync(root_dir + workspace + '/objects.json'));

    undo.commandPerformed(workspace,{
        command: 'Paste Area',
        files: {
            '/mesh.json': mesh,
            '/objects.json': objects,
        },
    })

    let minx = params.selection.x;
    let miny = params.selection.y;

    for (let x = 0; x < selection.w; x++) {
        for (let y = 0; y < selection.h; y++) {
            let sel = selection.mesh[x][y];
            let tile = mesh[x + minx][y + miny];
            if (params.layers['color'] && sel.color) {
                tile.color = sel.color;
            }
            if (params.layers['height'] && sel.elevation) {
                tile.elevation = sel.elevation;
            }
            if (params.layers['buildings']) {
                if (sel.texture1) tile.texture1 = sel.texture1; else delete tile.texture1;
                if (sel.texture2) tile.texture2 = sel.texture2; else delete tile.texture2;
                if (sel.buildings) tile.buildings = sel.buildings; else delete tile.buildings;
            }
            if (params.layers['scenery']) {
                let key = KEY(x + minx,y + miny);
                if (objects[key]) {
                    delete objects[key];
                }
                if (sel.object) {
                    let no = sel.object;
                    no.x = x + minx;
                    no.y = y + miny;
                    no.gx = no.x;
                    no.gy = no.gy;
                    objects[key] = no;
                }
            }
        }
    }

    fs.writeFileSync(root_dir + workspace + '/objects.json', json(objects));
    fs.writeFileSync(root_dir + workspace + '/mesh.json', json(mesh));
}

exports.init = (app) => {
    app.post('/cut/:workspace', (req, res) => {
        res.send(copy(req.params.workspace, req.body, true));
    })
    app.post('/copy/:workspace', (req, res) => {
        res.send(copy(req.params.workspace, req.body, false));
    })
    app.post('/paste/:workspace', (req, res) => {
        res.send(paste(req.params.workspace, req.body));
    })
    app.get('/selection/:workspace', (req, res) => {
        res.send(selection(req.params.workspace));
    })
    app.post('/selection/:workspace', (req, res) => {
        res.send(saveSelection(req.params.workspace, req.body));
    })
    return app;
}