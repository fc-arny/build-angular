/* jshint globalstrict: true */
/* global Scope: false */
'use strict';

describe('Scope', function(){
    it('can be constracted and used as an object', function(){
        var scope = new Scope();
        scope.aProperty = 1;

        expect(scope.aProperty).toBe(1);
    });

    describe('digest', function(){
        var scope;

        beforeEach(function(){
            scope = new Scope();
        });

        it('calls the listener function of watch on first $digest', function(){
            var watchFn = jasmine.createSpy();
            var listenerFn = jasmine.createSpy();
            scope.$watch(watchFn, listenerFn);

            scope.$digest();

            expect(watchFn).toHaveBeenCalledWith(scope);
        });

        it('calls the listener function when the watched value changes', function() {
            scope.someValue = 'a';
            scope.counter = 0;

            scope.$watch(
                function(scope) { return scope.someValue; },
                function(newValue, oldValue, scope) { scope.counter++; }
            );

            expect(scope.counter).toBe(0);

            scope.$digest();
            expect(scope.counter).toBe(1);

            scope.$digest();
            expect(scope.counter).toBe(1);

            scope.someValue = 'b';
            expect(scope.counter).toBe(1);

            scope.$digest();
            expect(scope.counter).toBe(2);
        });


        it('calls listener when watch value is first undefined', function() {
            scope.counter = 0;

            scope.$watch(
                function(scope) { return scope.someValue; },
                function(newValue, oldValue, scope) { return scope.counter++; }
            );

            scope.$digest();
            expect(scope.counter).toBe(1);
        });

        it('calls listener with new value as old value the first time', function() {
            scope.someValue = 123;
            var oldValueGiven;

            scope.$watch(
                function(scope) { return scope.someValue; },
                function(newValue, oldValue, scope) { oldValueGiven = oldValue; }
            );

            scope.$digest();
            expect(oldValueGiven).toBe(123);
        });

        it('may have watchers that omit listener function', function() {
            var watchFn = jasmine.createSpy().and.returnValue('something');
            scope.$watch(watchFn);

            scope.$digest();

            expect(watchFn).toHaveBeenCalled();
        });

        it('triggers chained watchers in the same digest', function() {
            scope.name = 'Jane';

            scope.$watch(
                function(scope) { return scope.nameUpper; },
                function(newValue, oldValue, scope) {
                    if(newValue) {
                        scope.initial = newValue.substring(0,1) + '.';
                    }
                }
            );

            scope.$watch(
                function() { return scope.name; },
                function(newValue, oldValue, scope) {
                    if(newValue) {
                        scope.nameUpper = newValue.toUpperCase();
                    }
                }
            );

            scope.$digest();
            expect(scope.initial).toBe('J.');

            scope.name = 'Bob';
            scope.$digest();
            expect(scope.initial).toBe('B.');
        });

        it('gives up on the watchers after 10 iterations', function() {
            scope.counterA = 0;
            scope.counterB = 0;

            scope.$watch(
                function(scope) { return scope.counterA; },
                function(newValue, oldValue, scope) {
                    scope.counterB++;
                }
            );

            scope.$watch(
                function() { return scope.counterB; },
                function(newValue, oldValue, scope) {
                    scope.counterA++;
                }
            );

            expect(function() { scope.$digest(); }).toThrow();

        });

        it('ends digest when the last watcher is clean', function() {
            scope.array = _.range(100);
            var watchExecutaions = 0;

            _.times(100, function(i) {
                scope.$watch(
                    function(scope) {
                        watchExecutaions++;
                        return scope.array[i];
                    },
                    function(newValue, oldValue, scope) {}
                );
            });

            scope.$digest();
            expect(watchExecutaions).toBe(200);

            scope.array[0] = 420;
            scope.$digest();
            expect(watchExecutaions).toBe(301);
        });

        it('do not end digest so that new watcher are not run', function() {
            scope.aValue = 'abc';
            scope.counter = 0;

            scope.$watch(
                function(scope) { return scope.aValue; },
                function(newValue, oldValue, scope) {
                    scope.$watch(
                        function() { return scope.aValue; },
                        function(newValue, oldValue, scope) {
                            scope.counter++;
                        }
                    );
                }
            );

            scope.$digest();
            expect(scope.counter).toBe(1);
        });

        it('compares based on value if enabled', function() {
            scope.aValue = [1, 2, 3];
            scope.counter = 0;

            scope.$watch(
                function(scope) { return scope.aValue; },
                function(newValue, oldValue, scope) {
                    scope.counter++;
                },
                true
            );

            scope.$digest();
            expect(scope.counter).toBe(1);

            scope.aValue.push(4);
            scope.$digest();
            expect(scope.counter).toBe(2);
        });

        it('correctly handles for NANs', function() {
            scope.number = 0/0;
            scope.counter = 0;

            scope.$watch(
                function(scope) { return scope.number; },
                function(newValue, oldValue, scope) {
                    scope.counter++;
                }
            );

            scope.$digest();
            expect(scope.counter).toBe(1);

            scope.$digest();
            expect(scope.counter).toBe(1);
        });

        it('executes $eval\'d function and returns result', function() {
            var result;
            scope.aValue = 42;

            result = scope.$eval(function(scope) {
                return scope.aValue;
            });

            expect(result).toBe(42);
        });

        it('passes the second $eval argument straight through', function() {
            var result;
            scope.aValue = 42;

            result = scope.$eval(function(scope, arg) {
                return scope.aValue + arg;
            }, 2);

            expect(result).toBe(44);
        });

        it('execute $apply\'ed function and starts the digest', function() {
            scope.aValue = 'someValue';
            scope.counter = 0;

            scope.$watch(
                function(scope) { return scope.aValue; },
                function(newValue, oldValue, scope) {
                    scope.counter++;
                }
            );

            scope.$digest();
            expect(scope.counter).toBe(1);

            scope.$apply(function(scope) {
                scope.aValue = 'someOtherValue';
            });
            expect(scope.counter).toBe(2);
        });

        it('executes $evalAsynced function letter in the same cycle', function() {
            scope.aValue = [1,2,3];
            scope.asyncEvaluated = false;
            scope.asyncEvaluatedImmidiatly = false;

            scope.$watch(
                function(scope) { return scope.aValue; },
                function(newValue, oldValue, scope) {
                    scope.$evalAsync(function(scope) {
                        scope.asyncEvaluated = true;
                    });
                    scope.asyncEvaluatedImmidiatly = scope.asyncEvaluated;
                }
            );

            scope.$digest();
            expect(scope.asyncEvaluated).toBe(true);
            expect(scope.asyncEvaluatedImmidiatly).toBe(false);
        });

        it('executed $evalAsynced function added by watch function', function() {
            scope.aValue = [1,2,3];
            scope.asyncEcaluated = false;

            scope.$watch(
                function(scope) {
                    if(!scope.asyncEcaluated) {
                        scope.$evalAsync(function(scope){
                            scope.asyncEcaluated = true;
                        });
                    }

                    return scope.aValue;
                },
                function(newValue, oldValue, scope) {}
            );

            scope.$digest();
            expect(scope.asyncEcaluated).toBe(true);
        });

        it('executes $evalAsynced function even when not dirty', function() {
            scope.aValue = [1,2,3];
            scope.asyncEvaluatedTimes = 0;

            scope.$watch(
                function(scope) {
                    if(scope.asyncEvaluatedTimes < 2) {
                        scope.$evalAsync(function(scope) {
                            scope.asyncEvaluatedTimes++;
                        });
                    }
                },
                function(newValue, oldValue, scope) {}
            );

            scope.$digest();
            expect(scope.asyncEvaluatedTimes).toBe(2);
        });

        it('eventually halts $evalAsyncs added by watchers', function() {
            scope.aValue = [1,2,3];

            scope.$watch(
                function(scope) {
                    scope.$evalAsync(function(scope) {});
                    return scope.aValue;
                },
                function(newValue, oldValue, scope) {}
            );

            expect(function() { scope.$digest(); }).toThrow();


        });
    });
});