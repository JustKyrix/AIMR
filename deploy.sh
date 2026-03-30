#!/bin/bash

while true
do
    cd /root/aimr

    # Fetch latest info from GitHub
    git fetch origin main

    # Check if origin/main has new commits compared to current HEAD
    if ! git diff --quiet HEAD origin/main; then
        echo "$(date): New changes found, pulling and restarting..." >> /root/aimr/deploy.log
        git pull origin main
        pm2 restart aimr
    else
        echo "$(date): No changes, nothing to do." >> /root/aimr/deploy.log
    fi

    # Wait 5 seconds before checking again
    sleep 5
done

