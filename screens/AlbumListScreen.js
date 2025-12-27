import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Image
} from 'react-native';
// Додав хук для оновлення списку при поверненні назад
import { useFocusEffect } from '@react-navigation/native';
import { getAlbums, getAlbumCoverUrl } from '../api/api';

export default function AlbumListScreen({ navigation }) {
    const [albums, setAlbums] = useState([]);

    // Використовуємо useFocusEffect замість useEffect,
    // щоб список оновлювався, коли ми повертаємось після створення альбому
    useFocusEffect(
        useCallback(() => {
            loadAlbums();
        }, [])
    );

    const loadAlbums = async () => {
        const data = await getAlbums();
        setAlbums(Array.isArray(data) ? data : []);
    };

    const openAlbum = (albumId) => {
        if (!albumId) return;
        navigation.navigate('AlbumDetail', { albumId });
    };

    const renderItem = ({ item }) => {
        // Mongo може повертати Id, id або _id. Беремо те, що є.
        const albumId = item.id || item.Id || item._id;

        const coverUri = item.coverFileId
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
                    />
                ) : (
                    <View style={styles.cover} />
                )}

                <Text style={styles.title} numberOfLines={1}>
                    {item.title}
                </Text>
                <Text style={styles.artist} numberOfLines={1}>
                    {item.artist}
                </Text>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            {/* Додав контейнер для заголовка та кнопки + */}
            <View style={styles.headerContainer}>
                <Text style={styles.header}>Albums</Text>

                {/* Кнопка додавання, якої не вистачало для навігації */}
                <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => navigation.navigate('CreateAlbum')}
                >
                    <Text style={styles.addButtonText}>+</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={albums}
                numColumns={2}
                keyExtractor={(item) => item.id || item.Id || item._id}
                renderItem={renderItem}
                ListEmptyComponent={
                    <Text style={styles.emptyText}>No albums</Text>
                }
            />
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
    // Оновив стилі заголовка, щоб додати кнопку "+" в один рядок
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
        alignItems: 'center'
    },
    cover: {
        width: 120,
        height: 120,
        marginBottom: 8,
        backgroundColor: '#ddd'
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
        color: '#777'
    }
});