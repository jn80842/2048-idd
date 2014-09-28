function GameManager(size, InputManager, Actuator, StorageManager) {
  this.size           = size; // Size of the grid
  this.inputManager   = new InputManager;
  this.storageManager = new StorageManager;
  this.actuator       = new Actuator;

  this.startTiles     = 2;

  this.inputManager.on("move", this.move.bind(this));
  this.inputManager.on("restart", this.restart.bind(this));
  this.inputManager.on("keepPlaying", this.keepPlaying.bind(this));
  this.inputManager.on("flip", this.flip.bind(this));
  this.inputManager.on("merge", this.merge.bind(this));

  this.setup();
}

// Restart the game
GameManager.prototype.restart = function () {
  this.storageManager.clearGameState();
  this.actuator.continueGame(); // Clear the game won/lost message
  this.setup();
};

// Keep playing after winning (allows going over 2048)
GameManager.prototype.keepPlaying = function () {
  this.keepPlaying = true;
  this.actuator.continueGame(); // Clear the game won/lost message
};

GameManager.prototype.flip = function() {
  var newLeftGridClasses = this.grid.flipActive();
  var newRightGridClasses = this.rightGrid.flipActive();
  this.actuator.applyClasses(this.actuator.gridContainer,newLeftGridClasses);
  this.actuator.applyClasses(this.actuator.rightGridContainer,newRightGridClasses)
  this.actuate();
};

GameManager.prototype.merge = function() {
  this.moveSide();
};
// Return true if the game is lost, or has won and the user hasn't kept playing
GameManager.prototype.isGameTerminated = function () {
  return this.over || (this.won && !this.keepPlaying);
};

// Set up the game
GameManager.prototype.setup = function () {
  var previousState = this.storageManager.getGameState();

  // Reload the game from a previous game if present
  if (previousState) {
    this.grid        = new Grid(previousState.grid.size,
                                previousState.grid.cells,"left",previousState.grid.active); // Reload grid
    this.rightGrid   = new Grid(previousState.rightGrid.size,previousState.rightGrid.cells,"right",previousState.rightGrid.active); 
    this.score       = previousState.score;
    this.over        = previousState.over;
    this.won         = previousState.won;
    this.keepPlaying = previousState.keepPlaying;
  } else {
    this.grid        = new Grid(this.size,null,"left",true);
    this.rightGrid   = new Grid(this.size,null,"right",true);
    this.score       = 0;
    this.over        = false;
    this.won         = false;
    this.keepPlaying = false;

    // Add the initial tiles
    this.addStartTiles();
    this.rightGrid.flipActive();
  }

  // Update the actuator
  this.actuate();
};

// Set up the initial tiles to start the game with
GameManager.prototype.addStartTiles = function () {
  for (var i = 0; i < this.startTiles; i++) {
    this.addRandomTile("left");
  }
  for (var i = 0; i < this.startTiles; i++) {
    this.addRandomTile("right");
  }
};

// Adds a tile in a random position
GameManager.prototype.addRandomTile = function (side) {
  if (side == "right" && (this.rightGrid.isActive()) && (this.rightGrid.cellsAvailable())) {
    var value = Math.random() < 0.9 ? 2 : 4;
    var tile = new Tile(this.rightGrid.randomAvailableCell(), value);

    this.rightGrid.insertTile(tile);
  } else if (this.grid.isActive() && this.grid.cellsAvailable()) {
    var value = Math.random() < 0.9 ? 2 : 4;
    var tile = new Tile(this.grid.randomAvailableCell(), value);

    this.grid.insertTile(tile);
  }
};

// Sends the updated grid to the actuator
GameManager.prototype.actuate = function () {
  if (this.storageManager.getBestScore() < this.score) {
    this.storageManager.setBestScore(this.score);
  }

  // Clear the state when the game is over (game over only, not win)
  if (this.over) {
    this.storageManager.clearGameState();
  } else {
    this.storageManager.setGameState(this.serialize());
  }

  this.actuator.actuate(this.grid, this.rightGrid, {
    score:      this.score,
    over:       this.over,
    won:        this.won,
    bestScore:  this.storageManager.getBestScore(),
    terminated: this.isGameTerminated()
  });

};

