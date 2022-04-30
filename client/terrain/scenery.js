class ModelLoader {
    constructor(root) {
        this.obj_loader = new THREE.OBJLoader();
        this.fbx_loader = new THREE.FBXLoader();
        this.cache = {};
        this.pending = {};
        this.root = root || '/static/models/';
    }

    useTextureManager(textures) {
        this.textures = textures;
    }

    useShaderUniforms(uniforms) {
        this.shader_uniforms = uniforms;
    }

    /**
     * Loads a model with a potential texture and material.
     * 
     * Unique models are model + material (optional).
     * Texture is added to mesh after loading.
     */
    loadModel(modelInfo, callback) {
        let key = modelInfo.model;
        if (modelInfo.material) key += modelInfo.material;

        if (key == 'polygon') {
            let geometry = new THREE.PlaneGeometry( 1, 1.6, 1, 1 ); // WALL_HEIGHT
            let material = new THREE.MeshBasicMaterial( {color: 0xffffff, side: THREE.DoubleSide} );
            let plane = new THREE.Mesh( geometry, material );
            plane.position.set(0,0.8,0);
            plane.name = 'mesh-polygon';
            //plane.matrixAutoUpdate = false;

            callback(this.applyTextures(modelInfo, plane));
            return;
        }

        if (key == 'fishing-spot') {
            let geometry = new THREE.PlaneGeometry( 1, 1, 1, 1 );
            let material = new THREE.MeshBasicMaterial( {
                color: 0xffffff, 
                side: THREE.DoubleSide
            } );
            let plane = new THREE.Mesh( geometry, material );
            plane.matrixAutoUpdate = false;
            plane.renderOrder = 20;

            callback(this.applyTextures(modelInfo, plane));
            return;
        }

        if (this.pending[key]) {
            this.pending[key].callbacks.push({ modelInfo: modelInfo, callback: callback });
            return;
        }

        this.pending[key] = {callbacks:[{ modelInfo: modelInfo, callback: callback }]};

        if (modelInfo.material) {
            // TODO: Lots of special-cased features in these.
            var mtlLoader = new THREE.MTLLoader();
            mtlLoader.load(this.root + modelInfo.material, (materials) => {
                materials.preload();
                let loader = new THREE.OBJLoader();
                loader.setMaterials( materials );
                loader.load(this.root + modelInfo.model, (model) => {
                    this.loadedModel(key, modelInfo, model);    
                });
            });
        } else {
            let path = modelInfo.model.split('.').pop();
            let loader = path == 'fbx' ? this.fbx_loader : this.obj_loader;
            loader.load(this.root + modelInfo.model, (model) => {
                this.loadedModel(key, modelInfo, model);
            }, undefined, (error) => {
                console.error(error);
            });
        }
    }

    loadedModel(key, modelInfo, model) {
        model.matrixAutoUpdate = false;
        
        let callbacks = this.pending[key].callbacks;
        delete this.pending[key];
        this.cache[key] = model;
        for (let c in callbacks) {
            callbacks[c].callback(
                this.applyTextures(callbacks[c].modelInfo, model)
            );
        }
    }

    /**
     * Returns a clone of the mesh with textures applied.
     */
    applyTextures(definition, mesh) {
        let clone = mesh.clone();

        if (!definition.multitexture &&
            !definition.texture && 
            !definition.color && 
            !definition.shader) return clone;

        clone.traverse( (n) => {
            if (n instanceof THREE.Mesh && n.material) {
                if (Array.isArray(n.material)) {
                    let materials = [];
                    for (let m in n.material) {
                        materials[m] = this.tweakMaterial(n.material[m], definition);
                    }
                    n.material = materials;
                } else {
                    n.material = this.tweakMaterial(n.material, definition);
                }
            }
        });

        return clone;
    }

    tweakMaterial(material, definition) {
        let m = material.clone();
        m.side = THREE.DoubleSide;

        if (definition.color) {
            m.color = new THREE.Color(definition.color);
        }

        let textureFound = false;
        if (definition.multitexture) {
            let key = m.name.toUpperCase();
            let d = definition.multitexture[key];
            if (d) {
                m.transparent = true;    
                m.map = this.textures.get(d.texture);
                m.alphaTest = definition.alphaTest || 0.5;
                textureFound = true;
            }
        }

        if (!textureFound && definition.texture) {
            m.transparent = true;
            m.map = this.textures.get(definition.texture);
            m.alphaTest = definition.alphaTest || 0.5;
        }
        m.needsUpdate = true;
        return m;
    }
}

class SceneryLoader {
    constructor() {}

    useModelLoader(models) {
        this.loader = models;
    }

    useSceneryDefinitions(defs) {
        this.definitions = defs;
    }

    _create(m, callback) {
        this.loader.loadModel(m, (mesh) => {
          let original = mesh.clone();
          if (m.scale) mesh.scale.set(N(m.scale.x), N(m.scale.y), N(m.scale.z));
    
          mesh.position.set(
            N(m?.offset?.x || 0.0),
            N(m?.offset?.y || 0.0),
            N(m?.offset?.z || 0.0));

          if (m.model == 'fishing-spot') {
            mesh.rotateX(THREE.Math.degToRad(-90));
          }
    
          mesh.updateMatrix();
    
          callback(mesh, m, original);
        });
      }
    
      createUnique(definition, callback) {
        let key = definition.scenery_key;
        let model_def = this.definitions[key];
    
        if (!model_def) {
          console.log("Invalid unique. No model found for key: ", key);
          return;
        }
    
        let merged_def = Object.assign({}, model_def || {}, definition);

        this._create(merged_def, callback);
      }
    
      createScenery(definition, callback) {
        let m = this.definitions[definition.object];
    
        if (!m) {
          console.log("Invalid model: " + definition.object)
          return;
        }
    
        this._create(m, callback);
      }
}