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

$(document).ready( () => {
    SCENE.init();
    WORKSPACES.init();
    TOOLS.init();
    MODEL_EDITOR.init();
    SCENERY_EDITOR.init();
    TEXTURE_SELECTION.init();
    MODEL_VISUAL.init();

    window.onbeforeunload = () => "Are you sure you want to navigate away?";

    document.addEventListener('keydown', event => {
        if (MODEL_VISUAL.opened) {
            MODEL_VISUAL.keyDown(event);
        } else if (MODEL_EDITOR.opened) {
            MODEL_EDITOR.keyDown(event);
        } else if (TEXTURE_SELECTION.opened) {
            TEXTURE_SELECTION.keyDown(event);
        }
    });

    document.addEventListener('keypress', event => {
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
        TOOLS.keyPress({
            ctrlKey: true,
            key: 'c'
        });
    })
    document.addEventListener('cut', event => {
        TOOLS.keyPress({
            ctrlKey: true,
            key: 'x'
        });
    })
    document.addEventListener('paste', event => {
        TOOLS.keyPress({
            ctrlKey: true,
            key: 'v'
        });
    })
})

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
        }
    });
}

function N(x) { return Number(x); }