// Represent the current game as an object
GameManager.prototype.serialize = function () {
  return {
    grid:        this.grid.serialize(),
    rightGrid:   this.rightGrid.serialize(),
    score:       this.score,
    over:        this.over,
    won:         this.won,
    keepPlaying: this.keepPlaying
  };
};

// Save all tile positions and remove merger info
GameManager.prototype.prepareTiles = function () {
  this.grid.eachCell(function (x, y, tile) {
    if (tile) {
      tile.mergedFrom = null;
      tile.savePosition();
    }
  });
  this.rightGrid.eachCell(function(x,y,tile) {
    if (tile) {
      tile.mergedFrom = null;
      tile.savePosition();
    }
  });
};

GameManager.prototype.moveTileSide = function(tile,cell) {
  if (tile.side == "left") {
    this.grid.cells[tile.x][tile.y] = null;
    this.rightGrid.cells[tile.x][tile.y] = tile;
    tile.updatePosition(cell);
  } else {
    this.rightGrid.cells[tile.x][tile.y] = null;
    this.grid.cells[tile.x][tile.y] = tile;
    tile.updatePosition(cell);
  }
}


// Move a tile and its representation
GameManager.prototype.moveTile = function (tile, cell) {
  if (tile.side == "left") {
    this.grid.cells[tile.x][tile.y] = null;
    this.grid.cells[cell.x][cell.y] = tile;
    tile.updatePosition(cell);
  } else {
    this.rightGrid.cells[tile.x][tile.y] = null;
    this.rightGrid.cells[cell.x][cell.y] = tile;
    tile.updatePosition(cell);
  }
};

GameManager.prototype.moveSide = function() { // direction is determined by which grid is active
  var self = this;
  var gridMovingFrom, gridMovingTo,activeSide,inactiveSide;
  if (this.grid.isActive()) {
    gridMovingFrom = this.grid;
    gridMovingTo = this.rightGrid;
    activeSide = "left";
    inactiveSide = "right";
  } else {
    gridMovingFrom = this.rightGrid;
    gridMovingTo = this.grid;
    activeSide = "right";
    inactiveSide = "left";
  }
  if (this.isGameTerminated()) return; // notice this is ill-defined for 2 grids though
  var cell, tile;
  var moved = false;
  this.prepareTiles();
  for (var posx = 0; posx < this.size; posx++) {
    for (var posy = 0; posy < this.size; posy++) {
      cell = { x: posx, y: posy, side: activeSide };
      tile = gridMovingFrom.cellContent(cell);
      if (tile) {
        cell.side = inactiveSide;
        next = gridMovingTo.cellContent(cell);
        if (next && tile.value == next.value) {
          var merged = new Tile(cell, tile.value * 2);
          merged.mergedFrom = [tile, next];
          gridMovingTo.insertTile(merged);
          gridMovingFrom.removeTile(tile);
          tile.updatePosition(cell);
          this.score += merged.value;
          if (merged.value === 32) {
            gridMovingTo.gridWon = true;
            if (this.grid.gridWon && this.rightGrid.gridWon) {
              this.won = true;
            }
          }
          moved = true;
        }
        if (!next) {
          this.moveTileSide(tile,cell);
          moved = true;
        }

      }
    }
  }
  if (moved) {

    this.addRandomTile(activeSide);
    if (!this.movesAvailable()) { // also only checks left i think?
      this.over = true; // Game over!
    }

    this.actuate();

  }

};

