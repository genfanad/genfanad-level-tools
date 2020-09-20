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