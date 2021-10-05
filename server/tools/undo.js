/**
 * Implements undo and redo.
 */

var fs = require('fs-extra');

var WORKSPACE = require('../workspace.js');

const UNDO_HISTORY = 5;

function json(content) {
    return JSON.stringify(content, null, 2);
}

function performUndo(workspace) {
    let log = WORKSPACE.readJSON(workspace, 'log.json', { undo: [], redo: []});

    if (log.undo.length == 0) {
        return false;
    }

    let command = log.undo.pop();
    let invert = {
        command: command.command,
        files: {}
    }
    console.log("Undoing " + command.command);
    for (let type in command.files) {
        let i = type;
        if (type.startsWith('/')) {
            i = type.substring(1).split('.')[0];
        }

        if (i == 'selection') {
            invert.files[type] = WORKSPACE.getSelection(workspace);
            WORKSPACE.writeSelection(workspace, command.files[type]);
        } else {
            invert.files[type] = WORKSPACE.readByKey(workspace, i);
            WORKSPACE.writeByKey(workspace, i, command.files[type])    
        }
    }

    if (log.redo.length > UNDO_HISTORY) log.redo.shift();
    log.redo.push(invert);

    WORKSPACE.writeJSON(workspace, 'log.json', log);
    return true;
}

function performRedo(workspace) {
    let log = WORKSPACE.readJSON(workspace, 'log.json', { undo: [], redo: []});

    if (log.redo.length == 0) {
        return false;
    }

    let command = log.redo.pop();
    let invert = {
        command: command.command,
        files: {}
    }
    console.log("Redoing " + command.command);
    for (let type in command.files) {
        // strip the field
        let i = type;
        if (type.startsWith('/')) {
            i = type.substring(1).split('.')[0];
        }

        if (i == 'selection') {
            invert.files[type] = WORKSPACE.getSelection(workspace);
            WORKSPACE.writeSelection(workspace, command.files[type]);
        } else {
            invert.files[type] = WORKSPACE.readByKey(workspace, i);
            WORKSPACE.writeByKey(workspace, i, command.files[type])
        }
    }

    if (log.undo.length > UNDO_HISTORY) log.undo.shift();
    log.undo.push(invert);

    WORKSPACE.writeJSON(workspace, 'log.json', log);
    return true;
}

/**
 * Writes a record to the undo log. The entry should be a map of file name to its
 * old contents.
 * 
 * { command: "name", files: {'/mesh.json': {...} } }
 */
exports.commandPerformed = (workspace, command) => {
    let log = WORKSPACE.readJSON(workspace, 'log.json', { undo: [], redo: []});

    if (log.undo.length > UNDO_HISTORY) log.undo.shift();
    log.undo.push(command);

    // clear redo list
    log.redo = [];

    WORKSPACE.writeJSON(workspace, 'log.json', log);
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