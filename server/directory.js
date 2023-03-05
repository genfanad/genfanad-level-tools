/**
 * The content folders follow a specific format:
 * 
 * <dir>/metadata.json
 * <dir>/subfolder/metadata.json
 * <dir>/subfolder/foo.json
 * 
 * This results in a single record:
 *   key: "subfolder/foo",
 * 
 * The contents of that record should be:
 *   Object.assign(
 *      {}, 
 *      <dir>/metadata.json, 
 *      <dir>/subfolder/metadata.json, 
 *      <dir>/subfolder/foo.json)
 */
var fs = require('fs-extra');
var path = require("path");
const stringify = require('json-stable-stringify');

/**
 * Does a single level merge of the base and all children.
 * 
 * Allows merging of 'tags' objects.
 */
function singleLevelMerge(base, ...children) {
    let new_object = Object.assign({}, base);
    for (let child of children) {
        for (let key in child) {
            if (typeof new_object[key] === 'object' && typeof child[key] === 'object') {
                for (let new_key in child[key]) {
                    new_object[key][new_key] = child[key][new_key];
                }
            } else {
                new_object[key] = child[key];
            }
        }
    }
    return new_object;
}

function traverseSubdirectory(pathList, metadataList, dir, itemCallback) {
    let metadata = {};
    if (fs.existsSync(dir + "/metadata.json")) {
        metadata = JSON.parse(fs.readFileSync(dir + "/metadata.json").toString());
    }

    let newMetadataList = [...metadataList, metadata];

    let contents = fs.readdirSync(dir);
    for (let i in contents) {
        let ii = contents[i];
        if (ii == 'metadata.json') continue;

        let file = dir + "/" + ii;
        let stats = fs.statSync(file);

        if (stats.isDirectory()) {
            let newPathList = [...pathList, ii];
            traverseSubdirectory(newPathList, newMetadataList, dir + "/" + ii, itemCallback);
        } else if (stats.isFile() && file.endsWith('.json')) {
            try {
                let contents = JSON.parse(fs.readFileSync(file).toString());
                let value = singleLevelMerge(...newMetadataList, contents);

                let extension = path.extname(file);
                let base = path.basename(file, extension);

                let key = [...pathList, base].join('-');

                if (value.authoritativeKey) key = value.authoritativeKey;

                let metadata = {
                    filename: file,
                    short: base,
                    directory: dir,
                    extension: extension,
                    pathlist: pathList,
                };

                try {
                    itemCallback(key, value, metadata);
                } catch (e) {
                    console.log(value);
                    throw e;
                }
            } catch (e) {
                console.log("Invalid JSON file: " + dir + "/" + ii);
                throw e;
            }
        }
    }
}

function typeAgnosticTraversal(pathList, dir, itemCallback) {
    let contents = fs.readdirSync(dir);
    for (let i in contents) {
        let ii = contents[i];

        let file = dir + "/" + ii;
        let stats = fs.statSync(file);

        if (stats.isDirectory()) {
            let newPathList = [...pathList, ii];
            typeAgnosticTraversal(newPathList, file, itemCallback);
        } else if (stats.isFile()) {
            let contents = fs.readFileSync(file);
            let extension = path.extname(file);
            let base = path.basename(file, extension);

            let key = [...pathList, base].join('-');

            try {
                itemCallback(key, contents, {
                    filename: file,
                    short: base,
                    directory: dir,
                    extension: extension,
                    pathlist: pathList
                });
            } catch (e) {
                console.log("Error processing file: " + file);
                throw e;
            }
        }
    }
}

/**
 * Helper method to call each on every file in the directory recursively
 */
function traverseDirectoryRaw(dir, each) {
    typeAgnosticTraversal([], dir, each);
}

function traverseDirectory(dir, callback) {
    let base = {};

    traverseSubdirectory([], [], dir, (key, value) => {
        base[key] = value;
    });

    callback(base);
}

function traverseAndCreateTree(tree, path) {
    for (let i in tree) {
        if (i == '$data') {
            fs.writeFileSync(path + ".json", stringify(tree[i], { space: 2 }));
        } else {
            fs.ensureDirSync(path);
            traverseAndCreateTree(tree[i], path + "/" + i);
        }
    }
}

function createDirectoriesFromFile(file, root) {
    let tree = {};

    // Generate the tree.
    for (let item in file) {
        let keys = item.split('-');
        let value = file[item];

        // create path
        let cur = tree;
        for (let i in keys) {
            let ii = keys[i];
            if (!cur[ii]) cur[ii] = {};
            cur = cur[ii];
        }

        cur["$data"] = value;
    }

    // Create the structure
    traverseAndCreateTree(tree, root);
}

exports.traverseAndCreateTree = traverseAndCreateTree;
exports.createDirectoriesFromFile = createDirectoriesFromFile;
exports.traverseDirectory = traverseDirectory;
exports.traverseDirectoryRaw = traverseDirectoryRaw;
exports.traverseSubdirectory = traverseSubdirectory;