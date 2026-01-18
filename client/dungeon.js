class DungeonManager {
    constructor() {
        this.enabled = false;
        this.dungeonName = null;
        this.data = null;
        this.barrierGroup = new THREE.Group();
        this.roomGroup = new THREE.Group();
        this.roomGroup = new THREE.Group();
        this.helpersGroup = new THREE.Group();
        this.connectionsGroup = new THREE.Group();
        
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
        SCENE.features['layer-dungeon-connections'] = { visible: false, instance: this.connectionsGroup };
        
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
            this.render();
        });
    }

    save() {
        if (!this.dungeonName || !this.data) return;
        post(`api/workspaces/json/${WORKSPACES.opened}/dungeon-${this.dungeonName}`, this.data, () => {
             // Flash save button or log?
             console.log("Dungeon saved.");
        });
    }

    openDefinitionFile() {
        if (!this.dungeonName) return;
        get(`api/workspaces/open-dungeon/${this.dungeonName}?workspace=${WORKSPACES.opened}`, () => {});
    }

    render() {
        this.renderBarriers();
        this.renderRooms();
        this.renderConnections();
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

    renderConnections() {
        while(this.connectionsGroup.children.length > 0) {
             this.connectionsGroup.remove(this.connectionsGroup.children[0]);
        }

        if (!this.data) return;

        // 1. Room -> Barrier (Green=Unlock, Red=Lock)
        if (this.data.rooms) {
            for (let id in this.data.rooms) {
                let r = this.data.rooms[id];
                if (!r.exits) continue;
                for (let exitName in r.exits) {
                    let exit = r.exits[exitName];
                    if (exit.unlocks) {
                        for (let barrierId of exit.unlocks) {
                            this.drawConnectionRoomToBarrier(id, barrierId, 0x00ff00);
                        }
                    }
                    if (exit.locks) {
                        for (let barrierId of exit.locks) {
                            this.drawConnectionRoomToBarrier(id, barrierId, 0xff0000);
                        }
                    }
                }
            }
        }

        // 2. Barrier -> Room (Blue, Access)
        // 3. Choice Paths (Purple)
        if (this.data.barriers) {
            for (let id in this.data.barriers) {
                let b = this.data.barriers[id];
                
                // Unlocks Room
                if (b.unlocks_room) {
                    this.drawConnectionBarrierToRoom(id, b.unlocks_room, 0x0000ff);
                }

                // Choice Interactions
                if (b.interaction && b.interaction.type == 'choice' && b.interaction.choices) {
                    for (let choice of b.interaction.choices) {
                        if (choice.unlocks) {
                            for (let targetBarrierId of choice.unlocks) {
                                this.drawConnectionBarrierToBarrier(id, targetBarrierId, 0xff00ff);
                            }
                        }
                    }
                }
            }
        }
    }

    _drawArrow(p1, p2, color) {
        let dir = new THREE.Vector3().subVectors(p2, p1);
        let len = dir.length();
        // Shorten slightly to not bury in object
        if (len > 1.0) {
            dir.normalize();
            p1 = p1.clone().add(dir.clone().multiplyScalar(0.5));
            p2 = p2.clone().sub(dir.clone().multiplyScalar(0.5));
            len -= 1.0;
            let arrow = new THREE.ArrowHelper(dir, p1, len, color, 0.5, 0.3);
            this.connectionsGroup.add(arrow);
        }
    }

    drawConnectionRoomToBarrier(roomId, barrierId, color) {
        let r = this.data.rooms[roomId];
        let b = this.data.barriers[barrierId];
        if (!r || !b || !r.icon_location || !b.visual) return;

        let p1 = new THREE.Vector3(r.icon_location.x, SCENE.terrain.heightAt(r.icon_location.x, r.icon_location.y) + 1.0, r.icon_location.y);
        
        // Barrier center
        let mx = (b.visual.from.x + b.visual.to.x)/2;
        let my = (b.visual.from.y + b.visual.to.y)/2;
        let h = SCENE.terrain.heightAt(mx, my) + 0.5;
        let p2 = new THREE.Vector3(mx, h, my);

        this._drawArrow(p1, p2, color);
    }

    drawConnectionBarrierToRoom(barrierId, roomId, color) {
        let r = this.data.rooms[roomId];
        let b = this.data.barriers[barrierId];
        if (!r || !b || !r.icon_location || !b.visual) return;

        let mx = (b.visual.from.x + b.visual.to.x)/2;
        let my = (b.visual.from.y + b.visual.to.y)/2;
        let h = SCENE.terrain.heightAt(mx, my) + 0.5;
        let p1 = new THREE.Vector3(mx, h, my);

        let p2 = new THREE.Vector3(r.icon_location.x, SCENE.terrain.heightAt(r.icon_location.x, r.icon_location.y) + 1.0, r.icon_location.y);

        this._drawArrow(p1, p2, color);
    }

    drawConnectionBarrierToBarrier(b1Id, b2Id, color) {
        let b1 = this.data.barriers[b1Id];
        let b2 = this.data.barriers[b2Id];
        if (!b1 || !b2 || !b1.visual || !b2.visual) return;

        let mx1 = (b1.visual.from.x + b1.visual.to.x)/2;
        let my1 = (b1.visual.from.y + b1.visual.to.y)/2;
        let h1 = SCENE.terrain.heightAt(mx1, my1) + 0.5;
        let p1 = new THREE.Vector3(mx1, h1, my1);

        let mx2 = (b2.visual.from.x + b2.visual.to.x)/2;
        let my2 = (b2.visual.from.y + b2.visual.to.y)/2;
        let h2 = SCENE.terrain.heightAt(mx2, my2) + 0.5;
        let p2 = new THREE.Vector3(mx2, h2, my2);

        this._drawArrow(p1, p2, color);
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

    getClosestObject(tileData) {
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
            return { type: bestType, id: bestId, dist: minDist };
        }
        return null;
    }

    select(tileData) {
        let best = this.getClosestObject(tileData);

        if (best) {
            this.selectById(best.type, best.id);
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
            $('#tools-detail-unselected').hide();
            $('#tools-detail-dungeon-barrier').show();
            $('#tools-detail-dungeon-room').hide();

            document.getElementById('dungeon-barrier-id').innerText = id;
            document.getElementById('dungeon-barrier-info').value = b.visual.info || "";
            document.getElementById('dungeon-barrier-state').value = b.state || "";
            document.getElementById('dungeon-barrier-unlocks-room').value = b.unlocks_room || "";
            
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
            $('#tools-detail-unselected').hide();
            $('#tools-detail-dungeon-barrier').hide();
            $('#tools-detail-dungeon-room').show();

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
        $('#tools-detail-dungeon-barrier').hide();
        $('#tools-detail-dungeon-room').hide();
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

        // Unlocks Room
        let unlocksRoom = document.getElementById('dungeon-barrier-unlocks-room').value;
        if (unlocksRoom) {
            b.unlocks_room = unlocksRoom;
        } else {
            delete b.unlocks_room;
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

    connectSelectionTo(tileData) {
        let target = this.getClosestObject(tileData);
        if (!target) return;

        // Source = Selected Object
        if (this.selectedRoomId && target.type == 'barrier') {
            // Room -> Barrier (Unlock)
            let r = this.data.rooms[this.selectedRoomId];
            if (!r.exits) r.exits = {};
            if (!r.exits.next) r.exits.next = { 
                description: "Next", 
                room: "", 
                unlocks: [] 
            };
            if (!r.exits.next.unlocks) r.exits.next.unlocks = [];

            let list = r.exits.next.unlocks;
            let idx = list.indexOf(target.id);
            if (idx >= 0) {
            let idx = list.indexOf(target.id);
            if (idx >= 0) {
                // Toggle Off
                list.splice(idx, 1);
            } else {
                // Toggle On
                list.push(target.id);
            }
            this.save();
            this.render();

        } else if (this.selectedBarrierId && target.type == 'room') {
            // Barrier -> Room (Access)
            let b = this.data.barriers[this.selectedBarrierId];
            if (b.unlocks_room == target.id) {
            if (b.unlocks_room == target.id) {
                 // Toggle Off
                 delete b.unlocks_room;
            } else {
                 // Toggle On
                 b.unlocks_room = target.id;
            }
            this.save();
            this.render();
        } else {
            console.log("Invalid connection type. Source must be Room (for Barrier target) or Barrier (for Room target).");
        }
    }

    setBarrierType(id, type) {
        if (!this.data || !this.data.barriers[id]) return;
        let b = this.data.barriers[id];

        if (type == 'counter') {
            b.visual.info = 'counter';
            b.visual.color = { r: 200, g: 0, b: 215 };
            delete b.interaction;
        } else if (type == 'optional') {
            b.visual.info = 'Optional';
            b.visual.color = { r: 0, g: 255, b: 255 };
            delete b.interaction;
        } else if (type == 'choice') {
            b.visual.info = 'choice';
            b.visual.color = { r: 200, g: 0, b: 215 }; // Same color as counter generally? Or maybe distinguish. Keeping purple.
            if (!b.interaction || b.interaction.type != 'choice') {
                b.interaction = {
                    type: 'choice',
                    text: 'A choice lies ahead.',
                    choices: [
                        { text: "Option A", action: "left", locks: [], unlocks: [] },
                        { text: "Option B", action: "right", locks: [], unlocks: [] }
                    ]
                };
            }
        }

        this.save();
        this.render();
        // Refresh UI if selected
        if (this.selectedBarrierId == id) {
            this.selectById('barrier', id);
        }
    }
}

var DUNGEON = new DungeonManager();
