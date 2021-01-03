/**
 * A way to pick scenery to add in a simpler way.
 */

const RECENT_MODELS = 15;

function setupPreviewCanvas() {
    var s = new THREE.Scene();
    var c = new THREE.PerspectiveCamera( 75, 1.0, 0.1, 1000 );
    cameraLookAt(c, 1.5,2.0,1.5, 0,1,0, 0.5,1.0,0.5);
    s.add( new THREE.DirectionalLight( 0xffffff, 1.0 ) );
    s.add(new THREE.AmbientLight( 0x888888 ));

    var r = new THREE.WebGLRenderer();
    r.setSize( 128, 128 );

    return [r, s, c];
}

class VisualModelSelection {
    constructor() {
        this.preview_canvas = setupPreviewCanvas();
        this.preview_queue = [];
        this.rendering_previews = false;

        let recent = localStorage.getItem('recent_scenery');
        this.recent_models = recent ? JSON.parse(recent) : [];
    }

    init() {
        $("#model-visual-dialog").dialog({
            beforeClose: () => {
                MODEL_VISUAL.opened = false;
            }
        });
    }

    showDialog() {
        this.opened = true;
        $("#model-visual-dialog").dialog("open");
        $("#model-visual-dialog").window("center");
    }

    closeDialog() {
        this.opened = false;
        $("#model-visual-dialog").dialog("close");
    }

    updateRecent(model) {
        let i = this.recent_models.indexOf(model);
        if (i > -1) {
            this.recent_models.splice(i, 1);
        }
        this.recent_models.unshift(model);

        if (this.recent_models.length > RECENT_MODELS) this.recent_models.pop();
        localStorage.setItem('recent_scenery', JSON.stringify(this.recent_models));

        this.renderRecent()
    }

    renderRecent() {
        let recent = document.getElementById('model-visual-recent');
        recent.innerHTML = '';

        for (let i of this.recent_models) {
            if (this.models[i]) {
                let div = this.createImageDiv(i);
                recent.appendChild(div);
            }
        }
    }

    selectModel(model) {
        document.getElementById('tools-detail-scenery-model-list').value = model;
        this.closeDialog();
        SCENERY_EDITOR.modelListChange();
        this.updateRecent(model);
    }

    generateModelPreview() {
        let val = this.preview_queue.pop();
        if (!val) {
            this.rendering_previews = false;
            return;
        }
        let [key,img] = val;
        this.rendering_previews = true;

        let [r,s,c] = this.preview_canvas;
        let workspace = this.workspace; // cache to make sure uri is saved
        this.scenery_loader.createScenery({ object: key, x:0, y:0 }, (mesh, info) => {
            let globalMesh = new THREE.Group();
            globalMesh.position.set(-0.5,-0.5,-0.5);
            globalMesh.add(mesh);
            s.add(globalMesh);

            // Some sort of race condition on the renderer.
            setTimeout(() => {
                r.render(s, c);
                let url = r.domElement.toDataURL('image/png');
                img.src = url;
                s.remove(globalMesh);

                post('api/tools/scenery/definition/save_preview/' + workspace, {
                    dataURI: url,
                    filename: key + '.png'
                }, () => {
                    console.log("Saved " + key);
                });

                this.generateModelPreview();
            }, 1000)
        });
    }

    queuePreview(key, img) {
        this.preview_queue.push([key,img]);
        if (!this.rendering_previews) {
            this.generateModelPreview();
        }
    }

    imagePreview(key, img) {
        let filename = this.texture_path + key + '.png';
        img.src = filename;
        img.onerror = () => {
            img.src = 'unknown.png';
            this.queuePreview(key, img);
        }
    }

    createImageDiv(i) {
        let label = document.createElement('div');
        label.classList.add('model-preview-label');
        label.innerText = i;
        let img = document.createElement('img');
        this.imagePreview(i, img);

        let div = document.createElement('div');
        div.classList.add('model-preview')
        div.appendChild(img);
        div.appendChild(label);

        div.onclick = () => {
            this.selectModel(i);
        }

        return div;
    }

    loadWorkspace(name, models, scenery_loader) {
        if (this.workspace == name) return;
        this.workspace = name;

        this.scenery_loader = scenery_loader;
        this.models = models;
        this.preview_queue = [];

        this.texture_path = "/workspaces/" + WORKSPACES.opened + "/models/preview/";

        let all = document.getElementById('model-visual-all');
        all.innerHTML = '';

        for (let i in models) {
            let div = this.createImageDiv(i);
            all.appendChild(div);
        }

        this.renderRecent();
    }

    keyPress(event) {
    }

    keyDown(event) {
        if (event.key == 'Escape') {
            this.closeDialog();
        }
    }
}

var MODEL_VISUAL = new VisualModelSelection();