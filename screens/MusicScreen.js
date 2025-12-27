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

export default function MusicScreen({ navigation }) {
    const [title, setTitle] = useState('');
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
        setAlbums(Array.isArray(data) ? data : []);
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

    const handleUpload = async () => {
        if (!file || !title) {
            Alert.alert('Помилка', 'Заповніть назву та виберіть файл');
            return;
        }

        if (!cover) {
            Alert.alert('Помилка', 'Виберіть обкладинку (обов\'язково)');
            return;
        }

        setLoading(true);

        const albumId = selectedAlbum ? (selectedAlbum.id || selectedAlbum._id || selectedAlbum.Id) : null;

        const result = await uploadTrack(
            file,
            title,
            "",
            albumId,
            cover
        );

        setLoading(false);

        if (result.error) {
            Alert.alert('Помилка', typeof result.error === 'string' ? result.error : 'Не вдалося завантажити трек');
        } else {
            Alert.alert('Успіх', 'Трек успішно завантажено');

            setTitle('');
            setFile(null);
            setCover(null);
            setSelectedAlbum(null);

            navigation.navigate('Tracks');
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
                <ActivityIndicator size="large" />
            ) : (
                <Button title="Upload" onPress={handleUpload} />
            )}

            <View style={styles.footer}>
                <Button title="Create album" onPress={() => navigation.navigate('CreateAlbum')} />
                <View style={{ marginTop: 10 }}>
                    <Button title="Back to Tracks" onPress={() => navigation.navigate('Tracks')} />
                </View>
            </View>

            {/* MODAL ALBUMS */}
            <Modal visible={isModalVisible} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Albums</Text>

                        <FlatList
                            data={albums}
                            keyExtractor={(item) => (item.id || item._id || Math.random()).toString()}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={styles.albumItem}
                                    onPress={() => {
                                        setSelectedAlbum(item);
                                        setModalVisible(false);
                                    }}
                                >
                                    <Text>
                                        {item.title}
                                    </Text>
                                </TouchableOpacity>
                            )}
                            ListEmptyComponent={
                                <Text style={{ textAlign: 'center', marginTop: 20 }}>
                                    No albums found
                                </Text>
                            }
                        />

                        <Button
                            title="Close"
                            onPress={() => {
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
        backgroundColor: '#fff',
        justifyContent: 'center'
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
        marginBottom: 10,
        borderRadius: 5
    },
    selector: {
        padding: 10,
        borderWidth: 1,
        borderColor: '#ccc',
        marginBottom: 15,
        borderRadius: 5,
        backgroundColor: '#f9f9f9'
    },
    row: {
        flexDirection: 'row',
        marginBottom: 15,
        justifyContent: 'space-between'
    },
    footer: {
        marginTop: 20
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center'
    },
    modalContent: {
        width: '80%',
        maxHeight: '60%',
        backgroundColor: '#fff',
        padding: 20,
        borderRadius: 10
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 10,
        textAlign: 'center'
    },
    albumItem: {
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#eee'
    }
});