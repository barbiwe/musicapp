import { create } from 'zustand';
import { Image } from 'react-native';
import TrackPlayer, {
    Capability,
    Event,
    IOSCategory,
    RepeatMode,
    State,
} from 'react-native-track-player';
import {
    addTrackPlay,
    getRadioQueue,
    getRandomAd,
    getStreamUrl,
    markAdShown,
    markTrackAsPlayed,
    shouldShowAdBeforeStream,
    getTrackCoverUrl,
    resolveArtistName,
} from '../api/api';
import { upsertPodcastProgress } from './podcastProgressStorage';

const getTrackId = (track) =>
    String(track?.id || track?._id || track?.trackId || track?.track?.id || '').trim();

const normalizeRecommendedTrack = (item) => {
    const src = item?.track || item;
    const id = getTrackId(item) || getTrackId(src);
    if (!id) return null;

    return {
        ...src,
        ...item,
        id,
        _id: id,
        title: src?.title || item?.title || 'Unknown title',
        artistName: src?.artistName || item?.artistName || src?.artist?.name || item?.artist?.name || null,
        ownerId: src?.ownerId || item?.ownerId || src?.artistId || item?.artistId || null,
        coverFileId: src?.coverFileId || item?.coverFileId || null,
        fileId: src?.fileId || item?.fileId || null,
    };
};

const buildRecommendedQueue = async (seedTrack) => {
    const seedId = getTrackId(seedTrack);
    if (!seedId) return [seedTrack];

    try {
        const raw = await getRadioQueue(seedId);
        const mapped = (Array.isArray(raw) ? raw : [])
            .map(normalizeRecommendedTrack)
            .filter(Boolean);

        const unique = [];
        const seen = new Set([seedId]);
        for (const track of mapped) {
            const id = getTrackId(track);
            if (!id || seen.has(id)) continue;
            seen.add(id);
            unique.push(track);
        }

        return [seedTrack, ...unique];
    } catch (_) {
        return [seedTrack];
    }
};

let playerReady = false;
let listenersReady = false;
let historyMarkedForCurrentTrack = false;
let lastPodcastSaveTs = 0;
let suppressQueueEndedUntil = 0;
let adFinishTriggered = false;
let progressPollInterval = null;
let lastAutoAdvanceAt = 0;
const adImagePrefetchCache = new Set();
const DEBUG_LOCKSCREEN = true;
const debugLog = (...args) => {
    if (DEBUG_LOCKSCREEN) {
        console.log('[TP-STORE]', ...args);
    }
};

const prefetchAdImage = async (uri, maxWaitMs = 700) => {
    if (!uri || adImagePrefetchCache.has(uri)) return;
    adImagePrefetchCache.add(uri);

    const prefetchPromise = Image.prefetch(uri).catch(() => {
        adImagePrefetchCache.delete(uri);
    });

    if (maxWaitMs > 0) {
        await Promise.race([
            prefetchPromise,
            new Promise((resolve) => setTimeout(resolve, maxWaitMs)),
        ]);
        return;
    }

    await prefetchPromise;
};

const toMs = (seconds) => {
    const n = Number(seconds);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.floor(n * 1000);
};

const playbackStateValue = (state) => state?.state ?? state;
const isPlaybackActive = (state) => {
    const value = playbackStateValue(state);
    return value === State.Playing || value === State.Buffering;
};

const parseDurationToMs = (raw) => {
    if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
        return raw > 1000 ? Math.floor(raw) : Math.floor(raw * 1000);
    }

    if (typeof raw !== 'string') return 0;
    const value = raw.trim();
    if (!value) return 0;

    if (/^\d+(\.\d+)?$/.test(value)) {
        const n = Number(value);
        if (!Number.isFinite(n) || n <= 0) return 0;
        return n > 1000 ? Math.floor(n) : Math.floor(n * 1000);
    }

    const parts = value.split(':').map((x) => Number(String(x).trim()));
    if (parts.some((n) => !Number.isFinite(n))) return 0;

    let totalSeconds = 0;
    if (parts.length === 3) {
        totalSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
        totalSeconds = parts[0] * 60 + parts[1];
    } else {
        return 0;
    }

    return totalSeconds > 0 ? Math.floor(totalSeconds * 1000) : 0;
};

