// src/screens/HomeScreen.js
import React, { useState } from "react";
import { View, Text, TextInput, Button } from "react-native";
import { sendText } from "../api/api";

export default function HomeScreen() {
    const [text, setText] = useState("");
    const [response, setResponse] = useState("");

    const handleSend = async () => {
        const result = await sendText(text);
        setResponse(JSON.stringify(result));
    };

    return (
        <View style={{ padding: 20, marginTop: 50 }}>

            <TextInput
                value={text}
                onChangeText={setText}
                placeholder="1223"
                style={{
                    borderWidth: 1,
                    padding: 10,
                    marginVertical: 10,
                }}
            />

            <Button title="отправить" onPress={handleSend} />

            <Text style={{ marginTop: 20 }}>
                ответ: {response}
            </Text>
        </View>
    );
}