var express = require('express');
var fs = require('fs-extra');
var http = require('http');
var path = require('path');
var bodyParser = require('body-parser');

var assets = require('./assets.js');
var workspaces = require('./workspace.js');
var tools = require('./tools.js');

const optionDefinitions = [
    { name: 'port', alias: 'v', type: Number, defaultValue: 7781 },
    { name: 'workspace', alias: 'w', type: String },
    { name: 'assets', alias: 'a', type: String },
    { name: 'disable_model_cache', type: Boolean, defaultValue: false }
  ]

const commandLineArgs = require('command-line-args');
const options = commandLineArgs(optionDefinitions);

const PORT = options.port;

var app = express();
app.set('port', PORT);
app.use(bodyParser.json({limit: '50mb', extended: true}))

app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "POST, GET");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});  
app.options('*', function (req,res) { res.sendStatus(200); });

if (options.workspace) {
    if (!fs.existsSync(options.workspace)) {
        throw "Invalid workspace path: " + options.workspace;
    }
    if (!fs.existsSync(options.workspace + '/maps/')) {
        throw "Workspace does not have a maps directory: " + options.workspace;
    }

    if (!fs.existsSync(options.assets)) {
        throw "Invalid workspace path: " + options.assets;
    }
    if (!fs.existsSync(options.assets + '/roofs/')) {
        throw "Assets does not have a roofs directory: " + options.assets;
    }

    workspaces.enableAttachedMode(options.workspace, options.assets, options.disable_model_cache);
    app.use('/global/buildings/floors', express.static(options.assets + '/ground-textures/'));
    app.use('/global/buildings/walls', express.static(options.assets + '/walls/definitions/'));
    app.use('/global/buildings/roofs', express.static(options.assets + '/roofs/definitions/'));
    app.use('/global', express.static(options.assets));
} else {
    app.use('/workspaces', express.static(path.join(__dirname,'../tmp')));
}

app.use(express.static(path.join(__dirname,'../web')));
app.use('/client', express.static(path.join(__dirname,'../client')));
app.use('/assets', express.static(path.join(__dirname,'../assets')));
app.get('/', function(req, res){ res.sendFile(path.join(__dirname, '../web/maps.html')); });

app.use('/api/assets', assets.init(express.Router()));
app.use('/api/workspaces', workspaces.init(express.Router()));
app.use('/api/tools', tools.init(express.Router()));

var server = http.Server(app);
server.listen(PORT, function() {
    console.log('Starting server on port ' + PORT);
});