

/*global $ */
/*jshint unused:false */
var app = app || {};
var classes = classes || {};
var ENTER_KEY = 13;
var ESC_KEY = 27;


var backwrap = {
	router: {
		routes: {
			'*filter': 'setFilter'
		},

		setFilter: function (param) {
			// Set the current filter to be used
			app.TodoFilter = param || '';

			// Trigger a collection filter event, causing hiding/unhiding
			// of Todo view items
			app.todos.trigger('filter');
		}
	},
	models: {
		Todo: {
			// Default attributes for the todo
			// and ensure that each todo created has `title` and `completed` keys.
			defaults: {
				title: '',
				completed: false
			},

			// Toggle the `completed` state of this todo item.
			toggle: function () {
				this.save({
					completed: !this.get('completed')
				});
			}
		}
	},
	views: {
		Todo: {
			//... is a list tag.
			tagName:  'li',

			// Cache the template function for a single item.
			template: _.template($('#item-template').html()),

			// The DOM events specific to an item.
			events: {
				'click .toggle': 'toggleCompleted',
				'dblclick label': 'edit',
				'click .destroy': 'clear',
				'keypress .edit': 'updateOnEnter',
				'keydown .edit': 'revertOnEscape',
				'blur .edit': 'close'
			},

			// The TodoView listens for changes to its model, re-rendering. Since
			// there's a one-to-one correspondence between a **Todo** and a
			// **TodoView** in this app, we set a direct reference on the model for
			// convenience.
			initialize: function () {
				this.listenTo(this.model, 'change', this.render);
				this.listenTo(this.model, 'destroy', this.remove);
				this.listenTo(this.model, 'visible', this.toggleVisible);
			},

			// Re-render the titles of the todo item.
			render: function () {
				// Backbone LocalStorage is adding `id` attribute instantly after
				// creating a model.  This causes our TodoView to render twice. Once
				// after creating a model and once on `id` change.  We want to
				// filter out the second redundant render, which is caused by this
				// `id` change.  It's known Backbone LocalStorage bug, therefore
				// we've to create a workaround.
				// https://github.com/tastejs/todomvc/issues/469
				if (this.model.changed.id !== undefined) {
					return;
				}

				this.$el.html(this.template(this.model.toJSON()));
				this.$el.toggleClass('completed', this.model.get('completed'));
				this.toggleVisible();
				this.$input = this.$('.edit');
				return this;
			},

			toggleVisible: function () {
				this.$el.toggleClass('hidden', this.isHidden());
			},

			isHidden: function () {
				return this.model.get('completed') ?
					app.TodoFilter === 'active' :
					app.TodoFilter === 'completed';
			},

			// Toggle the `"completed"` state of the model.
			toggleCompleted: function () {
				this.model.toggle();
			},

			// Switch this view into `"editing"` mode, displaying the input field.
			edit: function () {
				this.$el.addClass('editing');
				this.$input.focus();
			},

			// Close the `"editing"` mode, saving changes to the todo.
			close: function () {
				var value = this.$input.val();
				var trimmedValue = value.trim();

				// We don't want to handle blur events from an item that is no
				// longer being edited. Relying on the CSS class here has the
				// benefit of us not having to maintain state in the DOM and the
				// JavaScript logic.
				if (!this.$el.hasClass('editing')) {
					return;
				}

				if (trimmedValue) {
					this.model.save({ title: trimmedValue });
				} else {
					this.clear();
				}

				this.$el.removeClass('editing');
			},

			// If you hit `enter`, we're through editing the item.
			updateOnEnter: function (e) {
				if (e.which === ENTER_KEY) {
					this.close();
				}
			},

			// If you're pressing `escape` we revert your change by simply leaving
			// the `editing` state.
			revertOnEscape: function (e) {
				if (e.which === ESC_KEY) {
					this.$el.removeClass('editing');
					// Also reset the hidden input back to the original value.
					this.$input.val(this.model.get('title'));
				}
			},

			// Remove the item, destroy the model from *localStorage* and delete its view.
			clear: function () {
				this.model.destroy();
			}
		},
		App: {

			// Instead of generating a new element, bind to the existing skeleton of
			// the App already present in the HTML.
			el: '.todoapp',

			// Our template for the line of statistics at the bottom of the app.
			statsTemplate: _.template($('#stats-template').html()),

			// Delegated events for creating new items, and clearing completed ones.
			events: {
				'keypress .new-todo': 'createOnEnter',
				'click .clear-completed': 'clearCompleted',
				'click .toggle-all': 'toggleAllComplete'
			},

			// At initialization we bind to the relevant events on the `Todos`
			// collection, when items are added or changed. Kick things off by
			// loading any preexisting todos that might be saved in *localStorage*.
			initialize: function () {
				this.allCheckbox = this.$('.toggle-all')[0];
				this.$input = this.$('.new-todo');
				this.$footer = this.$('.footer');
				this.$main = this.$('.main');
				this.$list = $('.todo-list');

				this.listenTo(app.todos, 'add', this.addOne);
				this.listenTo(app.todos, 'reset', this.addAll);
				this.listenTo(app.todos, 'change:completed', this.filterOne);
				this.listenTo(app.todos, 'filter', this.filterAll);
				this.listenTo(app.todos, 'all', _.debounce(this.render, 0));

				// Suppresses 'add' events with {reset: true} and prevents the app view
				// from being re-rendered for every model. Only renders when the 'reset'
				// event is triggered at the end of the fetch.
				app.todos.fetch({reset: true});
			},

			// Re-rendering the App just means refreshing the statistics -- the rest
			// of the app doesn't change.
			render: function () {
				var completed = app.todos.completed().length;
				var remaining = app.todos.remaining().length;

				if (app.todos.length) {
					this.$main.show();
					this.$footer.show();

					this.$footer.html(this.statsTemplate({
						completed: completed,
						remaining: remaining
					}));

					this.$('.filters li a')
						.removeClass('selected')
						.filter('[href="#/' + (app.TodoFilter || '') + '"]')
						.addClass('selected');
				} else {
					this.$main.hide();
					this.$footer.hide();
				}

				this.allCheckbox.checked = !remaining;
			},

			// Add a single todo item to the list by creating a view for it, and
			// appending its element to the `<ul>`.
			addOne: function (todo) {
				var view = new app.TodoView({ model: todo });
				this.$list.append(view.render().el);
			},

			// Add all items in the **Todos** collection at once.
			addAll: function () {
				this.$list.html('');
				app.todos.each(this.addOne, this);
			},

			filterOne: function (todo) {
				todo.trigger('visible');
			},

			filterAll: function () {
				app.todos.each(this.filterOne, this);
			},

			// Generate the attributes for a new Todo item.
			newAttributes: function () {
				return {
					title: this.$input.val().trim(),
					order: app.todos.nextOrder(),
					completed: false
				};
			},

			// If you hit return in the main input field, create new **Todo** model,
			// persisting it to *localStorage*.
			createOnEnter: function (e) {
				if (e.which === ENTER_KEY && this.$input.val().trim()) {
					app.todos.create(this.newAttributes());
					this.$input.val('');
				}
			},

			// Clear all completed todo items, destroying their models.
			clearCompleted: function () {
				_.invoke(app.todos.completed(), 'destroy');
				return false;
			},

			toggleAllComplete: function () {
				var completed = this.allCheckbox.checked;

				app.todos.each(function (todo) {
					todo.save({
						completed: completed
					});
				});
			}
		}

	}
};

/** 1. models */
for (var key in backwrap.models) {
	app[key] = Backbone.Model.extend(backwrap.models[key]);
}

/** 2. collections */
var collection = {
		// Reference to this collection's model.
		model: app.Todo,

		// Save all of the todo items under this example's namespace.
		localStorage: new Backbone.LocalStorage('todos-backbone'),

		// Filter down the list of all todo items that are finished.
		completed: function () {
			return this.where({completed: true});
		},

		// Filter down the list to only todo items that are still not finished.
		remaining: function () {
			return this.where({completed: false});
		},

		// We keep the Todos in sequential order, despite being saved by unordered
		// GUID in the database. This generates the next order number for new items.
		nextOrder: function () {
			return this.length ? this.last().get('order') + 1 : 1;
		},

		// Todos are sorted by their original insertion order.
		comparator: 'order'
	}

var Todos = Backbone.Collection.extend(collection);
app.todos = new Todos();

/** 3. views */
app.TodoView = Backbone.View.extend(backwrap.views.Todo);
app.AppView = Backbone.View.extend(backwrap.views.App);

new app.AppView();
var TodoRouter = Backbone.Router.extend(backwrap.router);
app.TodoRouter = new TodoRouter();
Backbone.history.start();
