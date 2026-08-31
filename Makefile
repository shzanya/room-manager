# ── Room Manager — Docker Commands ────────────────────────────────
.PHONY: help up down restart logs status scale clean build db-migrate db-shell redis-cli

COMPOSE = docker compose
FILE = docker-compose.yml

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ── Lifecycle ─────────────────────────────────────────────────────

build: ## Build bot image
	$(COMPOSE) -f $(FILE) build --no-cache bot

up: ## Start all services
	$(COMPOSE) -f $(FILE) up -d

up-build: ## Rebuild and start
	$(COMPOSE) -f $(FILE) up -d --build

down: ## Stop all services
	$(COMPOSE) -f $(FILE) down

down-volumes: ## Stop + delete volumes (DESTRUCTIVE)
	$(COMPOSE) -f $(FILE) down -v

restart: ## Restart all services
	$(COMPOSE) -f $(FILE) restart

# ── Scaling ───────────────────────────────────────────────────────

scale: ## Scale bot replicas (usage: make scale N=3)
	$(COMPOSE) -f $(FILE) up -d --scale bot=$(N)

# ── Monitoring ────────────────────────────────────────────────────

logs: ## Tail all logs
	$(COMPOSE) -f $(FILE) logs -f --tail=100

logs-bot: ## Tail bot logs only
	$(COMPOSE) -f $(FILE) logs -f --tail=100 bot

logs-db: ## Tail PostgreSQL logs
	$(COMPOSE) -f $(FILE) logs -f --tail=100 postgres

status: ## Show service status
	$(COMPOSE) -f $(FILE) ps

top: ## Show resource usage
	$(COMPOSE) -f $(FILE) top

# ── Database ──────────────────────────────────────────────────────

db-migrate: ## Run drizzle migrations
	$(COMPOSE) -f $(FILE) exec bot bun run db:migrate

db-shell: ## Open psql shell
	$(COMPOSE) -f $(FILE) exec postgres psql -U $${POSTGRES_USER:-roommanager} -d $${POSTGRES_DB:-room_manager}

db-backup: ## Backup database
	$(COMPOSE) -f $(FILE) exec postgres pg_dump -U $${POSTGRES_USER:-roommanager} $${POSTGRES_DB:-room_manager} > backup_$$(date +%Y%m%d_%H%M%S).sql

# ── Redis ─────────────────────────────────────────────────────────

redis-cli: ## Open redis-cli
	$(COMPOSE) -f $(FILE) exec redis redis-cli

redis-flush: ## Flush all Redis data (DESTRUCTIVE)
	$(COMPOSE) -f $(FILE) exec redis redis-cli FLUSHALL

# ── Utilities ─────────────────────────────────────────────────────

shell: ## Open shell in bot container
	$(COMPOSE) -f $(FILE) exec bot sh

health: ## Check health endpoints
	@echo "── Bot Health ──"
	@curl -s http://localhost:$${BOT_PORT:-9090}/health | python3 -m json.tool 2>/dev/null || echo "Bot not reachable"
	@echo ""
	@echo "── Nginx Health ──"
	@curl -s http://localhost:$${NGINX_PORT:-80}/nginx-health | python3 -m json.tool 2>/dev/null || echo "Nginx not reachable"

clean: ## Remove all containers, images, volumes
	$(COMPOSE) -f $(FILE) down -v --rmi all
	docker system prune -f

# ── Deploy ────────────────────────────────────────────────────────

deploy: ## Full deploy: build + migrate + start
	$(MAKE) build
	$(MAKE) up-build
	@sleep 5
	$(MAKE) db-migrate
	$(MAKE) status

update: ## Pull latest + restart
	$(COMPOSE) -f $(FILE) pull
	$(MAKE) up-build
	$(MAKE) status
