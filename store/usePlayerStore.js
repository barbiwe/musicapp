import { create } from 'zustand';
import { Audio } from 'expo-av';
import { getRadioQueue, getRandomAd, getStreamUrl, markTrackAsPlayed, shouldShowAdBeforeStream } from '../api/api';

const getTrackId = (track) => String(track?.id || track?._id || track?.trackId || track?.track?.id || '').trim();

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
    adSoundObj: null,
    adPositionMs: 0,
    adDurationMs: 0,
    isAdPlaying: false,

    // Запуск одного треку (наприклад, з DiscoverScreen)
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

    // Встановлення цілої черги і запуск з певного індексу
    setQueue: async (newQueue, index) => {
        set({ queue: newQueue, currentIndex: index });
        await get().playTrack(newQueue[index]);
    },

    // Фізичний запуск музики через expo-av
    playTrack: async (track, options = {}) => {
        const { skipAd = false } = options;
        const { soundObj, adSoundObj } = get();
        if (soundObj) {
            try {
                await soundObj.unloadAsync();
            } catch (_) {
                // ignore
            }
        }
        if (adSoundObj) {
            try {
                await adSoundObj.unloadAsync();
            } catch (_) {
                // ignore
            }
        }

        try {
            const trackId = track.id || track._id;
            const isOfflineTrack = Boolean(track.localUri);
            const uri = track.localUri || getStreamUrl(trackId);

            if (!skipAd && !isOfflineTrack) {
                const needShowAd = await shouldShowAdBeforeStream();
                if (needShowAd) {
                    const ad = await getRandomAd();

                    if (!ad?.audioUrl) {
                        // Якщо ad тимчасово без audio, не блокуємо трек.
                        set({
                            adModalVisible: false,
                            pendingAdTrack: null,
                            adData: null,
                            adSoundObj: null,
                            adPositionMs: 0,
                            adDurationMs: 0,
                            isAdPlaying: false,
                        });
                    } else {
                        let adFinished = false;
                        const { sound: adSound } = await Audio.Sound.createAsync(
                            { uri: ad.audioUrl },
                            { shouldPlay: true },
                            (status) => {
                                if (!status?.isLoaded) return;

                                set({
                                    adPositionMs: status.positionMillis || 0,
                                    adDurationMs: status.durationMillis || 0,
                                    isAdPlaying: status.isPlaying,
                                });

                                if (status.didJustFinish && !adFinished) {
                                    adFinished = true;
                                    void get().dismissAdAndPlayPending();
                                }
                            }
                        );

                        set({
                            currentTrack: track,
                            isPlaying: false,
                            position: 0,
                            duration: 0,
                            adModalVisible: true,
                            pendingAdTrack: track,
                            soundObj: null,
                            adData: ad,
                            adSoundObj: adSound,
                            adPositionMs: 0,
                            adDurationMs: 0,
                            isAdPlaying: true,
                        });
                        return;
                    }
                }
            }

            set({
                currentTrack: track,
                isPlaying: true,
                position: 0,
                duration: 0,
                adModalVisible: false,
                pendingAdTrack: null,
                adData: null,
                adSoundObj: null,
                adPositionMs: 0,
                adDurationMs: 0,
                isAdPlaying: false,
            });
            let trackRecorded = false;

            const { sound } = await Audio.Sound.createAsync(
                { uri },
                { shouldPlay: true },
                (status) => {
                    if (status.isLoaded) {
                        set({
                            position: status.positionMillis || 0,
                            duration: status.durationMillis || 0,
                            isPlaying: status.isPlaying,
                        });

                        // Відправляємо статистику про прослуховування на сервер
                        if (status.isPlaying && status.positionMillis > 10000 && !trackRecorded) {
                            markTrackAsPlayed(trackId, status.positionMillis / 1000);
                            trackRecorded = true;
                        }

                        // Автоматично вмикаємо наступний трек, коли закінчився поточний
                        if (status.didJustFinish) {
                            get().playNext();
                        }
                    }
                }
            );
            set({ soundObj: sound });
        } catch (error) {
            console.log("Audio play error", error);

            // Якщо ad-flow дав збій, пробуємо той самий трек без реклами,
            // щоб користувач не отримував "тишу" після unload поточного.
            if (!skipAd) {
                try {
                    await get().playTrack(track, { skipAd: true });
                    return;
                } catch (_) {
                    // ignore and fall through
                }
            }

            set({
                isPlaying: false,
                soundObj: null,
            });
        }
    },

    dismissAdAndPlayPending: async () => {
        const { pendingAdTrack, adSoundObj } = get();

        if (adSoundObj) {
            try {
                await adSoundObj.unloadAsync();
            } catch (_) {
                // ignore
            }
        }

        set({
            adModalVisible: false,
            pendingAdTrack: null,
            adData: null,
            adSoundObj: null,
            adPositionMs: 0,
            adDurationMs: 0,
            isAdPlaying: false,
        });

        if (pendingAdTrack) {
            await get().playTrack(pendingAdTrack, { skipAd: true });
        }
    },

    closeAdModal: async () => {
        const { adSoundObj } = get();
        if (adSoundObj) {
            try {
                await adSoundObj.unloadAsync();
            } catch (_) {
                // ignore
            }
        }

        set({
            adModalVisible: false,
            pendingAdTrack: null,
            adData: null,
            adSoundObj: null,
            adPositionMs: 0,
            adDurationMs: 0,
            isAdPlaying: false,
        });
    },

    toggleAdPlayPause: async () => {
        const { adSoundObj, isAdPlaying } = get();
        if (!adSoundObj) return;

        try {
            if (isAdPlaying) {
                await adSoundObj.pauseAsync();
                set({ isAdPlaying: false });
            } else {
                await adSoundObj.playAsync();
                set({ isAdPlaying: true });
            }
        } catch (_) {
            // ignore
        }
    },

    togglePlay: async () => {
        const { soundObj, isPlaying } = get();
        if (!soundObj) return;
        if (isPlaying) {
            await soundObj.pauseAsync();
        } else {
            await soundObj.playAsync();
        }
    },

    playNext: async () => {
        const { queue, currentIndex } = get();
        if (currentIndex < queue.length - 1) {
            const newIndex = currentIndex + 1;
            set({ currentIndex: newIndex });
            await get().playTrack(queue[newIndex]);
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
        const { soundObj } = get();
        if (soundObj) {
            await soundObj.setPositionAsync(millis);
            set({ position: millis });
        }
    },

    addToQueue: (track) => {
        const { queue } = get();
        set({ queue: [...queue, track] });
    },

    clearQueue: () => {
        const { currentTrack } = get();
        set({ queue: [currentTrack], currentIndex: 0 });
    }
}));
