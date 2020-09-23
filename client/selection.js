/**
 * Selection modes:
 * - tile - hovers and selects an individual tile
 * - model - hovers and selects an individual model
 * - area - click and drag a rectangular shape
 * - wall - click once to set starting point, click again to draw a straight line
 */
class Selection {
    constructor() {
        this.mouse = new THREE.Vector2();
        this.ray = new THREE.Raycaster();

        this.mode = 'tile';
        this.selection = undefined;
        this.on_select = undefined;

        this.cursor = new Square();
    }

    setMode(type, on_select) {
        this.mode = type;
        this.on_select = on_select;
    }

    setTerrain(terrain) {
        this.terrain = terrain;
    }

    terrainHover(position) {
        let info = "";
        if (position) {
            let lx = Math.floor(position.x), ly = Math.floor(position.z);
            info += `(${lx},${ly}) `;
            this.cursor.setPosition(lx,ly, this.terrain.tileHeights(lx,ly));
            SCENE.scene.add(this.cursor.threeObject);
        } else {
            SCENE.scene.remove(this.cursor.threeObject);
        }

        if (this.selection) {
            info += 'Selected: ' + this.selection;
        }

        document.getElementById('footer').innerText = info;
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
            if (this.terrain) {
                this.ray.setFromCamera( this.mouse.clone(), SCENE.camera );
                let i = this.ray.intersectObject(this.terrain.mesh);
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

class Square {
    constructor() {
        let geo = new THREE.Geometry();
        geo.vertices.push(new THREE.Vector3(0,0,0));
        geo.vertices.push(new THREE.Vector3(1,0,0));
        geo.vertices.push(new THREE.Vector3(0,0,1));
        geo.vertices.push(new THREE.Vector3(1,0,1));
        geo.faces.push(new THREE.Face3(1,0,2));
        geo.faces.push(new THREE.Face3(1,2,3));

        geo.computeBoundingSphere();
        let mat = new THREE.MeshBasicMaterial({
            color: 0xbbbbff88,
            transparent: true
        });

        this.geometry = geo;
        this.material = mat;
        this.threeObject = new THREE.Mesh(geo, mat);
    }

    setPosition(x,z,heights) {
        this.geometry.vertices[0].y = heights[0] + 0.1;
        this.geometry.vertices[1].y = heights[1] + 0.1;
        this.geometry.vertices[2].y = heights[2] + 0.1;
        this.geometry.vertices[3].y = heights[3] + 0.1;
        this.geometry.verticesNeedUpdate = true;
        this.threeObject.position.set(x,0,z);
    }
}

var SELECTION = new Selection();