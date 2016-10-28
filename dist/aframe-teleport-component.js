/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};

/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {

/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId])
/******/ 			return installedModules[moduleId].exports;

/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			exports: {},
/******/ 			id: moduleId,
/******/ 			loaded: false
/******/ 		};

/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);

/******/ 		// Flag the module as loaded
/******/ 		module.loaded = true;

/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}


/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;

/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;

/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";

/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ function(module, exports, __webpack_require__) {

	/* global AFRAME */
	var parabolicCurve = __webpack_require__(1);
	var RayCurve = __webpack_require__(2);

	if (typeof AFRAME === 'undefined') {
	  throw new Error('Component attempted to register before AFRAME was available.');
	}

	/* global THREE AFRAME  */
	AFRAME.registerComponent('teleport', {
	  schema: {
	    button: {default: 'trackpad', oneOf: ['trackpad', 'trigger', 'grip', 'menu']},
	    collisionMesh: {type: 'selector'},
	    hitEntity: {type: 'selector'},
	    defaultEntityColor: {type: 'color', default: '#99ff99'},
	    defaultEntityRadius: {default: 0.25},
	    hitColor: {type: 'color', default: '#99ff99'},
	    missColor: {type: 'color', default: '#ff0000'},
	    numberPoints: {default: 30},
	    maxDistance: {default: 5},
	    lineWidth: {default: 0.025},
	    normal: {type: 'vec3', default: '0 1 0'},
	    angleThreshold: {default: '45'},
	    shootingSpeed: {default: 5},
	  },

	  init: function () {
	    this.active = false;
	    this.obj = this.el.object3D;
	    this.hitPoint = new THREE.Vector3();
	    this.hit = false;
	    this.prevHeightDiff = 0;
	    this.referenceNormal = new THREE.Vector3();
	    this.missColor = new THREE.Color();
	    this.hitColor = new THREE.Color();
	    this.raycaster = new THREE.Raycaster();

	    this.defaultPlane = this.createDefaultPlane();

	    this.teleportEntity = document.createElement('a-entity');
	    this.teleportEntity.className = 'teleport-ray';
	    this.teleportEntity.setAttribute('visible', false);
	    this.el.sceneEl.appendChild(this.teleportEntity);

	    this.el.addEventListener(this.data.button + 'down', this.onButtonDown.bind(this));
	    this.el.addEventListener(this.data.button + 'up', this.onButtonUp.bind(this));
	  },

	  onButtonDown: function (evt) {
	    this.active = true;
	  },

	  onButtonUp: function (evt) {
	    if (!this.active) { return; }

	    // Jump!

	    // Hide the hit point and the curve
	    this.active = false;
	    this.hitEntity.setAttribute('visible', false);
	    this.teleportEntity.setAttribute('visible', false);

	    if (!this.hit) {
	      // Button released but not hit point
	      return;
	    }

	    // @todo Create this aux vectors outside
	    var cameraEl = this.el.sceneEl.camera.el;
	    var camPosition = new THREE.Vector3().copy(cameraEl.getAttribute('position'));

	    var newCamPositionY = camPosition.y + this.hitPoint.y - this.prevHeightDiff;
	    var newCamPosition = new THREE.Vector3(this.hitPoint.x, newCamPositionY, this.hitPoint.z);
	    this.prevHeightDiff = this.hitPoint.y;

	    cameraEl.setAttribute('position', newCamPosition);

	    // Find the hands and move them proportionally
	    var hands = document.querySelectorAll('a-entity[tracked-controls]');
	    for (var i = 0; i < hands.length; i++) {
	      var position = hands[ i ].getAttribute('position');
	      var pos = new THREE.Vector3().copy(position);
	      var diff = camPosition.clone().sub(pos);
	      var newPosition = newCamPosition.clone().sub(diff);
	      hands[ i ].setAttribute('position', newPosition);
	    }
	  },

	  update: function (oldData) {
	    this.referenceNormal.copy(this.data.normal);
	    this.missColor.set(this.data.missColor);
	    this.hitColor.set(this.data.hitColor);

	    if (oldData.numberPoints !== this.data.numberPoints) {
	      this.createLine();
	    }

	    if (this.data.hitEntity) {
	      this.hitEntity = this.data.hitEntity;
	    } else {
	      this.hitEntity = this.createHitEntity();
	    }
	    this.hitEntity.setAttribute('visible', false);
	  },

	  remove: function () {
	    //@todo Remove entities created
	  },

	  tick: (function () {
	    var p0 = new THREE.Vector3();
	    var quaternion = new THREE.Quaternion();
	    var translation = new THREE.Vector3();
	    var scale = new THREE.Vector3();
	    var shootAngle = new THREE.Vector3();
	    var lastNext = new THREE.Vector3();

	    return function (time, delta) {
	      if (!this.active) { return; }

	      var matrixWorld = this.obj.matrixWorld;
	      matrixWorld.decompose(translation, quaternion, scale);

	      var v0 = shootAngle.set(0, 0, -1)
	        .applyQuaternion(quaternion)
	        .multiplyScalar(this.data.shootingSpeed);
	      var g = -9.8;
	      var a = new THREE.Vector3(0, g, 0);
	      p0.copy(this.obj.position);

	      var last = p0.clone();
	      var next;

	      // Set default status as non-hit
	      this.teleportEntity.setAttribute('visible', true);
	      this.line.material.color.set(this.missColor);
	      this.hitEntity.setAttribute('visible', false);
	      this.hit = false;

	      for (var i = 0; i < this.line.numPoints; i++) {
	        var t = i / (this.line.numPoints - 1);
	        next = parabolicCurve(p0, v0, a, t);
	        // Update the raycaster with the length of the current segment last->next
	        var dirLastNext = lastNext.copy(next).sub(last).normalize();
	        this.raycaster.far = dirLastNext.length();
	        this.raycaster.set(last, dirLastNext);

	        // Check intersection with the floor
	        var floor = this.data.collisionMesh && this.data.collisionMesh.getObject3D('mesh');
	        if (!floor) {
	          floor = this.defaultPlane
	        }
	        var intersects = this.raycaster.intersectObject(floor, true);

	        if (intersects.length > 0 && !this.hit && this.isValidNormalsAngle(intersects[0].face.normal)) {
	          var point = intersects[0].point;

	          this.line.material.color.set(this.hitColor);
	          this.hitEntity.setAttribute('position', point);
	          this.hitEntity.setAttribute('visible', true);

	          this.hit = true;
	          this.hitPoint.copy(intersects[0].point);

	          // If hit, just fill the rest of the points with the hit point and break the loop
	          for (var j = i; j < this.line.numPoints; j++) {
	            this.line.setPoint(j, this.hitPoint);
	          }
	          break;
	        } else {
	          this.line.setPoint(i, next);
	        }
	        last.copy(next);
	      }
	      this.line.update();
	    };
	  })(),

	  isValidNormalsAngle: function (collisionNormal) {
	    var angleNormals = this.referenceNormal.angleTo(collisionNormal);
	    return (THREE.Math.RAD2DEG * angleNormals <= this.data.angleThreshold);
	  },

	  createLine: function () {
	    this.line = new RayCurve(this.data.numberPoints, this.data.lineWidth);
	    this.teleportEntity.setObject3D('mesh', this.line.mesh);
	  },

	  createHitEntity: function () {
	    var hitEntity = document.createElement('a-entity');
	    hitEntity.className = 'hintEntity';

	    var torus = document.createElement('a-entity');
	    torus.setAttribute('geometry', {primitive: 'torus', radius: this.data.defaultEntityRadius, radiusTubular: 0.01});
	    torus.setAttribute('rotation', {x: 90, y: 0, z: 0});
	    torus.setAttribute('material', {shader: 'flat', color: '#9f9', side: 'double', depthTest: false});
	    hitEntity.appendChild(torus);

	    var cylinder = document.createElement('a-entity');
	    cylinder.setAttribute('geometry', {primitive: 'cylinder', segmentsHeight: 1, radius: this.data.defaultEntityRadius, height: 0.25, openEnded: true});
	    cylinder.setAttribute('position', {x: 0, y: 0.125, z: 0});
	    cylinder.setAttribute('material', {shader: 'flat', color: '#9f9', side: 'double', src: 'url(data:image/png;base64,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)', transparent: true, depthTest: false});
	    hitEntity.appendChild(cylinder);

	    document.querySelector('a-scene').appendChild(hitEntity);

	    return hitEntity;
	  },

	  createDefaultPlane: function () {
	    // @hack: Because I can't get three.bufferPlane working on raycaster
	    var geometry = new THREE.BoxBufferGeometry(100, 0.5, 100);
	    geometry.applyMatrix( new THREE.Matrix4().makeTranslation( 0, -0.25, 0 ) );
	    var material = new THREE.MeshBasicMaterial({color: 0xffff00});
	    var box = new THREE.Mesh( geometry, material );
	    return box;
	  }
	});


/***/ },
/* 1 */
/***/ function(module, exports) {

	/* global THREE */
	// Parabolic motion equation, y = p0 + v0*t + 1/2at^2
	function parabolicCurveScalar (p0, v0, a, t) {
	  return p0 + v0 * t + 0.5 * a * t * t;
	}

	// Parabolic motion equation applied to 3 dimensions
	function parabolicCurve (p0, v0, a, t) {
	  var ret = new THREE.Vector3();
	  ret.x = parabolicCurveScalar(p0.x, v0.x, a.x, t);
	  ret.y = parabolicCurveScalar(p0.y, v0.y, a.y, t);
	  ret.z = parabolicCurveScalar(p0.z, v0.z, a.z, t);
	  return ret;
	}

	module.exports = parabolicCurve;


/***/ },
/* 2 */
/***/ function(module, exports) {

	/* global THREE */
	var RayCurve = function (numPoints, width, up) {
	  this.geometry = new THREE.BufferGeometry();
	  this.vertices = new Float32Array(numPoints * 3 * 2);
	  this.uvs = new Float32Array(numPoints * 2 * 2);
	  this.width = width;

	  this.geometry.addAttribute('position', new THREE.BufferAttribute(this.vertices, 3).setDynamic(true));

	  this.material = new THREE.MeshBasicMaterial({
	    side: THREE.DoubleSide,
	    color: 0xff0000
	  });

	  this.mesh = new THREE.Mesh(this.geometry, this.material);
	  this.mesh.drawMode = THREE.TriangleStripDrawMode;

	  this.mesh.frustumCulled = false;
	  this.mesh.vertices = this.vertices;

	  this.points = [];
	  for (var i = 0; i < numPoints; i++) {
	    this.points.push(new THREE.Vector3());
	  }
	  this.numPoints = numPoints;
	  this.usedPoints = 0;
	};

	RayCurve.prototype = {
	  setPoint: function (i, point) {
	    this.points[i] = point.clone();
	  },
	  update: function () {
	    var direction = new THREE.Vector3();
	    var posA = new THREE.Vector3();
	    var posB = new THREE.Vector3();

	    var idx = 0;
	    direction = this.points[0].clone().sub(this.points[1]).normalize();
	    var UP = new THREE.Vector3(0, 1, 0);
	    direction.cross(UP).normalize();

	    for (var i = 0; i < this.numPoints; i++) {
	      posA.copy(this.points[i]).add(direction.clone().multiplyScalar(this.width / 2));
	      posB.copy(this.points[i]).add(direction.clone().multiplyScalar(-this.width / 2));

	      this.vertices[idx++] = posA.x;
	      this.vertices[idx++] = posA.y;
	      this.vertices[idx++] = posA.z;

	      this.vertices[idx++] = posB.x;
	      this.vertices[idx++] = posB.y;
	      this.vertices[idx++] = posB.z;
	    }

	    this.geometry.attributes.position.needsUpdate = true;
	  }
	};

	module.exports = RayCurve;


/***/ }
/******/ ]);