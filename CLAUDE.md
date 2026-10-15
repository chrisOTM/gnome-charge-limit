# gnome-charge-limit

GNOME Shell extension + pkexec root helper to set battery charge thresholds, a workaround for
GNOME Settings hiding its charge-limit option on the ThinkPad X9 (see README "Why").

- `extension/extension.js`: ESM extension (GNOME 48–50), `QuickMenuToggle` added via
  `addExternalIndicator`. Reads thresholds from sysfs directly; writes only through
  `pkexec /usr/local/libexec/charge-limit-helper START END`.
- `system/`: helper script and polkit action; the helper path is pinned in the policy's
  `exec.path` annotation, keep both in sync.
- Verify API usage against the installed shell: `gresource extract /usr/lib/gnome-shell/libshell-*.so /org/gnome/shell/ui/quickSettings.js`.
- Test changes: `./install.sh`, then log out/in; logs via `journalctl -f /usr/bin/gnome-shell`.
