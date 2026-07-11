/**
 * Art & Looks manager — the artist surface for the game's art-style data:
 *
 *  - AREAS: named tile regions (rect sets, global coordinates, can span
 *    segments) that assign a style profile, weather, camera hints, and a
 *    blend time. Drawn with the "Add Rect" tool; visualized as translucent
 *    colored volumes over the open segment.
 *  - PROFILES: named bundles of look values (atmosphere, sky, lighting,
 *    grade, water palettes, ceiling...). Edited as a key/value form; the
 *    game's F8 panel is the live playground to FIND values, this editor is
 *    where they get saved as content.
 *  - LAYERS: per-map-plane environment class (outdoor = sky + world look,
 *    enclosed = void + ceiling + dungeon look).
 *
 * Storage: metadata/art_looks.json in the content repo (server/art.js).
 * "Publish to Game" runs the content-tools bake, which validates and copies
 * to the served static data the game client loads at boot.
 */
class ArtManager {
    constructor() {
        this.looks = { version: 1, layers: {}, profiles: {}, areas: {} };
        this.selectedAreaIndex = -1;
        this.selectedProfile = null;
        this.group = new THREE.Group();
    }

    init() {
        SCENE.features['layer-art-areas'] = { visible: true, instance: this.group };
        SCENE.scene.add(this.group);
        SCENE.updateLayerVisibility();
        this.reload();
    }

    // ---- data plumbing --------------------------------------------------

    reload() {
        get('api/art/looks', (data) => {
            this.looks = data || { version: 1, layers: {}, profiles: {}, areas: {} };
            if (!this.looks.layers) this.looks.layers = {};
            if (!this.looks.profiles) this.looks.profiles = {};
            if (!this.looks.areas) this.looks.areas = {};
            this.selectedAreaIndex = -1;
            this.selectedProfile = Object.keys(this.looks.profiles)[0] || null;
            this.refreshUI();
            this.render();
        });
    }

    save(oncomplete) {
        post('api/art/looks', this.looks, (r) => {
            console.log('Art looks saved:', r.file);
            if (oncomplete) oncomplete();
        });
    }

    publish() {
        this.save(() => {
            post('api/art/publish', {}, (r) => {
                alert(r.ok ? ('Published to game data.\n\n' + r.output)
                    : ('PUBLISH FAILED:\n\n' + (r.output || r.error)));
            });
        });
    }

    // ---- workspace context ----------------------------------------------

    currentLayer() {
        if (!WORKSPACES.opened) return null;
        if (WORKSPACES.opened.indexOf(':') != -1) return WORKSPACES.opened.split(':')[0];
        let meta = WORKSPACES.current_map && WORKSPACES.current_map.loadedArgs.metadata;
        return meta ? meta.layer : null;
    }

    segmentOrigin() {
        if (WORKSPACES.opened && WORKSPACES.opened.indexOf(':') != -1) {
            let [mx, my] = WORKSPACES.opened.split(':')[1].split('_').map(Number);
            return { x: mx * wSIZE, y: my * wSIZE };
        }
        let meta = WORKSPACES.current_map && WORKSPACES.current_map.loadedArgs.metadata;
        if (meta && meta.MIN_X !== undefined) return { x: meta.MIN_X, y: meta.MIN_Y };
        return { x: 0, y: 0 };
    }

    layerAreas() {
        let layer = this.currentLayer();
        if (!layer) return [];
        if (!this.looks.areas[layer]) this.looks.areas[layer] = [];
        return this.looks.areas[layer];
    }

    selectedArea() {
        let areas = this.layerAreas();
        return this.selectedAreaIndex >= 0 ? areas[this.selectedAreaIndex] : null;
    }

    // ---- area editing ----------------------------------------------------

    newArea() {
        let name = prompt('Area name?');
        if (!name) return;
        let profiles = Object.keys(this.looks.profiles);
        let area = { name: name, profile: profiles[0] || 'world', blendMs: 2000, rects: [] };
        this.layerAreas().push(area);
        this.selectedAreaIndex = this.layerAreas().length - 1;
        this.refreshUI();
        this.render();
    }

