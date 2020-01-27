
node_modules: package.json package-lock.json
	npm install

build: node_modules
	npm run build

dev: node_modules build
	npm run dev

check: node_modules build
	npm run test
