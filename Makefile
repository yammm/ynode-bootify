.PHONY: help test lint format docs clean

help:
	@echo "Available commands:"
	@echo "  make test      Run the test suite via npm"
	@echo "  make lint      Run ESLint via npm"
	@echo "  make format    Run Prettier formatting via npm"
	@echo "  make docs      Generate JSDoc via npm"
	@echo "  make clean     Remove generated JSDoc directory via npm"

test:
	npm run test

lint:
	npm run lint

format:
	npm run format

docs:
	npm run docs

clean:
	npm run docs:clean
