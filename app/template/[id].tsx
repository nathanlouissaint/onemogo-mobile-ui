// app/sessions/[id].tsx
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Card } from "../../src/components/Card";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { Screen } from "../../src/components/Screen";
import { theme } from "../../src/constants/theme";

import {
  completeWorkoutSession,
  getWorkoutSessionById,
  type WorkoutSession,
} from "../../src/lib/workouts";
import { useSession } from "../../src/session/SessionContext";

function formatActivityType(v?: string | null) {
  if (!v) return "—";
  const s = String(v).trim();
  if (!s) return "—";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function getErrMsg(e: unknown, fallback: string) {
  if (typeof e === "string") return e;
  if (e && typeof e === "object") {
    const anyErr = e as any;
    if (typeof anyErr.message === "string") return anyErr.message;
    if (typeof anyErr.error_description === "string") {
      return anyErr.error_description;
    }
    if (typeof anyErr.details === "string") return anyErr.details;
    if (typeof anyErr.hint === "string") return anyErr.hint;
  }
  return fallback;
}

function formatDateTime(v?: string | null) {
  if (!v) return "—";

  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";

  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getElapsedSeconds(startedAt?: string | null, nowMs?: number) {
  if (!startedAt) return 0;

  const start = new Date(startedAt);
  if (Number.isNaN(start.getTime())) return 0;

  const endMs = typeof nowMs === "number" ? nowMs : Date.now();
  return Math.max(0, Math.floor((endMs - start.getTime()) / 1000));
}

function formatClockFromSeconds(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [
    String(hours).padStart(2, "0"),
    String(minutes).padStart(2, "0"),
    String(seconds).padStart(2, "0"),
  ].join(":");
}

function formatMinutesLabel(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  return `${minutes} min`;
}

export default function WorkoutSessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useSession();

  const sessionId = useMemo(() => {
    const raw = Array.isArray(id) ? id[0] : id;
    return (raw ?? "").toString().trim();
  }, [id]);

  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [liveNowMs, setLiveNowMs] = useState(() => Date.now());

  const loadSession = useCallback(async () => {
    if (!sessionId) {
      setErr("Missing session id.");
      setLoading(false);
      return;
    }

    if (!user?.id) {
      setErr("Not authenticated.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setErr(null);

    try {
      const data = await getWorkoutSessionById(sessionId);

      if (data.user_id !== user.id) {
        throw new Error("You do not have access to this session.");
      }

      setSession(data);
      setLiveNowMs(Date.now());
    } catch (e: unknown) {
      setErr(getErrMsg(e, "Failed to load session"));
    } finally {
      setLoading(false);
    }
  }, [sessionId, user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadSession();
    }, [loadSession])
  );

  useEffect(() => {
    if (!session || session.ended_at) return;

    const interval = setInterval(() => {
      setLiveNowMs(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, [session]);

  const onCompleteSession = async () => {
    if (!session?.id || session.ended_at) return;

    setCompleting(true);
    setErr(null);

    try {
      const updated = await completeWorkoutSession({ sessionId: session.id });
      setSession(updated);
      setLiveNowMs(Date.now());
    } catch (e: unknown) {
      setErr(getErrMsg(e, "Failed to complete session"));
    } finally {
      setCompleting(false);
    }
  };

  const title =
    (session?.title && String(session.title).trim()) || "Workout Session";

  const statusLabel = session?.ended_at ? "Completed" : "Active";

  const elapsedSeconds = useMemo(() => {
    if (!session?.started_at) return 0;

    if (session.ended_at && typeof session.duration_min === "number") {
      return session.duration_min * 60;
    }

    return getElapsedSeconds(session.started_at, liveNowMs);
  }, [session?.started_at, session?.ended_at, session?.duration_min, liveNowMs]);

  const liveClockLabel = useMemo(() => {
    return formatClockFromSeconds(elapsedSeconds);
  }, [elapsedSeconds]);

  const elapsedMeta = useMemo(() => {
    if (!session?.started_at) return "Session timing unavailable";

    const minutes = Math.floor(elapsedSeconds / 60);
    return `${minutes} minute${minutes === 1 ? "" : "s"} elapsed`;
  }, [session?.started_at, elapsedSeconds]);

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.kicker}>Session</Text>
          <Text style={styles.title} numberOfLines={2}>
            {loading ? "Loading..." : title}
          </Text>
          <Text style={styles.sub}>
            {loading
              ? "Loading session..."
              : `${formatActivityType(session?.activity_type)} • ${statusLabel}`}
          </Text>
        </View>

        {loading ? (
          <Card>
            <View style={styles.center}>
              <ActivityIndicator />
              <Text style={styles.meta}>Loading session…</Text>
            </View>
          </Card>
        ) : err ? (
          <Card>
            <Text style={styles.errorText}>{err}</Text>
            <View style={{ marginTop: theme.spacing.md }}>
              <PrimaryButton label="Retry" onPress={loadSession} />
            </View>
            <View style={{ height: 12 }} />
            <PrimaryButton label="Back" onPress={() => router.back()} />
          </Card>
        ) : session ? (
          <>
            <Card style={{ marginBottom: theme.spacing.md }}>
              <Text style={styles.section}>Live Timer</Text>

              <View style={styles.liveWrap}>
                <View style={styles.livePill}>
                  <Text style={styles.livePillText}>
                    {session.ended_at ? "Completed" : "Active"}
                  </Text>
                </View>

                <Text style={styles.liveTimer}>{liveClockLabel}</Text>
                <Text style={styles.liveMeta}>{elapsedMeta}</Text>
              </View>
            </Card>

            <Card style={{ marginBottom: theme.spacing.md }}>
              <Text style={styles.section}>Overview</Text>

              <View style={styles.metaStack}>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Activity</Text>
                  <Text style={styles.metaValue}>
                    {formatActivityType(session.activity_type)}
                  </Text>
                </View>

                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Status</Text>
                  <Text
                    style={[
                      styles.metaValue,
                      session.ended_at ? styles.completeText : styles.activeText,
                    ]}
                  >
                    {statusLabel}
                  </Text>
                </View>

                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Started</Text>
                  <Text style={styles.metaValue}>
                    {formatDateTime(session.started_at ?? session.created_at)}
                  </Text>
                </View>

                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Ended</Text>
                  <Text style={styles.metaValue}>
                    {formatDateTime(session.ended_at)}
                  </Text>
                </View>

                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Duration</Text>
                  <Text style={styles.metaValue}>{liveClockLabel}</Text>
                </View>

                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Rounded Minutes</Text>
                  <Text style={styles.metaValue}>
                    {formatMinutesLabel(elapsedSeconds)}
                  </Text>
                </View>

                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Plan Link</Text>
                  <Text style={styles.metaValue}>
                    {session.plan_id ? "Linked" : "None"}
                  </Text>
                </View>

                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Template</Text>
                  <Text style={styles.metaValue}>
                    {session.template_id ? "Linked" : "None"}
                  </Text>
                </View>
              </View>
            </Card>

            <Card>
              <Text style={styles.section}>Actions</Text>

              <View style={{ marginTop: theme.spacing.lg }}>
                {!session.ended_at ? (
                  <>
                    <PrimaryButton
                      label={completing ? "Completing..." : "Complete Session"}
                      onPress={onCompleteSession}
                    />
                    <View style={{ height: 12 }} />
                  </>
                ) : null}

                <PrimaryButton label="Refresh" onPress={loadSession} />
                <View style={{ height: 12 }} />
                <PrimaryButton label="Back" onPress={() => router.back()} />
              </View>

              <Text style={styles.meta}>
                This is the session-level checkpoint screen. The next build layer
                is exercise logging and set tracking inside the active session.
              </Text>
            </Card>
          </>
        ) : (
          <Card>
            <Text style={styles.meta}>Session not found.</Text>
            <View style={{ marginTop: theme.spacing.md }}>
              <PrimaryButton label="Back" onPress={() => router.back()} />
            </View>
          </Card>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 28 },

  header: { marginBottom: theme.spacing.lg },
  kicker: {
    color: theme.colors.textFaint,
    fontSize: theme.font.size.sm,
    fontWeight: "700",
  },
  title: {
    color: theme.colors.text,
    fontSize: theme.font.size.xxl,
    fontWeight: "900",
    marginTop: 8,
  },
  sub: {
    color: theme.colors.textMuted,
    marginTop: 10,
    fontSize: theme.font.size.md,
    fontWeight: "700",
  },

  center: {
    alignItems: "center",
    paddingVertical: 10,
  },

  section: {
    color: theme.colors.textFaint,
    fontSize: theme.font.size.sm,
    fontWeight: "800",
  },

  liveWrap: {
    marginTop: theme.spacing.md,
    alignItems: "center",
    paddingVertical: theme.spacing.md,
  },
  livePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(10,132,255,0.12)",
    borderWidth: 1,
    borderColor: theme.colors.accent,
  },
  livePillText: {
    color: theme.colors.text,
    fontWeight: "800",
    fontSize: theme.font.size.sm,
  },
  liveTimer: {
    color: theme.colors.text,
    fontSize: 40,
    fontWeight: "900",
    marginTop: 14,
    letterSpacing: 1.2,
  },
  liveMeta: {
    color: theme.colors.textMuted,
    marginTop: 8,
    fontSize: theme.font.size.sm,
    fontWeight: "700",
  },

  metaStack: {
    marginTop: theme.spacing.md,
    gap: 12,
  },

  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },

  metaLabel: {
    color: theme.colors.textFaint,
    fontSize: theme.font.size.sm,
    fontWeight: "800",
  },

  metaValue: {
    color: theme.colors.text,
    fontSize: theme.font.size.sm,
    fontWeight: "700",
    flexShrink: 1,
    textAlign: "right",
  },

  activeText: {
    color: theme.colors.text,
  },

  completeText: {
    color: theme.colors.text,
  },

  meta: {
    color: theme.colors.textMuted,
    marginTop: 10,
    fontSize: theme.font.size.sm,
    fontWeight: "700",
  },

  errorText: {
    color: "#ff6b6b",
    fontWeight: "800",
  },
});