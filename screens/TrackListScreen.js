import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    FlatList,
    StyleSheet,
    Image,
    ActivityIndicator,
    Button,
    TouchableOpacity,
    Alert
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Audio } from 'expo-av';
import {
    getTracks,
    getTrackCoverUrl,
    getStreamUrl,
    logoutUser // 👇 Додав функцію виходу
} from '../api/api';

export default function TrackListScreen({ navigation }) {
    const [tracks, setTracks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sound, setSound] = useState(null);
    const [playingTrackId, setPlayingTrackId] = useState(null);

    useFocusEffect(
        useCallback(() => {
            loadTracks();
            return () => {
                if (sound) {
                    sound.unloadAsync();
                }
            };
        }, [])
    );

    const loadTracks = async () => {
        setLoading(true);
        const data = await getTracks();
        setTracks(Array.isArray(data) ? data : []);
        setLoading(false);
    };

    const playTrack = async (track) => {
        try {
            const trackId = track.id || track._id;
            if (!trackId) return;

            if (sound) {
                await sound.unloadAsync();
                setSound(null);
            }

            if (playingTrackId === trackId) {
                setPlayingTrackId(null);
                return;
            }

            const streamUrl = getStreamUrl(trackId);

            const { sound: newSound } = await Audio.Sound.createAsync(
                { uri: streamUrl },
                { shouldPlay: true }
            );

            setSound(newSound);
            setPlayingTrackId(trackId);

            newSound.setOnPlaybackStatusUpdate((status) => {
                if (status.didJustFinish) {
                    setPlayingTrackId(null);
                }
            });

        } catch (e) {
            console.error("Play Error:", e);
            Alert.alert('Error', 'Cannot play track');
        }
    };

    const renderItem = ({ item }) => {
        const trackId = item.id || item._id;
        const isPlaying = playingTrackId === trackId;

        // 👇 Використовуємо нову функцію, яка бачить і великі, і маленькі літери
        const coverUri = getTrackCoverUrl(item);

        return (
            <TouchableOpacity
                onPress={() => playTrack(item)}
                style={styles.row}
            >
                {coverUri ? (
                    <Image
                        source={{ uri: coverUri }}
                        style={styles.cover}
                    />
                ) : (
                    <View style={styles.cover} />
                )}

                <View style={styles.info}>
                    <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.artist} numberOfLines={1}>{item.artist}</Text>
                </View>

                {/* 👇 Твій текст, жодних іконок */}
                <Text style={styles.playText}>
                    {isPlaying ? 'Stop' : 'Play'}
                </Text>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.headerRow}>
                <Text style={styles.header}>Tracks</Text>

                <Button
                    title="Logout"
                    onPress={async () => {
                        if (sound) {
                            await sound.unloadAsync();
                        }
                        await logoutUser(); // 👇 Видаляємо токен
                        navigation.replace('AuthChoice'); // Повертаємось на вибір
                    }}
                />
            </View>

            {loading ? (
                <ActivityIndicator size="large" />
            ) : (
                <FlatList
                    data={tracks}
                    keyExtractor={(item) => item.id || item._id || Math.random().toString()}
                    renderItem={renderItem}
                    ListEmptyComponent={
                        <Text style={styles.emptyText}>No tracks found</Text>
                    }
                />
            )}

            <View style={{ marginTop: 10 }}>
                <Button
                    title="Upload track"
                    onPress={() => navigation.navigate('Upload')}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingTop: 40,
        flex: 1,
        padding: 20,
        backgroundColor: '#fff'
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15
    },
    header: {
        fontSize: 20,
        fontWeight: '600'
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#eee'
    },
    cover: {
        width: 40,
        height: 40,
        backgroundColor: '#ddd',
        marginRight: 10,
        borderRadius: 4
    },
    info: {
        flex: 1,
        paddingRight: 10
    },
    title: {
        fontSize: 15,
        fontWeight: '500'
    },
    artist: {
        fontSize: 12,
        color: '#777'
    },
    playText: {
        fontSize: 14,
        color: '#007AFF',
        fontWeight: '600'
    },
    emptyText: {
        textAlign: 'center',
        marginTop: 40,
        color: '#777'
    }
});