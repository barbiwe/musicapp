import React, { useEffect, useState } from 'react';
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
import { Audio } from 'expo-av';
import {
    getTracks,
    getTrackCoverUrl,
    getStreamUrl
} from '../api/api';

export default function TrackListScreen({ navigation }) {
    const [tracks, setTracks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sound, setSound] = useState(null);
    const [playingTrackId, setPlayingTrackId] = useState(null);

    useEffect(() => {
        loadTracks();

        return () => {
            if (sound) {
                sound.unloadAsync();
            }
        };
    }, [sound]);

    const loadTracks = async () => {
        setLoading(true);
        const data = await getTracks();
        setTracks(data);
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
        } catch (e) {
            Alert.alert('Error', 'Cannot play track');
        }
    };

    const renderItem = ({ item }) => {
        const isPlaying = playingTrackId === item.id;

        return (
            <TouchableOpacity
                onPress={() => playTrack(item)}
                style={styles.row}
            >
                <Image
                    source={{ uri: getTrackCoverUrl(item.id) }}
                    style={styles.cover}
                />

                <View style={styles.info}>
                    <Text style={styles.title}>{item.title}</Text>
                    <Text style={styles.artist}>{item.artist}</Text>
                </View>

                <Text style={styles.playText}>
                    {isPlaying ? 'Stop' : 'Play'}
                </Text>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            {/* HEADER */}
            <View style={styles.headerRow}>
                <Text style={styles.header}>Tracks</Text>

                <Button
                    title="Logout"
                    onPress={async () => {
                        if (sound) {
                            await sound.unloadAsync();
                        }
                        navigation.replace('Login');
                    }}
                />
            </View>

            {/* LIST */}
            {loading ? (
                <ActivityIndicator size="large" />
            ) : (
                <FlatList
                    data={tracks}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={renderItem}
                    ListEmptyComponent={
                        <Text style={styles.emptyText}>No tracks</Text>
                    }
                />
            )}

            {/* FOOTER BUTTON */}
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
        marginRight: 10
    },
    info: {
        flex: 1
    },
    title: {
        fontSize: 15
    },
    artist: {
        fontSize: 12,
        color: '#777'
    },
    playText: {
        fontSize: 14,
        color: '#000'
    },
    emptyText: {
        textAlign: 'center',
        marginTop: 40,
        color: '#777'
    }
});
