import React from 'react';
import MusicScreen from './MusicScreen';

export default function CreateAlbumScreen(props) {
    return (
        <MusicScreen
            {...props}
            route={{
                ...(props.route || {}),
                params: {
                    ...(props.route?.params || {}),
                    initialMode: 'album',
                },
            }}
        />
    );
}
