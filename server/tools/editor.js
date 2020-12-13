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
    return { w: 10, h: 5 };
    /*if (!fs.existsSync(root_dir + workspace + '/selection.json')) {
        return false;
    }
    let selection = JSON.parse(fs.readFileSync(root_dir + workspace + '/selection.json'));
    return selection;*/
}

function cut(workspace, params) {
    
}

function copy(workspace, params) {

}

function paste(workspace, params) {
    if (!fs.existsSync(root_dir + workspace + '/selection.json')) {
        return false;
    }
    let selection = JSON.parse(fs.readFileSync(root_dir + workspace + '/selection.json'));
}

exports.init = (app) => {
    app.post('/cut/:workspace', (req, res) => {
        res.send(cut(req.params.workspace, req.body));
    })
    app.post('/copy/:workspace', (req, res) => {
        res.send(copy(req.params.workspace, req.body));
    })
    app.post('/paste/:workspace', (req, res) => {
        res.send(paste(req.params.workspace, req.body));
    })
    app.get('/selection/:workspace', (req, res) => {
        res.send(selection(req.params.workspace));
    })
    return app;
}