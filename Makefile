.PHONY: install backend-dev frontend-dev backend-lint backend-test frontend-lint frontend-test frontend-build check clean

VENV_DIR ?= backend/.venv
ifeq ($(OS),Windows_NT)
    BACKEND_BIN ?= $(VENV_DIR)/Scripts
else
    BACKEND_BIN ?= $(VENV_DIR)/bin
endif

install:
	@echo "Installing backend dependencies..."
	cd backend && uv venv --python 3.12 .venv && uv pip install -e ".[dev]"
	@echo "Installing frontend dependencies..."
	cd frontend && npm install

backend-lint:
	cd backend && $(BACKEND_BIN)/ruff check .
	cd backend && $(BACKEND_BIN)/ruff format --check .
	cd backend && $(BACKEND_BIN)/mypy app

backend-test:
	cd backend && $(BACKEND_BIN)/pytest

frontend-lint:
	cd frontend && npm run lint

frontend-test:
	cd frontend && npm run test

frontend-build:
	cd frontend && npm run build

backend-dev:
	cd backend && $(BACKEND_BIN)/uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

frontend-dev:
	cd frontend && npm run dev

check: backend-lint backend-test frontend-lint frontend-test frontend-build
	@echo "=== ALL CHECKS PASSED ==="
