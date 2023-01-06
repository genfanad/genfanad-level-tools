var fs = require('fs-extra');
var undo = require('./undo.js');

var WORKSPACE = require('../workspace.js');
const path = require('path');
const { exec } = require("child_process");

function openFile(workspace, filepath) {
  let normalized = path.normalize(WORKSPACE.getBasePath(workspace) + filepath);
  exec(`start "" "${normalized}"`, (error, stdout, stderr) => { });
}

function editItem(workspace, key) {
  openFile(workspace, "items/" + key + ".json");
}

function deleteItem(workspace, key) {
  let items = WORKSPACE.readItems(workspace);

  undo.commandPerformed(workspace, {
    command: "Delete Item",
    files: { '/items.json': items },
  })

  if (!key) {
    console.log("Object does not exist.");
    return false;
  }
  delete items[key];

  WORKSPACE.writeItems(workspace, items);
  return true;
}

function editNPC(workspace, key) {
  openFile(workspace, "npcs/" + key + ".json");
}

function deleteNPC(workspace, key) {
  let npcs = WORKSPACE.readNPCs(workspace);

  undo.commandPerformed(workspace, {
    command: "Delete NPC",
    files: { '/npcs.json': npcs },
  })

  if (!key) {
    console.log("Object does not exist.");
    return false;
  }
  delete npcs[key];

  WORKSPACE.writeNPCs(workspace, npcs);
  return true;
}

function editSeed(workspace, key) {
  openFile(workspace, "seeds/" + key + ".json");
}

function deleteSeed(workspace, key) {
  let seeds = WORKSPACE.readSeeds(workspace);

  undo.commandPerformed(workspace, {
    command: "Delete Seed",
    files: { '/seeds.json': seeds },
  })

  if (!key) {
    console.log("Object does not exist.");
    return false;
  }
  delete seeds[key];

  WORKSPACE.writeSeeds(workspace, seeds);
  return true;
}

exports.init = (app) => {
  app.post('/item-edit/:workspace', (req, res) => {
    res.send(editItem(req.params.workspace, req.body.key));
  });
  app.post('/item-delete/:workspace', (req, res) => {
    res.send(deleteItem(req.params.workspace, req.body.key));
  });

  app.post('/npc-edit/:workspace', (req, res) => {
    res.send(editNPC(req.params.workspace, req.body.key));
  });
  app.post('/npc-delete/:workspace', (req, res) => {
    res.send(deleteNPC(req.params.workspace, req.body.key));
  });

  app.post('/seed-edit/:workspace', (req, res) => {
    res.send(editSeed(req.params.workspace, req.body.key));
  });
  app.post('/seed-delete/:workspace', (req, res) => {
    res.send(deleteSeed(req.params.workspace, req.body.key));
  });

  return app;
}