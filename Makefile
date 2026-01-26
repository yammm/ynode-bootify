# Release helper
# Usage: make release VERSION=1.0.0
.PHONY: release check test lint docs clean

VERSION ?=

docs:
	npm run docs

clean:
	npm run docs:clean

lint:
	npm run lint

release: check
	@if [ -z "$(VERSION)" ]; then echo "VERSION required"; exit 2; fi
	npm version $(VERSION)
	npm publish --access public
	git push && git push --tags

check:
	@command -v npm >/dev/null 2>&1 || { echo "npm not found"; exit 1; }
	@if [ ! -f package.json ]; then echo "package.json missing"; exit 1; fi

test:
	npm run test
