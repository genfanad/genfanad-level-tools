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

        //this.mode = 'tile';
        this.mode = 'area';
        this.selection = undefined;
        this.on_select = undefined;

        //this.cursor = new Square();
    }

    setMode(type, on_select) {
        this.mode = type;
        this.on_select = on_select;
    }

    setTerrain(terrain) {
        this.terrain = terrain;
    }

    terrainDown(e, position) {
        if (this.mode == 'area' && e.button == 0) {
            SCENE.controls.enabled = false;
            
            if (position) {
                this.cursor = new Area(
                    this.terrain, {
                        x: Math.floor(position.x),
                        z: Math.floor(position.z)
                    });
                SCENE.scene.add(this.cursor.threeObject);
            }
        }
        console.log("Down: " + position);
    }

    terrainUp(e, position) {
        if (this.mode == 'area') {
            SCENE.controls.enabled = true;

            if (this.cursor) {
                SCENE.scene.remove(this.cursor.threeObject);
                delete this.cursor;
            }
        }
        console.log("Up: " + position);
    }

    terrainHover(position) {
        let info = "";
        if (position) {
            let lx = Math.floor(position.x), ly = Math.floor(position.z);
            info += `(${lx},${ly}) `;

            if (this.mode == 'area' && this.cursor) {
                this.cursor.setDynamic(
                    Math.round(position.x),
                    Math.round(position.z));
            } else if (this.mode == 'tile') {
                this.cursor.setPosition(lx,ly, this.terrain.tileHeights(lx,ly));
                SCENE.scene.add(this.cursor.threeObject);
            }
        } else {
            if (this.mode == 'tile') {
                SCENE.scene.remove(this.cursor.threeObject);
            }
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
            if (this.terrain) {
                this.parseMouseCoordinates(e);
                this.ray.setFromCamera( this.mouse.clone(), SCENE.camera );
                let i = this.ray.intersectObject(this.terrain.mesh);
                this.terrainHover(i[0] ? i[0].point : undefined);
            }
        });
        $(dom).mousedown((e) => {
            if (this.terrain) {
                this.parseMouseCoordinates(e);
                this.ray.setFromCamera( this.mouse.clone(), SCENE.camera );
                let i = this.ray.intersectObject(this.terrain.mesh);
                this.terrainDown(e, i[0] ? i[0].point : undefined);
            }
        });
        $(dom).mouseup((e) => {
            if (this.terrain) {
                this.parseMouseCoordinates(e);
                this.ray.setFromCamera( this.mouse.clone(), SCENE.camera );
                let i = this.ray.intersectObject(this.terrain.mesh);
                this.terrainUp(e, i[0] ? i[0].point : undefined);
            }
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
            color: 0xbbbbff,
            opacity: 0.5,
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

// represents a rectangular area and draws a cursor on top of the terrain
// origin is the fixed point, while dynamic is the one that moves around.
class Area {
    constructor(terrain, origin) {
        this.terrain = terrain;
        this.origin = origin;

        this.threeObject = createCube(0x00ff00);
        this.threeObject.position.x = origin.x;
        this.threeObject.position.y = this.terrain.heightAt(origin.x, origin.z);
        this.threeObject.position.z = origin.z;
        this.threeObject.scale.set(0.0, 1.0, 0.0);
    }

    setDynamic(x,z) {
        let left = Math.min(this.origin.x,x);
        let top = Math.min(this.origin.z,z);
        let w = Math.abs(this.origin.x-x);
        let h = Math.abs(this.origin.z-z);

        this.threeObject.position.x = left + w / 2.0;
        this.threeObject.position.z = top + h / 2.0;
        this.threeObject.scale.set(w, 1.0, h);
    }
}

// Represents a straight line between two points
class Line {

}

var SELECTION = new Selection();