import React, { useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    Image,
    FlatList,
    SafeAreaView,
    StatusBar,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

// ─── Типи ───────────────────────────────────────────────
interface Track {
    id: string;
    title: string;
    artist: string;
    album: string;
    duration: string;
    cover: string;
}

interface Playlist {
    id: string;
    title: string;
    count: number;
    cover: string;
}

// ─── Моккові дані ────────────────────────────────────────
const FEATURED_TRACKS: Track[] = [
    {
        id: '1',
        title: 'Blinding Lights',
        artist: 'The Weeknd',
        album: 'After Hours',
        duration: '3:20',
        cover: 'https://picsum.photos/seed/track1/200/200',
    },
    {
        id: '2',
        title: 'Stay',
        artist: 'Kid LAROI & Justin Bieber',
        album: 'F*CK LOVE 3',
        duration: '2:21',
        cover: 'https://picsum.photos/seed/track2/200/200',
    },
    {
        id: '3',
        title: 'Levitating',
        artist: 'Dua Lipa',
        album: 'Future Nostalgia',
        duration: '3:23',
        cover: 'https://picsum.photos/seed/track3/200/200',
    },
    {
        id: '4',
        title: 'Peaches',
        artist: 'Justin Bieber',
        album: 'Justice',
        duration: '3:18',
        cover: 'https://picsum.photos/seed/track4/200/200',
    },
];

const PLAYLISTS: Playlist[] = [
    {
        id: '1',
        title: 'Ранковий настрій ☀️',
        count: 24,
        cover: 'https://picsum.photos/seed/pl1/200/200',
    },
    {
        id: '2',
        title: 'Chill Vibes 🌊',
        count: 18,
        cover: 'https://picsum.photos/seed/pl2/200/200',
    },
    {
        id: '3',
        title: 'Workout Hard 💪',
        count: 32,
        cover: 'https://picsum.photos/seed/pl3/200/200',
    },
    {
        id: '4',
        title: 'Late Night 🌙',
        count: 15,
        cover: 'https://picsum.photos/seed/pl4/200/200',
    },
];

const CATEGORIES = ['Всі', 'Pop', 'Hip-Hop', 'Rock', 'Electronic', 'Jazz'];

// ─── Компоненти ──────────────────────────────────────────

const CategoryChip: React.FC<{
    label: string;
    isActive: boolean;
    onPress: () => void;
}> = ({ label, isActive, onPress }) => (
    <TouchableOpacity
        style={[styles.chip, isActive && styles.chipActive]}
        onPress={onPress}
        activeOpacity={0.8}
    >
        <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
            {label}
        </Text>
    </TouchableOpacity>
);

const PlaylistCard: React.FC<{ item: Playlist }> = ({ item }) => (
    <TouchableOpacity style={styles.playlistCard} activeOpacity={0.85}>
        <Image source={{ uri: item.cover }} style={styles.playlistCover} />
        <View style={styles.playlistOverlay} />
        <View style={styles.playlistInfo}>
            <Text style={styles.playlistTitle} numberOfLines={1}>
                {item.title}
            </Text>
            <Text style={styles.playlistCount}>{item.count} треків</Text>
        </View>
        <TouchableOpacity style={styles.playlistPlayBtn}>
            <Ionicons name="play" size={18} color="#fff" />
        </TouchableOpacity>
    </TouchableOpacity>
);

const TrackItem: React.FC<{
    item: Track;
    index: number;
    isPlaying: boolean;
    onPress: () => void;
}> = ({ item, index, isPlaying, onPress }) => (
    <TouchableOpacity
        style={[styles.trackItem, isPlaying && styles.trackItemActive]}
        onPress={onPress}
        activeOpacity={0.75}
    >
        <View style={styles.trackIndex}>
            {isPlaying ? (
                <MaterialIcons name="equalizer" size={18} color="#A78BFA" />
            ) : (
                <Text style={styles.trackIndexText}>{index + 1}</Text>
            )}
        </View>
        <Image source={{ uri: item.cover }} style={styles.trackCover} />
        <View style={styles.trackMeta}>
            <Text
                style={[styles.trackTitle, isPlaying && styles.trackTitleActive]}
                numberOfLines={1}
            >
                {item.title}
            </Text>
            <Text style={styles.trackArtist} numberOfLines={1}>
                {item.artist}
            </Text>
        </View>
        <Text style={styles.trackDuration}>{item.duration}</Text>
        <TouchableOpacity style={styles.trackMore}>
            <Ionicons name="ellipsis-vertical" size={18} color="#6B7280" />
        </TouchableOpacity>
    </TouchableOpacity>
);

// ─── NowPlayingBar ────────────────────────────────────────
const NowPlayingBar: React.FC<{
    track: Track;
    isPlaying: boolean;
    onToggle: () => void;
}> = ({ track, isPlaying, onToggle }) => (
    <View style={styles.nowPlaying}>
        <View style={styles.nowPlayingProgress} />
        <View style={styles.nowPlayingInner}>
            <Image source={{ uri: track.cover }} style={styles.nowPlayingCover} />
            <View style={styles.nowPlayingMeta}>
                <Text style={styles.nowPlayingTitle} numberOfLines={1}>
                    {track.title}
                </Text>
                <Text style={styles.nowPlayingArtist} numberOfLines={1}>
                    {track.artist}
                </Text>
            </View>
            <View style={styles.nowPlayingControls}>
                <TouchableOpacity>
                    <Ionicons name="play-skip-back" size={22} color="#E5E7EB" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.playPauseBtn} onPress={onToggle}>
                    <Ionicons
                        name={isPlaying ? 'pause' : 'play'}
                        size={22}
                        color="#fff"
                    />
                </TouchableOpacity>
                <TouchableOpacity>
                    <Ionicons name="play-skip-forward" size={22} color="#E5E7EB" />
                </TouchableOpacity>
            </View>
        </View>
    </View>
);

