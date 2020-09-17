$(document).ready( () => {
    SCENE.init();
    WORKSPACES.init();
})

function get(uri, oncomplete) {
    $.ajax({
        url: uri,
        type: 'GET',
        contentType: 'application/json', 
        success: (f) => oncomplete(JSON.parse(f))
    });
}

function post(uri, data, oncomplete) {
    $.ajax({
        url: uri,
        type: 'POST',
        data: JSON.stringify(data),
        contentType: 'application/json', 
        success: (f) => oncomplete(JSON.parse(f))
    });
}