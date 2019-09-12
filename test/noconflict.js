(function(QUnit) {

  QUnit.module('Skeletor.noConflict');

  QUnit.test('noConflict', function(assert) {
    assert.expect(2);
    var noconflictSkeletor = Skeletor.noConflict();
    assert.equal(window.Skeletor, undefined, 'Returned window.Skeletor');
    window.Skeletor = noconflictSkeletor;
    assert.equal(window.Skeletor, noconflictSkeletor, 'Skeletor is still pointing to the original Skeletor');
  });

})(QUnit);
