import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import {QuickMenuToggle, SystemIndicator} from 'resource:///org/gnome/shell/ui/quickSettings.js';

const HELPER = '/usr/local/libexec/charge-limit-helper';
const LIMITS = [60, 70, 75, 80, 85, 90, 95];
const DEFAULT_LIMIT = 80;
// Charging resumes once the level drops this far below the stop threshold.
const START_GAP = 10;

function findBattery() {
    const dir = Gio.File.new_for_path('/sys/class/power_supply');
    const iter = dir.enumerate_children('standard::name', Gio.FileQueryInfoFlags.NONE, null);
    let info;
    while ((info = iter.next_file(null))) {
        const name = info.get_name();
        const path = `/sys/class/power_supply/${name}`;
        if (name.startsWith('BAT') &&
            GLib.file_test(`${path}/charge_control_end_threshold`, GLib.FileTest.EXISTS))
            return path;
    }
    return null;
}

function readInt(path) {
    try {
        const [, bytes] = GLib.file_get_contents(path);
        return parseInt(new TextDecoder().decode(bytes).trim(), 10);
    } catch {
        return NaN;
    }
}

const ChargeLimitToggle = GObject.registerClass(
class ChargeLimitToggle extends QuickMenuToggle {
    _init(battery) {
        super._init({
            title: 'Charge Limit',
            iconName: 'battery-level-80-symbolic',
            toggleMode: false,
        });
        this._battery = battery;
        this._lastLimit = DEFAULT_LIMIT;

        this.menu.setHeader('battery-level-80-symbolic', 'Charge Limit');
        this._items = new Map();
        for (const limit of [...LIMITS, 100]) {
            const label = limit === 100 ? 'Off (charge to 100 %)' : `Stop at ${limit} %`;
            const item = new PopupMenu.PopupMenuItem(label);
            item.connect('activate', () => this._apply(limit));
            this.menu.addMenuItem(item);
            this._items.set(limit, item);
        }

        this.connect('clicked', () =>
            this._apply(this.checked ? 100 : this._lastLimit));
        this.menu.connect('open-state-changed', (_menu, open) => {
            if (open)
                this._refresh();
        });

        this._refresh();
    }

    _refresh() {
        const start = readInt(`${this._battery}/charge_control_start_threshold`);
        const end = readInt(`${this._battery}/charge_control_end_threshold`);
        const limited = end < 100;
        if (limited)
            this._lastLimit = end;

        this.checked = limited;
        this.iconName = limited ? 'battery-level-80-symbolic' : 'battery-level-100-symbolic';
        this.subtitle = limited ? `${start}–${end} %` : 'Off';
        for (const [limit, item] of this._items) {
            item.setOrnament(limit === end
                ? PopupMenu.Ornament.CHECK : PopupMenu.Ornament.NONE);
        }
    }

    _apply(end) {
        // "Off" uses start 99, not 0: ThinkPad firmware silently ignores start=0 and
        // keeps the old start threshold, which would block charging above it.
        const start = end === 100 ? 99 : Math.max(0, end - START_GAP);
        try {
            const proc = Gio.Subprocess.new(['pkexec', HELPER, `${start}`, `${end}`],
                Gio.SubprocessFlags.STDERR_PIPE);
            proc.communicate_utf8_async(null, null, (p, res) => {
                try {
                    const [, , stderr] = p.communicate_utf8_finish(res);
                    if (!p.get_successful())
                        Main.notifyError('Charge Limit', stderr?.trim() || 'Helper failed');
                } catch (e) {
                    Main.notifyError('Charge Limit', e.message);
                }
                this._refresh();
            });
        } catch (e) {
            Main.notifyError('Charge Limit', e.message);
        }
    }
});

const ChargeLimitIndicator = GObject.registerClass(
class ChargeLimitIndicator extends SystemIndicator {
    _init(battery) {
        super._init();
        this.quickSettingsItems.push(new ChargeLimitToggle(battery));
    }
});

export default class ChargeLimitExtension extends Extension {
    enable() {
        const battery = findBattery();
        if (!battery)
            return;
        this._indicator = new ChargeLimitIndicator(battery);
        Main.panel.statusArea.quickSettings.addExternalIndicator(this._indicator);
    }

    disable() {
        this._indicator?.quickSettingsItems.forEach(item => item.destroy());
        this._indicator?.destroy();
        this._indicator = null;
    }
}
