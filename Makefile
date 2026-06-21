.PHONY: install dev build test test-e2e migrate seed start stop health routes docs

install:
	npm install
	npx prisma generate

dev:
	npm run start:dev

build:
	npm run build

test:
	npm test

test-e2e:
	npm run test:e2e

migrate:
	npx prisma migrate deploy

migrate-dev:
	npm run prisma:migrate

seed:
	npm run prisma:seed

start:
	npm run start:prod

health:
	@curl -s http://localhost:3001/api/health | python3 -m json.tool

routes:
	@curl -s http://localhost:3001/api/routes | python3 -m json.tool

docs:
	@echo "Swagger:  http://localhost:3001/api/docs"
	@echo "Routes:   http://localhost:3001/api/routes"
	@echo "Health:   http://localhost:3001/api/health"

setup: install migrate seed
	@echo "Setup complete. Run: make dev"

full-test: build test-e2e
	@echo "All tests passed."
