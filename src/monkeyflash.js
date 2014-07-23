
(function(window) {
	var actions = {};
	var MonkeyFlash = {};

	var Keyframe = function(manager, animation, properties) {
		this.start = function() {
			var remaining = properties.actions.length;

			var check = function() {
				if (--remaining == 0) {
					animation.step();
				}
			};

			for (var i = 0; i < properties.actions.length; i++) {
				manager.beginAction(properties, properties.actions[i], check);
			}
		};
	};

	var Animation = function(manager, properties) {
		this.step = function() {
			var self = this;

			this.currentStep++;

			if (this.currentStep >= this.keyframes.length) {
				return manager.animationFinished();
			}

			this.keyframes[this.currentStep].start();
		};

		this.start = function() {
			var self = this;
			var time = properties.offset || 0;

			this.currentStep = -1;

			manager.schedule(properties.offset || 0, function() {
				self.step();
			});
		};

		this.keyframes = [];

		for (var i = 0; i < properties.keyframes.length; i++) {
			this.keyframes.push(new Keyframe(manager, this, properties.keyframes[i]));
		}
	};

	var Manager = function(parentElement, animations) {
		this.beginAction = function(keyframe, action, cb) {
			var self = this;

			if (!actions[action.kind]) {
				return cb();
			}

			if (!this.runningActions) {
				this.runningActions = [];
			}

			var controller = new actions[action.kind](this, keyframe, action, function() {
				var index = self.runningActions.indexOf(controller);

				if (index <= -1) {
					return;
				}

				self.runningActions.splice(index, 1);
				cb();
			});

			this.runningActions.push(controller);
			controller.start();
		};

		this.findElement = function(selector) {
			if (selector == '@self') {
				return this.element;
			}

			return this.element.find(selector);
		};
		
		this.schedule = function(time, cb) {
			setTimeout(function() {
				cb();
			}, time);
		};

		this.animationFinished = function() {
			if (--this.animationsPending == 0) {
				if (this.finished) {
					this.finished();
				}
			}
		};

		this.start = function(cb) {
			this.animationsPending = animations.length;

			for (var i = 0; i < animations.length; i++) {
				var anim = new Animation(this, animations[i]);

				anim.start();
			}	
		};

		this.pause = function() {
			for (var i = 0; i < this.runningActions.length; i++) {
				if (this.runningActions[i].pause) {
					this.runningActions[i].pause();
				}
			}
		};

		this.resume = function() {
			for (var i = 0; i < this.runningActions.length; i++) {
				if (this.runningActions[i].resume) {
					this.runningActions[i].resume();
				}
			}
		};

		this.element = $(parentElement);
	};


	MonkeyFlash.registerAction = function(name, action) {
		actions[name] = action;
	};

	MonkeyFlash.animate = function(parent, animations, cb) {
		var manager = new Manager(parent, animations);

		manager.finished = cb;
		manager.start();
		
		return manager;
	};

	MonkeyFlash.registerAction('move', function(manager, keyframe, action, cb) {
		var elementSelector = keyframe.element || '@self';
		var element = manager.findElement(elementSelector);

		this.start = function() {
			if (!element) {
				return cb();
			}

			element.animate({
				left: action.offset.x + 'px',
				top: action.offset.y + 'px'
			}, action.length || keyframe.length, action.easing || 'swing', cb);
		};

		this.pause = function() {
			element.pause();
		};

		this.resume = function() {
			element.resume();
		};
	});

	MonkeyFlash.Manager = Manager;

	window.MonkeyFlash = MonkeyFlash;
})(window);

