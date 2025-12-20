import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    Image,
    ActivityIndicator,
    Button,
    TouchableOpacity,
    Alert
} from 'react-native';
import { Audio } from 'expo-av';
import {
    getAlbumDetails,
    getTracks,
    getAlbumCoverUrl,
    getStreamUrl
} from '../api/api';

export default function AlbumDetailScreen({ albumId, onBack }) {
    const [album, setAlbum] = useState(null);
    const [albumTracks, setAlbumTracks] = useState([]);
    const [loading, setLoading] = useState(true);

    const [sound, setSound] = useState(null);
    const [playingTrackId, setPlayingTrackId] = useState(null);

    useEffect(() => {
        loadData();
        return () => {
            if (sound) {
                sound.unloadAsync();
            }
        };
    }, [albumId]);

    const loadData = async () => {
        setLoading(true);
        try {
            const albumData = await getAlbumDetails(albumId);
            setAlbum(albumData);

            const allTracks = await getTracks();
            const filtered = allTracks.filter(
                t => t.albumId == albumId || t.AlbumId == albumId
            );

            setAlbumTracks(filtered);
        } catch (error) {
            console.error('Load error:', error);
        }
        setLoading(false);
    };

    const playTrack = async (track) => {
        try {
            if (sound) {
                await sound.unloadAsync();
                setPlayingTrackId(null);
            }

            if (playingTrackId === track.id) {
                setSound(null);
                return;
            }

            const streamUrl = getStreamUrl(track.id);
            const { sound: newSound } = await Audio.Sound.createAsync(
                { uri: streamUrl },
                { shouldPlay: true }
            );

            setSound(newSound);
            setPlayingTrackId(track.id);
        } catch {
            Alert.alert('Error', 'Cannot play track');
        }
    };

    const renderTrack = ({ item, index }) => {
        const isPlaying = playingTrackId === item.id;

        return (
            <TouchableOpacity
                style={styles.trackRow}
                onPress={() => playTrack(item)}
            >
                <Text style={styles.trackNum}>{index + 1}.</Text>

                <View style={styles.trackInfo}>
                    <Text style={styles.trackTitle}>
                        {item.title}
                    </Text>
                    <Text style={styles.trackArtist}>
                        {item.artist}
                    </Text>
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
                <Button title="Back" onPress={onBack} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Image
                    source={{ uri: getAlbumCoverUrl(album.id) }}
                    style={styles.cover}
                />
                <Text style={styles.title}>{album.title}</Text>
                <Text style={styles.artist}>{album.artist}</Text>
                <Text style={styles.subInfo}>
                    Tracks: {albumTracks.length}
                </Text>
            </View>

            <FlatList
                data={albumTracks}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderTrack}
                ListEmptyComponent={
                    <Text style={styles.emptyText}>
                        No tracks in this album
                    </Text>
                }
            />

            <View style={styles.footer}>
                <Button
                    title="Back"
                    onPress={() => {
                        if (sound) sound.unloadAsync();
                        onBack();
                    }}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff'
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    header: {
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#ddd'
    },
    cover: {
        width: 140,
        height: 140,
        marginBottom: 10,
        backgroundColor: '#ccc'
    },
    title: {
        fontSize: 20,
        fontWeight: '600'
    },
    artist: {
        fontSize: 14,
        color: '#555'
    },
    subInfo: {
        marginTop: 4,
        fontSize: 12,
        color: '#777'
    },
    trackRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#eee'
    },
    trackNum: {
        width: 28,
        fontSize: 14,
        color: '#777'
    },
    trackInfo: {
        flex: 1
    },
    trackTitle: {
        fontSize: 15,
        fontWeight: '500'
    },
    trackArtist: {
        fontSize: 12,
        color: '#777'
    },
    trackAction: {
        fontSize: 14
    },
    emptyText: {
        textAlign: 'center',
        marginTop: 30,
        color: '#777'
    },
    footer: {
        padding: 10
    }
});
