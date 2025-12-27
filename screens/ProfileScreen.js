import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    Image,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    ScrollView,
    Button
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import {
    getMyTracks,
    getMyAlbums, // 👈 ТУТ ЗМІНА
    getTrackCoverUrl,
    getStreamUrl,
    getAlbumCoverUrl,
    logoutUser
} from '../api/api';

export default function ProfileScreen({ navigation }) {
    const [myTracks, setMyTracks] = useState([]);
    const [myAlbums, setMyAlbums] = useState([]);
    const [loading, setLoading] = useState(true);
    const [username, setUsername] = useState('User');

    // Аудіо
    const [sound, setSound] = useState(null);
    const [playingTrackId, setPlayingTrackId] = useState(null);

    useFocusEffect(
        useCallback(() => {
            loadProfileData();
            return () => {
                if (sound) sound.unloadAsync();
            };
        }, [])
    );

    const loadProfileData = async () => {
        setLoading(true);
        try {
            const storedName = await AsyncStorage.getItem('username');
            if (storedName) setUsername(storedName);

            // 1. Мої треки
            const tracksData = await getMyTracks();
            setMyTracks(Array.isArray(tracksData) ? tracksData : []);

            // 2. Мої альбоми (через новий ендпоінт)
            const albumsData = await getMyAlbums();
            setMyAlbums(Array.isArray(albumsData) ? albumsData : []);

        } catch (e) {
            console.log(e);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        if (sound) await sound.unloadAsync();
        await logoutUser();
        navigation.reset({
            index: 0,
            routes: [{ name: 'AuthChoice' }],
        });
    };

    const playTrack = async (track) => {
        try {
            const trackId = track.id || track._id;
            if (sound) {
                await sound.unloadAsync();
                setSound(null);
            }
            if (playingTrackId === trackId) {
                setPlayingTrackId(null);
                return;
            }

            const { sound: newSound } = await Audio.Sound.createAsync(
                { uri: getStreamUrl(trackId) },
                { shouldPlay: true }
            );
            setSound(newSound);
            setPlayingTrackId(trackId);

            newSound.setOnPlaybackStatusUpdate((status) => {
                if (status.didJustFinish) setPlayingTrackId(null);
            });
        } catch (e) {
            Alert.alert('Error', 'Cannot play track');
        }
    };

    const renderAlbumItem = ({ item }) => {
        const albumId = item.id || item._id || item.Id;
        const coverUrl = getAlbumCoverUrl(albumId);

        return (
            <TouchableOpacity
                style={styles.albumCard}
                onPress={() => navigation.navigate('AlbumDetail', { id: albumId })}
            >
                {coverUrl ? (
                    <Image source={{ uri: coverUrl }} style={styles.albumCover} />
                ) : (
                    <View style={styles.albumPlaceholder} />
                )}
                <Text style={styles.albumTitle} numberOfLines={1}>{item.title}</Text>
            </TouchableOpacity>
        );
    };

    const renderTrackItem = ({ item }) => {
        const isPlaying = playingTrackId === (item.id || item._id);
        const coverUri = getTrackCoverUrl(item);

        return (
            <TouchableOpacity onPress={() => playTrack(item)} style={styles.trackRow}>
                {coverUri ? (
                    <Image source={{ uri: coverUri }} style={styles.trackCover} />
                ) : (
                    <View style={styles.trackCoverPlaceholder} />
                )}
                <View style={styles.trackInfo}>
                    <Text style={styles.trackTitle} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.trackArtist} numberOfLines={1}>
                        {item.artist || username}
                    </Text>
                </View>
                <Text style={styles.playText}>{isPlaying ? 'Stop' : 'Play'}</Text>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Profile</Text>
                <Button title="Logout" onPress={handleLogout} color="red" />
            </View>

            {loading ? (
                <ActivityIndicator size="large" style={{ marginTop: 50 }} />
            ) : (
                <ScrollView contentContainerStyle={styles.scrollContent}>

                    <View style={styles.userInfo}>
                        <Text style={styles.usernameText}>{username}</Text>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>My Albums</Text>
                        {myAlbums.length === 0 ? (
                            <Text style={styles.emptyText}>No albums yet.</Text>
                        ) : (
                            <FlatList
                                horizontal
                                data={myAlbums}
                                keyExtractor={(item) => (item.id || item._id || Math.random()).toString()}
                                renderItem={renderAlbumItem}
                                showsHorizontalScrollIndicator={false}
                            />
                        )}
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>My Tracks</Text>
                        {myTracks.length === 0 ? (
                            <Text style={styles.emptyText}>No tracks uploaded.</Text>
                        ) : (
                            myTracks.map((item, index) => (
                                <View key={index}>
                                    {renderTrackItem({ item })}
                                </View>
                            ))
                        )}
                    </View>

                </ScrollView>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        paddingTop: 50,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 20,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#000',
    },
    scrollContent: {
        paddingBottom: 40,
    },
    userInfo: {
        alignItems: 'center',
        marginBottom: 30,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
        paddingBottom: 20,
    },
    usernameText: {
        fontSize: 18,
        fontWeight: '600',
    },
    section: {
        marginBottom: 30,
        paddingHorizontal: 20,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 15,
        color: '#333',
    },
    emptyText: {
        color: '#999',
        fontStyle: 'italic',
    },
    albumCard: {
        marginRight: 15,
        width: 120,
    },
    albumCover: {
        width: 120,
        height: 120,
        borderRadius: 8,
        backgroundColor: '#ddd',
        marginBottom: 8,
    },
    albumPlaceholder: {
        width: 120,
        height: 120,
        borderRadius: 8,
        backgroundColor: '#eee',
        marginBottom: 8,
    },
    albumTitle: {
        fontSize: 14,
        fontWeight: '500',
    },
    trackRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    trackCover: {
        width: 40,
        height: 40,
        borderRadius: 4,
        backgroundColor: '#ddd',
        marginRight: 12,
    },
    trackCoverPlaceholder: {
        width: 40,
        height: 40,
        borderRadius: 4,
        backgroundColor: '#eee',
        marginRight: 12,
    },
    trackInfo: {
        flex: 1,
    },
    trackTitle: {
        fontSize: 15,
        fontWeight: '500',
    },
    trackArtist: {
        fontSize: 12,
        color: '#888',
    },
    playText: {
        color: '#007AFF',
        fontWeight: '600',
        fontSize: 14,
    },
});