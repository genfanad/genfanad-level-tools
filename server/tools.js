var express = require('express');
var fs = require('fs-extra');
var dir = require('./directory.js');

var undo = require('./tools/undo.js');
var editor = require('./tools/editor.js');
var mesh = require('./tools/mesh.js');
var buildings = require('./tools/buildings.js');
var scenery = require('./tools/scenery.js');
var batch_scenery = require('./tools/batch-scenery.js');

exports.init = (app) => {
    app.use('/undo', undo.init(express.Router()));
    app.use('/editor', editor.init(express.Router()));
    app.use('/mesh', mesh.init(express.Router()));
    app.use('/buildings', buildings.init(express.Router()));
    app.use('/scenery', scenery.init(express.Router()));
    app.use('/batch-scenery', batch_scenery.init(express.Router()));
    return app;
}