    deleteArea() {
        let areas = this.layerAreas();
        if (this.selectedAreaIndex < 0) return;
        if (!confirm(`Delete area '${areas[this.selectedAreaIndex].name}'?`)) return;
        areas.splice(this.selectedAreaIndex, 1);
        this.selectedAreaIndex = -1;
        this.refreshUI();
        this.render();
    }

    selectArea(index) {
        this.selectedAreaIndex = Number(index);
        this.refreshAreaDetail();
        this.render();
    }

    /** 'Add Rect' tool: local segment selection -> global rect on the area. */
    addRectFromSelection(sel) {
        let area = this.selectedArea();
        if (!area) { alert('Select or create an area first (Art & Looks panel).'); return; }
        let o = this.segmentOrigin();
        area.rects.push([
            o.x + Math.min(sel.minx, sel.maxx), o.y + Math.min(sel.miny, sel.maxy),
            o.x + Math.max(sel.minx, sel.maxx) - 1, o.y + Math.max(sel.miny, sel.maxy) - 1,
        ]);
        this.refreshAreaDetail();
        this.render();
    }

    /** 'Pick Area' tool: select the area covering a clicked tile. */
    pickAreaAt(tile) {
        let o = this.segmentOrigin();
        let gx = o.x + tile.x, gy = o.y + tile.y;
        let areas = this.layerAreas();
        for (let i = 0; i < areas.length; i++) {
            for (let r of areas[i].rects) {
                if (gx >= r[0] && gx <= r[2] && gy >= r[1] && gy <= r[3]) {
                    this.selectedAreaIndex = i;
                    this.refreshUI();
                    this.render();
                    return;
                }
            }
        }
        console.log('No area at', gx, gy);
    }

    removeSelectedRect() {
        let area = this.selectedArea();
        if (!area) return;
        let list = document.getElementById('art-rect-list');
        if (list.selectedIndex < 0) return;
        area.rects.splice(list.selectedIndex, 1);
        this.refreshAreaDetail();
        this.render();
    }

    updateAreaFromForm() {
        let area = this.selectedArea();
        if (!area) return;
        let name = document.getElementById('art-area-name').value.trim();
        if (name) area.name = name;
        area.profile = document.getElementById('art-area-profile').value;
        let weather = document.getElementById('art-area-weather').value.trim();
        if (weather) area.weather = weather; else delete area.weather;
        area.blendMs = Number(document.getElementById('art-area-blend').value) || 2000;
        // Camera hints: only saved when at least one field is set.
        let cam = {};
        for (let key of ['polarMin', 'polarMax', 'frameShift', 'distance']) {
            let v = document.getElementById('art-area-cam-' + key).value;
            if (v !== '') cam[key] = Number(v);
        }
        if (Object.keys(cam).length) area.camera = cam; else delete area.camera;
        this.refreshUI();
        this.render();
    }

    // ---- layer class -----------------------------------------------------

    setLayerEnv(env) {
        let layer = this.currentLayer();
        if (!layer) return;
        if (!this.looks.layers[layer]) this.looks.layers[layer] = {};
        this.looks.layers[layer].env = env;
    }

    // ---- profile editing ---------------------------------------------------

    selectProfile(name) {
        this.selectedProfile = name;
        this.refreshProfileEditor();
    }

    newProfile() {
        let name = prompt('New profile name? (lowercase-with-dashes)');
        if (!name) return;
        if (this.looks.profiles[name]) { alert('Profile exists.'); return; }
        let clone = this.selectedProfile && confirm(`Copy values from '${this.selectedProfile}'?`);
        this.looks.profiles[name] = clone
            ? JSON.parse(JSON.stringify(this.looks.profiles[this.selectedProfile]))
            : {};
        this.selectedProfile = name;
        this.refreshUI();
    }

