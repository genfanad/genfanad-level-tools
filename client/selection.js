class Selection {
    constructor() {
        this.mouse = new THREE.Vector2();
        this.ray = new THREE.Raycaster();
    }

    setTerrainMesh(mesh) {
        this.mesh = mesh;
    }

    terrainHover(position) {
        if (position) {
            let lx = Math.floor(position.x), ly = Math.floor(position.z);
            document.getElementById('footer').innerText = `(${lx},${ly})`;
        } else {
            document.getElementById('footer').innerText = ``;
        }
    }

    init(dom) {
        this.dom = dom;
        $(dom).mousemove((e) => {
            let box = e.target.getBoundingClientRect();
            let x = e.pageX - box.left;
            let y = e.pageY - box.top;

            this.mouse.x = (x / dom.clientWidth) * 2 - 1;
            this.mouse.y = -(y / dom.clientHeight) * 2 + 1;

            if (this.mesh) {
                this.ray.setFromCamera( this.mouse.clone(), SCENE.camera );
                let i = this.ray.intersectObject(this.mesh);
                this.terrainHover(i[0] ? i[0].point : undefined);
            }
        });
    }
}

var SELECTION = new Selection();