const clearProgressPolling = () => {
    if (progressPollInterval) {
        clearInterval(progressPollInterval);
        progressPollInterval = null;
    }
};

const applyProgressSnapshot = (set, get, positionSec, durationSec) => {
    const positionMs = toMs(positionSec);
    const rawDurationMs = toMs(durationSec);
    const storeDurationMs = Math.max(0, Number(get().duration) || 0);
    const trackDurationMs = parseDurationToMs(get().currentTrack?.duration);
    const effectiveDurationMs = rawDurationMs > 0 ? rawDurationMs : (storeDurationMs > 0 ? storeDurationMs : trackDurationMs);

    set({
        position: positionMs,
        duration: effectiveDurationMs,
    });

    const { currentTrack, adModalVisible } = get();
    if (adModalVisible) {
        set({
            adPositionMs: positionMs,
            adDurationMs: rawDurationMs > 0 ? rawDurationMs : Math.max(0, Number(get().adDurationMs) || 0),
            isAdPlaying: true,
            isPlaying: true,
        });

        if (!adFinishTriggered && rawDurationMs > 0 && positionMs >= rawDurationMs - 250) {
            adFinishTriggered = true;
            void get().dismissAdAndPlayPending();
        }
        return;
    }

    if (!currentTrack) return;

    const trackId = getTrackId(currentTrack);
    if (!trackId) return;

    if (!historyMarkedForCurrentTrack && !currentTrack?.skipHistory && positionMs > 10000) {
        historyMarkedForCurrentTrack = true;
        markTrackAsPlayed(trackId, positionMs / 1000);
    }

    if (currentTrack?.isPodcast) {
        const now = Date.now();
        const nearEnd = effectiveDurationMs > 0 && positionMs >= effectiveDurationMs - 1500;
        const shouldPersist = nearEnd || now - lastPodcastSaveTs >= 5000;

        if (shouldPersist) {
            lastPodcastSaveTs = now;
            void upsertPodcastProgress(currentTrack, positionMs, effectiveDurationMs);
        }
    }
};

const startProgressPolling = (set, get) => {
    if (progressPollInterval) return;

    progressPollInterval = setInterval(async () => {
        try {
            const playback = await TrackPlayer.getPlaybackState();
            if (!isPlaybackActive(playback)) return;

            const progress = await TrackPlayer.getProgress();
            applyProgressSnapshot(set, get, progress?.position, progress?.duration);
        } catch (_) {
            // ignore polling errors
        }
    }, 500);
};

const toTrackPlayerItem = (track) => {
    const id = getTrackId(track);
    if (!id) return null;

    const uri = track?.localUri || getStreamUrl(id);
    if (!uri) return null;

    return {
        id,
        url: uri,
        title: String(track?.title || track?.episodeTitle || 'Unknown title'),
        artist: resolveArtistName(track, track?.podcastAuthor || 'Unknown Artist'),
        artwork: getTrackCoverUrl(track) || undefined,
    };
};

