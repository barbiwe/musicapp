const TrackPlayer = require('react-native-track-player');
const { Event } = TrackPlayer;
const DEBUG_LOCKSCREEN = true;
const debugLog = (...args) => {
    if (DEBUG_LOCKSCREEN) {
        console.log('[TP-BG]', ...args);
    }
};

let listenersAttached = false;
const subscriptions = [];

const resolveStoreState = () => {
    try {
        const mod = require('../store/usePlayerStore');
        return mod?.usePlayerStore?.getState?.() || null;
    } catch (_) {
        return null;
    }
};

module.exports = async function () {
    if (listenersAttached) return;
    listenersAttached = true;

    subscriptions.push(TrackPlayer.addEventListener(Event.RemoteNext, async () => {
        debugLog('event:RemoteNext');
        try {
            await TrackPlayer.skipToNext();
            await TrackPlayer.play();
        } catch (_) {
            try {
                const store = resolveStoreState();
                if (store?.playNext) {
                    await store.playNext();
                }
            } catch (_) {
                // ignore
            }
        }
    }));

    subscriptions.push(TrackPlayer.addEventListener(Event.RemotePrevious, async () => {
        debugLog('event:RemotePrevious');
        try {
            await TrackPlayer.skipToPrevious();
            await TrackPlayer.play();
        } catch (_) {
            try {
                const store = resolveStoreState();
                if (store?.playPrev) {
                    await store.playPrev();
                }
            } catch (_) {
                // ignore
            }
        }
    }));

    subscriptions.push(TrackPlayer.addEventListener(Event.RemoteSeek, async ({ position }) => {
        debugLog('event:RemoteSeek', { position });
        try {
            const ms = Math.max(0, Number(position || 0) * 1000);
            await TrackPlayer.seekTo(ms / 1000);
        } catch (_) {
            // ignore
        }
    }));

    subscriptions.push(TrackPlayer.addEventListener(Event.RemoteStop, async () => {
        debugLog('event:RemoteStop');
        try {
            await TrackPlayer.setPlayWhenReady(false);
        } catch (_) {
            // ignore
        }

        try {
            await TrackPlayer.pause();
        } catch (_) {
            // ignore
        }

        try {
            await TrackPlayer.stop();
        } catch (_) {
            // ignore
        }

    }));
};
