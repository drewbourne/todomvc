(function( window, undefined ) {
	'use strict';

	// ISSUES
	// - the todos object does too much, needs to be split
	// - need to split this file to separate files
	// - the load from localstorage could be an observable

	// ----

	// use mustache-y templates
	// escape by default.
	_.templateSettings = {
		evaluate    : /{{%([\s\S]+?)}}/g,
		interpolate : /{{=([\s\S]+?)}}/g,
		escape      : /{{([\s\S]+?)}}/g
	};

	// Application
	
	// Persistence
	// Your app should dynamically persist the todos to localStorage. 
	// If the framework has capabilities for persisting data (i.e. Backbone.sync), use that, otherwise vanilla localStorage. 
	// If possible, use the keys id, title, completed for each item. 
	// Make sure to use this format for the localStorage name: todos-[framework]. 
	// Editing mode should not be persisted.
	var todos = (function() {
		var collection = [];
		var subject = new Rx.Subject();
		var observable = subject.asObservable();

		function nextId() {
			return String(new Date().getTime());
		}

		function find(id) {
			return _.findWhere(collection, { id: id });
		}

		function findAll(properties) {
			return _.where(collection, properties);
		}

		function create(id, title) {
			return { id: id, title: title, completed: false };
		}

		function update(todo, changes) {
			return _.extend({}, todo, changes);
		}

		function add(todo) {
			collection.push(todo);
		}

		function remove(todo) {
			collection.splice(collection.indexOf(todo), 1);
		}

		function replace(existing, updated) {
			collection.splice(collection.indexOf(existing), 1, updated);
		}

		function incompleteTodos() {
			return findAll({ completed: false });
		}

		function completedTodos() {
			return findAll({ completed: true });
		}

		var todos = _.extend(observable, {
			added: observable.whereEqualTo('type', 'added').selectProperty('todo'),
			removed: observable.whereEqualTo('type', 'removed').selectProperty('todo'),
			updated: observable.whereEqualTo('type', 'updated').selectProperty('todo'),

			filterChanged: observable.whereEqualTo('type', 'filterChanged'),
			lengthChanged: observable.whereEqualTo('type', 'lengthChanged').throttle(30),
			completed: observable.whereEqualTo('type', 'completed').throttle(30),

			initialize: function() {
				load();
			},

			create: function(text) {
				var todo = create(nextId(), text);
				add(todo);
				subject.onNext({ type: 'added', todo: todo });
			}, 
			add: function(todo) {
				add(todo);
				subject.onNext({ type: 'added', todo: todo });
			},
			remove: function(id) {
				var todo = find(id);
				if (todo) {
					remove(todo);
					subject.onNext({ type: 'removed', todo: todo });
				}
			}, 
			update: function(id, text) {
				var todo = find(id);
				if (todo) {
					var updated = update(todo, { title: text });
					replace(todo, updated);
					subject.onNext({ type: 'updated', todo: updated });
				}
			},
			toggle: function(id) {
				var todo = find(id);
				if (todo) {
					var updated = update(todo, { completed: !todo.completed });
					replace(todo, updated);
					subject.onNext({ type: 'updated', todo: updated });
				}
			}, 
			toggleAll: function(completed) {
				var toUpdate = findAll({ completed: !completed });
				_.each(toUpdate, function(todo) {
					var updated = update(todo, { completed: completed });
					replace(todo, updated);
					subject.onNext({ type: 'updated', todo: updated });
				});
			},
			clearCompleted: function() {
				var toRemove = findAll({ completed: true });
				_.each(toRemove, function(todo) {
					remove(todo);
					subject.onNext({ type: 'removed', todo: todo });
				});
			}, 
			showAll: function() {
				// remove all 
				subject.onNext({ type: 'filterChanged', filterType: 'all' });
				
				// add all
				_.each(collection, function(todo) {
					subject.onNext({ type: 'added', todo: todo });
				});
			}, 
			showIncomplete: function() {
				// remove all
				subject.onNext({ type: 'filterChanged', filterType: 'incomplete'  });

				// add incomplete
				_.each(incompleteTodos(), function(todo) {
					subject.onNext({ type: 'added', todo: todo });
				});
			}, 
			showCompleted: function() {
				// remove all
				subject.onNext({ type: 'filterChanged', filterType: 'completed' });

				// add completed
				_.each(completedTodos(), function(todo) {
					subject.onNext({ type: 'added', todo: todo });
				});
			}
		});

		Rx.Observable.merge(todos.added, todos.removed)
			.throttle(30)
			.subscribe(function() {
				subject.onNext({ type: 'lengthChanged', countTodos: collection.length });
			});

		Rx.Observable.merge(todos.updated, todos.removed)
			.throttle(30)
			.subscribe(function() {
				var completed = completedTodos();
				subject.onNext({ type: 'completed', countCompleted: completed.length });
			});

		// Persistence
		function load() {
			var data = JSON.parse(localStorage['todos-rxjs'] || 'null');
			if (data) {
				_.each(data.collection, todos.add);
			}
		}

		// persist changes
		function save(e) {
			localStorage['todos-rxjs'] = JSON.stringify({ 
				collection: collection 
			});
		}

		todos.added.subscribe(save);
		todos.removed.subscribe(save);
		todos.updated.subscribe(save);

		return todos;
	})();

	var $list = $("#todo-list");
	var itemTemplate = _.template(
		'<li data-id="{{id}}" class="{{completedClass}}">' + 
			'<div class="view">' + 
				'<input class="toggle" type="checkbox" {{checked}}>' + 
				'<label>{{title}}</label>' + 
				'<button class="destroy"></button>' + 
			'</div>' +
			'<input class="edit" value="{{title}}" />' + 
		'</li>');

	function renderTodo(todo) {
		todo = _.extend({ 
			checked: todo.completed ? 'checked' : '', 
			completedClass: todo.completed ? 'completed' : ''
		}, todo);

		return itemTemplate(todo);
	}

	todos.added.debug('added').subscribe(function(todo) {
		$list.prepend(renderTodo(todo));
	});

	todos.removed.debug('removed').subscribe(function(todo) {
		elementFromTodo(todo).remove();
	});

	todos.updated.debug('updated').subscribe(function(todo) {
		elementFromTodo(todo).replaceWith(renderTodo(todo));
	});

	todos.filterChanged.debug('filterChanged').subscribe(function() {
		$list.empty();
	});

	// No todos
	// when no todos then #main and #footer should be hidden
	var $main = $('#main');
	var $footer = $('#footer');

	function hideTodos() {
		$main.hide();
		$footer.hide();
	}

	function showTodos() {
		$main.show();
		$footer.show();
	}

	todos.lengthChanged
		.where(function(e) { return e.countTodos > 0 })
		.subscribe(showTodos);

	todos.lengthChanged
		.where(function(e) { return e.countTodos === 0 })
		.subscribe(hideTodos);

	hideTodos();

	// New todo
	// New todos are entered in the input at the top of the app. 
	// Pressing Enter creates the todo, appends it to the todo list and clears the input. 
	// Make sure to .trim() the input and then check that it's not empty before creating a new todo.
	var ENTER = 13;

	function todoInputAsObservable(input) {
		return input.keyupAsObservable()
			.where(function(e) { return e.keyCode === ENTER })
			.select(function(e) { return e.target.value.trim() });
	}

	var $input = $('#new-todo');

	var newTodo = todoInputAsObservable($input)
		.where(function(text) { return text.length > 0 });

	newTodo.subscribe(todos.create);
	newTodo.subscribe(function() { $input.val(''); });

	// Mark all as complete
	// This checkbox toggles all the todos to the same state as itself. 
	// Make sure to clear the checked state after the the "Clear completed" button is clicked. 
	// The "Mark all as complete" checkbox should also be updated when single todo items are checked/unchecked. 
	// Eg. When all the todos are checked it should also get checked.
	var $toggleAll = $('#toggle-all');

	$toggleAll.changeAsObservable()
		.select(function(e) { return e.target.checked ? true : false; })
		.subscribe(todos.toggleAll);

	// Item
	// A todo item has three possible interactions:

	function elementFromEvent(e) {
		return $(e.target).parents('li');
	}

	function todoIdFromEvent(e) {
		return elementFromEvent(e).attr('data-id');
	}

	function elementFromTodo(todo) {
		return $('[data-id=' + todo.id + ']');
	}

	// 1) Clicking the checkbox marks the todo as complete by updating it's completed value 
	// and toggling the class completed on it's parent <li>
	var toggle = $(document).onAsObservable('change', '.toggle');
	
	toggle.select(todoIdFromEvent).subscribe(todos.toggle);

	// 2) Double-clicking the <label> activates editing mode, by toggling the .editing class on it's <li>
	var dblclick = $(document).onAsObservable('dblclick', 'label');

	dblclick.subscribe(edit);

	// 3) Hovering over the todo shows the remove button (.destroy)	
	var destroy = $(document).onAsObservable('click', 'button.destroy');

	destroy.select(todoIdFromEvent).subscribe(todos.remove);

	// Editing
	// When editing mode is activated it will hide the other controls and bring forward an input 
	// that contains the todo title, which should be focused (.focus()). The edit should be saved 
	// on both blur and enter, and the editing class should be removed. Make sure to .trim() the 
	// input and then check that it's not empty. If it's empty the todo should instead be destroyed. 
	// If escape is pressed during the edit, the edit state should be left and any changes be discarded.
	function edit(e) {

		var id = todoIdFromEvent(e);
		var el = elementFromEvent(e);
		var input = el.find('input');

		el.addClass('editing');
		input.focus();

		var todoInput = todoInputAsObservable(input);

		var updatesub = todoInput
			.where(function(text) { return text.length > 0 })
			.subscribe(function(text) {
				todos.update(id, text);
			});

		var removesub = todoInput
			.where(function(text) { return text.length === 0 })
			.subscribe(function(text) {
				todos.remove(id);
			});

		var blursub = input.onAsObservable('blur')
			.subscribe(cancel);

		var ESCAPE = 27;

		var escapesub = input.keyupAsObservable()
			.where(function(e) { return e.keyCode === ESCAPE })
			.subscribe(cancel);

		function cancel() {
			el.removeClass('editing');

			// TODO kill old subscriptions. 
		}
	}

	// Counter
	// Displays the number of active todos in a pluralized form. 
	// Make sure the number is wrapped by a <strong> tag. 
	// Also make sure to pluralize the item word correctly: 0 items, 1 item, 2 items. 
	// Example: 2 items left
	var $counter = $('#todo-count');
	var counterTemplate = _.template('<strong>{{number}}</strong> {{items}}');

	todos.lengthChanged.subscribe(function(e) {
		$counter.html(counterTemplate({ 
			number: e.countTodos, 
			items: e.countTodos === 1 ? 'item' : 'items'
		}));
	});

	// Clear completed button
	// Displays the number of completed todos, and when clicked, removes them. 
	// Should be hidden when there are no completed todos.
	var $clearCompleted = $('#clear-completed');
	var clearCompletedTemplate = _.template('Clear completed ({{count}})');

	var completed = todos.completed.subscribe(function(e) {
		renderClearCompleted(e.countCompleted);
	});

	// FIXME needs the value from the todos
	renderClearCompleted(0);

	function renderClearCompleted(count) {
		$clearCompleted.text(clearCompletedTemplate({ count: count }));

		var display = (count === 0 ? 'hide' : 'show');
		$clearCompleted[display]();
	}

	var cleared = $clearCompleted.clickAsObservable().subscribe(todos.clearCompleted);

	// Routing
	// The following routes should be implemented: 
	// #/ (all - default), #/active and #/completed (#!/ is also allowed). 
	// When the route changes the todo list should be filtered on a model level and 
	// the selected class on the filter links should be toggled. 
	// When an item is updated while in a filtered state, it should be updated accordingly. 
	// E.g. if the filter is Active and the item is checked, it should be hidden. 
	// Make sure the active filter is persisted on reload.

	var $filters = $('#filters');

	var filterTypeToHref = { 
		all: '#/', 
		incomplete: '#/active',
		completed: '#/completed' 
	};

	todos.filterChanged.subscribe(function(e) {
		$filters.find('a').removeClass('selected');
		$filters.find('a[href="' + filterTypeToHref[e.filterType] + '"]').addClass('selected');
	});

	function route(hash) {
		var routes = { 
			'#/': 			'showAll',
			'#/active': 	'showIncomplete', 
			'#/completed': 	'showCompleted'
		 }

		 if (routes[hash]) {
		 	todos[routes[hash]]();
		 }
	}

	$(window).onAsObservable('hashchange')
		.debug('hashchange')
		.select(function() { return window.location.hash })
		.subscribe(route);

	$(window).onAsObservable('load')
		.debug('load')
		.select(function() { return window.location.hash })
		.subscribe(route);

	todos.initialize();

})( window );
