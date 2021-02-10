ESLINT			?= ./node_modules/.bin/eslint
SED				?= sed

dev: node_modules build
	npm run dev

.PHONY: release
release:
	$(SED) -i '/"version":/s/:.*/: "$(VERSION)",/' package.json
	$(SED) -i "s/[Uu]nreleased/`date +%Y-%m-%d`/" CHANGES.md
	npm pack

node_modules: package.json package-lock.json
	npm install

build: node_modules
	npm run build

check: node_modules build eslint
	npm run test

.PHONY: eslint
eslint: node_modules
	$(ESLINT) src/*.js
