import { clone, uniq } from 'lodash';
import { Model } from '../src/model.js';
import { Collection } from "../src/collection";
import { expect } from 'chai';
import Storage from '../src/storage.js';
import root from 'window-or-global';


const attributes = {
    string: 'String',
    string2: 'String 2',
    number: 1337
};

const SavedModel = Model.extend({
    browserStorage: new Storage('SavedModel', 'noStorage'),
    defaults: attributes,
    urlRoot: '/test/'
});

const AjaxModel = Model.extend({
    defaults: attributes
});

const SavedCollection = Collection.extend({
    model: AjaxModel,
    browserStorage: new Storage('SavedCollection', 'noStorage')
});


describe.only('Storage Model using noStorage', function () {
    // beforeEach(() => sessionStorage.clear());

    it('is not saved', async function () {
        const mySavedModel = new SavedModel({'id': 10});
        await new Promise((resolve, reject) => mySavedModel.save(null, {'success': resolve}));
        expect(mySavedModel.id).to.equal(10);
        expect(mySavedModel.string).to.equal('String');
        expect(mySavedModel.string2).to.equal('String 2');
        expect(mySavedModel.number).to.equal(1337);
        mySavedModel.fetch();
        expect(mySavedModel.get('string')).to.be.undefined;
        expect(mySavedModel.get('string2')).to.be.undefined;
        expect(mySavedModel.get('number')).to.be.undefined;
    });

    it('can be converted to JSON', function () {
        const mySavedModel = new SavedModel({'id': 10});
        mySavedModel.save();
        expect(mySavedModel.toJSON()).to.eql({
            string: 'String',
            id: 10,
            number: 1337,
            string2: 'String 2'
        });
    });

    describe('once saved', function () {
        // beforeEach(() => sessionStorage.clear());

        it('cannot be fetched from noStorage', function () {
            const newModel = new SavedModel({'id': 10});
            newModel.fetch();
            expect(newModel.get('string')).to.be.undefined;
            expect(newModel.get('string2')).to.be.undefined;
            expect(newModel.get('number')).to.be.undefined;
        });

        it('passes fetch calls to success', function(done) {
            const mySavedModel = new SavedModel({'id': 10});
            mySavedModel.save();
            mySavedModel.fetch({
                success(model, response, options) {
                    expect(model).to.be.undefined;
                    done();
                }
            });
        });
    });
});
