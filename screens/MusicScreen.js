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
    FlatList
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { uploadTrack, getAlbums } from '../api/api';

export default function MusicScreen({ onSwitch, onCreateAlbum }) {
    const [title, setTitle] = useState('');
    const [artist, setArtist] = useState('');
    const [file, setFile] = useState(null);
    const [cover, setCover] = useState(null);

    const [albums, setAlbums] = useState([]);
    const [selectedAlbum, setSelectedAlbum] = useState(null);
    const [isModalVisible, setModalVisible] = useState(false);

    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchAlbums();
    }, []);

    const fetchAlbums = async () => {
        const data = await getAlbums();
        setAlbums(data);
    };

    const pickAudio = async () => {
        const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*' });
        if (!result.canceled) {
            setFile(result.assets[0]);
        }
    };

    const pickCover = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images
        });
        if (!result.canceled) {
            setCover(result.assets[0]);
        }
    };

    const handleUpload = async () => {
        if (!file || !title || !artist) {
            Alert.alert('Помилка', 'Заповніть всі обовʼязкові поля');
            return;
        }

        setLoading(true);

        const albumId = selectedAlbum ? selectedAlbum.id : null;
        const res = await uploadTrack(file, title, artist, albumId, cover);

        setLoading(false);

        if (res.success) {
            Alert.alert('Успіх', 'Трек завантажено');
            setTitle('');
            setArtist('');
            setFile(null);
            setCover(null);
            setSelectedAlbum(null);
        } else {
            Alert.alert('Помилка', res.error || 'Не вдалося завантажити');
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.header}>Upload track</Text>

            <TextInput
                placeholder="Track title"
                value={title}
                onChangeText={setTitle}
                style={styles.input}
            />

            <TextInput
                placeholder="Artist"
                value={artist}
                onChangeText={setArtist}
                style={styles.input}
            />

            <TouchableOpacity
                style={styles.selector}
                onPress={() => setModalVisible(true)}
            >
                <Text>
                    {selectedAlbum
                        ? `Album: ${selectedAlbum.title}`
                        : 'Select album (optional)'}
                </Text>
            </TouchableOpacity>

            <View style={styles.row}>
                <Button
                    title={file ? 'Audio selected' : 'Select audio'}
                    onPress={pickAudio}
                />
                <View style={{ width: 10 }} />
                <Button
                    title={cover ? 'Cover selected' : 'Select cover'}
                    onPress={pickCover}
                />
            </View>

            {loading ? (
                <ActivityIndicator size="large" />
            ) : (
                <Button title="Upload" onPress={handleUpload} />
            )}

            <View style={styles.footer}>
                <Button title="Create album" onPress={onCreateAlbum} />
                <View style={{ marginTop: 10 }}>
                    <Button title="Back" onPress={onSwitch} />
                </View>
            </View>

            <Modal visible={isModalVisible} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Albums</Text>

                        <FlatList
                            data={albums}
                            keyExtractor={(item) => item.id.toString()}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={styles.albumItem}
                                    onPress={() => {
                                        setSelectedAlbum(item);
                                        setModalVisible(false);
                                    }}
                                >
                                    <Text>
                                        {item.title} — {item.artist}
                                    </Text>
                                </TouchableOpacity>
                            )}
                            ListEmptyComponent={
                                <Text style={{ textAlign: 'center', marginTop: 20 }}>
                                    No albums
                                </Text>
                            }
                        />

                        <Button
                            title="Close"
                            onPress={() => {
                                setSelectedAlbum(null);
                                setModalVisible(false);
                            }}
                        />
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        backgroundColor: '#fff'
    },
    header: {
        fontSize: 20,
        fontWeight: '600',
        marginBottom: 15,
        textAlign: 'center'
    },
    input: {
        borderWidth: 1,
        borderColor: '#ccc',
        padding: 10,
        marginBottom: 10
    },
    selector: {
        padding: 10,
        borderWidth: 1,
        borderColor: '#ccc',
        marginBottom: 15
    },
    row: {
        flexDirection: 'row',
        marginBottom: 15
    },
    footer: {
        marginTop: 20
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center'
    },
    modalContent: {
        width: '80%',
        backgroundColor: '#fff',
        padding: 20
    },
    modalTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 10,
        textAlign: 'center'
    },
    albumItem: {
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#eee'
    }
});
