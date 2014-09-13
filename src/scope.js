/* jshint globalstrict: true */
'use strict';

function Scope() {
    this.$$watchers = [];
    this.$$lastDirtyWatch = null;
    this.$asyncQueue = [];
    this.$$postDigestQueue = [];
    this.$$root = this;
    this.$$phase = null;
    this.$$children = [];
}

function initWatchVal() {

}

Scope.prototype.$new = function (isolated) {
    var ChildScope, child;

    if (isolated) {
        child = new Scope();
        child.$$root = this.$$root;
    } else {
        ChildScope = function () {};

        ChildScope.prototype = this;
        child = new ChildScope();
    }

    this.$$children.push(child);

    child.$$watchers = [];
    child.$$children = [];

    return child;
};

Scope.prototype.$everyScope = function (fn) {
    if (fn(this)) {
        return this.$$children.every(function (child) {
            return child.$everyScope(fn);
        });
    } else {
        return false;
    }
};

Scope.prototype.$watch = function (watchFn, listenerFn, valueEq) {
    var self = this,
        watcher = {
        watchFn: watchFn,
        listenerFn: listenerFn || function () {
        },
        valueEq: !!valueEq,
        last: initWatchVal
    };

    this.$$watchers.unshift(watcher);
    this.$$root.$$lastDirtyWatch = null;

    return function () {
        var index = self.$$watchers.indexOf(watcher);
        if (index >= 0) {
            self.$$watchers.splice(index, 1);
            self.$$root.$$lastDirtyWatch = null;
        }
    };
};

Scope.prototype.$$digestOnce = function () {
    var dirty = false,
        continueLoop = true,
        self = this;
    this.$everyScope(function (scope) {
        var newValue, oldValue;
        _.forEachRight(scope.$$watchers, function (watcher) {
            try {
                if (watcher) {
                    newValue = watcher.watchFn(scope);
                    oldValue = watcher.last;
                    if (!scope.$$areEqual(newValue, oldValue, watcher.valueEq)) {
                        scope.$$root.$$lastDirtyWatch = watcher;
                        watcher.last = watcher.valueEq ? _.cloneDeep(newValue) : newValue;
                        watcher.listenerFn(newValue, (oldValue === initWatchVal ? newValue : oldValue), scope);
                        dirty = true;
                    } else if (scope.$$root.$$lastDirtyWatch === watcher) {
                        continueLoop = false;
                        return false;
                    }
                }
            } catch (e) {
                console.error(e);
            }
        });

        return continueLoop;
    });

    return dirty;
};

Scope.prototype.$digest = function () {

    var asyncTask;
    var dirty, ttl = 10;
    this.$$root.$$lastDirtyWatch = null;
    this.$beginPhase('$digest');

    do {
        while (this.$asyncQueue.length) {
            try {
                asyncTask = this.$asyncQueue.shift();
                this.$eval(asyncTask.expression);
            } catch (e) {
                console.error(e);
            }
        }
        dirty = this.$$digestOnce();
        if ((dirty || this.$asyncQueue.length) && !(ttl--)) {
            this.$clearPhase();
            throw new Error('10 digest iterations reached');
        }
    } while (dirty || this.$asyncQueue.length);
    this.$clearPhase();

    while (this.$$postDigestQueue.length) {
        try {
            this.$$postDigestQueue.shift()();
        } catch (e) {
            console.error(e);
        }

    }
};

Scope.prototype.$$areEqual = function (newValue, oldValue, valueEq) {
    if (valueEq) {
        return _.isEqual(newValue, oldValue);
    } else {
        return newValue === oldValue ||
        (typeof newValue === 'number' && typeof oldValue === 'number' && isNaN(newValue) && isNaN(oldValue));
    }
};

Scope.prototype.$eval = function (expr, locals) {
    return expr(this, locals);
};

Scope.prototype.$evalAsync = function (expr) {
    var self = this;

    if (!this.$$phase && !this.$asyncQueue.length) {
        setTimeout(function () {
            if (self.$asyncQueue.length) {
                self.$$root.$digest();
            }
        }, 0);
    }
    this.$asyncQueue.push({scope: this, expression: expr});
};

Scope.prototype.$apply = function (expr) {
    try {
        this.$beginPhase('$apply');
        return this.$eval(expr);
    } finally {
        this.$clearPhase();
        this.$$root.$digest();
    }
};

Scope.prototype.$beginPhase = function (phase) {
    if (this.$$phase) {
        throw new Error(this.$$phase + ' already in progress');
    }
    this.$$phase = phase;
};

Scope.prototype.$clearPhase = function () {
    this.$$phase = null;
};

Scope.prototype.$$postDigest = function (fn) {
    this.$$postDigestQueue.push(fn);
};