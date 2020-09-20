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

    parseMouseCoordinates(e) {
        let box = e.target.getBoundingClientRect();
        let x = e.pageX - box.left;
        let y = e.pageY - box.top;
        this.mouse.x = (x / e.target.clientWidth) * 2 - 1;
        this.mouse.y = -(y / e.target.clientHeight) * 2 + 1;
    }

    init(dom) {
        this.dom = dom;
        $(dom).mousemove((e) => {
            this.parseMouseCoordinates(e);
            if (this.mesh) {
                this.ray.setFromCamera( this.mouse.clone(), SCENE.camera );
                let i = this.ray.intersectObject(this.mesh);
                this.terrainHover(i[0] ? i[0].point : undefined);
            }
        });
        $(dom).mousedown((e) => {
            //console.log("mouse down");
        });
        $(dom).mouseup((e) => {
            //console.log("mouse up");
        });
    }
}

var SELECTION = new Selection();