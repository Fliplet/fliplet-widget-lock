Fliplet.Widget.instance('lock', function(data) {
  var $lock = $(this);
  var widgetId = data.id;
  var widgetUuid = data.uuid;

  if (!widgetId) {
    return;
  }

  $.fn.state = function(newState) {
    $(this).attr('data-state', newState);
    $(this).find('.state').hide().filter('[data-state="' + newState + '"]').show();

    return this;
  };

  /**
   * Returns a description of the given biometric type
   * @param {String} type - the value for the biometric type available as given by the JS API
   * @return {String} description
   */
  function getBiometricsDescription(type) {
    switch (type) {
      case 'face':
        if (Modernizr.ios) {
          return 'Face ID';
        }

        return 'Face Unlock';
      case 'finger':
      case 'touch':
        if (Modernizr.ios) {
          return 'Touch ID';
        }

        return 'Fingerprint';
      default:
        return type.charAt(0).toUpperCase() + type.slice(1);
    }
  }

  var lockScreen = (function() {
    var _this = this;
    var resetActionId = 'reset_action';
    var goToActionId = 'action';

    var lockScreen = function(configuration) {
      _this = this;
      this.widgetId = widgetId;
      this.widgetUuid = widgetUuid;
      this.configuration = (configuration || {});
      this.touchIdEnabled = this.configuration.enableTouchId || this.configuration.enable_touch_id;
      this.passcode = '';

      Fliplet.Security.Storage.init().then(function() {
        _this.initializePV();
        _this.attachEventListeners();
        _this.loadConfiguration(configuration);
      });
    };

    lockScreen.prototype = {
      constructor: lockScreen,
      attachEventListeners: function() {
        document.addEventListener('flLockCustomizationFinish', _this.initializeLockScreenUI);

        $lock.find('.num-setup').on('change keyup paste input', function() {
          var str = controlInput($(this));

          if (str.length >= 4) {
            _this.passcode = str;

            if ($lock.find('.state[data-state=setup]').hasClass('error')) {
              $lock.find('.state[data-state=setup]').removeClass('present error').addClass('past');
            } else {
              $lock.find('.state[data-state=setup]').removeClass('present').addClass('past');
            }

            _this.calculateElHeight($lock.find('.state[data-state=verify]'));
            $lock.find('.state[data-state=verify]').removeClass('future').addClass('present');
            _this.focusOnElement($lock.find('.state[data-state=verify]'));
            $(this).val('');
            $(this).blur();
          }
        });

        $lock.find('.num-verify').on('change keyup paste input', function() {
          var str = controlInput($(this));

          if (str.length >= 4) {
            if (str === _this.passcode) {
              _this.savePasscodeToStorage(encryptPasscode(_this.passcode));

              if (_this.touchIdEnabled) {
                Fliplet.User.Biometrics.isAvailable().then(function(type) {
                  $lock.find('.bio-id-type').text(getBiometricsDescription(type));
                  $lock.find('.state[data-state=verify]').removeClass('present').addClass('past');
                  _this.calculateElHeight($lock.find('.state[data-state=touchID]'));
                  $lock.find('.state[data-state=touchID]').removeClass('future').addClass('present');
                  $(this).val('');
                }, function onNotAvailable() {
                  $lock.find('.state[data-state=verify]').removeClass('present').addClass('past');
                  _this.calculateElHeight($lock.find('.state[data-state=noTouchID]'));
                  $lock.find('.state[data-state=noTouchID]').removeClass('future').addClass('present');
                  $(this).val('');
                });
              } else {
                $lock.find('.state[data-state=verify]').removeClass('present').addClass('past');
                _this.calculateElHeight($lock.find('.state[data-state=noTouchID]'));
                $lock.find('.state[data-state=noTouchID]').removeClass('future').addClass('present');
                $(this).val('');
              }
            } else {
              // GA Track event
              Fliplet.Analytics.trackEvent({
                category: 'lock_screen',
                action: 'setup_fail',
                nonInteraction: true
              });

              $lock.find('.state[data-state=verify]').removeClass('present').addClass('future');
              _this.calculateElHeight($lock.find('.state[data-state=setup]'));
              $lock.find('.state[data-state=setup]').removeClass('past').addClass('present error');
              _this.focusOnElement($lock.find('.state[data-state=setup]'));
            }

            $(this).val('');
            $(this).blur();
          }
        });

        $lock.find('.num-unlock').on('change keyup paste input', function() {
          var str = controlInput($(this));

          if (str.length >= 4) {
            if (encryptPasscode(str) === _this.passcodePV.hashedPassCode) {
              // GA Track event
              Fliplet.Analytics.trackEvent({
                category: 'lock_screen',
                action: 'enter_success'
              });

              redirectTo(goToActionId);
            } else {
              // TODO GA Track event
              Fliplet.Analytics.trackEvent({
                category: 'lock_screen',
                action: 'enter_fail'
              });

              $lock.find('.state[data-state=unlock]').addClass('error');
              $lock.find('.state[data-state=unlock]').find('input').focus();
            }

            $(this).val('');
            $(this).blur();
          }
        });

        $lock.find('.continue-touchID, .continue').on('click', function() {
          redirectTo(goToActionId);

          return false;
        });

        $lock.find('.forgot-passcode').on('click', function() {
          if (_this.configuration.hasReset) {
            // GA Track event
            Fliplet.Analytics.trackEvent({
              category: 'lock_screen',
              action: 'forgot_passcode'
            });

            Fliplet.Security.Storage.reset(_this.pvName).then(function() {
              // Users should be logged out before being redirected to the configured screen.
              Fliplet.Session.logout().then(function onSessionDestroyed() {
                // go to the user configured screen and add a Query var to let the application know that the app needs to be reset;
                redirectTo(resetActionId);
                $lock.find('.form-control.input-lg').val('');
              });

              return false;
            });
          }
        }).trigger('change');

        $lock.find('.back-setup').on('click', function() {
          // GA Track event
          Fliplet.Analytics.trackEvent({
            category: 'lock_screen',
            action: 'setup_back',
            nonInteraction: true
          });

          $lock.find('.state[data-state=verify]').removeClass('present').addClass('future');
          _this.calculateElHeight($lock.find('.state[data-state=setup]'));
          $lock.find('.state[data-state=setup]').removeClass('past').addClass('present');
          _this.focusOnElement($lock.find('.state[data-state=setup]'));
          $lock.find('.state[data-state=verify]').find('.num-verify').val('');
        });

        $lock.find('.use-touchid').on('click', function() {
          // GA Track event
          Fliplet.Analytics.trackEvent({
            category: 'lock_screen',
            action: 'touchid_manual_activated'
          });

          Fliplet.User.Biometrics.isAvailable().then(function() {
            _this.useBiometrics();
          });
        });
      },
      calculateElHeight: function(el) {
        var elementHeight = el.outerHeight();

        el.parents('.passcode-wrapper').css('height', elementHeight);
      },
      focusOnElement: function(el) {
        if (Modernizr.android) {
          setTimeout(function() {
            el.find('input').focus();
          }, 500);
        }
      },
      initializePV: function() {
        _this.pvName = 'passcode_' + _this.widgetUuid;

        var dataStructure = {
          hashedPassCode: false
        };

        Fliplet.Security.Storage.create(_this.pvName, dataStructure).then(
          function(data) {
            _this.passcodePV = data;

            if (_this.configuration.hasCustomization) {
              var event = new CustomEvent(
                'flLockOnLoadCustomization',
                {
                  bubbles: true,
                  cancelable: true
                }
              );

              document.dispatchEvent(event);

              return;
            }

            _this.initializeLockScreenUI();
          }
        );
      },
      initializeLockScreenUI: function() {
        var that = _this;

        if (_this.passcodePV.hashedPassCode) {
          _this.calculateElHeight($lock.find('.state[data-state=unlock]'));
          $lock.find('.state[data-state=unlock]').addClass('present');
          _this.focusOnElement($lock.find('.state[data-state=unlock]'));

          if (_this.touchIdEnabled) {
            // GA Track event
            Fliplet.Analytics.trackEvent({
              category: 'lock_screen',
              action: 'touchid_admin_enabled',
              nonInteraction: true
            });

            Fliplet.User.Biometrics.isAvailable().then(function(type) {
              $lock.find('.bio-id-type').text(getBiometricsDescription(type));

              // GA Track event
              Fliplet.Analytics.trackEvent({
                category: 'lock_screen',
                action: 'touchid_available',
                nonInteraction: true
              });

              $lock.find('.state[data-state=unlock]').find('.use-touchid').removeClass('notShow');

              that.useBiometrics();
            }, function onNotAvailable() {
              // Biometrics not available
            });
          }
        } else {
          _this.calculateElHeight($lock.find('.state[data-state=setup]'));
          $lock.find('.state[data-state=setup]').addClass('present');
          _this.focusOnElement($lock.find('.state[data-state=setup]'));
        }
      },
      /**
       * Ask the user to authenticate via the Biometrics
       * @returns {Promise} Verification promise
       */
      useBiometrics: function() {
        var options = {
          title: T('widgets.lock.touchId.authenticate.title')
        };

        if (Modernizr.ios) {
          options.description = T('widgets.lock.touchId.authenticate.description');
        }

        return Fliplet.User.Biometrics.verify(options).then(function() {
          // GA Track event
          Fliplet.Analytics.trackEvent({
            category: 'lock_screen',
            action: 'touchid_verified'
          });

          redirectTo(goToActionId);
        }, function onError() {
          // GA Track event
          Fliplet.Analytics.trackEvent({
            category: 'lock_screen',
            action: 'touchid_cancelled',
            nonInteraction: true
          });
        });
      },
      savePasscodeToStorage: function(hashedPassCode) {
        // GA Track event
        Fliplet.Analytics.trackEvent({
          category: 'lock_screen',
          action: 'setup_success'
        });

        _this.passcodePV.hashedPassCode = hashedPassCode;
        Fliplet.Security.Storage.update();
      },
      loadConfiguration: function(configuration) {
        if (!configuration.hasReset) {
          $lock.find('.forgot-passcode').addClass('hidden');
        }
      }
    };

    /**
     * use sjcl to hash the passode
     * @param {*} passcode to be hashed
     * @returns {*} hashed passcode
     */
    function encryptPasscode(passcode) {
      var bitArray = sjcl.hash.sha256.hash(passcode);

      return sjcl.codec.hex.fromBits(bitArray);
    }

    /**
         * enforcers the input ot be - Numerical digits only and 4-digits long
         * @param {*} $element element to obtain input
         * @returns {*} controlled string.
         */
    function controlInput($element) {
      var str = $element.val();

      str = str.toLowerCase().replace(/[^0-9]+/g, '').substr(0, 4);
      $element.val(str);

      return str;
    }

    /**
    * method used to navigate to another page based on a key of an link action on the configuration
    * @param {*} redirectKey $input that has the redirect onclick_attribute.
    * @returns {*} lockScreen
    */
    function redirectTo(redirectKey) {
      Fliplet.Navigate.to(_this.configuration[redirectKey]);
    }

    Fliplet.Studio.onEvent(function(event) {
      if (event.detail.event === 'reload-widget-instance') {
        setTimeout(function() {
          var elementHeight;

          if (_this.passcodePV.hashedPassCode) {
            elementHeight = $('.state[data-state=unlock]').outerHeight();
            $('.state[data-state=unlock]').addClass('present');
            $('.state[data-state=unlock]').parents('.passcode-wrapper').css('height', elementHeight);

            return;
          }

          elementHeight = $('.state[data-state=setup]').outerHeight();
          $('.state[data-state=setup]').addClass('present');
          $('.state[data-state=setup]').parents('.passcode-wrapper').css('height', elementHeight);
        }, 500);
      }
    });

    return lockScreen;
  })();

  Fliplet().then(function() {
    $lock.translate();

    new lockScreen(data);
  });
});