    deleteProfile() {
        let name = this.selectedProfile;
        if (!name) return;
        for (let layer in this.looks.areas) {
            for (let area of this.looks.areas[layer]) {
                if (area.profile == name) {
                    alert(`Profile '${name}' is used by area '${area.name}' (${layer}).`);
                    return;
                }
            }
        }
        if (!confirm(`Delete profile '${name}'?`)) return;
        delete this.looks.profiles[name];
        this.selectedProfile = Object.keys(this.looks.profiles)[0] || null;
        this.refreshUI();
    }

    setProfileKey(key, value) {
        let profile = this.looks.profiles[this.selectedProfile];
        if (!profile) return;
        profile[key] = value;
    }

    addProfileKey() {
        let profile = this.looks.profiles[this.selectedProfile];
        if (!profile) { alert('Select or create a profile first.'); return; }
        let key = document.getElementById('art-profile-add-key').value.trim();
        if (!key) return;
        let isColor = confirm('OK = color value [r,g,b], Cancel = single number');
        profile[key] = isColor ? [1, 1, 1] : 0;
        document.getElementById('art-profile-add-key').value = '';
        this.refreshProfileEditor();
    }

    removeProfileKey(key) {
        let profile = this.looks.profiles[this.selectedProfile];
        if (!profile) return;
        delete profile[key];
        this.refreshProfileEditor();
    }

    // ---- UI refresh --------------------------------------------------------

    refreshUI() {
        // Area list for the current layer.
        let list = document.getElementById('art-area-list');
        if (!list) return;
        list.innerHTML = '';
        this.layerAreas().forEach((area, i) => {
            let o = document.createElement('option');
            o.value = i;
            o.text = area.name;
            if (i == this.selectedAreaIndex) o.selected = true;
            list.appendChild(o);
        });

        // Layer env for the current layer.
        let layer = this.currentLayer();
        let envSel = document.getElementById('art-layer-env');
        if (envSel && layer) {
            let entry = this.looks.layers[layer] || {};
            envSel.value = entry.env || 'outdoor';
            document.getElementById('art-layer-name').innerText = layer;
        }

        this.refreshAreaDetail();
        this.refreshProfileEditor();
    }

    refreshAreaDetail() {
        let area = this.selectedArea();
        let detail = document.getElementById('art-area-detail');
        if (!detail) return;
        detail.style.display = area ? 'block' : 'none';
        if (!area) return;

        document.getElementById('art-area-name').value = area.name;
        document.getElementById('art-area-weather').value = area.weather || '';
        document.getElementById('art-area-blend').value = area.blendMs || 2000;
        for (let key of ['polarMin', 'polarMax', 'frameShift', 'distance']) {
            document.getElementById('art-area-cam-' + key).value =
                area.camera && area.camera[key] !== undefined ? area.camera[key] : '';
        }

        // Profile choices = everything in the file + the built-in bases.
        let profSel = document.getElementById('art-area-profile');
        profSel.innerHTML = '';
        let names = [...new Set([...Object.keys(this.looks.profiles), 'world', 'dungeon', 'plain'])];
        for (let name of names) {
            let o = document.createElement('option');
            o.value = name; o.text = name;
            if (name == area.profile) o.selected = true;
            profSel.appendChild(o);
        }

        let rects = document.getElementById('art-rect-list');
        rects.innerHTML = '';
        for (let r of area.rects) {
            let o = document.createElement('option');
            o.text = `[${r[0]}, ${r[1]}] .. [${r[2]}, ${r[3]}]`;
            rects.appendChild(o);
        }
    }

