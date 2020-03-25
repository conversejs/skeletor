ESLINT			?= ./node_modules/.bin/eslint

node_modules: package.json package-lock.json
	npm install

build: node_modules
	npm run build

dev: node_modules build
	npm run dev

check: node_modules build eslint
	npm run test

.PHONY: eslint
eslint: node_modules
	$(ESLINT) src/*.js
