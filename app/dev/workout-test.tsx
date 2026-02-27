import React, { useState } from "react";
import { View, Text, Button, StyleSheet } from "react-native";
import { Screen } from "../../src/components/Screen";
import { useSession } from "../../src/session/SessionContext";
import { startWorkout, stopWorkout } from "../../src/lib/workouts";

export default function WorkoutTestScreen() {
  const { user } = useSession();
  const [workoutId, setWorkoutId] = useState<string | null>(null);
  const [log, setLog] = useState<string>("");

  const runStart = async () => {
    if (!user?.id) {
      setLog("No user session");
      return;
    }

    try {
      const w = await startWorkout({
        userId: user.id,
        title: "Test",
        activityType: "strength",
      });

      setWorkoutId(w.id);
      setLog(`Started workout: ${w.id}`);
      console.log("started:", w.id);
    } catch (e: any) {
      setLog(`Error: ${e?.message}`);
    }
  };

  const runStop = async () => {
    if (!user?.id || !workoutId) {
      setLog("No workout to stop");
      return;
    }

    try {
      const w2 = await stopWorkout({
        userId: user.id,
        workoutId,
      });

      setLog(`Stopped. Duration: ${w2.duration_min} min`);
      console.log("stopped duration:", w2.duration_min);
    } catch (e: any) {
      setLog(`Error: ${e?.message}`);
    }
  };

  return (
    <Screen>
      <View style={styles.container}>
        <Text style={styles.title}>Workout Function Test</Text>

        <Button title="Start Workout" onPress={runStart} />
        <View style={{ height: 12 }} />
        <Button title="Stop Workout" onPress={runStop} />

        <View style={{ marginTop: 20 }}>
          <Text>{log}</Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20 },
  title: { fontSize: 18, fontWeight: "bold", marginBottom: 20 },
});