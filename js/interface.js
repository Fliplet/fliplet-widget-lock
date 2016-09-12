var Lock_screen = (function () {
  // Universal _this reference
  var _this;
  const reset_action_id = 'reset_action';
  const go_to_action_id = 'action';

  // constructor
  var Lock_screen = function () {
    _this = this;
    this.id = null;
    this.linkPromises = [];
    this.setupUI();
    this.data = Fliplet.Widget.getData() || {};
    this.widgetId = Fliplet.Widget.getDefaultId();
    this.createLinkProvider('#to_go_link_action', go_to_action_id);
    if(!_.isEmpty(this.data[reset_action_id])) {
      _this.createLinkProvider('#reset_link_action', reset_action_id);
    }

  };

  Lock_screen.prototype = {
    constructor: Lock_screen,
    setupUI: function() {

      _this.attach_event_listeners();

    },
    createLinkProvider: function(selector, id){
      var linkActionProvider = Fliplet.Widget.open('com.fliplet.link', {
        // If provided, the iframe will be appended here,
        // otherwise will be displayed as a full-size iframe overlay
        selector: selector,
        // Also send the data I have locally, so that
        // the interface gets repopulated with the same stuff
        data: this.data[id],
        // Events fired from the provider
        onEvent: function (event, data) {
          if (event === 'interface-validate') {
            Fliplet.Widget.toggleSaveButton(data.isValid === true);
          }
        }
      });
      // 3. Fired when the provider has finished
      linkActionProvider.then(function (result) {
        _this.data[id] = result.data;
        return Promise.resolve();
      });

      linkActionProvider.id = id;
      _this.linkPromises.push(linkActionProvider);
    },
    save:function(notifyComplete) {

      _this.data.enable_touch_id = $('#enable_touch_id').is(':checked') ? 1: null;
      _this.data.has_reset = $("#available_reset").is(':checked') ? true: null;

      if(notifyComplete) {
        Promise.all(_this.linkPromises).then(function () {
          // when all providers have finished
          Fliplet.Widget.save(_this.data).then(function () {
            Fliplet.Widget.complete();
          });
        });

        // forward save request to all providers
        _this.linkPromises.forEach(function (promise) {
          promise.forwardSaveRequest();
        });
      }

      Fliplet.Widget.save(_this.data).then(function () {
        Fliplet.Studio.emit('reload-widget-instance', _this.widgetId);
      });
    },
    /**
     * attach all event listener that the plugin configuration needs
     */
    attach_event_listeners: function() {

      Fliplet.Widget.onSaveRequest(function () {
        _this.save(true);
      });

      // Attach event listener for change on the reset section dropDown
      $("input[name='has_reset']").on('change', function(){

        if(this.id === 'available_reset') {
          _this.createLinkProvider('#reset_link_action', reset_action_id);
        } else {
          _this.data[reset_action_id] = null;
          $('#reset_link_action').html('');
          _.remove(_this.linkPromises,{id:reset_action_id});
        }
      });

    }
  };

  return Lock_screen;
})();

$(document).ready(function() {

  window.lock = new Lock_screen();

});
