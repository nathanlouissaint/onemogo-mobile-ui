import { View, Text } from "react-native";
import { useLocalSearchParams } from "expo-router";

export default function SessionScreen() {
  const { id } = useLocalSearchParams();

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text>Workout Session</Text>
      <Text>Session ID: {id}</Text>
    </View>
  );
}