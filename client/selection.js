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
        this.cursor.swapCursorType();
        SCENE.scene.add(this.cursor.threeObject);

        this.mode = 'tile';
        this.on_select = on_select;
    }

    setAreaMode(on_select) {
        this.cancelSelection();

        this.mode = 'area';
        this.on_select = on_select;
    }

    setFixedAreaMode(on_select) {
        this.cancelSelection();

        this.mode = 'fixed-area';
        this.on_select = on_select;

        this.cursor = new FixedArea();
    }

    setLineMode(on_select) {
        this.cancelSelection();

        this.mode = 'line';
        this.on_select = on_select;
    }

    setSceneryMode(on_select) {
        this.cancelSelection();
        this.mode = 'scenery';
        this.on_select = on_select;

        this.cursor = new ModelSelection();
    }

    showAdditionalCursor() {
        this.show_additional = true;
        SCENE.scene.add(this.default_cursor.threeObject);
    }

    swapCursorShape(shape) {
        this.default_cursor.swapCursorType(shape);
    }

    setTerrain(terrain) {
        this.terrain = terrain;
    }

    cancelSelection() {
        if (this.cursor) {
            SCENE.scene.remove(this.cursor.threeObject);
            delete this.cursor;
        }
        if (this.show_additional) {
            SCENE.scene.remove(this.default_cursor.threeObject);
        }
    }

    terrainDown(e, position) {
        if (!position) return;
        if (e.shiftKey) return;

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
            } else if (this.mode == 'fixed-area') {
                // noop
            } else if (this.mode == 'scenery') {
                // noop
            }
        }
    }

    sceneryUp(e) {
        if (e.shiftKey) return; // Short circuit if camera moving.
        if (e.button == 0) {
            if (this.cursor && this.on_select) this.on_select(this.cursor.selection());
        }
    }

    terrainUp(e, position) {
        if (e.shiftKey) return; // Short circuit if camera moving.
        if (e.button == 0) {
            if (this.cursor && this.on_select) this.on_select(this.cursor.selection());

            if (this.mode == 'area') {
                SCENE.controls.enabled = true;
                this.cancelSelection();
            } else if (this.mode == 'line') {
                SCENE.controls.enabled = true;
                this.cancelSelection();
            } else if (this.mode == 'tile') {
                // noop
            }
        }
    }

    modelHover(id, instance, intersection) {
        if (this.cursor) {
            this.cursor.setModel(id, instance, intersection);
        }
    }

    terrainHover(position) {
        let info = "";
        if (position) {
            let lx = Math.floor(position.x), ly = Math.floor(position.z);
            info += `(${lx},${ly}) `;

            if (this.show_additional) {
                this.default_cursor.setPosition(lx,ly, this.terrain.tileHeights(lx,ly));
                SCENE.scene.add(this.default_cursor.threeObject);
            }

            if (this.cursor && (this.mode == 'area' || this.mode == 'line')) {
                this.cursor.setDynamic(
                    Math.round(position.x),
                    Math.round(position.z));
            } else if (this.mode == 'tile' || this.mode == 'fixed-area') {
                this.cursor.setPosition(lx,ly, this.terrain.tileHeights(lx,ly));
                SCENE.scene.add(this.cursor.threeObject);
            }
        } else {
            if (this.mode == 'tile' || this.mode == 'fixed-area') {
                SCENE.scene.remove(this.cursor.threeObject);
            }
            if (this.show_additional) {
                SCENE.scene.remove(this.default_cursor.threeObject);
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
            if (this.mode == 'scenery') {
                this.parseMouseCoordinates(e);
                this.ray.setFromCamera( this.mouse.clone(), SCENE.camera );
                let groups = SCENE.getVisibleObjects();
                let i = this.ray.intersectObjects(groups, true);

                let id = undefined, instance = undefined;

                if (i[0]) {
                    // traverse up to parent until it finds original grouping mesh
                    let cur = i[0].object;
                    while (cur && !id) {
                        if (cur.original_id) {
                            id = cur.original_id;
                            instance = cur;
                        }
                        cur = cur.parent;
                    }
                }
                this.modelHover(id, instance, i[0]);
            } else if (this.terrain) {
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
            if (this.mode == 'scenery') {
                this.sceneryUp(e);
            } else if (this.terrain) {
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
        let geo = this.createGeometry('full');
        let mat = new THREE.MeshBasicMaterial({
            color: 0xbbbbff,
            opacity: 0.5,
            transparent: true
        });

        this.geometry = geo;
        this.material = mat;
        this.mesh = new THREE.Mesh(geo, mat);
        this.threeObject = new THREE.Group();
        this.threeObject.add(this.mesh);
        this.threeObject.frustumCulled = false;
        this.type = 'full';
    }

    createGeometry(type) {
        let geo = new THREE.Geometry();

        let t00 = new THREE.Vector3(0,0,0);
        let t01 = new THREE.Vector3(0,0,1);
        let t11 = new THREE.Vector3(1,0,1);
        let t10 = new THREE.Vector3(1,0,0);

        geo.vertices.push(t00);
        geo.vertices.push(t01);
        geo.vertices.push(t11);
        geo.vertices.push(t10);

        let face1;
        let face2;
        if (type == 'bl' || type == 'tr') {
            face1 = new THREE.Face3(0,1,2);
            face2 = new THREE.Face3(0,2,3);
        } else {
            face1 = new THREE.Face3(0,1,3);
            face2 = new THREE.Face3(3,1,2);
        }

        if (type == 'full' || type == 'tl' || type == 'bl') {
            geo.faces.push(face1);
        }
        if (type == 'full' || type == 'tr' || type == 'br') {
            geo.faces.push(face2);
        }
        return geo;
    }

    swapCursorType(type = 'full') {
        if (type == this.type) return;
        this.type = type;

        let geo = this.createGeometry(type);
        this.threeObject.remove(this.mesh);
        this.geometry = geo;
        this.mesh = new THREE.Mesh(geo, this.material);
        this.threeObject.add(this.mesh);
    }

    setPosition(x,z,heights) {
        this.x = x;
        this.z = z;

        let minHeight = Math.min(...heights);

        this.geometry.vertices[0].y = heights[0] + 0.1 - minHeight;
        this.geometry.vertices[1].y = heights[1] + 0.1 - minHeight;
        this.geometry.vertices[2].y = heights[2] + 0.1 - minHeight;
        this.geometry.vertices[3].y = heights[3] + 0.1 - minHeight;
        this.geometry.verticesNeedUpdate = true;
        this.threeObject.position.set(x,minHeight,z);

        this.elevation = minHeight;
    }

    selection() {
        return {
            type: 'tile',
            x: this.x,
            y: this.z,
            elevation: this.elevation,
        }
    }
}

// Works like a tile selection but previews with an area boundary
class FixedArea {
    constructor() {
        this.threeObject = createCube(0xff0000);
        this.threeObject.scale.set(0.0, 1.0, 0.0);
    }

    setDimensions(x,z) {
        this.threeObject.scale.set(x, 1.0, z);
    }

    setPosition(x,z,heights) {
        this.x = x;
        this.z = z;

        let minHeight = Math.min(...heights);
        this.threeObject.position.set(x,minHeight,z);

        this.elevation = minHeight;
    }

    selection() {
        return {
            type: 'fixed-area',
            x: this.x,
            y: this.z,
            elevation: this.elevation,
        }
    }
}

// represents a rectangular area and draws a cursor on top of the terrain
// origin is the fixed point, while dynamic is the one that moves around.
class Area {
    constructor(origin) {
        this.origin = origin;
        this.dynamic = {x: origin.x, z: origin.z};

        this.threeObject = createCube(0xff0000);
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
            color: 0xff0000,
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

class ModelSelection {
    constructor() {
        this.threeObject = new THREE.BoxHelper( undefined, 0xffff00 );
        this.selected = undefined;
    }

    setModel(id, instance, intersection) {
        this.selected = id;

        if (instance) {
            this.threeObject.setFromObject(instance);
            SCENE.scene.add(this.threeObject);
        } else {
            SCENE.scene.remove(this.threeObject);
        }
    }

    selection() {
        return this.selected;
    }
}

var SELECTION = new Selection();