#!/bin/bash

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# Function to open terminal
open_terminal() {
    local command=$1
    local working_dir=$(pwd)
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # Mac için iTerm kontrolü
        if osascript -e 'tell application "System Events" to exists process "iTerm"' &> /dev/null; then
            # iTerm varsa onu kullan
            osascript -e "tell application \"iTerm\"
                create window with default profile
                tell current session of current window
                    write text \"cd \\\"$working_dir\\\"\"
                    write text \"$command\"
                end tell
            end tell"
        else
            # iTerm yoksa Terminal.app'i kullan
            open -a Terminal.app . -e "$command"
        fi
    else
        # Linux/Windows için mevcut terminal'i kullan
        eval "$command"
    fi
}

# Function to open browser
open_browser() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        open http://localhost:3000
    else
        xdg-open http://localhost:3000
    fi
}

echo -e "${BLUE}Checking dependencies...${NC}"

# Check and setup backend
if [ ! -d "backend/venv" ]; then
    echo -e "${BLUE}Setting up Python virtual environment...${NC}"
    cd backend
    python -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
    cd ..
fi

# Check and setup frontend
if [ ! -d "frontend/node_modules" ]; then
    echo -e "${BLUE}Installing frontend dependencies...${NC}"
    cd frontend
    npm install
    cd ..
fi

echo -e "${BLUE}Starting services...${NC}"

# Start Backend
open_terminal "cd backend && source venv/bin/activate && python app.py"

# Start Frontend
open_terminal "cd frontend && npm start"

# Wait and open browser
sleep 3
open_browser

echo -e "${GREEN}Services started!${NC}"
echo -e "${BLUE}Frontend:${NC} http://localhost:3000"
echo -e "${BLUE}Backend:${NC} http://localhost:5000"

echo -e "\n${GREEN}To stop services:${NC}"
echo "1. Close the terminal windows"
echo "2. Or use: kill \$(lsof -t -i:3000 -i:5000)" 
