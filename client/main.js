// Size of the player mesh
const wSIZE = 128;
const WALL_HEIGHT = 1.6;
const ROOF_HEIGHT = 0.8;
const MAX_LEVEL = 4;
const WATER_ENCODE_RANGE = 3.0;

// Client configuration.
const ENABLE_STATS = true; // Shows fps/webgl stat boxes
const MAX_MESSAGES = 100; // Message history to keep
const ACTION_THRESHOLD = 250; // max time to register single click vs hold
const INV_SLOTS = 30; // number of inventory slots

// World layers
const OBJECT_TYPES = ["npc", "player", "item", "combat"];

var HOTKEYS_ENABLED = true;
var RELOAD_ENABLED = true;

const urlParams = new URLSearchParams(window.location.search);

$(document).ready( () => {
    SCENE.init();
    WORKSPACES.init();
    TOOLS.init();
    MODEL_EDITOR.init();
    SCENERY_EDITOR.init();
    TEXTURE_SELECTION.init();
    MODEL_VISUAL.init();

    if (urlParams.get('show_reparent')) {
        document.getElementById('reparent-section').style.display = 'block';
    }

    window.onbeforeunload = () => "Are you sure you want to navigate away?";

    document.addEventListener('keydown', event => {
        if (!HOTKEYS_ENABLED) return;

        if (MODEL_VISUAL.opened) {
            MODEL_VISUAL.keyDown(event);
        } else if (MODEL_EDITOR.opened) {
            MODEL_EDITOR.keyDown(event);
        } else if (TEXTURE_SELECTION.opened) {
            TEXTURE_SELECTION.keyDown(event);
        }
    });

    document.addEventListener('keypress', event => {
        if (!HOTKEYS_ENABLED) return;

        if (MODEL_VISUAL.opened) {
            MODEL_VISUAL.keyPress(event);
        } else if (MODEL_EDITOR.opened) {
            MODEL_EDITOR.keyPress(event);
        } else if (TEXTURE_SELECTION.opened) {
            TEXTURE_SELECTION.keyPress(event);
        } else {
            TOOLS.keyPress(event);
        }
    });

    document.addEventListener('copy', event => {
        if (!HOTKEYS_ENABLED) return;

        TOOLS.keyPress({
            ctrlKey: true,
            key: 'c'
        });
    })
    document.addEventListener('cut', event => {
        if (!HOTKEYS_ENABLED) return;

        TOOLS.keyPress({
            ctrlKey: true,
            key: 'x'
        });
    })
    document.addEventListener('paste', event => {
        if (!HOTKEYS_ENABLED) return;

        TOOLS.keyPress({
            ctrlKey: true,
            key: 'v'
        });
    })
})

function toggleHotkeys() {
    HOTKEYS_ENABLED = !HOTKEYS_ENABLED;

    if (HOTKEYS_ENABLED) {
        document.getElementById('hotkey-toggle').classList.remove('hotkeys-disabled')
        document.getElementById('hotkey-toggle').innerText = 'Disable Hotkeys'
    } else {
        document.getElementById('hotkey-toggle').classList.add('hotkeys-disabled')
        document.getElementById('hotkey-toggle').value = 'Enable Hotkeys'
    }
}

function toggleReload() {
    RELOAD_ENABLED = !RELOAD_ENABLED;

    if (RELOAD_ENABLED) {
        document.getElementById('reload-toggle').classList.remove('hotkeys-disabled')
        document.getElementById('reload-toggle').innerText = 'Disable Live Reload'
    } else {
        document.getElementById('reload-toggle').classList.add('hotkeys-disabled')
        document.getElementById('reload-toggle').value = 'Enable Live Reload'
    }
}

function initAttachedMode() {
    document.getElementById('tools-npc-place-button').disabled = false;
    document.getElementById('tools-npc-select-button').disabled = false;

    //document.getElementById('tools-item-select-button').disabled = false;

    $.ajax({
        url: 'http://localhost:7780/api/npcs',
        type: 'GET',
        contentType: 'application/json', 
        success: (r) => {
            let npcs = JSON.parse(r);
            let v = document.getElementById('tools-detail-npc-place-list');
            for (let i in npcs) {
                let o = document.createElement('option');
                o.value = i;
                o.text = i;
                v.appendChild(o);
            }
        }
    });

    $.ajax({
        url: 'http://localhost:7780/api/items',
        type: 'GET',
        contentType: 'application/json', 
        success: (r) => {
            let npcs = JSON.parse(r);
            let v = document.getElementById('tools-detail-item-place-list');
            for (let i in npcs) {
                let o = document.createElement('option');
                o.value = i;
                o.text = i;
                v.appendChild(o);
            }
        }
    });
}

function get(uri, oncomplete) {
    return $.ajax({
        url: uri,
        type: 'GET',
        contentType: 'application/json', 
        success: (f) => {
            if (oncomplete) oncomplete(f);
        }
    });
}

function post(uri, data, oncomplete) {
    return $.ajax({
        url: uri,
        type: 'POST',
        data: JSON.stringify(data),
        contentType: 'application/json', 
        success: (f) => {
            if (oncomplete) oncomplete(f);
        },
    });
}

function N(x) { return Number(x); }