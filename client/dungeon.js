class DungeonManager {
    constructor() {
        this.enabled = false;
        this.dungeonName = null;
        this.data = null;
        this.barrierGroup = new THREE.Group();
        this.roomGroup = new THREE.Group();
        this.helpersGroup = new THREE.Group();
        
        this.barrierGroup = new THREE.Group();
        this.roomGroup = new THREE.Group();
        this.helpersGroup = new THREE.Group();
        
        this.selectedBarrierId = null;
        this.selectedRoomId = null;
    }

    init() {   
        this.rootGroup = new THREE.Group();
        this.rootGroup.add(this.barrierGroup);
        this.rootGroup.add(this.roomGroup);
        this.rootGroup.add(this.helpersGroup);
        
        // Register feature for layer toggling (needs to match an ID in the layer tree ideally)
        // For now, we manually manage or add to 'layer-dungeon' if exists.
        // If we want it to be part of the standard layer system:
        SCENE.features['layer-dungeon'] = { visible: true, instance: this.rootGroup };
        SCENE.scene.add(this.rootGroup);
        SCENE.updateLayerVisibility(); 

        this.loadList();

        // Selection highlight
        this.selectionMesh = new THREE.Mesh(
            new THREE.BoxGeometry(1.2, 1.2, 1.2), 
            new THREE.MeshBasicMaterial({ color: 0xffff00, wireframe: true })
        );
        this.helpersGroup.add(this.selectionMesh);
        this.selectionMesh.visible = false;
    }

    loadList() {
        if (!WORKSPACES.opened) return; // Wait for workspace
        get('api/workspaces/list-dungeons?workspace=' + WORKSPACES.opened, (list) => {
            let select = document.getElementById('dungeon-file-select');
            if (!select) return;
            select.innerHTML = '';
            for (let d of list) {
                let opt = document.createElement('option');
                opt.value = d;
                opt.innerText = d;
                select.appendChild(opt);
            }
            if (list.length > 0) {
                this.load(list[0]);
                select.value = list[0];
            }
        });
    }


    load(name) {
        this.dungeonName = name;
        get(`api/workspaces/json/${WORKSPACES.opened}/dungeon-${name}`, (data) => {
            this.data = data;
            /* Validate structure */
            if (!this.data.barriers) this.data.barriers = {};
            if (!this.data.rooms) this.data.rooms = {};

            this.render();
            console.log("Dungeon loaded:", name);
        });
    }

    save() {
        if (!this.dungeonName || !this.data) return;
        post(`api/workspaces/json/${WORKSPACES.opened}/dungeon-${this.dungeonName}`, this.data, () => {
             // Flash save button or log?
             console.log("Dungeon saved.");
        });
    }

    render() {
        this.renderBarriers();
        this.renderRooms();
    }

    renderBarriers() {
        while(this.barrierGroup.children.length > 0){ 
            this.barrierGroup.remove(this.barrierGroup.children[0]); 
        }
        if (!this.data || !this.data.barriers) return;

        for (let id in this.data.barriers) {
            let b = this.data.barriers[id];
            if (b.visual) {
                this.createBarrierVisual(id, b);
            }
        }
    }

    createBarrierVisual(id, b) {
        let v = b.visual;
        let p1 = v.from;
        let p2 = v.to;

        // Draw line
        let h1 = SCENE.terrain.heightAt(p1.x, p1.y) + 0.5;
        let h2 = SCENE.terrain.heightAt(p2.x, p2.y) + 0.5;

        // Visual Line
        let points = [];
        points.push(new THREE.Vector3(p1.x, h1, p1.y));
        points.push(new THREE.Vector3(p2.x, h2, p2.y));

        let geometry = new THREE.BufferGeometry().setFromPoints(points);
        let color = v.color ? new THREE.Color(v.color.r/255, v.color.g/255, v.color.b/255) : new THREE.Color(1, 0, 0);
        
        let material = new THREE.LineBasicMaterial({ color: color, linewidth: 3 });
        let line = new THREE.Line(geometry, material);
        this.barrierGroup.add(line);

        // Center Box
        let midX = (p1.x + p2.x) / 2;
        let midY = (p1.y + p2.y) / 2;
        let midH = (h1 + h2) / 2;
        
        let boxGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        let boxMat = new THREE.MeshBasicMaterial({ color: color });
        let box = new THREE.Mesh(boxGeo, boxMat);
        box.position.set(midX, midH, midY);
        box.userData = { type: 'barrier', id: id };
        this.barrierGroup.add(box);

        // Blocked Tiles Overlay (Orange)
        if (b.blocked_tiles) {
            let overlayGeo = new THREE.Geometry();
            for (let t of b.blocked_tiles) {
                let th = SCENE.terrain.heightAt(t.x, t.y) + 0.1;
                // Create a small quad
                overlayGeo.vertices.push(
                    new THREE.Vector3(t.x, th, t.y),
                    new THREE.Vector3(t.x + 1, th, t.y),
                    new THREE.Vector3(t.x + 1, th, t.y + 1),
                    new THREE.Vector3(t.x, th, t.y + 1)
                );
                let idx = overlayGeo.vertices.length - 4;
                overlayGeo.faces.push(new THREE.Face3(idx, idx+1, idx+2));
                overlayGeo.faces.push(new THREE.Face3(idx, idx+2, idx+3));
            }
            let overlayMat = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
            let overlayMesh = new THREE.Mesh(overlayGeo, overlayMat);
            this.barrierGroup.add(overlayMesh);
        }
    }

    renderRooms() {
        while(this.roomGroup.children.length > 0){ 
            this.roomGroup.remove(this.roomGroup.children[0]); 
        }
        if (!this.data || !this.data.rooms) return;

        for (let id in this.data.rooms) {
            let r = this.data.rooms[id];
            if (r.icon_location) {
                let loc = r.icon_location;
                let h = SCENE.terrain.heightAt(loc.x, loc.y) + 1.0;
                
                let geo = new THREE.SphereGeometry(0.4);
                let mat = new THREE.MeshBasicMaterial({ color: 0x00ff00 }); // Default green
                if (r.minimap_icon == 'skull_red') mat.color.setHex(0xff0000);
                if (r.minimap_icon == 'skull_gold') mat.color.setHex(0xffd700);
                if (r.minimap_icon == 'boss') mat.color.setHex(0xaa00aa);
                if (r.minimap_icon == 'treasure') mat.color.setHex(0xffff00);

                let mesh = new THREE.Mesh(geo, mat);
                mesh.position.set(loc.x, h, loc.y);
                mesh.userData = { type: 'room', id: id };
                this.roomGroup.add(mesh);
            }
        }
    }

    // Tools
    addBarrier(lineData) {
        if (!this.data) return;
        
        let id = 'barrier_' + Math.floor(Math.random() * 10000);
        
        // Calculate blocked tiles using Bresenham's logic or similar
        // For simplicity, just add start and end, and maybe interpolation later.
        // Server side usually handles collision based on this list.
        // I will implement a simple line tracer here.
        let tiles = this.traceLine(lineData.from.x, lineData.from.y, lineData.to.x, lineData.to.y);

        this.data.barriers[id] = {
             blocked_tiles: tiles.map(t => ({x: t.x, y: t.y})), 
             visual: {
                 from: { x: lineData.from.x, y: lineData.from.y },
                 to: { x: lineData.to.x, y: lineData.to.y },
                 info: "new",
                 color: { r: 255, g: 0, b: 0 }
             }
        };
        this.save();
        this.render();
        this.selectById('barrier', id);
    }

    traceLine(x0, y0, x1, y1) {
        // Simple Bresenham-like or step trace
        let tiles = [];
        let dx = Math.abs(x1 - x0);
        let dy = Math.abs(y1 - y0);
        let sx = (x0 < x1) ? 1 : -1;
        let sy = (y0 < y1) ? 1 : -1;
        let err = dx - dy;

        while(true) {
            tiles.push({x: x0, y: y0});
            if ((Math.abs(x0 - x1) < 0.1) && (Math.abs(y0 - y1) < 0.1)) break;
            let e2 = 2*err;
            if (e2 > -dy) { err -= dy; x0 += sx; }
            if (e2 < dx) { err += dx; y0 += sy; }
        }
        return tiles;
    }

    addRoom(tileData) {
        if (!this.data) return;

        let id = 'room_' + Math.floor(Math.random() * 10000);
        this.data.rooms[id] = {
            type: "enemy",
            amount: 1,
            minimap_icon: "skull_grey",
            icon_location: { x: tileData.x, y: tileData.y },
            exits: {}
        };
        this.save();
        this.render();
        this.selectById('room', id);
    }

    select(tileData) {
        // Find nearest object
        let minDist = 2.0;
        let bestId = null;
        let bestType = null;

        // Check rooms
        for (let id in this.data.rooms) {
            let r = this.data.rooms[id];
            if (r.icon_location) {
                let dx = r.icon_location.x - tileData.x;
                let dy = r.icon_location.y - tileData.y;
                let dist = Math.sqrt(dx*dx + dy*dy);
                if (dist < minDist) {
                    minDist = dist;
                    bestId = id;
                    bestType = 'room';
                }
            }
        }

        // Check barriers (center point for now)
        for (let id in this.data.barriers) {
             let b = this.data.barriers[id];
             if (b.visual) {
                 let mx = (b.visual.from.x + b.visual.to.x)/2;
                 let my = (b.visual.from.y + b.visual.to.y)/2;
                 let dist = Math.sqrt(Math.pow(mx - tileData.x, 2) + Math.pow(my - tileData.y, 2));
                 if (dist < minDist) {
                     minDist = dist;
                     bestId = id;
                     bestType = 'barrier';
                 }
             }
        }

        if (bestId) {
            this.selectById(bestType, bestId);
        } else {
            this.clearSelection();
        }
    }

    selectById(type, id) {
        this.clearSelection(); // Visually clear old selection

        if (type == 'barrier') {
            this.selectedBarrierId = id;
            this.selectedRoomId = null;
            
            let b = this.data.barriers[id];
            
            // Populate UI
            $('#tools-detail-dungeon-barrier').removeClass('hidden');
            $('#tools-detail-dungeon-room').addClass('hidden');

            document.getElementById('dungeon-barrier-id').innerText = id;
            document.getElementById('dungeon-barrier-info').value = b.visual.info || "";
            document.getElementById('dungeon-barrier-state').value = b.state || "";
            
            let c = b.visual.color || {r:255,g:0,b:0};
            // Hex for input type=color
            let hex = "#" + ((1 << 24) + (c.r << 16) + (c.g << 8) + c.b).toString(16).slice(1);
            document.getElementById('dungeon-barrier-color').value = hex;

            // Visual Highlight (reposition selection mesh)
            let mx = (b.visual.from.x + b.visual.to.x)/2;
            let my = (b.visual.from.y + b.visual.to.y)/2;
            let h = SCENE.terrain.heightAt(mx, my) + 0.5;
            this.selectionMesh.position.set(mx, h, my);
            this.selectionMesh.visible = true;

        } else if (type == 'room') {
            this.selectedRoomId = id;
            this.selectedBarrierId = null;

            let r = this.data.rooms[id];

            // Populate UI
            $('#tools-detail-dungeon-barrier').addClass('hidden');
            $('#tools-detail-dungeon-room').removeClass('hidden');

            document.getElementById('dungeon-room-id').innerText = id;
            document.getElementById('dungeon-room-type').value = r.type;
            document.getElementById('dungeon-room-amount').value = r.amount;
            document.getElementById('dungeon-room-icon').value = r.minimap_icon;

             // Visual Highlight
             let loc = r.icon_location;
             let h = SCENE.terrain.heightAt(loc.x, loc.y) + 1.0;
             this.selectionMesh.position.set(loc.x, h, loc.y);
             this.selectionMesh.visible = true;
        }
    }

    clearSelection() {
        this.selectedBarrierId = null;
        this.selectedRoomId = null;
        this.selectionMesh.visible = false;
        $('#tools-detail-dungeon-barrier').addClass('hidden');
        $('#tools-detail-dungeon-room').addClass('hidden');
    }

    updateBarrier() {
        if (!this.selectedBarrierId) return;
        let b = this.data.barriers[this.selectedBarrierId];
        
        b.visual.info = document.getElementById('dungeon-barrier-info').value;
        
        // Parse Color
        let hex = document.getElementById('dungeon-barrier-color').value;
        let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (result) {
            b.visual.color = {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16)
            };
        }

        // State
        let stateVal = document.getElementById('dungeon-barrier-state').value;
        if (stateVal) {
            b.state = stateVal;
        } else {
            delete b.state;
        }
        
        this.save();
        this.render();
    }

    updateRoom() {
        if (!this.selectedRoomId) return;
        let r = this.data.rooms[this.selectedRoomId];

        r.type = document.getElementById('dungeon-room-type').value;
        r.amount = parseInt(document.getElementById('dungeon-room-amount').value);
        r.minimap_icon = document.getElementById('dungeon-room-icon').value;

        this.save();
        this.render();
    }
}

var DUNGEON = new DungeonManager();
