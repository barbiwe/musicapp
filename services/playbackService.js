const TrackPlayer = require('react-native-track-player');
const { Event, State } = TrackPlayer;
const { usePlayerStore } = require('../store/usePlayerStore');

const isPlaybackActive = (state) => state === State.Playing || state === State.Buffering;
let mutedByRemotePauseFallback = false;
let hardStoppedByRemotePause = false;
let resumePositionSec = 0;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

module.exports = async function () {
    TrackPlayer.addEventListener(Event.RemotePlay, async () => {
        try {
            if (mutedByRemotePauseFallback) {
                try {
                    await TrackPlayer.setVolume(1);
                } catch (_) {
                    // ignore
                }
                mutedByRemotePauseFallback = false;
            }
            if (hardStoppedByRemotePause) {
                try {
                    if (resumePositionSec > 0) {
                        await TrackPlayer.seekTo(resumePositionSec);
                    }
                } catch (_) {
                    // ignore
                }
                hardStoppedByRemotePause = false;
            }
            await TrackPlayer.play();
            usePlayerStore.setState({ isPlaying: true });
        } catch (_) {
            // ignore
        }
    });

    TrackPlayer.addEventListener(Event.RemotePause, async () => {
        try {
            try {
                const progress = await TrackPlayer.getProgress();
                resumePositionSec = Number(progress?.position || 0);
            } catch (_) {
                resumePositionSec = 0;
            }

            await TrackPlayer.pause();
            // Double-check state in background context; some iOS builds may ignore first pause.
            await sleep(120);
            const stateRaw = await TrackPlayer.getPlaybackState();
            const state = stateRaw?.state ?? stateRaw;
            if (isPlaybackActive(state)) {
                await TrackPlayer.pause();
                await sleep(80);
                // iOS beta fallback: if transport stays active after pause, hard-mute output.
                const stateAfterSecondPauseRaw = await TrackPlayer.getPlaybackState();
                const stateAfterSecondPause = stateAfterSecondPauseRaw?.state ?? stateAfterSecondPauseRaw;
                if (isPlaybackActive(stateAfterSecondPause)) {
                    try {
                        await TrackPlayer.setVolume(0);
                        mutedByRemotePauseFallback = true;
                    } catch (_) {
                        // ignore
                    }

                    // Final fallback: force stop transport if pause is still ignored.
                    try {
                        await TrackPlayer.stop();
                        hardStoppedByRemotePause = true;
                    } catch (_) {
                        // ignore
                    }
                }
            }
            usePlayerStore.setState({ isPlaying: false, isAdPlaying: false });
        } catch (_) {
            // ignore
        }
    });

    TrackPlayer.addEventListener(Event.RemoteNext, async () => {
        await usePlayerStore.getState().playNext();
    });

    TrackPlayer.addEventListener(Event.RemotePrevious, async () => {
        await usePlayerStore.getState().playPrev();
    });

    TrackPlayer.addEventListener(Event.RemoteSeek, async ({ position }) => {
        await usePlayerStore.getState().seekTo(Math.max(0, Number(position || 0) * 1000));
    });

    TrackPlayer.addEventListener(Event.RemoteStop, async () => {
        try {
            if (mutedByRemotePauseFallback) {
                try {
                    await TrackPlayer.setVolume(1);
                } catch (_) {
                    // ignore
                }
                mutedByRemotePauseFallback = false;
            }
            hardStoppedByRemotePause = false;
            resumePositionSec = 0;
            const stateRaw = await TrackPlayer.getPlaybackState();
            const state = stateRaw?.state ?? stateRaw;
            if (isPlaybackActive(state)) {
                await TrackPlayer.stop();
            }
            usePlayerStore.setState({
                isPlaying: false,
                position: 0,
                adModalVisible: false,
                pendingAdTrack: null,
                adData: null,
                adPositionMs: 0,
                adDurationMs: 0,
                isAdPlaying: false,
            });
        } catch (_) {
            // ignore
        }
    });
};
