# Release Checklist

1. Make sure all tests pass (run 'make check')
2. Update CHANGES.md
3. Run `make release VERSION=0.0.8` (on Mac, prefix with "SED=gsed" so that GNU-sed is used).
4. `git commit -am "Release 0.0.8"`
5. Tag code with version (`git tag -s vVERSION -m "Release 0.0.8"` )
6. Push repo and tags (`git push && git push origin v0.0.8`)
7. Publish on NPM: "npm publish"
8. Update the release notes on https://github.com/conversejs/skeletor/releases
9. Run `npm pack` and upload the tgz file to the releases page.