// ─── Головний екран ───────────────────────────────────────
const HomeScreen: React.FC = () => {
    const [activeCategory, setActiveCategory] = useState('Всі');
    const [currentTrack, setCurrentTrack] = useState<Track>(FEATURED_TRACKS[0]);
    const [isPlaying, setIsPlaying] = useState(false);

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#0F0F1A" />

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {/* ── Хедер ── */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.greeting}>Привіт, Олексій 👋</Text>
                        <Text style={styles.subGreeting}>Що слухаємо сьогодні?</Text>
                    </View>
                    <View style={styles.headerRight}>
                        <TouchableOpacity style={styles.iconBtn}>
                            <Ionicons name="search-outline" size={22} color="#E5E7EB" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.avatarBtn}>
                            <Image
                                source={{ uri: 'https://picsum.photos/seed/avatar/100/100' }}
                                style={styles.avatar}
                            />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* ── Банер "Зараз популярне" ── */}
                <View style={styles.heroBanner}>
                    <Image
                        source={{ uri: 'https://picsum.photos/seed/hero/800/400' }}
                        style={styles.heroBannerImage}
                    />
                    <View style={styles.heroBannerOverlay} />
                    <View style={styles.heroBannerContent}>
                        <View style={styles.heroBadge}>
                            <Ionicons name="flame" size={12} color="#FBBF24" />
                            <Text style={styles.heroBadgeText}>Топ тижня</Text>
                        </View>
                        <Text style={styles.heroBannerTitle}>Blinding Lights</Text>
                        <Text style={styles.heroBannerArtist}>The Weeknd</Text>
                        <TouchableOpacity
                            style={styles.heroPlayBtn}
                            onPress={() => {
                                setCurrentTrack(FEATURED_TRACKS[0]);
                                setIsPlaying(true);
                            }}
                        >
                            <Ionicons name="play" size={16} color="#0F0F1A" />
                            <Text style={styles.heroPlayBtnText}>Слухати</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* ── Мої плейлисти ── */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Мої плейлисти</Text>
                        <TouchableOpacity>
                            <Text style={styles.seeAll}>Всі</Text>
                        </TouchableOpacity>
                    </View>
                    <FlatList
                        data={PLAYLISTS}
                        keyExtractor={(item) => item.id}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
                        renderItem={({ item }) => <PlaylistCard item={item} />}
                    />
                </View>

                {/* ── Категорії ── */}
                <View style={styles.section}>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.categoriesRow}
                    >
                        {CATEGORIES.map((cat) => (
                            <CategoryChip
                                key={cat}
                                label={cat}
                                isActive={activeCategory === cat}
                                onPress={() => setActiveCategory(cat)}
                            />
                        ))}
                    </ScrollView>
                </View>

                {/* ── Список треків ── */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Популярні треки</Text>
                        <TouchableOpacity>
                            <Text style={styles.seeAll}>Всі</Text>
                        </TouchableOpacity>
                    </View>
                    {FEATURED_TRACKS.map((track, index) => (
                        <TrackItem
                            key={track.id}
                            item={track}
                            index={index}
                            isPlaying={currentTrack.id === track.id && isPlaying}
                            onPress={() => {
                                setCurrentTrack(track);
                                setIsPlaying(true);
                            }}
                        />
                    ))}
                </View>

                {/* Нижній відступ для NowPlayingBar */}
                <View style={{ height: 90 }} />
            </ScrollView>

            {/* ── NowPlayingBar ── */}
            <NowPlayingBar
                track={currentTrack}
                isPlaying={isPlaying}
                onToggle={() => setIsPlaying((prev) => !prev)}
            />
        </SafeAreaView>
    );
};

export default HomeScreen;


