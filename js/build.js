Fliplet.Widget.instance('passcode', function(data){
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

    var Lock_screen = (function() {

        var _this = this;
        const reset_action_id = 'reset_action';
        const go_to_action_id = 'action';

        var Lock_screen = function(configuration) {

            _this = this;
            this.widgetId = widgetId;
            this.widgetUuid = widgetUuid;
            this.configuration = (configuration || {});
            this.passcode = '';
            Fliplet.Security.Storage.init().then(function(){
                _this.initialize_PV();
                _this.attach_event_listeners();
                _this.load_configuration(configuration);
            });
        };

        Lock_screen.prototype = {
            constructor: Lock_screen,
            attach_event_listeners: function() {

                document.addEventListener('flLockCustomizationFinish', _this.initialize_lock_screen_ui);

                $lock.find('.num-setup').on('change keyup paste input', function() {

                    var str = control_input($(this));

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

                    var str = control_input($(this));

                    if (str.length >= 4) {
                        if (str === _this.passcode) {
                            _this.savePasscodeOnPV(encrypt_passcode(_this.passcode));
                            if (Fliplet.Env.get('platform') !== 'web' && _this.configuration.enable_touch_id) {
                                if (window.plugins.touchid) {
                                    window.plugins.touchid.isAvailable(
                                        function(msg) {
                                            $lock.find('.state[data-state=verify]').removeClass('present').addClass('past');
                                            _this.calculateElHeight($lock.find('.state[data-state=touchID]'));
                                            $lock.find('.state[data-state=touchID]').removeClass('future').addClass('present');
                                            $(this).val('');
                                        },
                                        function(msg) {
                                            $lock.find('.state[data-state=verify]').removeClass('present').addClass('past');
                                            _this.calculateElHeight($lock.find('.state[data-state=noTouchID]'));
                                            $lock.find('.state[data-state=noTouchID]').removeClass('future').addClass('present');
                                            $(this).val('');
                                        }
                                    );
                                } else {
                                    $lock.find('.state[data-state=verify]').removeClass('present').addClass('past');
                                    _this.calculateElHeight($lock.find('.state[data-state=noTouchID]'));
                                    $lock.find('.state[data-state=noTouchID]').removeClass('future').addClass('present');
                                    $(this).val('');
                                }
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

                    var str = control_input($(this));

                    if (str.length >= 4) {
                        if (encrypt_passcode(str) === _this.passcodePV.hashedPassCode) {
                            // GA Track event
                            Fliplet.Analytics.trackEvent({
                              category: 'lock_screen',
                              action: 'enter_success'
                            });

                            redirect_to(go_to_action_id);
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
                    redirect_to(go_to_action_id);
                    return false;
                });

                $lock.find('.forgot-passcode').on('click', function() {
                    if (_this.configuration.has_reset) {
                        // GA Track event
                        Fliplet.Analytics.trackEvent({
                          category: 'lock_screen',
                          action: 'forgot_passcode'
                        });

                        Fliplet.Security.Storage.reset(_this.pvName).then(function(data){
                            //go to the user configured screen and add a Query var to let the application know that the app needs to be reset;
                            redirect_to(reset_action_id);
                            $lock.find('.form-control.input-lg').val('');
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
                    _this.useTouchId();
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
            initialize_PV: function() {

                _this.pvName = 'passcode_' + _this.widgetUuid;
                var dataStructure = {
                    hashedPassCode: false
                };

                Fliplet.Security.Storage.create(_this.pvName, dataStructure).then(
                    function(data) {
                        _this.passcodePV = data;
                        if(_this.configuration.hasCustomization) {
                            var event = new CustomEvent(
                                "flLockOnLoadCustomization",
                                {
                                    bubbles: true,
                                    cancelable: true
                                }
                            );
                            document.dispatchEvent(event);
                            return;
                        }
                        _this.initialize_lock_screen_ui();
                    }
                );
            },
            initialize_lock_screen_ui: function(){
                var that = _this;

                if (_this.passcodePV.hashedPassCode) {
                    if (_this.configuration.enable_touch_id && Fliplet.Env.get('platform') !== 'web') {
                        // GA Track event
                        Fliplet.Analytics.trackEvent({
                          category: 'lock_screen',
                          action: 'touchid_admin_enabled',
                          nonInteraction: true
                        });

                        if (window.plugins.touchid) {
                            window.plugins.touchid.isAvailable(
                                function(msg) {
                                    // GA Track event
                                    Fliplet.Analytics.trackEvent({
                                      category: 'lock_screen',
                                      action: 'touchid_available',
                                      nonInteraction: true
                                    });
                                    $lock.find('.state[data-state=unlock]').find('.use-touchid').removeClass('notShow');
                                    that.useTouchId();
                                },
                                function(msg) {}
                            );
                        }
                    }
                    _this.calculateElHeight($lock.find('.state[data-state=unlock]'));
                    $lock.find('.state[data-state=unlock]').addClass('present');
                    _this.focusOnElement($lock.find('.state[data-state=unlock]'));
                } else {
                    _this.calculateElHeight($lock.find('.state[data-state=setup]'));
                    $lock.find('.state[data-state=setup]').addClass('present');
                    _this.focusOnElement($lock.find('.state[data-state=setup]'));
                }
            },
            useTouchId: function() {
                window.plugins.touchid.verifyFingerprintWithCustomPasswordFallbackAndEnterPasswordLabel(
                    'Use your fingerprint to unlock your app',
                    'Enter Passcode',
                    function(msg) {
                        // GA Track event
                        Fliplet.Analytics.trackEvent({
                          category: 'lock_screen',
                          action: 'touchid_verified'
                        });

                        redirect_to(go_to_action_id);
                    },
                    function(msg) {
                        // GA Track event
                        Fliplet.Analytics.trackEvent({
                          category: 'lock_screen',
                          action: 'touchid_cancelled',
                          nonInteraction: true
                        });
                    }
                );
            },
            savePasscodeOnPV: function(hashedPassCode) {
                // GA Track event
                Fliplet.Analytics.trackEvent({
                  category: 'lock_screen',
                  action: 'setup_success'
                });

                _this.passcodePV.hashedPassCode = hashedPassCode;
                Fliplet.Security.Storage.update();
            },
            load_configuration: function(configuration) {
                if (!configuration.has_reset) {
                    $lock.find('.forgot-passcode').addClass("hidden");
                }
            }
        };

        /**
         * use sjcl to hash the passode
         * @param passcode to be hashed
         * @returns {*} hashed passcode
         */
        function encrypt_passcode(passcode) {
            var bitArray = sjcl.hash.sha256.hash(passcode);
            return sjcl.codec.hex.fromBits(bitArray);
        }

        /**
         * enforcers the input ot be - Numerical digits only and 4-digits long
         * @param $element element to obtain input
         * @returns {*} controlled string.
         */
        function control_input($element) {
            var str = $element.val();

            str = str.toLowerCase().replace(/[^0-9]+/g, "").substr(0, 4);
            $element.val(str);

            return str;
        }

        /**
         * method used to navigate to another page based on a key of an link action on the configuration
         * @param redirect_key $input that has the redirect onclick_attribute.
         */
        function redirect_to(redirect_key) {
            Fliplet.Navigate.to(_this.configuration[redirect_key]);
        }

        Fliplet.Studio.onEvent(function (event) {
            if (event.detail.event === 'reload-widget-instance') {
                setTimeout(function() {
                    if (_this.passcodePV.hashedPassCode) {
                        var elementHeight = $('.state[data-state=unlock]').outerHeight();
                        $('.state[data-state=unlock]').addClass('present');
                        $('.state[data-state=unlock]').parents('.passcode-wrapper').css('height', elementHeight);
                        return;
                    }
                    var elementHeight = $('.state[data-state=setup]').outerHeight();
                    $('.state[data-state=setup]').addClass('present');
                    $('.state[data-state=setup]').parents('.passcode-wrapper').css('height', elementHeight);

                }, 500);
            }
        });

        return Lock_screen;
    })();

    if(Fliplet.Env.get('platform') === 'web') {
        initLockScreen();
        $('.passcode-wrapper').parent().on("fliplet_page_reloaded", initLockScreen);
    } else {
        Fliplet().then(function() {
          initLockScreen();
        });
    }

    function initLockScreen(){

        data.hasCustomization = typeof lockScreenCustomization!== "undefined" ? lockScreenCustomization : false;

        new Lock_screen(data);
    }
});
