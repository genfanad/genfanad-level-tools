/**
 * Art & Looks API — the editor surface for the artist-owned look data
 * (style areas / profiles / layer classes) used by the game's art-style
 * systems, and for the building-identity overrides.
 *
 * STORAGE (split layout, 2026-07-12 — see genfanad-content-tools
 * scripts/world/art_looks_lib.js and building_overrides_lib.js):
 *   metadata/art_looks.json              layer classes only
 *   metadata/profiles/<name>.json        one style profile per file
 *   maps/<layer>/<seg>/art_areas.json    areas live with their segment
 *   maps/<layer>/<seg>/building_overrides.json  building identity
 *
 * The editor client still exchanges the COMBINED shapes ({version, layers,
 * profiles, areas} and {layer: [entries]}); this server splits/merges via
 * the content-tools libs so the editor and the build can never disagree
 * about the layout. Standalone mode (no content repo) keeps everything in
 * single files under the editor tmp dir. Publish runs the content-tools
 * bake, which validates and copies to the served static data.
 */
var fs = require('fs-extra');
var path = require('path');
var { execFile } = require('child_process');

var workspaces = require('./workspace.js');

const EMPTY_LOOKS = { version: 1, layers: {}, profiles: {}, areas: {} };

// The split-layout libs live in the content-tools checkout beside the
// content repo. Returns null in standalone mode or on an old content-tools
// checkout that predates the split — callers fall back to single files.
function contentToolsLib(name) {
    let root = workspaces.attachedRoot();
    if (!root) return null;
    let file = path.resolve(root, '..', 'genfanad-content-tools', 'scripts', 'world', name);
    if (!fs.existsSync(file)) return null;
    return require(file);
}

function attachedContentRoot() {
    let root = workspaces.attachedRoot();
    return root ? path.resolve(root) : null;
}

function logWarnings(where, warnings) {
    for (const w of warnings || []) console.warn(`${where}: ${w}`);
}

// ---- looks (layers + profiles + areas) --------------------------------

function readLooks() {
    let lib = contentToolsLib('art_looks_lib.js');
    if (lib) {
        let { data, warnings } = lib.collectArtLooks(attachedContentRoot());
        logWarnings('art looks', warnings);
        return data;
    }
    // Standalone / legacy: one combined file.
    let file = workspaces.artLooksPath();
    if (!fs.existsSync(file)) return EMPTY_LOOKS;
    return fs.readJsonSync(file);
}

function writeLooks(data) {
    let lib = contentToolsLib('art_looks_lib.js');
    if (lib) {
        let result = lib.writeArtLooks(attachedContentRoot(), data);
        logWarnings('art looks', result.warnings);
        return {
            file: `${result.written.length} files (split layout)`,
            warnings: result.warnings,
        };
    }
    let file = workspaces.artLooksPath();
    fs.ensureDirSync(path.dirname(file));
    fs.writeJsonSync(file, data, { spaces: 2 });
    return { file, warnings: [] };
}

// ---- building identity (Phase 8 bucket 4) ------------------------------
// Overrides live per segment (maps/<layer>/<seg>/building_overrides.json),
// applied by the compile AFTER the generated partition (content-tools
// collisions.js applyRoofOverrides). Suggestions = the current effective
// partition, computed by the content-tools exporter.

function standaloneBuildingsFile() {
    return path.join(__dirname, '../tmp/building_overrides.json');
}

function readBuildings() {
    let lib = contentToolsLib('building_overrides_lib.js');
    if (lib) {
        let mapsDir = path.join(attachedContentRoot(), 'maps');
        let { byLayer, warnings } = lib.collectBuildingOverrides(mapsDir);
        logWarnings('building overrides', warnings);
        return byLayer;
    }
    let file = workspaces.attachedRoot()
        ? path.join(workspaces.attachedRoot(), 'maps/building_overrides.json')
        : standaloneBuildingsFile();
    return fs.existsSync(file) ? fs.readJsonSync(file) : {};
}

function writeBuildings(data) {
    let lib = contentToolsLib('building_overrides_lib.js');
    if (lib) {
        let mapsDir = path.join(attachedContentRoot(), 'maps');
        let result = lib.writeSegmentOverrides(mapsDir, data);
        logWarnings('building overrides', result.warnings);
        return {
            file: `${result.written.length} segment files (${result.removed.length} removed)`,
            warnings: result.warnings,
        };
    }
    let file = workspaces.attachedRoot()
        ? path.join(workspaces.attachedRoot(), 'maps/building_overrides.json')
        : standaloneBuildingsFile();
    fs.ensureDirSync(path.dirname(file));
    fs.writeJsonSync(file, data, { spaces: 2 });
    return { file, warnings: [] };
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
            let result = writeLooks(req.body);
            res.json({ ok: true, file: result.file, warnings: result.warnings });
        } catch (e) {
            res.status(500).json({ error: String(e) });
        }
    });

    app.get('/buildings', (req, res) => {
        try {
            res.json(readBuildings());
        } catch (e) {
            res.status(500).json({ error: String(e) });
        }
    });

    app.post('/buildings', (req, res) => {
        try {
            let result = writeBuildings(req.body);
            res.json({ ok: true, file: result.file, warnings: result.warnings });
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