const attachListeners = (set, get) => {
    if (listenersReady) return;
    listenersReady = true;

    const triggerAutoAdvance = async (reason) => {
        const now = Date.now();
        if (now - lastAutoAdvanceAt < 900) {
            debugLog('auto-advance:skip-duplicate', { reason });
            return;
        }
        lastAutoAdvanceAt = now;

        const { adModalVisible } = get();
        if (adModalVisible) {
            if (!adFinishTriggered) {
                adFinishTriggered = true;
                debugLog('auto-advance:ad-finish', { reason });
                void get().dismissAdAndPlayPending();
            }
            return;
        }

        debugLog('auto-advance:playNext', { reason });
        void get().playNext();
    };

    TrackPlayer.addEventListener(Event.PlaybackState, async ({ state }) => {
        const active = isPlaybackActive(state);
        debugLog('event:PlaybackState', { state, active });
        try {
            if (active) {
                await TrackPlayer.setVolume(1);
            } else if (playbackStateValue(state) === State.Paused) {
                await TrackPlayer.setVolume(0);
            }
        } catch (_) {
            // ignore
        }
        if (active) {
            startProgressPolling(set, get);
        } else {
            clearProgressPolling();
        }

        // Android can finish a track without reliable PlaybackQueueEnded event.
        // Handle ended state directly with anti-duplicate guard.
        if (playbackStateValue(state) === State.Ended) {
            await triggerAutoAdvance('playback-state-ended');
        }
    });

    TrackPlayer.addEventListener(Event.PlaybackPlayWhenReadyChanged, ({ playWhenReady }) => {
        debugLog('event:PlaybackPlayWhenReadyChanged', { playWhenReady });
        set({ isPlaying: !!playWhenReady });
        if (playWhenReady) {
            startProgressPolling(set, get);
        } else {
            clearProgressPolling();
        }
    });

    TrackPlayer.addEventListener(Event.PlaybackQueueEnded, async () => {
        if (Date.now() < suppressQueueEndedUntil) return;

        // Ignore false-positive queue-ended emissions not caused by real track finish.
        try {
            const progress = await TrackPlayer.getProgress();
            const position = Number(progress?.position || 0);
            const duration = Number(progress?.duration || 0);
            const reallyEnded = duration > 0 && position >= Math.max(0, duration - 0.35);
            if (!reallyEnded) return;
        } catch (_) {
            return;
        }

        await triggerAutoAdvance('playback-queue-ended');
    });
};

const ensurePlayerReady = async (set, get) => {
    if (!playerReady) {
        await TrackPlayer.setupPlayer({
            iosCategory: IOSCategory.Playback,
            autoUpdateMetadata: true,
            autoHandleInterruptions: false,
        });
        await TrackPlayer.setRepeatMode(RepeatMode.Off);
        await TrackPlayer.updateOptions({
            // Keep 0 to disable native "playback-progress-updated" emitter.
            // We use JS polling for progress updates to avoid iOS crash in RNTP emitter bridge.
            progressUpdateEventInterval: 0,
            capabilities: [
                Capability.Play,
                Capability.Pause,
                Capability.SkipToNext,
                Capability.SkipToPrevious,
                Capability.SeekTo,
                Capability.Stop,
            ],
            compactCapabilities: [
                Capability.Play,
                Capability.Pause,
                Capability.SkipToNext,
                Capability.SkipToPrevious,
            ],
            notificationCapabilities: [
                Capability.Play,
                Capability.Pause,
                Capability.SkipToNext,
                Capability.SkipToPrevious,
                Capability.SeekTo,
                Capability.Stop,
            ],
        });
        playerReady = true;
    }

    attachListeners(set, get);
};

