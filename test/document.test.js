"use strict";

var _ = require('lodash');
var fs = require('fs');
var expect = require('chai').expect;
var connect = require('../index').connect;
var Document = require('../index').Document;
var Data = require('./data');
var getData1 = require('./util').data1;
var getData2 = require('./util').data2;
var validateId = require('./util').validateId;

describe('Document', function() {

    // TODO: Should probably use mock database client...
    var url = 'nedb://' + __dirname + '/nedbdata';
    var database = null;

    before(function(done) {
        connect(url).then(function(db) {
            database = db;
            return database.dropDatabase();
        }).then(function() {
            return done();
        });
    });

    beforeEach(function(done) {
        done();
    });

    afterEach(function(done) {
        database.dropDatabase().then(function() {}).then(done, done);
    });

    after(function(done) {
        database.dropDatabase().then(function() {}).then(done, done);
    });

    describe('types', function() {
        it('should allow reference types', function(done) {

            class ReferenceeModel extends Document {
                constructor() {
                    super('referencee1');
                    this.str = String;
                }
            }

            class ReferencerModel extends Document {
                constructor() {
                    super('referencer1');
                    this.ref = ReferenceeModel;
                    this.num = { type: Number };
                }
            }

            var data = ReferencerModel.create();
            data.ref = ReferenceeModel.create();
            data.ref.str = 'some data';
            data.num = 1;

            data.ref.save().then(function(d) {
                validateId(d);
                return data.save();
            }).then(function(d) {
                validateId(d);
                return ReferencerModel.loadOne({ num: 1 });
            }).then(function(d) {
                validateId(d);
                validateId(d.ref);
                expect(d.ref instanceof ReferenceeModel).to.be.true;
                expect(d.ref.str).to.be.equal('some data');
            }).then(done, done);
        });

        it('should allow array of references', function(done) {

            class ReferenceeModel extends Document {
                constructor() {
                    super('referencee2');
                    this.schema({ str: { type: String } });
                }
            }

            class ReferencerModel extends Document {
                constructor() {
                    super('referencer2');
                    this.refs = [ReferenceeModel];
                    this.num = Number;
                }
            }

            var data = ReferencerModel.create();
            data.refs.push(ReferenceeModel.create());
            data.refs.push(ReferenceeModel.create());
            data.refs[0].str = 'string1';
            data.refs[1].str = 'string2';
            data.num = 1;

            data.refs[0].save().then(function(d) {
                validateId(d);
                return data.refs[1].save();
            }).then(function(d) {
                validateId(d);
                return data.save();
            }).then(function(d) {
                validateId(d);
                return ReferencerModel.loadOne({ num: 1 });
            }).then(function(d) {
                validateId(d);
                validateId(d.refs[0]);
                validateId(d.refs[1]);
                expect(d.refs[0] instanceof ReferenceeModel).to.be.true;
                expect(d.refs[1] instanceof ReferenceeModel).to.be.true;
                expect(d.refs[0].str).to.be.equal('string1');
                expect(d.refs[1].str).to.be.equal('string2');
            }).then(done, done);
        });

        it('should allow circular references', function(done) {

            class Employee extends Document {
                constructor() {
                    super('employee');
                    this.name = String;
                    this.boss = Boss;
                }
            }

            class Boss extends Document {
                constructor() {
                    super('boss');
                    this.salary = Number;
                    this.employees = [Employee];
                }
            }

            var employee = Employee.create();
            employee.name = 'Scott';

            var boss = Boss.create();
            boss.salary = 10000000;

            employee.boss = boss;

            boss.save().then(function(b) {
                validateId(b);

                return employee.save();
            }).then(function(e) {
                validateId(e);
                validateId(e.boss);

                boss.employees.push(employee);

                return boss.save();
            }).then(function(b) {
                validateId(b);
                validateId(b.employees[0]);
                validateId(b.employees[0].boss);

                return Boss.loadOne({ salary: 10000000 });
            }).then(function(b) {
                // If we had an issue with an infinite loop
                // of loading circular dependencies then the
                // test probably would have crashed by now,
                // so we're good.

                validateId(b);

                // Validate that boss employee ref was loaded
                validateId(b.employees[0]);

                // .loadOne should have only loaded 1 level
                // of references, so the boss's reference
                // to the employee is still the ID.
                expect(b.employees[0].boss).to.be.a('string');
            }).then(done, done);
        });

        it('should allow string types', function(done) {

            class StringModel extends Document {
                constructor() {
                    super('data');
                    this.schema({ str: { type: String } });
                }
            }

            var data = StringModel.create();
            data.str = 'hello';

            data.save().then(function(d) {
                validateId(d);
                expect(d.str).to.be.equal('hello');
            }).then(done, done);
        });

        it('should allow number types', function(done) {

            class NumberModel extends Document {
                constructor() {
                    super('data');
                    this.schema({ num: { type: Number } });
                }
            }

            var data = NumberModel.create();
            data.num = 26;

            data.save().then(function(d) {
                validateId(d);
                expect(d.num).to.be.equal(26);
            }).then(done, done);
        });

        it('should allow boolean types', function(done) {

            class BooleanModel extends Document {
                constructor() {
                    super('data');
                    this.schema({ bool: { type: Boolean } });
                }
            }

            var data = BooleanModel.create();
            data.bool = true;

            data.save().then(function(d) {
                validateId(d);
                expect(d.bool).to.be.equal(true);
            }).then(done, done);
        });

        it('should allow date types', function(done) {

            class DateModel extends Document {
                constructor() {
                    super('data');
                    this.schema({ date: { type: Date } });
                }
            }

            var data = DateModel.create();
            var date = new Date();
            data.date = date;

            data.save().then(function(d) {
                validateId(d);
                expect(d.date).to.be.equal(date);
            }).then(done, done);
        });

        it('should allow object types', function(done) {

            class ObjectModel extends Document {
                constructor() {
                    super('data');
                    this.schema({ obj: { type: Object } });
                }
            }

            var data = ObjectModel.create();
            data.obj = { hi: 'bye'};

            data.save().then(function(d) {
                validateId(d);
                expect(d.obj.hi).to.not.be.null;
                expect(d.obj.hi).to.be.equal('bye');
            }).then(done, done);
        });

        it('should allow buffer types', function(done) {

            class BufferModel extends Document {
                constructor() {
                    super('data');
                    this.schema({ buf: { type: Buffer } });
                }
            }

            var data = BufferModel.create();
            data.buf = new Buffer('hello');

            data.save().then(function(d) {
                validateId(d);
                expect(d.buf.toString('ascii')).to.be.equal('hello');
            }).then(done, done);
        });

        it('should allow array types', function(done) {

            class ArrayModel extends Document {
                constructor() {
                    super('data');
                    this.schema({ arr: { type: Array } });
                }
            }

            var data = ArrayModel.create();
            data.arr = [1, 'number', true];

            data.save().then(function(d) {
                validateId(d);
                expect(d.arr).to.have.length(3);
                expect(d.arr).to.include(1);
                expect(d.arr).to.include('number');
                expect(d.arr).to.include(true);
            }).then(done, done);
        });

        it('should allow typed-array types', function(done) {

            class ArrayModel extends Document {
                constructor() {
                    super('data');
                    this.schema({ arr: { type: [String] } });
                }
            }

            var data = ArrayModel.create();
            data.arr = ['1', '2', '3'];

            data.save().then(function(d) {
                validateId(d);
                expect(d.arr).to.have.length(3);
                expect(d.arr).to.include('1');
                expect(d.arr).to.include('2');
                expect(d.arr).to.include('3');
            }).then(done, done);
        });

        it('should reject objects containing values with different types', function(done) {

            class NumberModel extends Document {
                constructor() {
                    super('data');
                    this.schema({ num: { type: Number } });
                }
            }

            var data = NumberModel.create();
            data.num = '1';

            data.save().then(function(d) {
                expect.fail(null, Error, 'Expected error, but got none.');
            }).catch(function(error) {
                expect(error instanceof Error).to.be.true;
            }).then(done, done);
        });

        it('should reject typed-arrays containing different types', function(done) {

            class ArrayModel extends Document {
                constructor() {
                    super('data');
                    this.schema({ arr: { type: [String] } });
                }
            }

            var data = ArrayModel.create();
            data.arr = [1, 2, 3];

            data.save().then(function(d) {
                expect.fail(null, Error, 'Expected error, but got none.');
            }).catch(function(error) {
                expect(error instanceof Error).to.be.true;
            }).then(done, done);
        });
    });

    describe('defaults', function() {
        it('should assign default value if unassigned', function(done) {

            var data = Data.create();

            data.save().then(function(d) {
                validateId(d);
                expect(d.source).to.be.equal('reddit');
            }).then(done, done);
        });

        it('should assign default value via function if unassigned', function(done) {

            var data = Data.create();

            data.save().then(function(d) {
                validateId(d);
                expect(d.date).to.be.lessThan(Date.now());
            }).then(done, done);
        });
    });

    describe('choices', function() {
        it('should accept value specified in choices', function(done) {

            var data = Data.create();
            data.source = 'wired';

            data.save().then(function(d) {
                validateId(d);
                expect(d.source).to.be.equal('wired');
            }).then(done, done);
        });

        it('should reject values not specified in choices', function(done) {

            var data = Data.create();
            data.source = 'google';

            data.save().then(function(d) {
                expect.fail(null, Error, 'Expected error, but got none.');
            }).catch(function(error) {
                expect(error instanceof Error).to.be.true;
            }).then(done, done);
        });
    });

    describe('min', function() {
        it('should accept value > min', function(done) {

            var data = Data.create();
            data.item = 1;

            data.save().then(function(d) {
                validateId(d);
                expect(d.item).to.be.equal(1);
            }).then(done, done);
        });

        it('should accept value == min', function(done) {

            var data = Data.create();
            data.item = 0;

            data.save().then(function(d) {
                validateId(d);
                expect(d.item).to.be.equal(0);
            }).then(done, done);
        });

        it('should reject value < min', function(done) {

            var data = Data.create();
            data.item = -1;

            data.save().then(function(d) {
                expect.fail(null, Error, 'Expected error, but got none.');
            }).catch(function(error) {
                expect(error instanceof Error).to.be.true;
            }).then(done, done);
        });
    });

    describe('max', function() {
        it('should accept value < max', function(done) {

            var data = Data.create();
            data.item = 99;

            data.save().then(function(d) {
                validateId(d);
                expect(d.item).to.be.equal(99);
            }).then(done, done);
        });

        it('should accept value == max', function(done) {

            var data = Data.create();
            data.item = 100;

            data.save().then(function(d) {
                validateId(d);
                expect(d.item).to.be.equal(100);
            }).then(done, done);
        });

        it('should reject value > max', function(done) {

            var data = Data.create();
            data.item = 101;

            data.save().then(function(d) {
                expect.fail(null, Error, 'Expected error, but got none.');
            }).catch(function(error) {
                expect(error instanceof Error).to.be.true;
            }).then(done, done);
        });
    });
});