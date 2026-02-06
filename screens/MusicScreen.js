import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    Button,
    StyleSheet,
    Alert,
    ActivityIndicator,
    TouchableOpacity,
    Modal,
    FlatList,
    SafeAreaView,
    ScrollView // Додав ScrollView, бо форма стала довгою
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { uploadTrack, getAlbums, getGenres } from '../api/api';

export default function MusicScreen({ navigation }) {
    const [title, setTitle] = useState('');
    // 👇 1. Додав стейт для тексту пісні
    const [lyrics, setLyrics] = useState('');

    const [file, setFile] = useState(null);
    const [cover, setCover] = useState(null);

    // --- ALBUMS STATE ---
    const [albums, setAlbums] = useState([]);
    const [selectedAlbum, setSelectedAlbum] = useState(null);
    const [isAlbumModalVisible, setAlbumModalVisible] = useState(false);

    // --- GENRES STATE ---
    const [genres, setGenres] = useState([]);
    const [selectedGenreIds, setSelectedGenreIds] = useState([]);
    const [isGenreModalVisible, setGenreModalVisible] = useState(false);

    const [artistId, setArtistId] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchData();
        fetchUserId();
    }, []);

    const fetchUserId = async () => {
        try {
            const id = await AsyncStorage.getItem('userId');
            if (id) {
                setArtistId(id);
            } else {
                Alert.alert('Увага', 'Не вдалося знайти ваш ID. Спробуйте перелогінитись.');
            }
        } catch (error) {
            console.error('Failed to load user ID', error);
        }
    };

    const fetchData = async () => {
        const [albumsData, genresData] = await Promise.all([
            getAlbums(),
            getGenres()
        ]);
        setAlbums(Array.isArray(albumsData) ? albumsData : []);
        setGenres(Array.isArray(genresData) ? genresData : []);
    };

    const pickAudio = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: 'audio/*',
                copyToCacheDirectory: true
            });
            if (!result.canceled && result.assets) {
                setFile(result.assets[0]);
            }
        } catch (e) {
            console.log(e);
        }
    };

    const pickCover = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7
        });
        if (!result.canceled) {
            setCover(result.assets[0]);
        }
    };

    const toggleGenre = (id) => {
        if (selectedGenreIds.includes(id)) {
            setSelectedGenreIds(selectedGenreIds.filter(gId => gId !== id));
        } else {
            setSelectedGenreIds([...selectedGenreIds, id]);
        }
    };

    const handleUpload = async () => {
        if (!artistId) {
            Alert.alert('Помилка', 'Не знайдено ID виконавця.');
            return;
        }
        if (!file || !title) {
            Alert.alert('Помилка', 'Заповніть назву та виберіть файл');
            return;
        }
        if (!cover) {
            Alert.alert('Помилка', 'Виберіть обкладинку (вимога сервера)');
            return;
        }
        if (selectedGenreIds.length === 0) {
            Alert.alert('Помилка', 'Виберіть хоча б один жанр');
            return;
        }

        setLoading(true);

        const albumId = selectedAlbum ? (selectedAlbum.id || selectedAlbum._id) : null;

        // 👇 2. Передаємо lyrics у функцію
        const result = await uploadTrack(
            file,
            title,
            artistId,
            albumId,
            cover,
            selectedGenreIds,
            lyrics
        );

        setLoading(false);

        if (result.error) {
            Alert.alert('Помилка', typeof result.error === 'string' ? result.error : 'Не вдалося завантажити трек');
        } else {
            Alert.alert('Успіх', 'Трек успішно завантажено');
            setTitle('');
            setLyrics(''); // Очищаємо поле тексту
            setFile(null);
            setCover(null);
            setSelectedAlbum(null);
            setSelectedGenreIds([]);
            navigation.navigate('Tracks');
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <Text style={styles.header}>Upload track</Text>

                <TextInput
                    placeholder="Track title"
                    value={title}
                    onChangeText={setTitle}
                    style={styles.input}
                    placeholderTextColor="#999"
                />

                {/* 👇 3. Поле для тексту пісні */}
                <TextInput
                    placeholder="Lyrics (optional)"
                    value={lyrics}
                    onChangeText={setLyrics}
                    style={[styles.input, styles.textArea]}
                    placeholderTextColor="#999"
                    multiline={true}
                    numberOfLines={4}
                />

                {/* ALBUM SELECTOR */}
                <TouchableOpacity
                    style={styles.selector}
                    onPress={() => setAlbumModalVisible(true)}
                >
                    <Text style={styles.selectorText}>
                        {selectedAlbum
                            ? `💿 Album: ${selectedAlbum.title}`
                            : 'Select album (optional)'}
                    </Text>
                </TouchableOpacity>

                {/* GENRE SELECTOR */}
                <TouchableOpacity
                    style={styles.selector}
                    onPress={() => setGenreModalVisible(true)}
                >
                    <Text style={styles.selectorText}>
                        {selectedGenreIds.length > 0
                            ? `🎵 Genres: ${selectedGenreIds.length} selected`
                            : 'Select genres (required)'}
                    </Text>
                </TouchableOpacity>

                <View style={styles.row}>
                    <Button
                        title={file ? `File: ${file.name}` : 'Select audio'}
                        onPress={pickAudio}
                    />
                    <View style={{ width: 10 }} />
                    <Button
                        title={cover ? 'Cover selected' : 'Select cover'}
                        onPress={pickCover}
                    />
                </View>

                {loading ? (
                    <ActivityIndicator size="large" color="#000" />
                ) : (
                    <Button title="Upload Track" onPress={handleUpload} />
                )}

                <View style={styles.footer}>
                    <Button title="Create album" onPress={() => navigation.navigate('CreateAlbum')} />
                    <View style={{ marginTop: 10 }}>
                        <Button title="Back to Tracks" onPress={() => navigation.navigate('Tracks')} />
                    </View>
                </View>
            </ScrollView>

            {/* --- MODAL ALBUMS --- */}
            <Modal visible={isAlbumModalVisible} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Select Album</Text>
                        <FlatList
                            data={albums}
                            keyExtractor={(item) => (item.id || item._id).toString()}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={styles.listItem}
                                    onPress={() => {
                                        setSelectedAlbum(item);
                                        setAlbumModalVisible(false);
                                    }}
                                >
                                    <Text>{item.title}</Text>
                                </TouchableOpacity>
                            )}
                        />
                        <Button title="Close" onPress={() => setAlbumModalVisible(false)} />
                    </View>
                </View>
            </Modal>

            {/* --- MODAL GENRES --- */}
            <Modal visible={isGenreModalVisible} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Select Genres</Text>
                        <Text style={{textAlign:'center', marginBottom:10, color:'#666'}}>
                            Selected: {selectedGenreIds.length}
                        </Text>

                        <FlatList
                            data={genres}
                            keyExtractor={(item) => (item.id || item._id).toString()}
                            renderItem={({ item }) => {
                                const isSelected = selectedGenreIds.includes(item.id || item._id);
                                return (
                                    <TouchableOpacity
                                        style={[
                                            styles.listItem,
                                            isSelected && styles.listItemActive
                                        ]}
                                        onPress={() => toggleGenre(item.id || item._id)}
                                    >
                                        <Text style={isSelected ? {color:'#fff', fontWeight:'bold'} : {color:'#000'}}>
                                            {item.name}
                                        </Text>
                                        {isSelected && <Text style={{color:'#fff'}}>✓</Text>}
                                    </TouchableOpacity>
                                );
                            }}
                        />
                        <Button title="Done" onPress={() => setGenreModalVisible(false)} />
                    </View>
                </View>
            </Modal>

        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 50
    },
    header: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'center'
    },
    input: {
        borderWidth: 1,
        borderColor: '#ddd',
        padding: 12,
        marginBottom: 12,
        borderRadius: 8,
        fontSize: 16,
        backgroundColor: '#fafafa'
    },
    textArea: {
        height: 100, // Висота для поля тексту
        textAlignVertical: 'top', // Щоб текст починався зверху (для Android)
    },
    selector: {
        padding: 12,
        borderWidth: 1,
        borderColor: '#ddd',
        marginBottom: 15,
        borderRadius: 8,
        backgroundColor: '#f0f0f0'
    },
    selectorText: {
        fontSize: 16,
        color: '#333'
    },
    row: {
        flexDirection: 'row',
        marginBottom: 20,
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    footer: {
        marginTop: 30,
        paddingTop: 20,
        borderTopWidth: 1,
        borderTopColor: '#eee'
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center'
    },
    modalContent: {
        width: '85%',
        maxHeight: '70%',
        backgroundColor: '#fff',
        padding: 20,
        borderRadius: 12,
        elevation: 5,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 15,
        textAlign: 'center'
    },
    listItem: {
        paddingVertical: 12,
        paddingHorizontal: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    listItemActive: {
        backgroundColor: '#007AFF',
        borderRadius: 6,
        borderBottomWidth: 0,
        marginBottom: 2
    }
});