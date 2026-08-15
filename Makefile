#Created make file to run some commands

help:
	@echo "List of commands you can call"
	@echo "fe - Calls the frontend expo mobile app"
	@echo "be - Starts the Backend FastAPI service"

fe:
	echo "Starting the frontend"
	cd apps/mobile && npx expo start 
	echo "Frontend is starting"

be: 
	echo "Starting Backend Fast API service"
	cd apps/api/ && source .venv/bin/activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000