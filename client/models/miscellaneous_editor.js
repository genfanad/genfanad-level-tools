class MiscellaneousEditor {
  constructor() {
    this.type = 'none';
    this.key = undefined;
  }

  deselect() {
    this.type = 'none';
    this.key = undefined;
  }

  select(type, key) {
    this.type = type;
    this.key = key;
  }
}

var MISC_EDITOR = new MiscellaneousEditor();