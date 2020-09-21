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