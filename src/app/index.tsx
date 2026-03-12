import { View, Button } from "react-native";
import { router } from "expo-router";

export default function Index() {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Button
        title="Open Test Session"
        onPress={() => router.push("/sessions/test")}
      />
    </View>
  );
}