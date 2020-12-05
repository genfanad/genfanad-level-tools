/**
 * Implements undo and redo.
 */

var fs = require('fs-extra');

const root_dir = './tmp/';
const UNDO_HISTORY = 5;

function json(content) {
    return JSON.stringify(content, null, 2);
}

function performUndo(workspace) {
    let log = { undo: [], redo: []};
    if (fs.existsSync(root_dir + workspace + '/log.json')) {
        log = JSON.parse(fs.readFileSync(root_dir + workspace + '/log.json'));
    }

    if (log.undo.length == 0) {
        return false;
    }

    let command = log.undo.pop();
    let invert = {
        command: command.command,
        files: {}
    }
    console.log("Undoing " + command.command);
    for (let i in command.files) {
        invert.files[i] = JSON.parse(fs.readFileSync(root_dir + workspace + i));
        fs.writeFileSync(root_dir + workspace + i, json(command.files[i]));
    }

    if (log.redo.length > UNDO_HISTORY) log.redo.shift();
    log.redo.push(invert);

    fs.writeFileSync(root_dir + workspace + '/log.json', json(log));
    return true;
}

function performRedo(workspace) {
    let log = { undo: [], redo: []};
    if (fs.existsSync(root_dir + workspace + '/log.json')) {
        log = JSON.parse(fs.readFileSync(root_dir + workspace + '/log.json'));
    }

    if (log.redo.length == 0) {
        return false;
    }

    let command = log.redo.pop();
    let invert = {
        command: command.command,
        files: {}
    }
    console.log("Redoing " + command.command);
    for (let i in command.files) {
        invert.files[i] = JSON.parse(fs.readFileSync(root_dir + workspace + i));
        fs.writeFileSync(root_dir + workspace + i, json(command.files[i]));
    }

    if (log.undo.length > UNDO_HISTORY) log.undo.shift();
    log.undo.push(invert);

    fs.writeFileSync(root_dir + workspace + '/log.json', json(log));
    return true;
}

/**
 * Writes a record to the undo log. The entry should be a map of file name to its
 * old contents.
 * 
 * { command: "name", files: {'/mesh.json': {...} } }
 */
exports.commandPerformed = (workspace, command) => {
    let log = { undo: [], redo: []};
    if (fs.existsSync(root_dir + workspace + '/log.json')) {
        log = JSON.parse(fs.readFileSync(root_dir + workspace + '/log.json'));
    }

    if (log.undo.length > UNDO_HISTORY) log.undo.shift();
    log.undo.push(command);

    // clear redo list
    log.redo = [];

    fs.writeFileSync(root_dir + workspace + '/log.json', json(log));
}

exports.init = (app) => {
    app.get('/undo/:workspace', (req, res) => {
        res.send(performUndo(req.params.workspace));
    })
    app.get('/redo/:workspace', (req, res) => {
        res.send(performRedo(req.params.workspace));
    })
    return app;
}