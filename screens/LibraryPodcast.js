import React, { useEffect, useState } from 'react';

import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Image,
    TouchableOpacity,
    Dimensions
} from 'react-native';
import { SvgUri } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { getIcons, scale } from '../api/api';
import InsetShadow from 'react-native-inset-shadow';
const { width, height } = Dimensions.get('window');

export default function LibraryPodcast({ navigation }) {
    // Дані згідно зі скріншотом "Podcast"
    const DATA = [
        {
            id: '1',
            title: 'Топ аудіокниг',
            subtitle: 'Podcast / Taras Andrushko',
            // Навушники та книги
            image: 'https://www.chipublib.org/wp-content/uploads/sites/3/2022/09/36079964425_7b3042d5e1_k.jpg'
        },
        {
            id: '2',
            title: 'Атомні звички',
            subtitle: 'Podcast / Andrew Ozarkiv',
            // Книга на світлому фоні
            image: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?q=80&w=300&auto=format&fit=crop'
        },
        {
            id: '3',
            title: 'Книги для розвитку',
            subtitle: 'Podcast / Dmitrij',
            // Стопка книг
            image: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?q=80&w=300&auto=format&fit=crop'
        },
        {
            id: '4',
            title: 'Подкаст українською',
            subtitle: 'Podcast / Unknown',
            // Мінімалістичний текст на білому
            image: 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?q=80&w=300&auto=format&fit=crop'
        },
        {
            id: '5',
            title: 'Подкаст терапія',
            subtitle: 'Podcast / Spartak Subbota',
            // Чорно-біле фото чоловіка
            image: 'https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?q=80&w=300&auto=format&fit=crop'
        },
        {
            id: '6',
            title: 'Цейво подкаст',
            subtitle: 'Podcast / Василь Байдак',
            // Чоловік на синьому фоні
            image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=300&auto=format&fit=crop'
        },
        {
            id: '7',
            title: 'Подкаст',
            subtitle: 'Podcast / Alla Malkin',
            // Мозок / ілюстрація
            image: 'https://images.unsplash.com/photo-1559757175-5700dde675bc?q=80&w=300&auto=format&fit=crop'
        },
    ];

    const renderCard = (item) => {
        return (
            <TouchableOpacity
                key={item.id}
                style={styles.cardContainer} // Стиль ідентичний до Playlist/Album
                activeOpacity={0.7}
                onPress={() => {}}
            >
                <View style={styles.imageWrapper}>
                    <Image
                        source={{ uri: item.image }}
                        style={styles.image} // Квадратні з заокругленням (не круглі)
                        resizeMode="cover"
                    />
                </View>

                <View style={styles.textContainer}>
                    <Text style={styles.title} numberOfLines={1}>
                        {item.title}
                    </Text>
                    <Text style={styles.subtitle} numberOfLines={1}>
                        {item.subtitle}
                    </Text>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#9A4B39', '#80291E', '#190707']}
                locations={[0, 0.2, 0.59]}
                start={{ x: 1, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.gradient}
            >
                {/* Відступ під хедер */}
                <View style={{ height: 220 }} />

                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {DATA.map((item) => renderCard(item))}

                    {/* Відступ знизу */}
                    <View style={{ height: scale(100) }} />
                </ScrollView>
            </LinearGradient>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    gradient: {
        flex: 1,
        width: width,
        height: height,
    },
    scrollContent: {
        paddingHorizontal: scale(16),
        paddingTop: scale(20),
        paddingBottom: scale(100),
    },

    // --- CARD STYLES ---
    cardContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(48, 12, 10, 0.2)',
        borderRadius: scale(20),
        marginBottom: scale(16),
        width: '100%',

        // Зберігаємо стиль лівого краю як у Playlist
        borderTopLeftRadius: scale(50),
        borderBottomLeftRadius: scale(50),

        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },

    imageWrapper: {
        marginRight: scale(16),
        justifyContent: 'center',
        alignItems: 'center',
    },

    image: {
        width: scale(80),
        height: scale(80),
        borderRadius: scale(15), // Стандартне заокруглення (не коло)
        backgroundColor: '#333',
    },

    // --- TEXT STYLES ---
    textContainer: {
        flex: 1,
        justifyContent: 'center',
        paddingRight: scale(10),
    },
    title: {
        color: '#F5D8CB',
        fontSize: scale(16),
        fontFamily: 'Unbounded-Medium',
        marginBottom: scale(4),
    },
    subtitle: {
        color: 'rgba(245, 216, 203, 0.7)',
        fontSize: scale(14),
        fontFamily: 'Poppins-Regular',
    },
});