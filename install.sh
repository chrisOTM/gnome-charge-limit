#!/bin/bash
# Install the root helper + polkit action (needs sudo) and the GNOME extension (user).
set -eu
cd "$(dirname "$0")"

sudo install -Dm755 system/charge-limit-helper /usr/local/libexec/charge-limit-helper
sudo install -Dm644 system/io.github.chrisotm.charge-limit.policy \
    /usr/share/polkit-1/actions/io.github.chrisotm.charge-limit.policy

uuid=charge-limit@chrisotm.github.io
dest=~/.local/share/gnome-shell/extensions/$uuid
mkdir -p "$dest"
cp extension/metadata.json extension/extension.js "$dest/"
gnome-extensions enable "$uuid" 2>/dev/null || true

echo "Installed. Log out and back in (Wayland), then enable with: gnome-extensions enable $uuid"
