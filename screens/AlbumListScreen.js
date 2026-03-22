import React, { useState, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Image,
    ActivityIndicator,
    RefreshControl // Додав "потягнути, щоб оновити"
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
// 👇 Використовуємо getAlbums (всі), а не getMyAlbums
import { getAlbums, getAlbumCoverUrl } from '../api/api';

let albumListSessionCache = null;

export default function AlbumListScreen({ navigation }) {
    const hasLoadedOnceRef = useRef(false);
    const [albums, setAlbums] = useState([]);
    const [loading, setLoading] = useState(false);

    useFocusEffect(
        useCallback(() => {
            if (!hasLoadedOnceRef.current) {
                loadAlbums({ force: false });
            }
        }, [])
    );

    const loadAlbums = async ({ force = true } = {}) => {
        if (!force) {
            if (hasLoadedOnceRef.current) return;
            if (Array.isArray(albumListSessionCache)) {
                setAlbums(albumListSessionCache);
                hasLoadedOnceRef.current = true;
                return;
            }
        }

        setLoading(true);
        try {

            const data = await getAlbums();


            if (Array.isArray(data)) {
                setAlbums(data);
                albumListSessionCache = data;
            } else {
                setAlbums([]);
                albumListSessionCache = [];
            }
            hasLoadedOnceRef.current = true;
        } catch (e) {
            hasLoadedOnceRef.current = false;
        } finally {
            setLoading(false);
        }
    };

    const openAlbum = (albumId) => {
        if (!albumId) return;
        navigation.navigate('AlbumDetail', { albumId });
    };

    const renderItem = ({ item }) => {
        // Отримуємо ID (враховуємо різні варіанти з беку)
        const albumId = item.id || item.Id || item._id;

        // Отримуємо обкладинку
        const coverUri = (item.coverFileId || item.CoverFileId)
            ? getAlbumCoverUrl(albumId)
            : null;

        return (
            <TouchableOpacity
                style={styles.albumItem}
                onPress={() => openAlbum(albumId)}
            >
                {coverUri ? (
                    <Image
                        source={{ uri: coverUri }}
                        style={styles.cover}
                        resizeMode="cover"
                    />
                ) : (
                    <View style={styles.coverPlaceholder}>
                        <Text style={styles.placeholderText}>No Cover</Text>
                    </View>
                )}

                <Text style={styles.title} numberOfLines={1}>
                    {item.title || item.Title || 'Untitled'}
                </Text>
                <Text style={styles.artist} numberOfLines={1}>
                    {item.artist || item.Artist || 'Unknown Artist'}
                </Text>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.headerContainer}>
                <Text style={styles.header}>All Albums</Text>
                <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => navigation.navigate('CreateAlbum')}
                >
                    <Text style={styles.addButtonText}>+</Text>
                </TouchableOpacity>
            </View>

            {loading && albums.length === 0 ? (
                <ActivityIndicator size="large" color="#000" style={{ marginTop: 20 }} />
            ) : (
                <FlatList
                    data={albums}
                    numColumns={2}
                    keyExtractor={(item) => item.id || item.Id || item._id || Math.random().toString()}
                    renderItem={renderItem}
                    contentContainerStyle={{ paddingBottom: 20 }}
                    refreshControl={
                        <RefreshControl refreshing={loading} onRefresh={() => loadAlbums({ force: true })} />
                    }
                    ListEmptyComponent={
                        <Text style={styles.emptyText}>
                            No albums found.{"\n"}
                            Create one to test!
                        </Text>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        paddingTop: 60,
        backgroundColor: '#fff'
    },
    headerContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 15,
        position: 'relative'
    },
    header: {
        fontSize: 20,
        fontWeight: '600',
        textAlign: 'center'
    },
    addButton: {
        position: 'absolute',
        right: 0,
        padding: 5,
    },
    addButtonText: {
        fontSize: 28,
        fontWeight: '400',
        lineHeight: 30
    },
    albumItem: {
        flex: 1,
        margin: 10,
        alignItems: 'center',
        maxWidth: '45%'
    },
    cover: {
        width: 140,
        height: 140,
        borderRadius: 8,
        marginBottom: 8,
        backgroundColor: '#ddd'
    },
    coverPlaceholder: {
        width: 140,
        height: 140,
        borderRadius: 8,
        marginBottom: 8,
        backgroundColor: '#eee',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#ccc'
    },
    placeholderText: {
        color: '#888',
        fontSize: 12
    },
    title: {
        fontSize: 14,
        fontWeight: '600',
        textAlign: 'center'
    },
    artist: {
        fontSize: 12,
        color: '#555',
        textAlign: 'center'
    },
    emptyText: {
        textAlign: 'center',
        marginTop: 40,
        color: '#777',
        lineHeight: 24
    }
});
