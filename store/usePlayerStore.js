import { create } from 'zustand';
import { Audio } from 'expo-av';
import { getStreamUrl, markTrackAsPlayed } from '../api/api';

export const usePlayerStore = create((set, get) => ({
    queue: [],
    currentIndex: 0,
    currentTrack: null,
    isPlaying: false,
    soundObj: null,
    position: 0,
    duration: 0,

    // Запуск одного треку (наприклад, з DiscoverScreen)
    setTrack: async (track) => {
        set({ queue: [track], currentIndex: 0 });
        await get().playTrack(track);
    },

    // Встановлення цілої черги і запуск з певного індексу
    setQueue: async (newQueue, index) => {
        set({ queue: newQueue, currentIndex: index });
        await get().playTrack(newQueue[index]);
    },

    // Фізичний запуск музики через expo-av
    playTrack: async (track) => {
        const { soundObj } = get();
        if (soundObj) {
            await soundObj.unloadAsync(); // Зупиняємо попередній трек
        }

        set({ currentTrack: track, isPlaying: true, position: 0, duration: 0 });

        try {
            const trackId = track.id || track._id;
            const uri = getStreamUrl(trackId);
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
            await get().playTrack(queue[newIndex]);
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