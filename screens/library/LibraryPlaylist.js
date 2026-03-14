import React, { useEffect, useState } from 'react';
import { SvgUri } from 'react-native-svg';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Image,
    TouchableOpacity,
    Dimensions
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { getIcons, scale } from '../../api/api';
import InsetShadow from 'react-native-inset-shadow';
const { width, height } = Dimensions.get('window');

export default function LibraryPlaylist({ navigation }) {
    // Дані згідно зі скріншотом (Playlist tab)
    const DATA = [
        {
            id: '1',
            title: 'For car',
            subtitle: 'Playlist / Unknown',
            // Картинка: дівчина в машині/рука на кермі
            image: 'https://images.unsplash.com/photo-1511553677255-ba939e5537e0?q=80&w=300&auto=format&fit=crop'
        },
        {
            id: '2',
            title: 'Mix of the day',
            subtitle: 'Playlist / For this user',
            // Картинка: книга/ранок
            image: 'https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?q=80&w=300&auto=format&fit=crop'
        },
        {
            id: '3',
            title: 'My summer',
            subtitle: 'Playlist / QWS',
            // Картинка: пальми
            image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=300&auto=format&fit=crop'
        },
        {
            id: '4',
            title: 'Magic city',
            subtitle: 'Playlist / S-star',
            // Картинка: леопард/лапа
            image: 'https://images.unsplash.com/photo-1534234828569-1d37803d5268?q=80&w=300&auto=format&fit=crop'
        },
    ];

    const renderCard = (item) => {
        return (
            <TouchableOpacity
                key={item.id}
                style={styles.cardContainer} // Стиль точно як у твоєму коді
                activeOpacity={0.7}
                onPress={() => {}}
            >
                <View style={styles.imageWrapper}>
                    <Image
                        source={{ uri: item.image }}
                        style={styles.image}
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
                {/* Відступ під хедер (як у прикладі) */}
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

    // --- CARD STYLES (Скопійовано з твого коду 1 в 1) ---
    cardContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(48, 12, 10, 0.2)',
        borderRadius: scale(20),
        marginBottom: scale(16),
        width: '100%',
        // Ті самі скруглення зліва, що ти скинув
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
        borderRadius: scale(15),
        backgroundColor: '#333',
    },

    // --- TEXT STYLES ---
    textContainer: {
        flex: 1,
        justifyContent: 'center',
        paddingRight: scale(10),
    },
    title: {
        color: '#FF4D4F',
        fontSize: scale(16),
        fontFamily: 'Unbounded-Medium',
        marginBottom: scale(4),
    },
    subtitle: {
        color: '#FF4D4F',
        fontSize: scale(14),
        fontFamily: 'Poppins-Regular',
    },
});
