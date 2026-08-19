# Created make file to run some commands

.PHONY: help fe fe-iphone be migrate ios-device eas-login eas-register-device eas-build-ios eas-build-ios-development eas-build-ios-production

help:
	@echo "List of commands you can call"
	@echo "fe - Calls the frontend expo mobile app"
	@echo "fe-iphone - Start Expo Go with this Mac's LAN backend for a connected iPhone"
	@echo "be - Starts the Backend FastAPI service"
	@echo "migrate - Applies outstanding Neon database migrations"
	@echo "ios-device - Build, sign, and install the iOS app using this Mac's LAN API"
	@echo "eas-login - Sign in to Expo Application Services (EAS)"
	@echo "eas-register-device - Register an iPhone for EAS internal iOS builds"
	@echo "eas-build-ios - Create a cloud-built, installable internal iPhone build"
	@echo "eas-build-ios-development - Create a dev client required for Plaid Link"
	@echo "eas-build-ios-production - Create an App Store/TestFlight iOS build"

fe:
	@$(MAKE) fe-iphone

# Starts Metro in LAN mode and gives Expo Go a backend URL that the iPhone can
# reach. The phone and Mac must be on the same Wi-Fi network.
fe-iphone:
	@lan_ip="$(LAN_IP)"; \
	if [ -z "$$lan_ip" ]; then lan_ip="$$(ipconfig getifaddr en0 2>/dev/null)"; fi; \
	if [ -z "$$lan_ip" ]; then lan_ip="$$(ifconfig | awk '$$1 == "inet" && $$2 ~ /^(10\\.|192\\.168\\.|172\\.(1[6-9]|2[0-9]|3[0-1])\\.)/ { print $$2; exit }')"; fi; \
	test -n "$$lan_ip" || { echo "Could not find a Wi-Fi LAN address. Run: make fe-iphone LAN_IP=<your-mac-ip>"; exit 1; }; \
	echo "Starting Expo Go with API at http://$$lan_ip:8000"; \
	cd apps/mobile && EXPO_PUBLIC_API_URL="http://$$lan_ip:8000" npx expo start --clear --lan

# Uses Xcode to make a native development build. This does not use Expo Go, so
# it works even when the installed Expo Go app does not support this SDK.
# If more than one device is connected, select one when prompted, or specify it:
#   make ios-device DEVICE="My iPhone"
# The API defaults to this Mac's Wi-Fi IP. Override detection when needed:
#   make ios-device LAN_IP=192.168.1.42
ios-device:
	@xcodebuild -version >/dev/null 2>&1 || { \
		echo "Full Xcode is required for iPhone builds. Install Xcode, then run: sudo xcode-select -s /Applications/Xcode.app/Contents/Developer"; \
		exit 1; \
	}
	@lan_ip="$(LAN_IP)"; \
	if [ -z "$$lan_ip" ]; then lan_ip="$$(ipconfig getifaddr en0 2>/dev/null)"; fi; \
	if [ -z "$$lan_ip" ]; then lan_ip="$$(ifconfig | awk '$$1 == "inet" && $$2 ~ /^(10\\.|192\\.168\\.|172\\.(1[6-9]|2[0-9]|3[0-1])\\.)/ { print $$2; exit }')"; fi; \
	test -n "$$lan_ip" || { echo "Could not find a Wi-Fi LAN address. Run: make ios-device LAN_IP=<your-mac-ip>"; exit 1; }; \
	echo "Building the iPhone app with API at http://$$lan_ip:8000"; \
	cd apps/mobile && \
	if [ -n "$(DEVICE)" ]; then \
		EXPO_PUBLIC_API_URL="http://$$lan_ip:8000" npx expo run:ios --device "$(DEVICE)"; \
	else \
		EXPO_PUBLIC_API_URL="http://$$lan_ip:8000" npx expo run:ios --device; \
	fi

# Cloud builds do not need a locally installed Xcode. The first command opens
# Expo sign-in; the second registers the connected phone's UDID for Apple's
# ad-hoc provisioning. EAS will guide you through Apple signing on first use.
eas-login:
	@cd apps/mobile && npx eas-cli@latest login

eas-register-device:
	@cd apps/mobile && npx eas-cli@latest device:create

eas-build-ios:
	@cd apps/mobile && npx eas-cli@latest build --platform ios --profile preview

eas-build-ios-development:
	@cd apps/mobile && npx eas-cli@latest build --platform ios --profile development

eas-build-ios-production:
	@cd apps/mobile && npx eas-cli@latest build --platform ios --profile production

be: 
	echo "Starting Backend Fast API service"
	cd apps/api/ && source .venv/bin/activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

migrate:
	@cd apps/api && \
	database_url="$$(sed -nE 's/^DATABASE_URL_UNPOOLED[[:space:]]*=[[:space:]]*//p' .env | tr -d '\"')"; \
	test -n "$$database_url" || { echo "DATABASE_URL_UNPOOLED is required in apps/api/.env"; exit 1; }; \
	psql "$$database_url" -v ON_ERROR_STOP=1 -c "CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())" || exit $$?; \
	for file in migrations/*.sql; do \
		version="$${file##*/}"; \
		applied="$$(psql "$$database_url" -v ON_ERROR_STOP=1 -At -c "SELECT EXISTS (SELECT 1 FROM schema_migrations WHERE version = '$$version')")" || exit $$?; \
		if [ "$$applied" = "f" ]; then \
			echo "Applying $$version"; \
			psql "$$database_url" -v ON_ERROR_STOP=1 -f "$$file" && psql "$$database_url" -v ON_ERROR_STOP=1 -c "INSERT INTO schema_migrations (version) VALUES ('$$version')"; \
		else \
			echo "Already applied $$version"; \
		fi; \
	done
