/**
 * Art & Looks API — the editor surface for the artist-owned look data
 * (style areas / profiles / layer classes) used by the game's art-style
 * systems. The data lives in the content repo at metadata/art_looks.json
 * (attached mode) or in the editor tmp dir (standalone), and is published
 * to the served static data by genfanad-content-tools
 * scripts/world/bake_art_looks.js — which /publish runs for you when the
 * content-tools repo sits beside the content repo.
 */
var fs = require('fs-extra');
var path = require('path');
var { execFile } = require('child_process');

var workspaces = require('./workspace.js');

const EMPTY_LOOKS = { version: 1, layers: {}, profiles: {}, areas: {} };

function readLooks() {
    let file = workspaces.artLooksPath();
    if (!fs.existsSync(file)) return EMPTY_LOOKS;
    return fs.readJsonSync(file);
}

function writeLooks(data) {
    let file = workspaces.artLooksPath();
    fs.ensureDirSync(path.dirname(file));
    fs.writeJsonSync(file, data, { spaces: 2 });
}

exports.init = (app) => {
    app.get('/looks', (req, res) => {
        try {
            res.json(readLooks());
        } catch (e) {
            res.status(500).json({ error: String(e) });
        }
    });

    app.post('/looks', (req, res) => {
        try {
            writeLooks(req.body);
            res.json({ ok: true, file: workspaces.artLooksPath() });
        } catch (e) {
            res.status(500).json({ error: String(e) });
        }
    });

    // ---- building identity (Phase 8 bucket 4) --------------------------
    // Overrides file: <content>/maps/building_overrides.json — applied by
    // the compile AFTER the generated partition (content-tools
    // collisions.js applyRoofOverrides). Suggestions = the current
    // effective partition, computed by the content-tools exporter.

    app.get('/buildings', (req, res) => {
        try {
            let root = workspaces.attachedRoot();
            let file = root ? path.join(root, 'maps/building_overrides.json')
                : path.join(__dirname, '../tmp/building_overrides.json');
            res.json(fs.existsSync(file) ? fs.readJsonSync(file) : {});
        } catch (e) {
            res.status(500).json({ error: String(e) });
        }
    });

    app.post('/buildings', (req, res) => {
        try {
            let root = workspaces.attachedRoot();
            let file = root ? path.join(root, 'maps/building_overrides.json')
                : path.join(__dirname, '../tmp/building_overrides.json');
            fs.ensureDirSync(path.dirname(file));
            fs.writeJsonSync(file, req.body, { spaces: 2 });
            res.json({ ok: true, file });
        } catch (e) {
            res.status(500).json({ error: String(e) });
        }
    });

    // Compute the generated building partition (honors current overrides).
    // Runs the content-tools exporter over the attached content; the local
    // dev content compiles in seconds, the full world takes a while — the
    // editor shows a spinner-ish disabled state meanwhile.
    app.post('/buildings/suggestions', (req, res) => {
        let root = workspaces.attachedRoot();
        if (!root) {
            res.status(400).json({ error: 'suggestions require attached mode (content repo)' });
            return;
        }
        let tools = path.resolve(root, '..', 'genfanad-content-tools');
        let script = path.join(tools, 'scripts/oneoff/export_building_suggestions.js');
        if (!fs.existsSync(script)) {
            res.status(400).json({ error: 'genfanad-content-tools not found beside the content repo: ' + tools });
            return;
        }
        let out = path.join(tools, 'tmp', 'building_suggestions_editor.json');
        fs.ensureDirSync(path.dirname(out));
        execFile('node', ['scripts/oneoff/export_building_suggestions.js', out],
            { cwd: tools, maxBuffer: 64 * 1024 * 1024 }, (err, stdout, stderr) => {
                if (err || !fs.existsSync(out)) {
                    res.status(500).json({ error: (stdout || '') + (stderr || '') });
                    return;
                }
                try {
                    res.json({ suggestions: fs.readJsonSync(out), log: stdout });
                } catch (e) {
                    res.status(500).json({ error: String(e) });
                }
            });
    });

    // Publish = run the content-tools bake (validates, then copies to the
    // served static data). Only available in attached mode with the
    // standard sibling checkout layout.
    app.post('/publish', (req, res) => {
        let root = workspaces.attachedRoot();
        if (!root) {
            res.status(400).json({ error: 'publish requires attached mode (content repo)' });
            return;
        }
        let tools = path.resolve(root, '..', 'genfanad-content-tools');
        if (!fs.existsSync(path.join(tools, 'scripts/world/bake_art_looks.js'))) {
            res.status(400).json({ error: 'genfanad-content-tools not found beside the content repo: ' + tools });
            return;
        }
        execFile('node', ['scripts/world/bake_art_looks.js'], { cwd: tools }, (err, stdout, stderr) => {
            res.json({ ok: !err, output: (stdout || '') + (stderr || '') });
        });
    });

    return app;
};
