#!/bin/bash

# =============================================================================
# Setup Local Development Environment for AI Customer Support Copilot
# =============================================================================

set -e  # Exit on error

echo "🚀 Setting up AI Customer Support Copilot local development environment..."
echo ""

# Check prerequisites
echo "📋 Checking prerequisites..."

command -v docker >/dev/null 2>&1 || { echo "❌ Docker is required but not installed. Visit https://docs.docker.com/get-docker/"; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "❌ Python 3.11+ is required but not installed."; exit 1; }
command -v node >/dev/null 2>&1 || { echo "❌ Node.js 18+ is required but not installed."; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "❌ npm is required but not installed."; exit 1; }

echo "✅ All prerequisites found"
echo ""

# Check Python version
PYTHON_VERSION=$(python3 --version | cut -d' ' -f2 | cut -d'.' -f1-2)
REQUIRED_PYTHON="3.11"
if [ "$(printf '%s\n' "$REQUIRED_PYTHON" "$PYTHON_VERSION" | sort -V | head -n1)" != "$REQUIRED_PYTHON" ]; then
    echo "⚠️  Warning: Python $REQUIRED_PYTHON+ recommended (found $PYTHON_VERSION)"
fi

# Check Node version
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "⚠️  Warning: Node.js 18+ recommended (found v$NODE_VERSION)"
fi

echo ""

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from .env.example..."
    cp .env.example .env
    echo "✅ .env file created - PLEASE UPDATE WITH YOUR ACTUAL CREDENTIALS"
    echo ""
else
    echo "✅ .env file already exists"
    echo ""
fi

# Setup Python backend
echo "🐍 Setting up Python backend..."
cd backend

if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi

echo "Activating virtual environment..."
source venv/bin/activate 2>/dev/null || source venv/Scripts/activate 2>/dev/null

echo "Installing Python dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

echo "✅ Backend setup complete"
cd ..
echo ""

# Setup Node.js frontend
echo "⚛️  Setting up Node.js frontend..."
cd frontend

if [ ! -d "node_modules" ]; then
    echo "Installing Node.js dependencies..."
    npm install
else
    echo "✅ node_modules already exists"
fi

echo "✅ Frontend setup complete"
cd ..
echo ""

# Start Docker infrastructure
echo "🐳 Starting Docker infrastructure (Kafka, Redis, Zookeeper)..."
cd infra/docker

if docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
else
    COMPOSE_CMD="docker-compose"
fi

$COMPOSE_CMD up -d

echo "Waiting for services to be healthy..."
sleep 10

# Check service health
echo "Checking Kafka health..."
docker exec kafka kafka-broker-api-versions --bootstrap-server localhost:9092 >/dev/null 2>&1 && echo "✅ Kafka is healthy" || echo "⚠️  Kafka may not be ready yet"

echo "Checking Redis health..."
docker exec redis redis-cli ping >/dev/null 2>&1 && echo "✅ Redis is healthy" || echo "⚠️  Redis may not be ready yet"

cd ../..
echo ""

# Create Kafka topics
echo "📊 Creating Kafka topics..."
docker exec kafka kafka-topics --bootstrap-server localhost:9092 --create --if-not-exists --topic chat-events --partitions 3 --replication-factor 1 || true
docker exec kafka kafka-topics --bootstrap-server localhost:9092 --create --if-not-exists --topic chat-responses --partitions 3 --replication-factor 1 || true
docker exec kafka kafka-topics --bootstrap-server localhost:9092 --create --if-not-exists --topic ticket-events --partitions 2 --replication-factor 1 || true
docker exec kafka kafka-topics --bootstrap-server localhost:9092 --create --if-not-exists --topic ingestion-events --partitions 2 --replication-factor 1 || true
docker exec kafka kafka-topics --bootstrap-server localhost:9092 --create --if-not-exists --topic notification-events --partitions 1 --replication-factor 1 || true
docker exec kafka kafka-topics --bootstrap-server localhost:9092 --create --if-not-exists --topic audit-events --partitions 1 --replication-factor 1 || true

echo "✅ Kafka topics created"
echo ""

# Summary
echo "=========================================="
echo "✅ Local development environment is ready!"
echo "=========================================="
echo ""
echo "Next steps:"
echo ""
echo "1. Update .env file with your Supabase and Groq credentials"
echo ""
echo "2. Initialize Supabase schema:"
echo "   npm install -g supabase"
echo "   supabase link --project-ref <your-project-ref>"
echo "   supabase db push"
echo ""
echo "3. Start the backend API:"
echo "   cd backend"
echo "   source venv/bin/activate  # On Windows: venv\\Scripts\\activate"
echo "   uvicorn src.api.main:app --reload --host 0.0.0.0 --port 8000"
echo ""
echo "4. Start AI inference worker (new terminal):"
echo "   cd backend"
echo "   source venv/bin/activate"
echo "   python src/workers/ai_inference_worker.py"
echo ""
echo "5. Start ingestion worker (new terminal):"
echo "   cd backend"
echo "   source venv/bin/activate"
echo "   python src/workers/ingestion_worker.py"
echo ""
echo "6. Start the frontend (new terminal):"
echo "   cd frontend"
echo "   npm run dev"
echo ""
echo "7. Visit http://localhost:3000 to see the application"
echo ""
echo "Docker services running:"
echo "  - Kafka: localhost:9092"
echo "  - Redis: localhost:6379"
echo "  - Zookeeper: localhost:2181"
echo ""
echo "To stop Docker services: cd infra/docker && docker compose down"
echo ""
