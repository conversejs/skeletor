import * as Skeletor from '../src/index';

(function() {

  QUnit.module('Skeletor.noConflict');

  QUnit.test('noConflict', function(assert) {
    assert.expect(2);
    const noconflictSkeletor = Skeletor.noConflict();
    assert.equal((window as any).Skeletor, undefined, 'Returned window.Skeletor');
    (window as any).Skeletor = noconflictSkeletor;
    assert.equal((window as any).Skeletor, noconflictSkeletor, 'Skeletor is still pointing to the original Skeletor');
  });

})();
