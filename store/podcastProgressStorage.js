import AsyncStorage from '@react-native-async-storage/async-storage';

const PODCAST_PROGRESS_KEY = 'podcast_episode_progress_v1';
const PODCAST_HISTORY_KEY = 'podcast_episode_history_v1';
const MAX_HISTORY_ITEMS = 100;
const COMPLETED_THRESHOLD_MS = 3000;

const safeParse = (raw, fallback) => {
    if (!raw || typeof raw !== 'string') return fallback;
    try {
        const parsed = JSON.parse(raw);
        return parsed ?? fallback;
    } catch (_) {
        return fallback;
    }
};

const toIntMs = (value) => {
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0) return 0;
    return Math.floor(num);
};

export const buildPodcastEpisodeKey = (track) => {
    const podcastId = String(track?.podcastId || '').trim();
    const episodeId = String(track?.episodeId || track?.id || track?._id || '').trim();

    if (!podcastId || !episodeId) return null;
    return `${podcastId}::${episodeId}`;
};

export const readPodcastProgressMap = async () => {
    try {
        const raw = await AsyncStorage.getItem(PODCAST_PROGRESS_KEY);
        const parsed = safeParse(raw, {});
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
        return parsed;
    } catch (_) {
        return {};
    }
};

export const readPodcastProgressForPodcast = async (podcastId) => {
    const pid = String(podcastId || '').trim();
    if (!pid) return {};

    const map = await readPodcastProgressMap();
    const result = {};

    Object.values(map).forEach((entry) => {
        const entryPodcastId = String(entry?.podcastId || '').trim();
        const entryEpisodeId = String(entry?.episodeId || '').trim();
        if (!entryPodcastId || !entryEpisodeId) return;
        if (entryPodcastId !== pid) return;
        result[entryEpisodeId] = entry;
    });

    return result;
};

export const upsertPodcastProgress = async (track, positionMs, durationMs) => {
    const key = buildPodcastEpisodeKey(track);
    if (!key) return;

    const podcastId = String(track?.podcastId || '').trim();
    const episodeId = String(track?.episodeId || track?.id || track?._id || '').trim();
    if (!podcastId || !episodeId) return;

    const safePosition = toIntMs(positionMs);
    const safeDuration = toIntMs(durationMs);
    const updatedAt = new Date().toISOString();
    const isCompleted =
        safeDuration > 0 && safeDuration - safePosition <= COMPLETED_THRESHOLD_MS;

    const entry = {
        key,
        podcastId,
        episodeId,
        podcastTitle: String(track?.podcastTitle || '').trim(),
        episodeTitle: String(track?.title || '').trim(),
        artistName: String(track?.artistName || '').trim(),
        coverUrl: String(track?.coverUrl || '').trim(),
        positionMs: safePosition,
        durationMs: safeDuration,
        updatedAt,
        completed: isCompleted,
    };

    try {
        const [rawProgress, rawHistory] = await AsyncStorage.multiGet([
            PODCAST_PROGRESS_KEY,
            PODCAST_HISTORY_KEY,
        ]);

        const progressMap = safeParse(rawProgress?.[1], {});
        const history = safeParse(rawHistory?.[1], []);

        if (isCompleted) {
            delete progressMap[key];
        } else {
            progressMap[key] = entry;
        }

        const nextHistory = Array.isArray(history)
            ? history.filter((item) => String(item?.key || '') !== key)
            : [];
        nextHistory.unshift(entry);

        await AsyncStorage.multiSet([
            [PODCAST_PROGRESS_KEY, JSON.stringify(progressMap)],
            [PODCAST_HISTORY_KEY, JSON.stringify(nextHistory.slice(0, MAX_HISTORY_ITEMS))],
        ]);
    } catch (_) {
        // ignore persistence errors
    }
};