export const usePlayerStore = create((set, get) => ({
    queue: [],
    currentIndex: 0,
    currentTrack: null,
    miniPlayerHiddenKey: null,
    isShuffleEnabled: false,
    repeatMode: 'off', // off | one
    queueBeforeShuffle: null,
    isPlaying: false,
    soundObj: null,
    position: 0,
    duration: 0,
    adModalVisible: false,
    pendingAdTrack: null,
    adData: null,
    adPositionMs: 0,
    adDurationMs: 0,
    isAdPlaying: false,

    initPlayer: async () => {
        try {
            await ensurePlayerReady(set, get);
        } catch (e) {
            console.log('TrackPlayer init error:', e);
        }
    },

    setTrack: async (track) => {
        const seedId = getTrackId(track);
        set({
            queue: [track],
            currentIndex: 0,
            isShuffleEnabled: false,
            repeatMode: get().repeatMode,
            queueBeforeShuffle: null,
        });
        await get().playTrack(track);

        const nextQueue = await buildRecommendedQueue(track);
        if (nextQueue.length <= 1) return;

        set((state) => {
            const currentId = getTrackId(state.currentTrack);
            if (currentId && seedId && currentId !== seedId) {
                return {};
            }
            return {
                queue: nextQueue,
                currentIndex: 0,
                isShuffleEnabled: false,
                queueBeforeShuffle: null,
            };
        });
    },

    setQueue: async (newQueue, index) => {
        const safeIndex = Math.max(0, Math.min(Number(index) || 0, Math.max(0, newQueue.length - 1)));
        set((state) => ({
            queue: newQueue,
            currentIndex: safeIndex,
            queueBeforeShuffle: state.isShuffleEnabled ? state.queueBeforeShuffle : null,
        }));
        if (!newQueue[safeIndex]) return;
        await get().playTrack(newQueue[safeIndex]);
    },

    playTrack: async (track, options = {}) => {
        const { skipAd = false } = options;
        try {
            await ensurePlayerReady(set, get);

            suppressQueueEndedUntil = Date.now() + 1200;
            try {
                await TrackPlayer.stop();
            } catch (_) {
                // ignore
            }
            try {
                await TrackPlayer.reset();
            } catch (_) {
                // ignore
            }

            const isOfflineTrack = Boolean(track?.localUri);

            if (!skipAd && !isOfflineTrack) {
                const needShowAd = await shouldShowAdBeforeStream();
                debugLog('ad:check-before-stream', { needShowAd });
                if (needShowAd) {
                    const ad = await getRandomAd();
                    debugLog('ad:random-response', {
                        hasAd: !!ad,
                        adId: ad?.id || null,
                        hasAudio: !!ad?.audioUrl,
                    });

                    if (!ad?.audioUrl) {
                        set({
                            adModalVisible: false,
                            pendingAdTrack: null,
                            adData: null,
                            adPositionMs: 0,
                            adDurationMs: 0,
                            isAdPlaying: false,
                        });
                    } else {
                        if (ad.imageUrl) {
                            await prefetchAdImage(ad.imageUrl);
                        }

                        const adTrack = {
                            id: `ad-${Date.now()}`,
                            url: String(ad.audioUrl),
                            title: 'Advertisement',
                            artist: String(ad.title || 'VOX'),
                            artwork: ad.imageUrl || undefined,
                        };

                        adFinishTriggered = false;
                        await TrackPlayer.add([adTrack]);
                        await TrackPlayer.updateNowPlayingMetadata({
                            title: adTrack.title,
                            artist: adTrack.artist,
                            artwork: adTrack.artwork,
                        });
                        try {
                            await TrackPlayer.setVolume(1);
                        } catch (_) {
                            // ignore
                        }
                        await TrackPlayer.play();
                        await markAdShown();
                        debugLog('ad:started', { adId: ad?.id || null });
                        startProgressPolling(set, get);

                        set({
                            currentTrack: track,
                            isPlaying: true,
                            position: 0,
                            duration: 0,
                            adModalVisible: true,
                            pendingAdTrack: track,
                            soundObj: null,
                            adData: ad,
                            adPositionMs: 0,
                            adDurationMs: 0,
                            isAdPlaying: true,
                        });
                        return;
                    }
                }
            }

            const playerTrack = toTrackPlayerItem(track);
            if (!playerTrack) {
                throw new Error('TrackPlayer item is invalid');
            }

            const initialDurationMs = parseDurationToMs(track?.duration);

            set({
                currentTrack: track,
                isPlaying: true,
                position: 0,
                duration: initialDurationMs,
                adModalVisible: false,
                pendingAdTrack: null,
                adData: null,
                adPositionMs: 0,
                adDurationMs: 0,
                isAdPlaying: false,
                soundObj: null,
            });

            historyMarkedForCurrentTrack = false;
            lastPodcastSaveTs = 0;

            // New backend plays metric: count one play when track playback starts.
            if (!track?.isPodcast && !track?.skipHistory) {
                const playTrackId = getTrackId(track);
                if (playTrackId) {
                    void addTrackPlay(playTrackId);
                }
            }

            await TrackPlayer.add([playerTrack]);
            await TrackPlayer.updateNowPlayingMetadata({
                title: playerTrack.title,
                artist: playerTrack.artist,
                artwork: playerTrack.artwork,
            });

            const startPositionMs = Math.max(0, Number(track?.startPositionMs) || 0);
            if (startPositionMs > 0) {
                await TrackPlayer.seekTo(startPositionMs / 1000);
                set({ position: startPositionMs });
            }

            try {
                await TrackPlayer.setVolume(1);
            } catch (_) {
                // ignore
            }
            await TrackPlayer.play();
            startProgressPolling(set, get);

            try {
                const progress = await TrackPlayer.getProgress();
                applyProgressSnapshot(set, get, progress?.position, progress?.duration);
            } catch (_) {
                // ignore
            }
        } catch (error) {
            console.log('Audio play error', error);

            if (!skipAd) {
                try {
                    await get().playTrack(track, { skipAd: true });
                    return;
                } catch (_) {
                    // ignore
                }
            }

            set({
                isPlaying: false,
                soundObj: null,
            });
            clearProgressPolling();
        }
    },

    dismissAdAndPlayPending: async () => {
        const { pendingAdTrack } = get();
        adFinishTriggered = false;

        set({
            adModalVisible: false,
            pendingAdTrack: null,
            adData: null,
            adPositionMs: 0,
            adDurationMs: 0,
            isAdPlaying: false,
        });

        if (pendingAdTrack) {
            await get().playTrack(pendingAdTrack, { skipAd: true });
        }
    },

    closeAdModal: async () => {
        try {
            await TrackPlayer.pause();
            await TrackPlayer.stop();
            await TrackPlayer.reset();
        } catch (_) {
            // ignore
        }
        clearProgressPolling();
        adFinishTriggered = false;

        set({
            adModalVisible: false,
            pendingAdTrack: null,
            adData: null,
            adPositionMs: 0,
            adDurationMs: 0,
            isAdPlaying: false,
        });
    },

    toggleAdPlayPause: async () => {
        const { isAdPlaying } = get();

        try {
            if (isAdPlaying) {
                await TrackPlayer.pause();
                set({ isAdPlaying: false, isPlaying: false });
                clearProgressPolling();
            } else {
                try {
                    await TrackPlayer.setVolume(1);
                } catch (_) {
                    // ignore
                }
                await TrackPlayer.play();
                set({ isAdPlaying: true, isPlaying: true });
                startProgressPolling(set, get);
            }
        } catch (_) {
            // ignore
        }
    },

    pausePlayback: async () => {
        try {
            await ensurePlayerReady(set, get);
            await TrackPlayer.pause();
            set({ isAdPlaying: false, isPlaying: false });
            clearProgressPolling();
        } catch (_) {
            // ignore
        }
    },

    resumePlayback: async () => {
        const { adModalVisible } = get();
        try {
            await ensurePlayerReady(set, get);
            try {
                await TrackPlayer.setVolume(1);
            } catch (_) {
                // ignore
            }
            await TrackPlayer.play();
            set({ isAdPlaying: adModalVisible, isPlaying: true });
            startProgressPolling(set, get);
        } catch (_) {
            // ignore
        }
    },

    togglePlay: async () => {
        try {
            const { adModalVisible, isAdPlaying } = get();
            if (adModalVisible) {
                if (isAdPlaying) {
                    await get().pausePlayback();
                } else {
                    await get().resumePlayback();
                }
                return;
            }

            await ensurePlayerReady(set, get);
            const state = await TrackPlayer.getPlaybackState();
            if (isPlaybackActive(state)) {
                await get().pausePlayback();
            } else {
                await get().resumePlayback();
            }
        } catch (_) {
            // ignore
        }
    },

    playNext: async () => {
        const { queue, currentIndex, repeatMode } = get();
        if (!Array.isArray(queue) || queue.length === 0) {
            set({ isPlaying: false });
            return;
        }

        if (repeatMode === 'one') {
            const current = queue[currentIndex] || queue[0];
            if (current) {
                await get().playTrack(current, { skipAd: true });
            } else {
                set({ isPlaying: false });
            }
            return;
        }

        if (currentIndex < queue.length - 1) {
            const newIndex = currentIndex + 1;
            set({ currentIndex: newIndex });
            await get().playTrack(queue[newIndex]);
            return;
        }

        set({ isPlaying: false });
    },

    playPrev: async () => {
        const { queue, currentIndex, repeatMode } = get();
        if (!Array.isArray(queue) || queue.length === 0) return;

        if (currentIndex > 0) {
            const newIndex = currentIndex - 1;
            set({ currentIndex: newIndex });
            await get().playTrack(queue[newIndex], { skipAd: true });
            return;
        }

        if (repeatMode === 'one') {
            const current = queue[currentIndex] || queue[0];
            if (current) {
                await get().playTrack(current, { skipAd: true });
            }
        }
    },

    seekTo: async (millis) => {
        try {
            await ensurePlayerReady(set, get);
            await TrackPlayer.seekTo((millis || 0) / 1000);
            set({ position: millis || 0 });
        } catch (_) {
            // ignore
        }
    },

    addToQueue: (track) => {
        const { queue, isShuffleEnabled, queueBeforeShuffle } = get();
        set({
            queue: [...queue, track],
            queueBeforeShuffle: isShuffleEnabled && Array.isArray(queueBeforeShuffle)
                ? [...queueBeforeShuffle, track]
                : queueBeforeShuffle,
        });
    },

    clearQueue: () => {
        const { currentTrack } = get();
        set({
            queue: [currentTrack],
            currentIndex: 0,
            isShuffleEnabled: false,
            queueBeforeShuffle: null,
        });
    },

    toggleShuffle: () => {
        const { queue, currentIndex, currentTrack, isShuffleEnabled, queueBeforeShuffle } = get();
        const safeQueue = Array.isArray(queue) ? queue.filter(Boolean) : [];

        if (safeQueue.length <= 1) {
            set({ isShuffleEnabled: !isShuffleEnabled });
            return;
        }

        const current = safeQueue[currentIndex] || currentTrack || safeQueue[0];
        const currentId = getTrackId(current);

        if (!isShuffleEnabled) {
            const base = [...safeQueue];
            const others = base.filter((item, idx) => {
                if (idx === currentIndex) return false;
                if (!currentId) return true;
                return getTrackId(item) !== currentId;
            });

            for (let i = others.length - 1; i > 0; i -= 1) {
                const j = Math.floor(Math.random() * (i + 1));
                [others[i], others[j]] = [others[j], others[i]];
            }

            const shuffled = current ? [current, ...others] : others;
            set({
                queue: shuffled,
                currentIndex: 0,
                isShuffleEnabled: true,
                queueBeforeShuffle: base,
            });
            return;
        }

        let restore = Array.isArray(queueBeforeShuffle) && queueBeforeShuffle.length > 0
            ? queueBeforeShuffle.filter(Boolean)
            : safeQueue;

        // Safety net: never allow empty queue after disabling shuffle.
        if (!Array.isArray(restore) || restore.length === 0) {
            restore = currentTrack ? [currentTrack] : safeQueue;
        }

        // Safety net: keep currently playing track in restored queue.
        if (currentId && !restore.some((item) => getTrackId(item) === currentId) && currentTrack) {
            restore = [currentTrack, ...restore];
        }

        const restoreIndex = restore.findIndex((item) => getTrackId(item) === currentId);
        const safeRestoreIndex = restore.length > 0
            ? Math.max(0, Math.min(restoreIndex >= 0 ? restoreIndex : 0, restore.length - 1))
            : 0;

        set({
            queue: restore,
            currentIndex: safeRestoreIndex,
            isShuffleEnabled: false,
            queueBeforeShuffle: null,
        });
    },

    toggleRepeatMode: () => {
        const { repeatMode } = get();
        const next = repeatMode === 'off' ? 'one' : 'off';
        set({ repeatMode: next });
    },

    setMiniPlayerHiddenKey: (key) => {
        set({ miniPlayerHiddenKey: key || null });
    },

    stopPlayback: async () => {
        try {
            await ensurePlayerReady(set, get);
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
        try {
            await TrackPlayer.reset();
        } catch (_) {
            // ignore
        }

        clearProgressPolling();
        adFinishTriggered = false;
        historyMarkedForCurrentTrack = false;
        lastPodcastSaveTs = 0;

        set({
            queue: [],
            currentIndex: 0,
            currentTrack: null,
            isShuffleEnabled: false,
            queueBeforeShuffle: null,
            isPlaying: false,
            position: 0,
            duration: 0,
            adModalVisible: false,
            pendingAdTrack: null,
            adData: null,
            adPositionMs: 0,
            adDurationMs: 0,
            isAdPlaying: false,
            miniPlayerHiddenKey: null,
        });
    },
}));
