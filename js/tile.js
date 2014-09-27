function Tile(position, value) {
  this.x                = position.x;
  this.y                = position.y;
  this.side             = position.side;
  this.value            = value || 2;

  this.previousPosition = null;
  this.mergedFrom       = null; // Tracks tiles that merged together
}

Tile.prototype.savePosition = function () {
  this.previousPosition = { x: this.x, y: this.y, side: this.side };
};

Tile.prototype.updatePosition = function (position) {
  this.x = position.x;
  this.y = position.y;
  this.side = position.side;
};

Tile.prototype.serialize = function () {
  return {
    position: {
      x: this.x,
      y: this.y,
      side: this.side
    },
    value: this.value,
  };
};
