import { create } from 'zustand';
import TrackPlayer, {
    Capability,
    Event,
    IOSCategory,
    RepeatMode,
    State,
} from 'react-native-track-player';
import {
    getRadioQueue,
    getRandomAd,
    getStreamUrl,
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

const toMs = (seconds) => Math.max(0, Math.floor((Number(seconds) || 0) * 1000));

const playbackStateValue = (state) => state?.state ?? state;
const isPlaybackActive = (state) => {
    const value = playbackStateValue(state);
    return value === State.Playing || value === State.Buffering;
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

    TrackPlayer.addEventListener(Event.PlaybackState, ({ state }) => {
        set({ isPlaying: isPlaybackActive(state) });
    });

    TrackPlayer.addEventListener(Event.PlaybackProgressUpdated, ({ position, duration }) => {
        const positionMs = toMs(position);
        const durationMs = toMs(duration);

        set({
            position: positionMs,
            duration: durationMs,
        });

        const { currentTrack, adModalVisible } = get();
        if (adModalVisible) {
            set({
                adPositionMs: positionMs,
                adDurationMs: durationMs,
                isAdPlaying: true,
                isPlaying: true,
            });

            if (!adFinishTriggered && durationMs > 0 && positionMs >= durationMs - 250) {
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
            const nearEnd = durationMs > 0 && positionMs >= durationMs - 1500;
            const shouldPersist = nearEnd || now - lastPodcastSaveTs >= 5000;

            if (shouldPersist) {
                lastPodcastSaveTs = now;
                void upsertPodcastProgress(currentTrack, positionMs, durationMs);
            }
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

        const { adModalVisible } = get();
        if (adModalVisible) {
            if (!adFinishTriggered) {
                adFinishTriggered = true;
                void get().dismissAdAndPlayPending();
            }
            return;
        }
        void get().playNext();
    });
};

const ensurePlayerReady = async (set, get) => {
    if (!playerReady) {
        await TrackPlayer.setupPlayer({
            iosCategory: IOSCategory.Playback,
            autoUpdateMetadata: true,
            autoHandleInterruptions: true,
        });
        await TrackPlayer.setRepeatMode(RepeatMode.Off);
        await TrackPlayer.updateOptions({
            progressUpdateEventInterval: 1,
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
        set({ queue: [track], currentIndex: 0 });
        await get().playTrack(track);

        const nextQueue = await buildRecommendedQueue(track);
        if (nextQueue.length <= 1) return;

        set((state) => {
            const currentId = getTrackId(state.currentTrack);
            if (currentId && seedId && currentId !== seedId) {
                return {};
            }
            return { queue: nextQueue, currentIndex: 0 };
        });
    },

    setQueue: async (newQueue, index) => {
        set({ queue: newQueue, currentIndex: index });
        await get().playTrack(newQueue[index]);
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
                if (needShowAd) {
                    const ad = await getRandomAd();

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
                        await TrackPlayer.play();

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

            set({
                currentTrack: track,
                isPlaying: true,
                position: 0,
                duration: 0,
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

            await TrackPlayer.play();

            try {
                const progress = await TrackPlayer.getProgress();
                set({
                    position: toMs(progress?.position),
                    duration: toMs(progress?.duration),
                });
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
            } else {
                await TrackPlayer.play();
                set({ isAdPlaying: true, isPlaying: true });
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
        } catch (_) {
            // ignore
        }
    },

    resumePlayback: async () => {
        const { adModalVisible } = get();
        try {
            await ensurePlayerReady(set, get);
            await TrackPlayer.play();
            set({ isAdPlaying: adModalVisible, isPlaying: true });
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
        const { queue, currentIndex } = get();
        if (currentIndex < queue.length - 1) {
            const newIndex = currentIndex + 1;
            set({ currentIndex: newIndex });
            await get().playTrack(queue[newIndex]);
        } else {
            set({ isPlaying: false });
        }
    },

    playPrev: async () => {
        const { queue, currentIndex } = get();
        if (currentIndex > 0) {
            const newIndex = currentIndex - 1;
            set({ currentIndex: newIndex });
            await get().playTrack(queue[newIndex], { skipAd: true });
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
        const { queue } = get();
        set({ queue: [...queue, track] });
    },

    clearQueue: () => {
        const { currentTrack } = get();
        set({ queue: [currentTrack], currentIndex: 0 });
    },
}));