const styles = StyleSheet.create({
    // ── Контейнер ──────────────────────────────────────────
    container: {
        flex: 1,
        backgroundColor: '#0F0F1A',
    },
    scrollContent: {
        paddingBottom: 20,
    },

    // ── Хедер ──────────────────────────────────────────────
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 20,
    },
    greeting: {
        fontSize: 22,
        fontWeight: '700',
        color: '#F9FAFB',
    },
    subGreeting: {
        fontSize: 13,
        color: '#9CA3AF',
        marginTop: 2,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    iconBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#1E1E30',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarBtn: {
        width: 42,
        height: 42,
        borderRadius: 21,
        borderWidth: 2,
        borderColor: '#A78BFA',
        overflow: 'hidden',
    },
    avatar: {
        width: '100%',
        height: '100%',
    },

    // ── Банер ──────────────────────────────────────────────
    heroBanner: {
        marginHorizontal: 20,
        borderRadius: 20,
        overflow: 'hidden',
        height: 200,
        marginBottom: 28,
    },
    heroBannerImage: {
        width: '100%',
        height: '100%',
        position: 'absolute',
    },
    heroBannerOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(15,15,26,0.65)',
    },
    heroBannerContent: {
        flex: 1,
        padding: 20,
        justifyContent: 'flex-end',
    },
    heroBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(251,191,36,0.15)',
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
        marginBottom: 8,
    },
    heroBadgeText: {
        fontSize: 11,
        color: '#FBBF24',
        fontWeight: '600',
    },
    heroBannerTitle: {
        fontSize: 26,
        fontWeight: '800',
        color: '#F9FAFB',
    },
    heroBannerArtist: {
        fontSize: 14,
        color: '#D1D5DB',
        marginBottom: 14,
    },
    heroPlayBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#A78BFA',
        alignSelf: 'flex-start',
        paddingHorizontal: 18,
        paddingVertical: 9,
        borderRadius: 25,
    },
    heroPlayBtnText: {
        color: '#0F0F1A',
        fontWeight: '700',
        fontSize: 14,
    },

    // ── Секції ─────────────────────────────────────────────
    section: {
        marginBottom: 28,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#F9FAFB',
    },
    seeAll: {
        fontSize: 14,
        color: '#A78BFA',
        fontWeight: '600',
    },

    // ── Плейлист картка ────────────────────────────────────
    playlistCard: {
        width: 150,
        height: 150,
        borderRadius: 16,
        overflow: 'hidden',
        marginLeft: 20,
    },
    playlistCover: {
        width: '100%',
        height: '100%',
        position: 'absolute',
    },
    playlistOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(15,15,26,0.55)',
    },
    playlistInfo: {
        position: 'absolute',
        bottom: 36,
        left: 10,
        right: 10,
    },
    playlistTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#F9FAFB',
    },
    playlistCount: {
        fontSize: 11,
        color: '#D1D5DB',
        marginTop: 2,
    },
    playlistPlayBtn: {
        position: 'absolute',
        bottom: 8,
        right: 8,
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: '#A78BFA',
        justifyContent: 'center',
        alignItems: 'center',
    },

    // ── Категорії ──────────────────────────────────────────
    categoriesRow: {
        paddingHorizontal: 20,
        gap: 8,
    },
    chip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#1E1E30',
    },
    chipActive: {
        backgroundColor: '#A78BFA',
    },
    chipText: {
        fontSize: 13,
        color: '#9CA3AF',
        fontWeight: '600',
    },
    chipTextActive: {
        color: '#fff',
    },

    // ── Трек ───────────────────────────────────────────────
    trackItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 12,
        marginHorizontal: 12,
        marginBottom: 4,
    },
    trackItemActive: {
        backgroundColor: '#1E1E30',
    },
    trackIndex: {
        width: 28,
        alignItems: 'center',
    },
    trackIndexText: {
        fontSize: 14,
        color: '#6B7280',
    },
    trackCover: {
        width: 46,
        height: 46,
        borderRadius: 10,
        marginRight: 12,
    },
    trackMeta: {
        flex: 1,
    },
    trackTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#E5E7EB',
    },
    trackTitleActive: {
        color: '#A78BFA',
    },
    trackArtist: {
        fontSize: 12,
        color: '#9CA3AF',
        marginTop: 2,
    },
    trackDuration: {
        fontSize: 13,
        color: '#6B7280',
        marginRight: 8,
    },
    trackMore: {
        padding: 4,
    },

    // ── NowPlayingBar ──────────────────────────────────────
    nowPlaying: {
        position: 'absolute',
        bottom: 12,
        left: 12,
        right: 12,
        backgroundColor: '#1E1E30',
        borderRadius: 18,
        overflow: 'hidden',
        elevation: 12,
        shadowColor: '#A78BFA',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
    },
    nowPlayingProgress: {
        height: 3,
        width: '45%',
        backgroundColor: '#A78BFA',
        borderRadius: 2,
    },
    nowPlayingInner: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        gap: 10,
    },
    nowPlayingCover: {
        width: 44,
        height: 44,
        borderRadius: 10,
    },
    nowPlayingMeta: {
        flex: 1,
    },
    nowPlayingTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#F9FAFB',
    },
    nowPlayingArtist: {
        fontSize: 12,
        color: '#9CA3AF',
        marginTop: 2,
    },
    nowPlayingControls: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    playPauseBtn: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#A78BFA',
        justifyContent: 'center',
        alignItems: 'center',
    },
});
