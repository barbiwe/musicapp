import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    Image,
    ActivityIndicator,
    TouchableOpacity,
    Alert
} from 'react-native';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage'; // 👈 Додав
import * as ImagePicker from 'expo-image-picker'; // 👈 Додав
import {
    getAlbumDetails,
    getAlbumTracks,
    getTracks,
    getAlbumCoverUrl,
    getStreamUrl,
    uploadAlbumCover
} from '../api/api';

export default function AlbumDetailScreen({ route, navigation }) {
    const { id: routeId, albumId: routeAlbumId } = route.params || {};
    const albumId = routeId || routeAlbumId;

    const [album, setAlbum] = useState(null);
    const [albumTracks, setAlbumTracks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isOwner, setIsOwner] = useState(false); // 👈 Стейт власника

    const [sound, setSound] = useState(null);
    const [playingTrackId, setPlayingTrackId] = useState(null);

    useEffect(() => {
        loadData();
        return () => {
            if (sound) sound.unloadAsync();
        };
    }, [albumId]);

    const loadData = async () => {
        setLoading(true);
        try {
            const albumData = await getAlbumDetails(albumId);
            if (!albumData) {
                setAlbum(null);
                setLoading(false);
                return;
            }
            setAlbum(albumData);

            const storedName = await AsyncStorage.getItem('username');
            if (storedName && albumData.artist) {
                const isMyAlbum = storedName.toLowerCase().trim() === albumData.artist.toLowerCase().trim();
                setIsOwner(isMyAlbum);
            }

            let foundTracks = await getAlbumTracks(albumId);

            if (!foundTracks || foundTracks.length === 0) {
                const allTracks = await getTracks();
                foundTracks = allTracks.filter(t => {
                    const tAlbId = t.albumId || t.AlbumId;
                    return tAlbId && tAlbId.toString() === albumId.toString();
                });
            }

            setAlbumTracks(Array.isArray(foundTracks) ? foundTracks : []);

        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    const handleAddCover = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.7
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                setLoading(true);
                const success = await uploadAlbumCover(albumId, result.assets[0]);

                if (success) {
                    Alert.alert('Success', 'Cover updated!');
                    await loadData();
                } else {
                    Alert.alert('Error', 'Failed to upload cover');
                    setLoading(false);
                }
            }
        } catch (e) {
            console.log(e);
            setLoading(false);
        }
    };

    const playTrack = async (track) => {
        try {
            const trackId = track.id || track._id;
            if (!trackId) return;

            if (sound) {
                await sound.unloadAsync();
                setPlayingTrackId(null);
            }

            if (playingTrackId === trackId) {
                setSound(null);
                return;
            }

            const { sound: newSound } = await Audio.Sound.createAsync(
                { uri: getStreamUrl(trackId) },
                { shouldPlay: true }
            );

            setSound(newSound);
            setPlayingTrackId(trackId);

            newSound.setOnPlaybackStatusUpdate((status) => {
                if (status.didJustFinish) {
                    setPlayingTrackId(null);
                }
            });

        } catch {
            Alert.alert('Error', 'Cannot play track');
        }
    };

    const renderTrack = ({ item, index }) => {
        const trackId = item.id || item._id;
        const isPlaying = playingTrackId === trackId;

        return (
            <TouchableOpacity
                style={styles.trackRow}
                onPress={() => playTrack(item)}
            >
                <Text style={styles.trackNum}>{index + 1}.</Text>

                <View style={styles.trackInfo}>
                    <Text style={styles.trackTitle}>{item.title}</Text>
                    <Text style={styles.trackArtist}>{item.artist}</Text>
                </View>

                <Text style={styles.trackAction}>
                    {isPlaying ? 'Stop' : 'Play'}
                </Text>
            </TouchableOpacity>
        );
    };

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" />
            </View>
        );
    }

    if (!album) {
        return (
            <View style={styles.center}>
                <Text>Album not found</Text>
            </View>
        );
    }

    const currentAlbumId = album.id || album._id;
    const coverUri = album.coverFileId
        ? getAlbumCoverUrl(currentAlbumId)
        : null;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <Text style={styles.backText}>Back</Text>
                </TouchableOpacity>

                {coverUri ? (
                    <Image source={{ uri: coverUri }} style={styles.cover} />
                ) : (
                    isOwner ? (
                        <TouchableOpacity
                            style={[styles.cover, { justifyContent: 'center', alignItems: 'center' }]}
                            onPress={handleAddCover}
                        >
                            <Text style={{ color: '#007AFF', fontWeight: 'bold' }}>+ Add Cover</Text>
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.cover} />
                    )
                )}

                <Text style={styles.title}>{album.title}</Text>
                <Text style={styles.artist}>{album.artist}</Text>
                <Text style={styles.subInfo}>
                    Tracks: {albumTracks.length}
                </Text>
            </View>

            <FlatList
                data={albumTracks}
                keyExtractor={(item) => item.id || item._id}
                renderItem={renderTrack}
                ListEmptyComponent={
                    <Text style={styles.emptyText}>
                        No tracks in this album
                    </Text>
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    header: {
        alignItems: 'center',
        padding: 20,
        paddingTop: 70,
        borderBottomWidth: 1,
        borderBottomColor: '#ddd',
        position: 'relative'
    },
    backButton: {
        position: 'absolute',
        top: 50,
        left: 20,
        zIndex: 10
    },
    backText: {
        fontSize: 16,
        color: '#007AFF',
        fontWeight: '600'
    },
    cover: {
        width: 140,
        height: 140,
        marginBottom: 10,
        backgroundColor: '#ccc',
        borderRadius: 8
    },
    title: { fontSize: 20,
             fontWeight: '600' },
    artist: { fontSize: 14,
              color: '#555' },
    subInfo: { marginTop: 4,
               fontSize: 12,
               color: '#777' },

    trackRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#eee'
    },
    trackNum: { width: 28, fontSize: 14, color: '#777' },
    trackInfo: { flex: 1 },
    trackTitle: { fontSize: 15, fontWeight: '500' },
    trackArtist: { fontSize: 12, color: '#777' },
    trackAction: { fontSize: 14, color: '#007AFF' },

    emptyText: {
        textAlign: 'center',
        marginTop: 30,
        color: '#777'
    }
});