    refreshProfileEditor() {
        let sel = document.getElementById('art-profile-list');
        if (!sel) return;
        sel.innerHTML = '';
        for (let name of Object.keys(this.looks.profiles)) {
            let o = document.createElement('option');
            o.value = name; o.text = name;
            if (name == this.selectedProfile) o.selected = true;
            sel.appendChild(o);
        }

        let rows = document.getElementById('art-profile-rows');
        rows.innerHTML = '';
        let profile = this.looks.profiles[this.selectedProfile];
        if (!profile) return;
        for (let key of Object.keys(profile).sort()) {
            let value = profile[key];
            let row = document.createElement('div');
            row.style.cssText = 'display:flex; align-items:center; gap:4px; padding:1px 0;';
            let label = document.createElement('span');
            label.style.cssText = 'width:210px; overflow:hidden; font-family:monospace;';
            label.innerText = key;
            row.appendChild(label);
            if (Array.isArray(value)) {
                value.forEach((component, ci) => {
                    let input = document.createElement('input');
                    input.type = 'number'; input.step = '0.01'; input.value = component;
                    input.style.width = '52px';
                    input.onchange = () => {
                        let profileNow = this.looks.profiles[this.selectedProfile];
                        profileNow[key][ci] = Number(input.value);
                        swatch.style.background = this.cssColor(profileNow[key]);
                    };
                    row.appendChild(input);
                });
                var swatch = document.createElement('span');
                swatch.style.cssText = 'width:18px; height:14px; display:inline-block; border:1px solid #888; background:' + this.cssColor(value) + ';';
                row.appendChild(swatch);
            } else {
                let input = document.createElement('input');
                input.type = 'number'; input.step = '0.01'; input.value = value;
                input.style.width = '80px';
                input.onchange = () => this.setProfileKey(key, Number(input.value));
                row.appendChild(input);
            }
            let del = document.createElement('button');
            del.innerText = 'x';
            del.title = 'Remove this value from the profile';
            del.onclick = () => this.removeProfileKey(key);
            row.appendChild(del);
            rows.appendChild(row);
        }
    }

    cssColor(rgb) {
        let c = (v) => Math.max(0, Math.min(255, Math.round(v * 255)));
        return `rgb(${c(rgb[0])}, ${c(rgb[1])}, ${c(rgb[2])})`;
    }

    // ---- overlay rendering ---------------------------------------------------

    render() {
        while (this.group.children.length > 0) this.group.remove(this.group.children[0]);
        let layer = this.currentLayer();
        if (!layer || !WORKSPACES.current_map) return;
        let o = this.segmentOrigin();
        let terrain = WORKSPACES.current_map.terrain;
        let areas = this.looks.areas[layer] || [];
        areas.forEach((area, i) => {
            let color = this.areaColor(area.name);
            let selected = i == this.selectedAreaIndex;
            for (let r of area.rects) {
                // Clip to the open segment.
                let minx = Math.max(r[0] - o.x, 0), maxx = Math.min(r[2] - o.x, wSIZE - 1);
                let miny = Math.max(r[1] - o.y, 0), maxy = Math.min(r[3] - o.y, wSIZE - 1);
                if (minx > maxx || miny > maxy) continue;
                let w = maxx - minx + 1, h = maxy - miny + 1;
                let cx = minx + w / 2, cy = miny + h / 2;
                let elev = (terrain.heightAt(Math.floor(cx), Math.floor(cy)) || 0);
                let box = new THREE.Mesh(
                    new THREE.BoxGeometry(w, 3, h),
                    new THREE.MeshBasicMaterial({
                        color: color, transparent: true,
                        opacity: selected ? 0.4 : 0.18, depthWrite: false,
                    }));
                box.position.set(cx, elev + 1.5, cy);
                this.group.add(box);
                let edges = new THREE.LineSegments(
                    new THREE.EdgesGeometry(box.geometry),
                    new THREE.LineBasicMaterial({ color: color }));
                edges.position.copy(box.position);
                this.group.add(edges);
            }
        });
    }

    areaColor(name) {
        let hash = 0;
        for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
        return new THREE.Color().setHSL((hash % 360) / 360, 0.75, 0.5);
    }
}

var ART = new ArtManager();
