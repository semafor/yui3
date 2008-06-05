YUI.add("state", function(Y) {

    var L = Y.Lang;

    /**
     * Maintain state for a collection of items.  Individual properties 
     * are stored in hash tables.  This is instead of having state objects 
     * for each item in the collection.  For large collections, especially 
     * changing ones, this approach may perform better.
     * @class State
     */
    Y.State = function() { 

        /**
         * Hash of attributes
         * @property data
         */
        this.data = {};
    };

    Y.State.prototype = {

        /**
         * Add an item with all of the properties in the supplied object.
         * @method add
         * @param name {string} identifier for this attribute
         * @param o hash of attributes
         */
        add: function(name, o) {
            Y.each(o, function(v, k) {
                if (!this.data[k]) {
                    this.data[k] = {};
                }

                this.data[k][name] = v;
            }, this);
        },

        /**
         * Remove entire item, or optionally specified fields
         * @method remove
         * @param name {string} name of attribute
         * @param o {string|object|array} single key or collection of keys to delete
         */
        remove: function(name, o) {
            var d = this.data, 
                del = function(key) {
                    if (d[key] && (name in d[key])) {
                        delete d[key][name];
                    }
                };

            if (L.isString(o)) {
                del(o);
            } else {
                Y.each(o || d, function(v, k) {
                    if(L.isString(k)) {
                        del(k);
                    } else {
                        del(v);
                    }
                }, this);

            }
        },

        /** 
         * for a given item, gets an attribute.  If key is not
         * supplied, a disposable object with all attributes is 
         * returned.  Use of the latter option makes sense when
         * working with single items, but not if object explosion
         * might cause gc problems.
         * @method get
         * @param name {string} name of attribute
         * @param key {string} optional attribute to get
         * @return either the value of the supplied key or an object with
         * all data.
         */
        // get: function(name, key, val) {
        get: function(name, key) {
            var d = this.data;

            if (key) {
                return d[key] && d[key][name];
            } else {
                var o = {};

                Y.each(d, function(v, k) {
                    if (name in d[k]) {
                        o[k] = v[name];
                    }
                }, this);

                return o;

            }
        },

        // figure out what kind of functionality we may need here
        // get whole list
        // get a list of items and values for a given key
        // get a list of items where a key has the supplied value
        list: function(key, val) {
            var o = {}, d = this.data, test = !L.isUndefined(val);

            Y.each(this, function(v, k) {

                // verify key
                if (key && k !== key) {
                    return;
                // verify value.  note, v will be the item names, so this
                // isn't working ... need to iterate v items
                } else if (test && v !== val) {
                    return;
                }

                o[k] = v;

            }, this);

            return o;
        }
    };
}, "3.0.0");

