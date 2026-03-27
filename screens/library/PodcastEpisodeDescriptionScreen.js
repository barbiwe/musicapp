import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    StatusBar,
    Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { scale } from '../../api/api';

const { height } = Dimensions.get('window');

export default function PodcastEpisodeDescriptionScreen({ route, navigation }) {
    const title = String(route?.params?.title || 'Episode').trim();
    const description = String(route?.params?.description || 'No episode description yet.').trim();

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ flexGrow: 1 }}
                bounces={false}
                overScrollMode="never"
            >
                <LinearGradient
                    colors={['#9A4B39', '#80291E', '#190707']}
                    locations={[0, 0.2, 0.59]}
                    start={{ x: 1, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={styles.gradient}
                >
                    <View style={styles.navBar}>
                        <TouchableOpacity
                            onPress={() => navigation.goBack()}
                            style={styles.backBtn}
                            hitSlop={{ top: scale(20), bottom: scale(20), left: scale(20), right: scale(20) }}
                        >
                            <Text style={styles.backText}>‹</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.contentWrap}>
                        <Text style={styles.screenTitle}>Episode description</Text>
                        <Text style={styles.episodeTitle}>{title}</Text>
                        <Text style={styles.descriptionText}>{description}</Text>
                    </View>
                </LinearGradient>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#300C0A',
    },
    gradient: {
        minHeight: height,
    },
    navBar: {
        marginTop: scale(50),
        paddingHorizontal: scale(16),
        height: scale(44),
        justifyContent: 'center',
    },
    backBtn: {
        width: scale(36),
        height: scale(36),
        justifyContent: 'center',
        alignItems: 'center',
    },
    backText: {
        color: '#F5D8CB',
        fontSize: scale(28),
        lineHeight: scale(28),
        fontFamily: 'Poppins-Regular',
    },
    contentWrap: {
        paddingHorizontal: scale(16),
        paddingTop: scale(14),
        paddingBottom: scale(120),
    },
    screenTitle: {
        color: '#F5D8CB',
        fontSize: scale(20),
        fontFamily: 'Unbounded-SemiBold',
        marginBottom: scale(18),
    },
    episodeTitle: {
        color: '#F5D8CB',
        fontSize: scale(16),
        lineHeight: scale(24),
        fontFamily: 'Unbounded-Medium',
        marginBottom: scale(14),
    },
    descriptionText: {
        color: '#F5D8CB',
        fontSize: scale(17),
        lineHeight: scale(34),
        fontFamily: 'Poppins-Regular',
    },
});
