// Canvas Asteroids
//
// Copyright (c) 2010 Doug McInnes
//
var Asteroids = {};

(function() {

  var KEY_CODES = {
    32: 'space',
    37: 'left',
    38: 'up',
    39: 'right',
    40: 'down',
    70: 'f',
    71: 'g',
    72: 'h',
    77: 'm',
    80: 'p'
  }

  var KEY_STATUS = { keyDown:false };
  for (code in KEY_CODES) {
    KEY_STATUS[KEY_CODES[code]] = false;
  }

  var keyStatusOf = function (name) {
    return function() { return KEY_STATUS[name]; };
  }

  var rotateLeft    = keyStatusOf('left');
  var rotateRight   = keyStatusOf('right');
  var thrustersOn   = keyStatusOf('up');
  var fireBullets   = keyStatusOf('space');
  var showDebugGrid = keyStatusOf('g');
  var shouldStartGame = function () { return KEY_STATUS.space || window.gameStart;}

  var GRID_SIZE = 60;

  var Matrix = function (rows, columns) {
    var i, j;
    this.data = new Array(rows);
    for (i = 0; i < rows; i++) {
      this.data[i] = new Array(columns);
    }

    this.configure = function (scale, pos) {
      var rad = (pos.rot * Math.PI)/180;
      var sin = Math.sin(rad) * scale;
      var cos = Math.cos(rad) * scale;
      this.set(cos, -sin, pos.x,
               sin,  cos, pos.y);
    };

    this.set = function () {
      var k = 0;
      for (i = 0; i < rows; i++) {
        for (j = 0; j < columns; j++) {
          this.data[i][j] = arguments[k];
          k++;
        }
      }
    }

    this.multiply = function () {
      var vector = new Array(rows);
      for (i = 0; i < rows; i++) {
        vector[i] = 0;
        for (j = 0; j < columns; j++) {
          vector[i] += this.data[i][j] * arguments[j];
        }
      }
      return vector;
    };
  };

  var withContext = function(context, inContext) {
    context.save();
    inContext(context);
    context.restore();
  };

  var xyrot = function(x, y, rot) {
    return {x: x, y: y, rot: (rot || 0)};
  }
  var zeroedXYRot = function() { return xyrot(0,0,0); }
  var centerXYRot = function() { return xyrot(Game.canvasWidth / 2, Game.canvasHeight / 2); }
  var randomPosition = function() {
    return xyrot(Math.random() * Game.canvasWidth,
		 Math.random() * Game.canvasHeight,
		 0);
  };
  var bumpXYRot = function (pt, x, y, rot) {
    return xyrot(pt.x + x, pt.y + y, (pt.rot + (rot||0)) % 360)
  };

  var Sprite = function () {
    this.init = function (name, points) {
      this.name     = name;
      this.points   = points;

      this.pos = zeroedXYRot();
      this.vel = zeroedXYRot();
      this.acc = zeroedXYRot();
    };

    this.children = {};

    this.visible  = false;
    this.reap     = false;
    this.bridgesH = true;
    this.bridgesV = true;

    this.collidesWith = [];

    this.scale = 1;

    this.currentNode = null;
    this.nextSprite  = null;

    this.preMove  = null;
    this.postMove = null;

    this.run = function(delta) {

      this.move(delta);
      this.updateGrid();
      
      var canidates;
      var self = this;
      withContext(this.context, function(context){
        self.configureTransform();
        self.draw(context);

        canidates = self.findCollisionCanidates();

        self.matrix.configure(self.scale, self.pos);
        self.checkCollisionsAgainst(canidates);
      });
      var transformDrawCheckCollisions = function(canidates) {
        withContext(self.context, function(context){
          self.configureTransform();
          self.draw(context);
          self.checkCollisionsAgainst(canidates);
        });
      };

      function hasHorizDupe(sprite) {
        return sprite.bridgesH &&
               sprite.currentNode &&
               sprite.currentNode.dupe.horizontal;
      }
      function hasVertDupe(sprite) {
        return sprite.bridgesV &&
               sprite.currentNode &&
               sprite.currentNode.dupe.vertical;
      }

      if (hasHorizDupe(this)) {
        this.pos.x += this.currentNode.dupe.horizontal;
        transformDrawCheckCollisions(canidates);
        if (this.currentNode) {
          this.pos.x -= this.currentNode.dupe.horizontal;
        }
      }
      if (hasVertDupe(this)) {
        this.pos.y += this.currentNode.dupe.vertical;
        transformDrawCheckCollisions(canidates);
        if (this.currentNode) {
          this.pos.y -= this.currentNode.dupe.vertical;
        }
      }
      if (hasVertDupe(this) && hasHorizDupe(this)) {
        this.pos.x += this.currentNode.dupe.horizontal;
        this.pos.y += this.currentNode.dupe.vertical;
        transformDrawCheckCollisions(canidates);
        if (this.currentNode) {
          this.pos.x -= this.currentNode.dupe.horizontal;
          this.pos.y -= this.currentNode.dupe.vertical;
        }
      }
    };
    this.move = function (delta) {
      if (!this.visible) return;
      this.transPoints = null; // clear cached points

      if ($.isFunction(this.preMove)) {
        this.preMove(delta);
      }

      this.vel = bumpXYRot(this.vel, this.acc.x * delta, this.acc.y * delta);
      this.pos = bumpXYRot(this.pos, this.vel.x * delta, this.vel.y * delta, this.vel.rot * delta);

      if ($.isFunction(this.postMove)) {
        this.postMove(delta);
      }
    };
    this.updateGrid = function () {
      if (!this.visible) return;
      var newNode = this.grid.get(this.pos);
      if (newNode != this.currentNode) {
        if (this.currentNode) {
          this.currentNode.leave(this);
        }
        newNode.enter(this);
        this.currentNode = newNode;
      }

      if (showDebugGrid() && this.currentNode) {
	this.grid.drawDebugHighlight(this.context, this.pos);
      }
    };
    this.configureTransform = function () {
      if (!this.visible) return;

      var rad = (this.pos.rot * Math.PI)/180;

      this.context.translate(this.pos.x, this.pos.y);
      this.context.rotate(rad);
      this.context.scale(this.scale, this.scale);
    };
    this.drawChildren = function (context) {
      for (child in this.children) {
	this.children[child].draw(context);
      }
    }
    this.drawSelf = function (context) {
      context.moveTo(this.points[0], this.points[1]);
      for (var i = 1; i < this.points.length/2; i++) {
	var xi = i*2;
	var yi = xi + 1;
	context.lineTo(this.points[xi], this.points[yi]);
      }
    }
    this.configurePen = function (context) {
      context.lineWidth = 1.0 / this.scale;
    }
    this.draw = function (context) {
      if (!this.visible) return;

      this.configurePen(context);
      this.drawChildren(context);

      context.beginPath();

      this.drawSelf(context);

      context.closePath();
      context.stroke();
    };
    this.findCollisionCanidates = function () {
      if (!this.visible || !this.currentNode) return [];
      var cn = this.currentNode;
      var canidates = [cn.nextSprite,
                       cn.north.nextSprite,
                       cn.south.nextSprite,
                       cn.east.nextSprite,
                       cn.west.nextSprite,
                       cn.north.east.nextSprite,
                       cn.north.west.nextSprite,
                       cn.south.east.nextSprite,
                       cn.south.west.nextSprite].
                       filter(function(sprite) {return sprite;})
      return canidates
    };
    this.checkCollisionsAgainst = function (canidates) {
      var self = this;
      canidates.forEach(function(ref) {
        do {
          self.checkCollision(ref);
          ref = ref.nextSprite;
        } while (ref)
      });
    };
    this.checkCollision = function (other) {
      if (!other.visible ||
          this == other ||
          this.collidesWith.indexOf(other.name) == -1) return;

      var trans = other.transformedPoints();
      var self = this;
      trans.forEach(function(pos) {
        var px=pos.x, py=pos.y;
        // mozilla doesn't take into account transforms with isPointInPath >:-P
        if (($.browser.mozilla) ? self.pointInPolygon(px, py) : self.context.isPointInPath(px, py)) {
          other.collision(self);
          self.collision(other);
          return;
        }
      });
    };
    this.pointInPolygon = function (x, y) {
      var points = this.transformedPoints();
      var j = 1;
      var y0, y1;
      var oddNodes = false;
      for (var i = 0; i < points.length; i += 1) {
        y0 = points[i].y;
        y1 = points[j].y;
        if ((y0 < y && y1 >= y) ||
            (y1 < y && y0 >= y)) {
          if (points[i].x+(y-y0)/(y1-y0)*(points[j].x-points[i].x) < x) {
            oddNodes = !oddNodes;
          }
        }
        j += 1
        if (j == points.length) j = 0;
      }
      return oddNodes;
    };
    this.collision = function () {
    };
    this.die = function () {
      this.visible = false;
      this.reap = true;
      if (this.currentNode) {
	this.currentNode.leave(this);
	this.currentNode = null;
      }
    };
    this.transformedPoints = function () {
      if (this.transPoints) return this.transPoints;
      var trans = [];
      this.matrix.configure(this.scale, this.pos);
      for (var i = 0; i < this.points.length/2; i++) {
        var xi = i*2;
        var yi = xi + 1;
        var pts = this.matrix.multiply(this.points[xi], this.points[yi], 1);
        trans.push(xyrot(pts[0],pts[1],0))
      }
      this.transPoints = trans; // cache translated points
      return trans;
    };
    this.isClear = function () {
      if (this.collidesWith.length == 0) return true;
      var cn = this.currentNode;
      if (cn == null) {
        cn = this.grid.get(this.pos);
      }
      var self = this;
      return [cn,
	            cn.north,
	            cn.south,
	            cn.east,
	            cn.west,
	            cn.north.east,
	            cn.north.west,
	            cn.south.east,
	            cn.south.west].
            every(function(cn) {return cn.isEmpty(self.collidesWith)});
    };
    this.wrapPostMove = function () {
      this.pos.x = (Game.canvasWidth  + this.pos.x) % Game.canvasWidth;
      this.pos.y = (Game.canvasHeight + this.pos.y) % Game.canvasHeight;
    };

  };

  Ship = function () {
    this.init("ship",
	      [-5,   4,
		0, -12,
		5,   4]);

    this.children.exhaust = new Sprite();
    this.children.exhaust.init("exhaust",
			       [-3,  6,
				 0, 11,
				 3,  6]);

    this.bulletCounter = 0;

    this.postMove = this.wrapPostMove;

    this.collidesWith = ["asteroid", "bigalien", "alienbullet"];
    this.preMove = function (delta) {
      if (rotateLeft()) {
	this.vel.rot = -6;
      } else if (rotateRight()) {
	this.vel.rot = 6;
      } else {
	this.vel.rot = 0;
      }

      if (thrustersOn()) {
	var rad = ((this.pos.rot-90) * Math.PI)/180;
	this.acc.x = 0.5 * Math.cos(rad);
	this.acc.y = 0.5 * Math.sin(rad);
	this.children.exhaust.visible = Math.random() > 0.1;
      } else {
	this.acc.x = 0;
	this.acc.y = 0;
	this.children.exhaust.visible = false;
      }

      if (this.bulletCounter > 0) {
	this.bulletCounter -= delta;
      }
      if (fireBullets()) {
	if (this.bulletCounter <= 0) {
	  this.bulletCounter = 10;
	  for (var i = 0; i < this.bullets.length; i++) {
	    if (!this.bullets[i].visible) {
	      SFX.laser();
	      var bullet = this.bullets[i];
	      var rad = ((this.pos.rot-90) * Math.PI)/180;
	      var vectorx = Math.cos(rad);
	      var vectory = Math.sin(rad);
	      // move to the nose of the ship
	      bullet.pos.x = this.pos.x + vectorx * 4;
	      bullet.pos.y = this.pos.y + vectory * 4;
	      bullet.vel.x = 6 * vectorx + this.vel.x;
	      bullet.vel.y = 6 * vectory + this.vel.y;
	      bullet.visible = true;
	      break;
	    }
	  }
	}
      }

      // limit the ship's speed
      if (Math.sqrt(this.vel.x * this.vel.x + this.vel.y * this.vel.y) > 8) {
	this.vel.x *= 0.95;
	this.vel.y *= 0.95;
      }
    };

    this.collision = function (other) {
      SFX.explosion();
      Game.explosionAt(other.pos);
      Game.FSM.state = 'player_died';
      this.visible = false;
      this.currentNode.leave(this);
      this.currentNode = null;
      Game.lives--;
    };

  };
  Ship.prototype = new Sprite();

  BigAlien = function () {
    this.init("bigalien",
	      [-20,   0,
	       -12,  -4,
		12,  -4,
		20,   0,
		12,   4,
	       -12,   4,
	       -20,   0,
		20,   0]);

    this.children.top = new Sprite();
    this.children.top.init("bigalien_top",
			   [-8, -4,
			    -6, -6,
			     6, -6,
			     8, -4]);
    this.children.top.visible = true;

    this.children.bottom = new Sprite();
    this.children.bottom.init("bigalien_top",
			      [ 8, 4,
				6, 6,
			       -6, 6,
			       -8, 4]);
    this.children.bottom.visible = true;

    this.collidesWith = ["asteroid", "ship", "bullet"];

    this.bridgesH = false;

    this.bullets = [];
    this.bulletCounter = 0;

    this.newPosition = function () {
      if (Math.random() < 0.5) {
	this.pos.x = -20;
	this.vel.x = 1.5;
      } else {
	this.pos.x = Game.canvasWidth + 20;
	this.vel.x = -1.5;
      }
      this.pos.y = Math.random() * Game.canvasHeight;
    };

    this.setup = function () {
      this.newPosition();

      for (var i = 0; i < 3; i++) {
	var bull = new AlienBullet();
	this.bullets.push(bull);
	Game.sprites.push(bull);
      }
    };

    this.preMove = function (delta) {
      var cn = this.currentNode;
      if (cn == null) return;

      var topCount = 0;
      if (cn.north.nextSprite) topCount++;
      if (cn.north.east.nextSprite) topCount++;
      if (cn.north.west.nextSprite) topCount++;

      var bottomCount = 0;
      if (cn.south.nextSprite) bottomCount++;
      if (cn.south.east.nextSprite) bottomCount++;
      if (cn.south.west.nextSprite) bottomCount++;

      if (topCount > bottomCount) {
	this.vel.y = 1;
      } else if (topCount < bottomCount) {
	this.vel.y = -1;
      } else if (Math.random() < 0.01) {
	this.vel.y = -this.vel.y;
      }

      this.bulletCounter -= delta;
      if (this.bulletCounter <= 0) {
	this.bulletCounter = 22;
	for (var i = 0; i < this.bullets.length; i++) {
	  if (!this.bullets[i].visible) {
	    bullet = this.bullets[i];
	    var rad = 2 * Math.PI * Math.random();
	    var vectorx = Math.cos(rad);
	    var vectory = Math.sin(rad);
	    bullet.pos.x = this.pos.x;
	    bullet.pos.y = this.pos.y;
	    bullet.vel.x = 6 * vectorx;
	    bullet.vel.y = 6 * vectory;
	    bullet.visible = true;
	    SFX.laser();
	    break;
	  }
	}
      }

    };

    BigAlien.prototype.collision = function (other) {
      if (other.name == "bullet") Game.score += 200;
      SFX.explosion();
      Game.explosionAt(other.pos);
      this.visible = false;
      this.newPosition();
    };

    this.postMove = function () {
      if (this.pos.y > Game.canvasHeight) {
	this.pos.y = 0;
      } else if (this.pos.y < 0) {
	this.pos.y = Game.canvasHeight;
      }

      if ((this.vel.x > 0 && this.pos.x > Game.canvasWidth + 20) ||
	  (this.vel.x < 0 && this.pos.x < -20)) {
	// why did the alien cross the road?
	this.visible = false;
	this.newPosition();
      }
    }
  };
  BigAlien.prototype = new Sprite();

  Bullet = function () {
    this.init("bullet", [0, 0]);
    this.time = 0;
    this.bridgesH = false;
    this.bridgesV = false;
    this.postMove = this.wrapPostMove;
    // asteroid can look for bullets so doesn't have
    // to be other way around
    //this.collidesWith = ["asteroid"];

    this.configureTransform = function () {};
    this.configurePen = function (context) {
      context.lineWidth = 2;
    };
    this.drawSelf = function (context) {
      context.moveTo(this.pos.x-1, this.pos.y-1);
      context.lineTo(this.pos.x+1, this.pos.y+1);
      context.moveTo(this.pos.x+1, this.pos.y-1);
      context.lineTo(this.pos.x-1, this.pos.y+1);
    };
    this.preMove = function (delta) {
      if (this.visible) {
	this.time += delta;
      }
      if (this.time > 50) {
	this.visible = false;
	this.time = 0;
      }
    };
    this.collision = function (other) {
      this.time = 0;
      this.visible = false;
      this.currentNode.leave(this);
      this.currentNode = null;
    };
    this.transformedPoints = function (other) {
      return [this.pos];
    };

  };
  Bullet.prototype = new Sprite();

  AlienBullet = function () {
    this.init("alienbullet");
    this.drawSelf = function (context) {
      context.moveTo(this.pos.x, this.pos.y);
      context.lineTo(this.pos.x-this.vel.x, this.pos.y-this.vel.y);
    };
  };
  AlienBullet.prototype = new Bullet();

  Asteroid = function () {
    this.init("asteroid",
	      [-10,   0,
		-5,   7,
		-3,   4,
		 1,  10,
		 5,   4,
		10,   0,
		 5,  -6,
		 2, -10,
		-4, -10,
		-4,  -5]);

    this.visible = true;
    this.scale = 6;
    this.postMove = this.wrapPostMove;

    this.collidesWith = ["ship", "bullet", "bigalien", "alienbullet"];

    this.collision = function (other) {
      SFX.explosion();
      if (other.name == "bullet") Game.score += 120 / this.scale;
      this.scale /= 3;
      if (this.scale > 0.5) {
	// break into fragments
	for (var i = 0; i < 3; i++) {
	  var roid = $.extend(true, {}, this);
	  roid.vel.x = Math.random() * 6 - 3;
	  roid.vel.y = Math.random() * 6 - 3;
	  roid.vel.rot = Math.random() * 2 - 1;
	  if (Math.random() > 0.5) {
	    roid.points.reverse();
	  }
	  roid.move(roid.scale * 3); // give them a little push
	  Game.sprites.push(roid);
	}
      }
      Game.explosionAt(other.pos);
      this.die();
    };
  };
  Asteroid.prototype = new Sprite();

  Explosion = function () {
    this.init("explosion");

    this.bridgesH = false;
    this.bridgesV = false;

    this.lines = [];
    for (var i = 0; i < 5; i++) {
      var rad = 2 * Math.PI * Math.random();
      var x = Math.cos(rad);
      var y = Math.sin(rad);
      this.lines.push([x, y, x*2, y*2]);
    }

    this.drawSelf = function (context) {
      for (var i = 0; i < 5; i++) {
	var line = this.lines[i];
	context.moveTo(line[0], line[1]);
	context.lineTo(line[2], line[3]);
      }
    };

    this.preMove = function (delta) {
      if (this.visible) {
	this.scale += delta;
      }
      if (this.scale > 8) {
	this.die();
      }
    };
  };
  Explosion.prototype = new Sprite();

  var Grid = function (widthpx, heightpx, nodeSize) {


    this.nodeSize = nodeSize;
    this.width = Math.round(widthpx / nodeSize);
    this.height = Math.round(heightpx / nodeSize);
    var grid = new Array(this.width);
    for (var i = 0; i < this.width; i++) {
      grid[i] = new Array(this.height);
      for (var j = 0; j < this.height; j++) {
	grid[i][j] = new GridNode();
      }
    }

    // set up the positional references
    for (var i = 0; i < this.width; i++) {
      for (var j = 0; j < this.height; j++) {
	var node   = grid[i][j];
	node.north = grid[i][(j == 0) ? this.height-1 : j-1];
	node.south = grid[i][(j == this.height-1) ? 0 : j+1];
	node.west  = grid[(i == 0) ? this.width-1 : i-1][j];
	node.east  = grid[(i == this.width-1) ? 0 : i+1][j];
      }
    }

    // set up borders
    for (var i = 0; i < this.width; i++) {
      grid[i][0].dupe.vertical            =  heightpx;
      grid[i][this.height-1].dupe.vertical = -heightpx;
    }

    for (var j = 0; j < this.height; j++) {
      grid[0][j].dupe.horizontal           =  widthpx;
      grid[this.width-1][j].dupe.horizontal = -widthpx;
    }

    var gridCoordinates = function(pos) {
      var gridx = Math.floor(pos.x / nodeSize);
      var gridy = Math.floor(pos.y / nodeSize);
      gridx = (gridx >= grid.length) ? 0 : gridx;
      gridy = (gridy >= grid[0].length) ? 0 : gridy;
      gridx = (gridx < 0) ? grid.length-1 : gridx;
      gridy = (gridy < 0) ? grid[0].length-1 : gridy;
      return {x: gridx, y: gridy};
    };

    this.grid = grid;
    this.get = function(pos) {
      var coords = gridCoordinates(pos);
      return this.grid[coords.x][coords.y];
    }

    this.drawDebugHighlight = function(context, pos) {
      var coords = gridCoordinates(pos);
      context.lineWidth = 3.0;
      context.strokeStyle = 'green';
      context.strokeRect(coords.x*this.nodeSize+2, coords.y*this.nodeSize+2, this.nodeSize-4, this.nodeSize-4);
      context.strokeStyle = 'black';
      context.lineWidth = 1.0;
    }
  }

  var GridNode = function () {
    this.north = null;
    this.south = null;
    this.east  = null;
    this.west  = null;

    this.nextSprite = null;

    this.dupe = {
      horizontal: null,
      vertical:   null
    };

    this.enter = function (sprite) {
      sprite.nextSprite = this.nextSprite;
      this.nextSprite = sprite;
    };

    this.leave = function (sprite) {
      var ref = this;
      while (ref && (ref.nextSprite != sprite)) {
	ref = ref.nextSprite;
      }
      if (ref) {
	ref.nextSprite = sprite.nextSprite;
	sprite.nextSprite = null;
      }
    };

    this.eachSprite = function(sprite, callback) {
      var ref = this;
      while (ref.nextSprite) {
	ref = ref.nextSprite;
	callback.call(sprite, ref);
      }
    };

    this.isEmpty = function (collidables) {
      var empty = true;
      var ref = this;
      while (ref.nextSprite) {
	ref = ref.nextSprite;
	empty = !ref.visible || collidables.indexOf(ref.name) == -1
	if (!empty) break;
      }
      return empty;
    };
  };

  // borrowed from typeface-0.14.js
  // http://typeface.neocracy.org
  Text = {
    renderGlyph: function (ctx, face, char) {

      var glyph = face.glyphs[char];

      if (glyph.o) {

	var outline;
	if (glyph.cached_outline) {
	  outline = glyph.cached_outline;
	} else {
	  outline = glyph.o.split(' ');
	  glyph.cached_outline = outline;
	}

	var outlineLength = outline.length;
	for (var i = 0; i < outlineLength; ) {

	  var action = outline[i++];

	  switch(action) {
	    case 'm':
	      ctx.moveTo(outline[i++], outline[i++]);
	      break;
	    case 'l':
	      ctx.lineTo(outline[i++], outline[i++]);
	      break;

	    case 'q':
	      var cpx = outline[i++];
	      var cpy = outline[i++];
	      ctx.quadraticCurveTo(outline[i++], outline[i++], cpx, cpy);
	      break;

	    case 'b':
	      var x = outline[i++];
	      var y = outline[i++];
	      ctx.bezierCurveTo(outline[i++], outline[i++], outline[i++], outline[i++], x, y);
	      break;
	  }
	}
      }
      if (glyph.ha) {
	ctx.translate(glyph.ha, 0);
      }
    },

    renderText: function(text, size, x, y) {
      var self=this;
      withContext(this.context, function(context) {
	context.translate(x, y);

	var pixels = size * 72 / (self.face.resolution * 100);
	context.scale(pixels, -1 * pixels);
	context.beginPath();
	var chars = text.split('');
	var charsLength = chars.length;
	for (var i = 0; i < charsLength; i++) {
	  self.renderGlyph(context, self.face, chars[i]);
	}
	context.fill();
      });
    },

    context: null,
    face: null
  };

  var SFX = {
    laser:     new Audio('39459__THE_bizniss__laser.wav'),
    explosion: new Audio('51467__smcameron__missile_explosion.wav')
  };

  // preload audio
  for (var sfx in SFX) {
    (function () {
      var audio = SFX[sfx];
      audio.muted = true;
      audio.play();

      SFX[sfx] = function () {
	if (!this.muted) {
	  if (audio.duration == 0) {
	    // somehow dropped out
	    audio.load();
	    audio.play();
	  } else {
	    audio.muted = false;
	    audio.currentTime = 0;
	  }
	}
	return audio;
      }
    })();
  }
  // pre-mute audio
  SFX.muted = true;
  var drawGameOverText = function () {
    Text.renderText('GAME OVER', 50, Game.canvasWidth/2 - 160, Game.canvasHeight/2 + 10);
  }
  var Game = {
    score: 0,
    totalAsteroids: 5,
    lives: 0,

    canvasWidth: 800,
    canvasHeight: 600,

    sprites: [],
    ship: null,
    bigAlien: null,

    nextBigAlienTime: null,

    spawnAsteroids: function (count) {
      if (!count) count = this.totalAsteroids;
      for (var i = 0; i < count; i++) {
	var roid = new Asteroid();
	roid.pos = randomPosition();
	while (!roid.isClear()) {
	  roid.pos = randomPosition();
	}
	roid.vel.x = Math.random() * 4 - 2;
	roid.vel.y = Math.random() * 4 - 2;
	roid.vel.rot = Math.random() * 2 - 1;
	if (Math.random() > 0.5) {
	  roid.points.reverse();
	}
	Game.sprites.push(roid);
      }
    },

    explosionAt: function (position) {
      var splosion = new Explosion();
      splosion.pos.x = position.x;
      splosion.pos.y = position.y;
      splosion.visible = true;
      Game.sprites.push(splosion);
    },

    FSM: {
      boot: function () {
	Game.spawnAsteroids(5);
	this.state = 'waiting';
      },
      waiting: function () {
	Text.renderText(window.ipad ? 'Touch Screen to Start' : 'Press Space to Start', 36, Game.canvasWidth/2 - 270, Game.canvasHeight/2);
	if (shouldStartGame()) {
	  KEY_STATUS.space = false; // hack so we don't shoot right away
	  window.gameStart = false;
	  this.state = 'start';
	}
      },
      start: function () {
	for (var i = 0; i < Game.sprites.length; i++) {
	  if (Game.sprites[i].name == 'asteroid') {
	    Game.sprites[i].die();
	  } else if (Game.sprites[i].name == 'bullet' ||
		     Game.sprites[i].name == 'bigalien') {
	    Game.sprites[i].visible = false;
	  }
	}

	Game.score = 0;
	Game.lives = 2;
	Game.totalAsteroids = 2;
	Game.spawnAsteroids();

	Game.nextBigAlienTime = Date.now() + 30000 + (30000 * Math.random());

	this.state = 'spawn_ship';
      },
      spawn_ship: function () {
	Game.ship.pos = centerXYRot();
	if (Game.ship.isClear()) {
	  Game.ship.pos.rot = 0;
	  Game.ship.vel = zeroedXYRot();
	  Game.ship.visible = true;
	  this.state = 'run';
	}
      },
      run: function () {
	for (var i = 0; i < Game.sprites.length; i++) {
	  if (Game.sprites[i].name == 'asteroid') {
	    break;
	  }
	}
	if (i == Game.sprites.length) {
	  this.state = 'new_level';
	}
	if (!Game.bigAlien.visible &&
	    Date.now() > Game.nextBigAlienTime) {
	  Game.bigAlien.visible = true;
	  Game.nextBigAlienTime = Date.now() + (30000 * Math.random());
	}
      },
      waitingForTimeToPass: function (timeToWait) {
	if (this.timer == null) {
	  this.timer = Date.now();
	}
	var amWaiting =  Date.now() - this.timer <= timeToWait
	if (!amWaiting) {this.timer = null;}
	return amWaiting;
      },
      new_level: function () {
	// wait a second before spawning more asteroids
	if (this.waitingForTimeToPass(1000)) {
	  return;
	}

	Game.totalAsteroids++;
	if (Game.totalAsteroids > 12) Game.totalAsteroids = 12;
	Game.spawnAsteroids();
	this.state = 'run';
      },
      player_died: function () {
	if (Game.lives < 0) {
	  this.state = 'end_game';
	} else {
	  // wait a second before spawning
	  if (this.waitingForTimeToPass(1000)) {
	    return;
	  }
	  this.state = 'spawn_ship';
	}
      },
      end_game: function () {
	drawGameOverText();
	window.gameStart = false;

	// wait 5 seconds then go back to waiting state
	if (this.waitingForTimeToPass(5000)) {
	  return;
	}
	this.state = 'waiting';
      },

      execute: function () {
	this[this.state]();
      },
      state: 'boot'
    }

  };


  Asteroids.start = function () {
    var canvas = $("#canvas");
    Game.canvasWidth  = canvas.width();
    Game.canvasHeight = canvas.height();

    var context = canvas[0].getContext("2d");

    Text.context = context;
    Text.face = vector_battle;

    var grid = new Grid(Game.canvasWidth, Game.canvasHeight, GRID_SIZE);

    var sprites = [];
    Game.sprites = sprites;

    // so all the sprites can use it
    Sprite.prototype.context = context;
    Sprite.prototype.grid    = grid;
    Sprite.prototype.matrix  = new Matrix(2, 3);

    var ship = new Ship();

    ship.pos = centerXYRot();

    sprites.push(ship);

    ship.bullets = [];
    for (var i = 0; i < 10; i++) {
      var bull = new Bullet();
      ship.bullets.push(bull);
      sprites.push(bull);
    }
    Game.ship = ship;

    var bigAlien = new BigAlien();
    bigAlien.setup();
    sprites.push(bigAlien);
    Game.bigAlien = bigAlien;

    var extraDude = new Ship();
    extraDude.scale = 0.6;
    extraDude.visible = true;
    extraDude.preMove = null;
    extraDude.children = [];

    var i, j = 0;

    var paused = false;
    var showFramerate = false;
    var avgFramerate = 0;
    var frameCount = 0;
    var elapsedCounter = 0;

    var lastFrame = Date.now();
    var elapsed;

    var canvasNode = canvas[0];

    var calcFrameRate = function () {
      frameCount++;
      elapsedCounter += elapsed;
      if (elapsedCounter > 1000) {
        elapsedCounter -= 1000;
        avgFramerate = frameCount;
        frameCount = 0;
      }
    };

    var toggleFrameRate = function () { showFramerate = !showFramerate; };
    var toggleMuted = function () { SFX.muted = !SFX.muted; };
    var togglePaused = function () {
      paused = !paused;
      if (!paused) {
        // start up again
        lastFrame = Date.now();
        mainLoop();
      }
    };

    var drawGrid = function (context) {
      context.beginPath();
      for (var i = 0; i < grid.width; i++) {
        context.moveTo(i * grid.nodeSize, 0);
        context.lineTo(i * grid.nodeSize, Game.canvasHeight);
      }
      for (var j = 0; j < grid.height; j++) {
        context.moveTo(0, j * grid.nodeSize);
        context.lineTo(Game.canvasWidth, j * grid.nodeSize);
      }
      context.closePath();
      context.stroke();
    }

    var drawExtraDudes = function (context) {
      for (i = 0; i < Game.lives; i++) {
        extraDude.pos.x = Game.canvasWidth - (8 * (i + 1));
        extraDude.pos.y = 32;
        withContext(context, function(context){
          extraDude.configureTransform();
          extraDude.draw(context);
        });
      }
    }

    var drawScore = function () {
      var score_text = ''+Game.score;
      Text.renderText(score_text, 18, Game.canvasWidth - 14 * score_text.length, 20);
    }

    var drawFrameRate = function () {
      Text.renderText(''+avgFramerate, 24, Game.canvasWidth - 38, Game.canvasHeight - 2);
    }

    var drawPausedText = function () {
      Text.renderText('PAUSED', 72, Game.canvasWidth/2 - 160, 120);
    }

    var deltaSinceLastFrame = function () {
      var thisFrame = Date.now();
      var elapsed = thisFrame - lastFrame;
      lastFrame = thisFrame;
      return elapsed / 30;
    }

    var runAndReapSprites = function (delta) {
      for (i = 0; i < sprites.length; i++) {
        sprites[i].run(delta);

        if (sprites[i].reap) {
          sprites[i].reap = false;
          sprites.splice(i, 1);
          i--;
        }
      }
    }

    var clearCanvas = function () {
      context.clearRect(0, 0, Game.canvasWidth, Game.canvasHeight);
    }

    var mainLoop = function () {
      clearCanvas();

      Game.FSM.execute();

      if (showDebugGrid()) {
        drawGrid(context);
      }
      runAndReapSprites(deltaSinceLastFrame());

      drawScore();
      drawExtraDudes(context);

      calcFrameRate();
      if (showFramerate) {
        drawFrameRate();
      }

      if (paused) {
        drawPausedText();
      } else {
        requestAnimFrame(mainLoop, canvasNode);
      }
    };

    mainLoop();

    $(window).keydown(function (e) {
      switch (KEY_CODES[e.keyCode]) {
      case 'f':
        toggleFrameRate();
        break;
      case 'p':
        togglePaused();
        break;
      case 'm':
        toggleMuted();
        break;
      }
    }).keydown(function (e) {
      KEY_STATUS.keyDown = true;
      if (KEY_CODES[e.keyCode]) {
        e.preventDefault();
        KEY_STATUS[KEY_CODES[e.keyCode]] = true;
      }
    }).keyup(function (e) {
      KEY_STATUS.keyDown = false;
      if (KEY_CODES[e.keyCode]) {
        e.preventDefault();
        KEY_STATUS[KEY_CODES[e.keyCode]] = false;
      }
    });
  };

  $(function () { Asteroids.start(); });

})();