YUI.add('attribute', function(Y) {

    var O = Y.Object,
        DOT = ".",
        CHANGE = "Change",
        GET = "get",
        SET = "set",
        VALUE = "value",
        READ_ONLY = "readonly",
        VALIDATOR = "validator";

    function _fireChange(type, currVal, newVal, attrName, strFullPath, opts) {
        type = type + CHANGE;

        // TODO: Publishing temporarily,
        // while we address event bubbling.
        this.publish(type, {queuable:false});

        var eData = {
            type: type,
            prevVal: currVal,
            newVal: newVal,
            attrName: attrName,
            subAttrName: strFullPath
        };

        if (opts) {
            Y.mix(eData, opts);
        }

        this.fire(eData);
    }

    /**
     * Manages attributes
     *
     * @class Attribute
     * @uses EventTarget
     */
    Y.Attribute = function() {
        this._conf = this._conf || new Y.State();
        Y.log('att constructor called', 'info', 'Attribute');
    };

    Y.Attribute.prototype = {
        /**
         * Adds an attribute.
         * @method add
         * @param {String} name The attribute key
         * @param {Object} val (optional) The attribute value
         */
        addAtt: function(name, hash) {
            Y.log('adding attribute: ' + name, 'info', 'Attribute');
            this._conf.add(name, hash);
        },

        /**
         * Removes an attribute.
         * @method remove
         * @param {String} name The attribute key
         */
        remove: function(name) {
            this._conf.remove(name);
        },

        /**
         * Returns the current value of the attribute. If the attribute
         * has been configured with a 'get' handler, this method will delegate
         * to the 'get' handler to obtain the value of the attribute.
         * The 'get' handler will be passed the current value of the attribute 
         * as the only argument.
         * @method get
         * @param {String} key The attribute whose value will be returned.
         */
        get: function(name) {

            var conf = this._conf,
                path,
                getFn,
                rawVal,
                val;

            if (name.indexOf(DOT) !== -1) {
                path = name.split(DOT);
                name = path.shift();
            }

            getFn = conf.get(name, GET);
            rawVal = conf.get(name, VALUE);
            val = (getFn) ? getFn.call(this, rawVal) : rawVal;

            return (path) ? this._getSubValue(path, val) : val;
        },

        /**
         * Sets the value of an attribute.
         * @method set
         * @param {String} name The name of the attribute
         * @param {Any} value The value to apply to the attribute
         * @param {Object} Event options. This object will be mixed into
         * the event facade passed as the first argument to subscribers 
         * attribute change events
         */
        set: function(name, val, opts) {

            var conf = this._conf,
                strPath,
                path,
                setFn,
                validatorFn,
                retVal,
                currVal,
                eData,
                e;

            if (name.indexOf(DOT) !== -1) {
                strPath = name;
                path = name.split(DOT);
                name = path.shift();
            }

            if (conf.get(name, READ_ONLY)) {
                Y.log('set ' + name + 'failed; attribute is readonly', 'error', 'Attribute');
                return this;
            }

            if (!conf.get(name)) {
                Y.log('Set called with unconfigured attribute. Adding a new attribute: ' + name, 'info', 'Attribute');
            }

            currVal = this.get(name);

            if (path) {
               val = this._setSubValue(path, Y.clone(currVal), val);
               if (val === undefined) {
                   // Path not valid, don't set anything.
                   Y.log('set ' + strPath + 'failed; attribute sub path is invalid', 'error', 'Attribute');
                   return this;
               }
            }

            setFn = conf.get(name, SET);
            if (setFn) {
                retVal = setFn.call(this, val);
                if (retVal !== undefined) {
                    Y.log('attribute: ' + name + ' modified by setter', 'info', 'Attribute');
                    val = retVal; // setter can change value
                }
            }

            validatorFn = conf.get(name, VALIDATOR);
            if (!validatorFn || validatorFn.call(this, val)) {
                conf.add(name, { value: val });
                if (path) {
                    _fireChange.call(this, strPath, currVal, val, name, strPath, opts);
                }
                _fireChange.call(this, name, currVal, val, name, strPath, opts);
            }

            return this;
        },

        /**
         * Retrieves the sub value at the provided path,
         * from the value object provided.
         *
         * @param {Array} path  A path array, specifying the object traversal path
         *                      from which to obtain the sub value.
         * @param {Object} val  The object from which to extract the property value
         * @return {Any} The value stored in the path or undefined if not found.
         *
         * @private
         */
        _getSubValue: function (path, val) {
            var pl = path.length,
                i;

            if (pl > 0) {
                for (i = 0; val !== undefined && i < pl; ++i) {
                    val = val[path[i]];
                }
            }

            return val;
        },

        /**
         * Sets the sub value at the provided path on the value object.
         * Returns the modified value object, or undefined if the path is invalid.
         *
         * @param {Array} path  A path array, specifying the object traversal path
         *                      at which to set the sub value.
         * @param {Object} val  The object on which to set the sub value.
         * @param {Any} subval  The sub value to set.
         * @return {Object}     The modified object, with the new sub value set, or 
         *                      undefined, if the path was invalid.
         *
         * @private
         */
        _setSubValue: function(path, val, subval) {

            var leafIdx = path.length-1,
                i,
                o;

            if (leafIdx >= 0) {
                o = val;

                for (i = 0; o !== undefined && i < leafIdx; ++i) {
                    o = o[path[i]];
                }

                // Not preventing new properties from being added
                if (o !== undefined /* && o[path[i]] !== undefined */) {
                    o[path[i]] = subval;
                } else {
                    val = undefined;
                }
            }

            return val;
        },

        /**
         * Sets multiple attribute values.
         * 
         * @method setAtts
         * @param {Object} atts  A hash of attributes: name/value pairs
         */
        setAtts: function(atts) {
            for (var att in atts) {
                if ( O.owns(atts, att) ) {
                    this.set(att, atts[att]);
                }
            }
        },

        /**
         * Gets multiple attribute values.
         * 
         * @method getAtts
         * @return {Object} A hash of attributes: name/values pairs
         */
        getAtts: function(atts) {
            var o = {};
            if (atts) {
                o = Y.clone(atts);
            } else {
                Y.each(this._conf.get(VALUE), function(val, att) {
                    o[att] = val; 
                });
            }

            return o;
        },

        /**
         * Configures attributes, and sets initial values
         *
         * @method _initAtts
         * @param {Object} cfg Attribute configuration object literal
         * @param {Object} initValues Name/Value hash of initial values to apply
         *
         * @private
         */
        _initAtts : function(cfg, initValues) {
            if (cfg) {
                var att,
                    attCfg,
                    values,
                    atts = Y.merge(cfg);

                values = this._splitAttVals(initValues);

                for (att in atts) {
                    if (O.owns(atts, att)) {
                        attCfg = atts[att];
                        this.addAtt(att, attCfg);
                        this._initAttValue(att, attCfg, values);
                    }
                }
            }
        },

        /**
         * Splits out regular from complex attribute intialization
         * values
         *
         * @method _splitAttrValues
         * @private
         */
        _splitAttVals: function(valueHash) {
            var vals = {},
                subvals = {},
                path,
                attr,
                v;

            for (var k in valueHash) {
                if (O.owns(valueHash, k)) {
                    if (k.indexOf(DOT) !== -1) {
                        path = k.split(DOT);
                        attr = path.shift();
                        v = subvals[attr] = subvals[attr] || [];
                        v[v.length] = {
                            path : path, 
                            value: valueHash[k]
                        };
                    } else {
                        vals[k] = valueHash[k];
                    }
                }
            }
            return { simple:vals, complex:subvals };
        },

        /**
         * Set the initial value of the given attribute from
         * either the default configuration provided, or the 
         * over-ridden value if it exists in the initValues 
         * hash provided.
         *
         * @param {String} att Attribute name
         * @param {Object} cfg Default attribute configuration
         * object literal
         * @param {Object} Initial attribute values.
         *
         * @method _initAttValue
         * @private
         */
        _initAttValue : function(att, cfg, initValues) {

            var hasVal = ("value" in cfg),
                val = cfg.value,
                simple, 
                complex,
                i, 
                l, 
                path, 
                subval, 
                subvals;

            if (initValues) {
                // Simple Attributes
                simple = initValues.simple;
                if (simple && O.owns(simple, att)) {
                    hasVal = true;
                    val = simple[att];
                }

                // Complex Attributes
                complex = initValues.complex;
                if (complex && O.owns(complex, att)) {
                    subvals = complex[att];
                    hasVal = true;

                    for (i = 0, l = subvals.length; i < l; ++i) {
                        path = subvals[i].path;
                        subval = subvals[i].value;
                        val = this._setSubValue(path, val, subval);
                    }
                }
            }

            if (hasVal) {
                this.set(att, val);
            }
        }
    };

    Y.augment(Y.Attribute, Y.EventTarget, null, null, {
        emitFacade: true
    });

}, '3.0.0', { requires: ['state'] });

