import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Image,
    Button
} from 'react-native';
import { getAlbums, getAlbumCoverUrl } from '../api/api';

export default function AlbumListScreen({ onOpenAlbum, onBack }) {
    const [albums, setAlbums] = useState([]);

    useEffect(() => {
        loadAlbums();
    }, []);

    const loadAlbums = async () => {
        const data = await getAlbums();
        setAlbums(data);
    };

    return (
        <View style={styles.container}>
            <Text style={styles.header}>Albums</Text>

            <FlatList
                data={albums}
                numColumns={2}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={styles.albumItem}
                        onPress={() => onOpenAlbum(item.id)}
                    >
                        <Image
                            source={{ uri: getAlbumCoverUrl(item.id) }}
                            style={styles.cover}
                        />
                        <Text style={styles.title} numberOfLines={1}>
                            {item.title}
                        </Text>
                        <Text style={styles.artist} numberOfLines={1}>
                            {item.artist}
                        </Text>
                    </TouchableOpacity>
                )}
                ListEmptyComponent={
                    <Text style={styles.emptyText}>No albums</Text>
                }
            />

            <View style={styles.footer}>
                <Button title="Back" onPress={onBack} />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        paddingTop: 40,
        backgroundColor: '#fff'
    },
    header: {
        fontSize: 20,
        fontWeight: '600',
        marginBottom: 15,
        textAlign: 'center'
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
    },
    footer: {
        marginTop: 20
    }
});
