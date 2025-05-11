#!/bin/bash

# Navigate to the script's directory
cd $0

# Function to check for internet connectivity
check_internet() {
    echo "Checking for internet connection..."
    if ping -q -c 1 -W 1 google.com >/dev/null; then
        echo "Internet connection available."
        return 0 # Success
    else
        echo "No internet connection."
        return 1 # Failure
    fi
}

# Main script logic
if check_internet; then
    echo "Attempting to update from GitHub..."
    git pull
    if [ $? -eq 0 ]; then
        echo "Code updated successfully."
        echo "Installing/updating dependencies..."
        npm install
        if [ $? -ne 0 ]; then
            echo "Failed to install dependencies. Proceeding with existing ones."
        fi
    else
        echo "Failed to pull from GitHub. Using local version."
    fi
else
    echo "Proceeding without updating code or dependencies due to no internet."
fi

# Run the main application in a loop
while true; do
    echo "Starting Node.js application (main.js)..."
    node main.js
    echo "Application (main.js) exited with code $?. Restarting in 5 seconds..."
    sleep 5
done
