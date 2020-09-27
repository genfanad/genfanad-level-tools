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

        this.default_cursor = new Square();
    }

    setTileMode(on_select) {
        this.cancelSelection();

        this.cursor = this.default_cursor;
        SCENE.scene.add(this.cursor.threeObject);

        this.mode = 'tile';
        this.on_select = on_select;
    }

    setAreaMode(on_select) {
        this.cancelSelection();

        this.mode = 'area';
        this.on_select = on_select;
    }

    setLineMode(on_select) {
        this.cancelSelection();

        this.mode = 'line';
        this.on_select = on_select;
    }

    setTerrain(terrain) {
        this.terrain = terrain;
    }

    cancelSelection() {
        if (this.cursor) {
            SCENE.scene.remove(this.cursor.threeObject);
            delete this.cursor;
        }
    }

    terrainDown(e, position) {
        if (!position) return;

        if (e.button == 0) {
            if (this.mode == 'area') {
                SCENE.controls.enabled = false;

                this.cancelSelection();
                this.cursor = new Area({
                    x: Math.round(position.x),
                    y: this.terrain.heightAt(position.x, position.z),
                    z: Math.round(position.z)
                });
                SCENE.scene.add(this.cursor.threeObject);
            } else if (this.mode == 'line') {
                SCENE.controls.enabled = false;

                this.cancelSelection();
                this.cursor = new Line({
                    x: Math.round(position.x),
                    y: this.terrain.heightAt(position.x, position.z),
                    z: Math.round(position.z)
                });
                SCENE.scene.add(this.cursor.threeObject);
            } else if (this.mode == 'tile') {
                // noop
            }
        }
    }

    terrainUp(e, position) {
        if (e.button == 0) {
            if (this.cursor && this.on_select) this.on_select(this.cursor.selection());

            if (this.mode == 'area') {
                SCENE.controls.enabled = true;
                this.cancelSelection();
            } else if (this.mode == 'line') {
                SCENE.controls.enabled = true;
                this.cancelSelection();
            } else if (this.mode == 'tile') {
            }
        }
    }

    terrainHover(position) {
        let info = "";
        if (position) {
            let lx = Math.floor(position.x), ly = Math.floor(position.z);
            info += `(${lx},${ly}) `;

            if (this.cursor && (this.mode == 'area' || this.mode == 'line')) {
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
        this.setTileMode();

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

        let mat = new THREE.MeshBasicMaterial({
            color: 0xbbbbff,
            opacity: 0.5,
            transparent: true
        });

        this.geometry = geo;
        this.material = mat;
        this.threeObject = new THREE.Mesh(geo, mat);
        this.threeObject.frustumCulled = false;
    }

    setPosition(x,z,heights) {
        this.x = x;
        this.z = z;

        this.geometry.vertices[0].y = heights[0] + 0.1;
        this.geometry.vertices[1].y = heights[1] + 0.1;
        this.geometry.vertices[2].y = heights[2] + 0.1;
        this.geometry.vertices[3].y = heights[3] + 0.1;
        this.geometry.verticesNeedUpdate = true;
        this.threeObject.position.set(x,0,z);
    }

    selection() {
        return {
            type: 'tile',
            x: this.x,
            y: this.z,
        }
    }
}

// represents a rectangular area and draws a cursor on top of the terrain
// origin is the fixed point, while dynamic is the one that moves around.
class Area {
    constructor(origin) {
        this.origin = origin;
        this.dynamic = {x: origin.x, z: origin.z};

        this.threeObject = createCube(0x00ff00);
        this.threeObject.position.x = origin.x;
        this.threeObject.position.y = origin.y;
        this.threeObject.position.z = origin.z;
        this.threeObject.scale.set(0.0, 1.0, 0.0);

        this.selected = {
            type: 'area',
            minx: origin.x, miny: origin.z,
            maxx: origin.x, maxy: origin.z
        }
    }

    setDynamic(x,z) {
        let left = Math.min(this.origin.x,x);
        let top = Math.min(this.origin.z,z);
        let w = Math.abs(this.origin.x-x);
        let h = Math.abs(this.origin.z-z);

        this.threeObject.position.x = left + w / 2.0;
        this.threeObject.position.z = top + h / 2.0;
        this.threeObject.scale.set(w, 1.0, h);

        this.dynamic.x = x;
        this.dynamic.z = z;
        this.selected = {
            type: 'area',
            minx: left, miny: top,
            maxx: left + w, maxy: top + h
        }
    }

    selection() {
        return this.selected;
    }
}

// Represents a straight line between two points
class Line {
    constructor(origin) {
        this.origin = origin;
        this.dynamic = {x: origin.x, z: origin.z};

        let low = origin.y - 1.6;
        let high = origin.y + 1.6;

        let geo = new THREE.Geometry();
        geo.vertices.push(new THREE.Vector3(origin.x,low,origin.z));
        geo.vertices.push(new THREE.Vector3(origin.x,low,origin.z));
        geo.vertices.push(new THREE.Vector3(origin.x,high,origin.z));
        geo.vertices.push(new THREE.Vector3(origin.x,high,origin.z));

        geo.faces.push(new THREE.Face3(1,0,2));
        geo.faces.push(new THREE.Face3(1,2,3));

        geo.computeBoundingSphere();
        let mat = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            side: THREE.DoubleSide,
        });

        this.geometry = geo;
        this.material = mat;
        this.threeObject = new THREE.Mesh(geo, mat);

        this.selected = {
            type: 'line',
            from: { x: this.origin.x, y: this.origin.z },
            to: { x: this.origin.x, y: this.origin.z },
        }
    }

    setDynamic(x,z) {
        this.dynamic.x = x;
        this.dynamic.z = z;

        // figure out closest straight line to target point
        let dx = Math.abs(this.origin.x - x);
        let dz = Math.abs(this.origin.z - z);
        let diag = Math.min(dx,dz);

        let tx, tz;
        if (diag * 1.4 > Math.max(dx, dz)) {
            tx = this.origin.x + Math.sign(x - this.origin.x) * diag;
            tz = this.origin.z + Math.sign(z - this.origin.z) * diag;
        } else if (dx > dz) {
            tx = x;
            tz = this.origin.z;
        } else if (dz > dx) {
            tx = this.origin.x;
            tz = z;
        }

        //console.log([this.origin.x , this.origin.z, x,z])
        //console.log([dx, dz, diag, tx, tz]);

        this.geometry.vertices[1].x = tx;
        this.geometry.vertices[1].z = tz;
        this.geometry.vertices[3].x = tx;
        this.geometry.vertices[3].z = tz;
        this.geometry.verticesNeedUpdate = true;

        this.selected = {
            type: 'line',
            from: { x: this.origin.x, y: this.origin.z },
            to: { x: tx, y: tz }
        }
    }
 
    selection() {
        return this.selected;
    }
}

var SELECTION = new Selection();