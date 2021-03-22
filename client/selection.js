const leftMouseButton = 0;
const rightMouseButton = 2;

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

        this.cursor = new Area();

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

        this.cursor = new Line();

        this.mode = 'line';
        this.on_select = on_select;
    }

    setSceneryMode(on_select) {
        this.cancelSelection();

        this.mode = 'scenery';
        this.on_select = on_select;

        this.cursor = new ModelSelection();
    }

    /* When we pick another tool, we have to clean up the BoxHelper around the selected model */
    removeSceneryCursor() {
        this.cursor.removeSelectedCursor();
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

    terrainDown(e, position, heightLevel = 0) {
        if (!position) return;
        if (e.shiftKey) return;


        if (e.button === leftMouseButton) {
            if (this.mode === 'area') {
                SCENE.controls.enabled = false;
                this.cursor.setActive();
            } else if (this.mode === 'line') {
                SCENE.controls.enabled = false;
                this.cursor.setActive();
            } else if (this.mode === 'tile') {
                // noop
            } else if (this.mode === 'fixed-area') {
                // noop
            } else if (this.mode === 'scenery') {
                // noop
            }
        } else if (e.button === rightMouseButton) {
            if (this.mode === 'area') {
                SCENE.controls.enabled = true;
                this.cancelSelection();
                this.cursor = new Area();
            } else if (this.mode === 'line') {
                SCENE.controls.enabled = true;
                this.cancelSelection();
                this.cursor = new Line();
            }
        }
    }

    sceneryUp(e) {
        if (e.shiftKey) return; // Short circuit if camera moving.
        if (e.button === leftMouseButton) {
            if (this.cursor && this.on_select) this.on_select(this.cursor.selection());
        }

        this.cursor.selectModel();
    }

    terrainUp(e, position) {
        if (e.shiftKey) return; // Short circuit if camera moving.
        if (e.button === leftMouseButton) {
            if (this.cursor && this.on_select) {
                if (this.cursor.selectionIsValid !== undefined) {
                    if (this.cursor.selectionIsValid) {
                        this.on_select(this.cursor.selection());
                    }
                } else {
                    this.on_select(this.cursor.selection());
                }
            }

            if (this.mode === 'area') {
                SCENE.controls.enabled = true;
                this.cancelSelection();
                this.cursor = new Area();
            } else if (this.mode === 'line') {
                SCENE.controls.enabled = true;
                this.cancelSelection();
                this.cursor = new Line();
            } else if (this.mode === 'tile') {
                // noop
            }
        }
    }

    modelHover(id, instance, intersection) {
        if (this.cursor) {
            this.cursor.setHoverModel(id, instance, intersection);
        }
    }

    terrainHover(position) {
        let info = "";
        if (position) {
            let lx = Math.floor(position.x), ly = Math.floor(position.z);

            let height = this.terrain.heightAt(lx,ly);

            info += `(${lx},${ly}), elevation ${height.toFixed(4)} `;

            if (this.show_additional) {
                this.default_cursor.setPosition(lx,ly, this.terrain.tileHeights(lx,ly));
                SCENE.scene.add(this.default_cursor.threeObject);
            }

            if (this.mode === 'area' || this.mode === 'line') {
                if (!this.cursor.active || !this.cursor.origin) {
                    this.cursor.setOrigin({
                        x: Math.round(position.x),
                        y: this.terrain.heightAt(position.x, position.z),
                        z: Math.round(position.z)
                    });
                } else {
                    this.cursor.setDynamic(
                        Math.round(position.x),
                        Math.round(position.z));
                }
            } else if (this.mode === 'tile' || this.mode === 'fixed-area') {
                this.cursor.setPosition(lx,ly, this.terrain.tileHeights(lx,ly));
                SCENE.scene.add(this.cursor.threeObject);
            }
        } else {
            if (this.mode === 'tile' || this.mode === 'fixed-area') {
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
            if (this.mode === 'scenery') {
                this.parseMouseCoordinates(e);

                this.ray.setFromCamera( this.mouse.clone(), SCENE.camera );
                let groups = SCENE.getVisibleObjects();
                let intersections = this.ray.intersectObjects(groups, true);

                let id = undefined, instance = undefined;

                if (intersections.length > 0) {
                    // traverse up to parent until it finds original grouping mesh
                    let cur = intersections[0].object;
                    while (cur && !id) {
                        if (cur.original_id) {
                            id = cur.original_id;
                            instance = cur;
                        }
                        cur = cur.parent;
                    }
                }

                this.modelHover(id, instance, intersections[0]);
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

                const heightLevel = +document.getElementById('tools-detail-buildings-level').value;
                this.terrainDown(e, i[0] ? i[0].point : undefined, heightLevel);
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
        this.w = 0;
        this.h = 0;
        this.centered = false;
    }

    setDimensions(x,z, centered = false) {
        this.threeObject.scale.set(x, 1.0, z);
        this.w = x;
        this.h = z;
        this.centered = centered;
    }

    setPosition(x,z,heights) {
        this.x = x;
        this.z = z;

        let minHeight = Math.min(...heights);

        let ox = x + this.w / 2.0;
        let oz = z + this.h / 2.0;

        if (this.centered) {
            ox -= Math.floor(this.w / 2.0);
            oz -= Math.floor(this.w / 2.0);
        }

        this.threeObject.position.set(ox,minHeight,oz);

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
    constructor() {
        this.origin = null;
        this.selectionIsValid = false;
        this.active = false;
        this.selected = {
            type: 'area',
            minx: null,
            miny: null,
            maxx: null,
            maxy: null
        }
        this.geometry = null;
        this.material = null;
        this.width = null;
        this.height = null;
    }

    setOrigin(origin) {
        this.origin = origin;
        const low = origin.y - 1.6;
        const high = origin.y + 1.6;

        this.selected.from = {x: this.origin.x, y: this.origin.z};

        const vertices = [
            new THREE.Vector3(origin.x, low, origin.z),
            new THREE.Vector3(origin.x, high, origin.z)
        ];

        if (!this.threeObject) {
            this.createInactiveCursor(vertices);
        } else {
            this.updateInactiveCursor(vertices);
        }
    }

    setDynamic(x, z) {
        const left = Math.min(this.origin.x, x);
        const top = Math.min(this.origin.z, z);
        this.width = Math.abs(this.origin.x - x);
        this.height = Math.abs(this.origin.z - z);

        this.selected = {
            type: 'area',
            minx: left,
            miny: top,
            maxx: left + this.width,
            maxy: top + this.height
        };

        this.selectionIsValid = !(this.selected.minx === this.selected.maxx && this.selected.miny === this.selected.maxy);

        if (!this.threeObject) {
            this.createActiveCursor();
        } else {
            this.updateActiveCursor();
        }
    }

    setActive() {
        this.active = true;
        SCENE.scene.remove(this.threeObject);
        this.threeObject = null;
    }

    createInactiveCursor(vertices) {
        const material = new THREE.LineBasicMaterial( { color: 0xff0000 } );
        this.geometry = new THREE.Geometry();
        this.geometry.vertices = vertices;
        this.threeObject = new THREE.Line(this.geometry, material);
        SCENE.scene.add(this.threeObject);
    }

    updateInactiveCursor(vertices) {
        this.geometry.vertices = vertices;
        this.geometry.verticesNeedUpdate = true;
    }

    createActiveCursor() {
        this.threeObject = createCube(0xff0000);
        this.updateActiveCursor();
        SCENE.scene.add(this.threeObject);
    }

    updateActiveCursor() {
        this.threeObject.position.x = this.selected.minx + this.width / 2.0;
        this.threeObject.position.y = this.origin.y;
        this.threeObject.position.z = this.selected.miny + this.height / 2.0;
        this.threeObject.scale.set(this.width, 1.0, this.height);
    }

    selection() {
        return this.selected;
    }
}

// Represents a straight line between two points
class Line {
    constructor() {
        this.origin = null;
        this.selectionIsValid = false;
        this.active = false;
        this.selected = {
            type: 'line',
            from: null,
            to: null
        }
        this.geometry = null;
        this.material = null;
        this.low = null;
        this.high = null;
    }

    setOrigin(origin) {
        this.origin = origin;
        this.low = origin.y - 1.6;
        this.high = origin.y + 1.6;

        this.selected.from = {x: this.origin.x, y: this.origin.z};

        const vertices = [
            new THREE.Vector3(origin.x, this.low, origin.z),
            new THREE.Vector3(origin.x, this.high, origin.z)
        ];

        if (!this.threeObject) {
            this.createInactiveCursor(vertices);
        } else {
            this.updateInactiveCursor(vertices);
        }
    }

    setDynamic(x, z) {
        const {tx, tz} = this.makeSureLineIsIn45DegreeInterval(x, z);

        this.selected.to = {x: tx, y: tz};

        this.selectionIsValid = !(this.selected.from.x === this.selected.to.x && this.selected.from.y === this.selected.to.y);

        const vertices = [
            new THREE.Vector3(this.origin.x, this.low, this.origin.z),
            new THREE.Vector3(tx, this.low, tz),
            new THREE.Vector3(this.origin.x, this.high, this.origin.z),
            new THREE.Vector3(tx, this.high, tz)
        ];

        if (!this.threeObject) {
            this.createActiveCursor(vertices);
        } else {
            this.updateActiveCursor(vertices);
        }
    }

    setActive() {
        this.active = true;
        SCENE.scene.remove(this.threeObject);
        this.threeObject = null;
    }

    makeSureLineIsIn45DegreeInterval(x, z) {
        let dx = Math.abs(this.origin.x - x);
        let dz = Math.abs(this.origin.z - z);
        let diag = Math.min(dx, dz);

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

        return {tx: tx || this.origin.x, tz: tz || this.origin.z};
    }

    createInactiveCursor(vertices) {
        const material = new THREE.LineBasicMaterial( { color: 0xff0000 } );
        this.geometry = new THREE.Geometry();
        this.geometry.vertices = vertices;
        this.threeObject = new THREE.Line(this.geometry, material);
        SCENE.scene.add(this.threeObject);
    }

    updateInactiveCursor(vertices) {
        this.geometry.vertices = vertices;
        this.geometry.verticesNeedUpdate = true;
    }

    createActiveCursor(vertices) {
        const material = new THREE.MeshBasicMaterial({
            color: 0xff0000,
            side: THREE.DoubleSide,
        });
        this.geometry = new THREE.Geometry();
        this.geometry.vertices = vertices;
        this.geometry.faces = [new THREE.Face3(1, 0, 2), new THREE.Face3(1, 2, 3)];
        this.geometry.computeBoundingSphere();
        this.threeObject = new THREE.Mesh(this.geometry, material);
        SCENE.scene.add(this.threeObject);
    }

    updateActiveCursor(vertices) {
        this.geometry.vertices[1].x = vertices[1].x;
        this.geometry.vertices[1].z = vertices[1].z;
        this.geometry.vertices[3].x = vertices[3].x;
        this.geometry.vertices[3].z = vertices[3].z;
        this.geometry.computeBoundingSphere()
        this.geometry.verticesNeedUpdate = true;
    }

    selection() {
        return this.selected;
    }
}

class ModelSelection {
    constructor() {
        this.hoverThreeObject = new THREE.BoxHelper(undefined, 0xffff00);
        this.selectedThreeObject = null;
        this.selectedId = undefined;
        this.hoveringOverInstance = false;
        this.lastHoveredInstance = undefined;
    }

    setHoverModel(id, instance, intersection) {
        this.selectedId = id;
        this.hoveringOverInstance = !!instance;

        if (this.hoveringOverInstance) {
            this.lastHoveredInstance = instance;
            this.hoverThreeObject.setFromObject(instance);
            SCENE.scene.add(this.hoverThreeObject);
        } else {
            SCENE.scene.remove(this.hoverThreeObject);
        }
    }

    selectModel() {
        if (this.hoveringOverInstance) {
            if (this.selectedThreeObject === null) {
                this.selectedThreeObject = new THREE.BoxHelper(undefined, 0xffff00);
                SCENE.scene.add(this.selectedThreeObject);
            }

            this.selectedThreeObject.setFromObject(this.lastHoveredInstance);
        } else {
            SCENE.scene.remove(this.selectedThreeObject);
            this.selectedThreeObject = null;
        }
    }

    removeSelectedCursor() {
        if (this.selectedThreeObject) {
            SCENE.scene.remove(this.selectedThreeObject);
        }
    }

    selection() {
        return this.selectedId;
    }
}

const SELECTION = new Selection();