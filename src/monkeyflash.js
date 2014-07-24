
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

	MonkeyFlash.registerAction('click', function(manager, keyframe, action, cb) {
		var elementSelector = keyframe.element || '@self';
		var element = manager.findElement(elementSelector);
		var clickElement = element;

		if (action.target) {
			clickElement = element.find(action.target);
		}

		this.start = function() {
			if (!element) {
				return cb();
			}

			element.toggleClass('mf-fake-hover');
			element.trigger('mouseenter');
			element.focus();

			setTimeout(function() {
				clickElement.trigger('click');

				element.toggleClass('mf-fake-hover');
				element.trigger('mouseleave');
				
				cb();
			}, action.length || keyframe.length || 0);
		};
	});

	MonkeyFlash.registerAction('sleep', function(manager, keyframe, action, cb) {
		this.start = function() {
			setTimeout(cb, action.length || keyframe.length || 0);
		};
	});

	MonkeyFlash.registerAction('sendkeys', function(manager, keyframe, action, cb) {
		var minThreshold = action.minThreshold || 70, maxThreshold = action.maxThreshold || 150, errorThreshold = action.errorThreshold || 0;
		var errorChars = action.onlyNumbers ? '0123456789' : 'qwertyuiopasdfghjklzxcvbnm1234567890';

		var elementSelector = keyframe.element || '@self';
		var element = manager.findElement(elementSelector);
		var paused = false, current = 0, deleteNext = false;

		this.append = function(chr) {
			var code = chr.charCodeAt(0);

			element.trigger(jQuery.Event("keydown", { keyCode: code }));
			element.trigger(jQuery.Event("keypress", { keyCode: code }));

			element.val(element.val() + chr);

			element.trigger(jQuery.Event("keyup", { keyCode: code }));
		};

		this.backspace = function() {
			element.trigger(jQuery.Event("keydown", { keyCode: 9 }));
			element.trigger(jQuery.Event("keypress", { keyCode: 9 }));

			var val = element.val();

			val = val.substring(0, val.length - 1);

			element.val(val);
			
			element.trigger(jQuery.Event("keyup", { keyCode: 9 }));
		};

		this.step = function() {
			var self = this;
			var isError = false;

			if (current >= action.text.length) {
				element.trigger(jQuery.Event("change", {}));
				return cb();
			}

			if (deleteNext) {
				this.backspace();
				deleteNext = false;
			} else {
				isError = Math.random() <= errorThreshold;

				this.append(isError ? errorChars[Math.round(Math.random() * (errorChars.length - 1))] : action.text[current]);

				if (isError) {
					deleteNext = true;
				} else {
					current++;
				}
			}

			if (!paused && current <= action.text.length) {
				var time = minThreshold + Math.random() * (maxThreshold - minThreshold);

				if (isError) {
					time *= 1.7;
				}

				setTimeout(function() {
					self.step();
				}, time);
			}
		};

		this.start = function() {
			if (!element) {
				return cb();
			}

			element.focus();
			this.step();
		};

		this.pause = function() {
			paused = true;
		};

		this.resume = function() {
			paused = false;
			this.step();
		};
	});

			MonkeyFlash.registerAction('waitforinput', function(manager, keyframe, action, cb) {	
			var elementSelector = keyframe.element || '@self';
			var element = manager.findElement(elementSelector);

			this.start = function() {
				var self = this;

				if (element.val() != '') {
					return cb();
				}

				setTimeout(function() {
					self.start();
				}, 50);
			};
		});

	MonkeyFlash.Manager = Manager;

	window.MonkeyFlash = MonkeyFlash;
})(window);

