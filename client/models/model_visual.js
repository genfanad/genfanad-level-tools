/**
 * A way to pick scenery to add in a simpler way.
 */

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
    }

    showDialog() {
        $("#model-visual-dialog").dialog("open");
        $("#model-visual-dialog").window("center");
    }

    generateModelPreview() {
        let [key,img] = this.preview_queue.pop();
        if (!key) {
            this.rendering_previews = false;
            return;
        }
        this.rendering_previews = true;

        let [r,s,c] = this.preview_canvas;
        console.log("Loading " + key);
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

                console.log("Loaded " + key);

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

    imagePreview(key, model, img) {
        let filename = this.texture_path + key + '.png';
        img.src = filename;
        img.onerror = () => {
            img.src = 'unknown.png';
            this.queuePreview(key, img);
        }
    }

    loadWorkspace(name, models, scenery_loader) {
        if (this.workspace == name) return;
        this.workspace = name;
        this.scenery_loader = scenery_loader;
        this.preview_queue = [];

        this.texture_path = "/workspaces/" + WORKSPACES.opened + "/models/previews/";

        let recent = document.getElementById('model-visual-recent');
        recent.innerHTML = '';
        let all = document.getElementById('model-visual-all');
        all.innerHTML = '';

        for (let i in models) {
            let label = document.createElement('div');
            label.classList.add('model-preview-label');
            label.innerText = i;
            let img = document.createElement('img');
            this.imagePreview(i, models[i], img);

            let div = document.createElement('div');
            div.classList.add('model-preview')
            div.appendChild(img);
            div.appendChild(label);

            all.appendChild(div);
        }
    }
}

var MODEL_VISUAL = new VisualModelSelection();