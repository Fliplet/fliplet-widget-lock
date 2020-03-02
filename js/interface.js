var lockScreen = (function() {
  // Universal _this reference
  var _this;
  const resetActionId = 'reset_action';
  const goToActionId = 'action';

  // constructor
  var lockScreen = function() {
    _this = this;
    this.id = null;
    this.linkPromises = [];
    this.setupUI();
    this.widgetId = Fliplet.Widget.getDefaultId();
    this.data = Fliplet.Widget.getData(this.widgetId) || {};
    this.createLinkProvider('#to_go_link_action', goToActionId);
    if (!_.isEmpty(this.data[resetActionId])) {
      _this.createLinkProvider('#reset_link_action', resetActionId);
    }
  };

  lockScreen.prototype = {
    constructor: lockScreen,
    setupUI: function() {
      _this.attachEventListeners();
    },
    createLinkProvider: function(selector, id) {
      var page = Fliplet.Widget.getPage();
      var omitPages = page ? [page.id] : [];

      this.data[id] = this.data[id] || {};
      this.data[id].omitPages = omitPages;
      var linkActionProvider = Fliplet.Widget.open('com.fliplet.link', {
        // If provided, the iframe will be appended here,
        // otherwise will be displayed as a full-size iframe overlay
        selector: selector,
        // Also send the data I have locally, so that
        // the interface gets repopulated with the same stuff
        data: this.data[id],
        // Events fired from the provider
        onEvent: function(event, data) {
          if (event === 'interface-validate') {
            Fliplet.Widget.toggleSaveButton(data.isValid === true);
          }
        }
      });
      // 3. Fired when the provider has finished
      linkActionProvider.then(function(result) {
        _this.data[id] = result.data;
        return Promise.resolve();
      });

      linkActionProvider.id = id;
      _this.linkPromises.push(linkActionProvider);
    },
    save: function(notifyComplete) {
      _this.data.enableTouchId = $('#enable_touch_id').is(':checked') ? 1 : null;
      _this.data.hasReset = $('#available_reset').is(':checked') ? true : null;

      if (notifyComplete) {
        Fliplet.Widget.all(_this.linkPromises).then(function() {
          // when all providers have finished
          Fliplet.Widget.save(_this.data).then(function() {
            Fliplet.Widget.complete();
          });
        });

        // forward save request to all providers
        _this.linkPromises.forEach(function(promise) {
          promise.forwardSaveRequest();
        });
      }
    },
    /**
     * attach all event listener that the plugin configuration needs
     * @returns {*} lockscreen
     */
    attachEventListeners: function() {
      Fliplet.Widget.onSaveRequest(function() {
        _this.save(true);
      });

      // Attach event listener for change on the reset section dropDown
      $("input[name='has_reset']").on('change', function() {
        if (this.id === 'available_reset') {
          _this.createLinkProvider('#reset_link_action', resetActionId);
        } else {
          _this.data[resetActionId] = null;
          $('#reset_link_action').html('');
          _.remove(_this.linkPromises, {id: resetActionId});
        }
      });
    }
  };

  return lockScreen;
})();

$(document).ready(function() {
  window.lock = new lockScreen();
});
