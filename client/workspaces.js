class Workspaces {
    constructor() {
        this.opened = undefined;
    }

    closeWorkspace() {
        console.log("Closing " + this.opened);

        if (!this.opened) return;

        this.opened = undefined;
    }

    openWorkspace(name) {
        if (this.opened == name) return;

        this.closeWorkspace();

        console.log("Opening " + name);

        MAPLOADER.load(name, (map) => {
            this.current_map = map;
        });

        document.getElementById('currently-open').innerText = name;

        this.opened = name;
    }

    create() {
        console.log('TODO: new');
    }

    open() {
        console.log('TODO: open');
    }

    reload() {
        console.log('TODO: reload');
    }

    save() {
        console.log('TODO: save');
    }

    init() {
        get('/api/workspaces/list', (data) => {
            let list = document.getElementById('file-workspaces');
            list.innerHTML = "";
            for (let workspace of data) {
                let e = document.createElement('li');
                e.innerText = workspace;
                list.appendChild(e);
            }
            $('#file-workspaces').datalist({
                onSelect: (n,r) => this.openWorkspace(r.value)
            });
        });
    }
}

var WORKSPACES = new Workspaces();