// Move tiles on the grid in the specified direction
GameManager.prototype.move = function (direction) {
  // 0: up, 1: right, 2: down, 3: left
  var self = this;
  var gridToMove;
  var side;
  if (this.grid.isActive()) {
    gridToMove = this.grid;
    side = "left";
  } else {
    gridToMove = this.rightGrid;
    side = "right";
  }

  if (this.isGameTerminated()) return; // Don't do anything if the game's over

  var cell, tile;

  var vector     = this.getVector(direction);
  var traversals = this.buildTraversals(vector);
  var moved      = false;

  // Save the current tile positions and remove merger information
  this.prepareTiles();

  // Traverse the grid in the right direction and move tiles
  traversals.x.forEach(function (x) {
    traversals.y.forEach(function (y) {
      cell = { x: x, y: y, side: side };
      tile = gridToMove.cellContent(cell);

      if (tile) {
        var positions = self.findFarthestPosition(cell, vector, gridToMove);
        var next      = gridToMove.cellContent(positions.next);

        // Only one merger per row traversal?
        if (next && next.value === tile.value && !next.mergedFrom) {
          var merged = new Tile(positions.next, tile.value * 2);
          merged.mergedFrom = [tile, next];

          gridToMove.insertTile(merged);
          gridToMove.removeTile(tile);

          // Converge the two tiles' positions
          tile.updatePosition(positions.next);

          // Update the score
          self.score += merged.value;

          // The mighty 2048 tile
          if (merged.value === 2048) {
            gridToMove.gridWon = true;
            if (self.grid.gridWon && self.rightGrid.gridWon) {
              self.won = true;
            }
          }
        } else {
          self.moveTile(tile, positions.farthest);
        }

        if (!self.positionsEqual(cell, tile)) {
          moved = true; // The tile moved from its original cell!
        }
      }
    });
  });

  if (moved) {
    this.addRandomTile(side);

    if (!this.movesAvailable()) {
      this.over = true; // Game over!
    }

    this.actuate();
  }
};

// Get the vector representing the chosen direction
GameManager.prototype.getVector = function (direction) {
  // Vectors representing tile movement
  var map = {
    0: { x: 0,  y: -1 }, // Up
    1: { x: 1,  y: 0 },  // Right
    2: { x: 0,  y: 1 },  // Down
    3: { x: -1, y: 0 }   // Left
  };

  return map[direction];
};

// Build a list of positions to traverse in the right order
GameManager.prototype.buildTraversals = function (vector) {
  var traversals = { x: [], y: [] };

  for (var pos = 0; pos < this.size; pos++) {
    traversals.x.push(pos);
    traversals.y.push(pos);
  }

  // Always traverse from the farthest cell in the chosen direction
  if (vector.x === 1) traversals.x = traversals.x.reverse();
  if (vector.y === 1) traversals.y = traversals.y.reverse();

  return traversals;
};

GameManager.prototype.findFarthestPosition = function (cell, vector, grid) {
  var previous;

  // Progress towards the vector direction until an obstacle is found
  do {
    previous = cell;
    cell     = { x: previous.x + vector.x, y: previous.y + vector.y, side: grid.side };
  } while (grid.withinBounds(cell) &&
           grid.cellAvailable(cell));

  return {
    farthest: previous,
    next: cell // Used to check if a merge is required
  };
};

//only checks left
GameManager.prototype.movesAvailable = function () {
  return this.grid.cellsAvailable() || this.tileMatchesAvailable();
};

// why doesn't this method belong to grid class?
// Check for available matches between tiles (more expensive check)
GameManager.prototype.tileMatchesAvailable = function () {
  var self = this;

  var tile;

  for (var x = 0; x < this.size; x++) {
    for (var y = 0; y < this.size; y++) {
      tile = this.grid.cellContent({ x: x, y: y });

      if (tile) {
        for (var direction = 0; direction < 4; direction++) {
          var vector = self.getVector(direction);
          var cell   = { x: x + vector.x, y: y + vector.y, side: "left" };

          var other  = self.grid.cellContent(cell);

          if (other && other.value === tile.value) {
            return true; // These two tiles can be merged
          }
        }
      }
    }
  }

  return false;
};

GameManager.prototype.positionsEqual = function (first, second) {
  return first.x === second.x && first.y === second.y && first.side == second.side;
};
