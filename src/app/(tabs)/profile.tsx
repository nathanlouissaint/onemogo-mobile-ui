import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import { Card } from "../../components/Card";
import { PrimaryButton } from "../../components/PrimaryButton";
import { Screen } from "../../components/Screen";
import { theme } from "../../constants/theme";

import { ApiError, updateProfile } from "../../lib/supabase";
import { useSession } from "../../session/SessionContext";

type ProfileDraft = {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  phone: string;
  bio: string;
};

const ui = {
  radiusPill: 999,
  avatarSize: 84,
};

export default function ProfileScreen() {
  const { user, refresh, logout } = useSession();

  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hydrating, setHydrating] = useState(true);

  const [draft, setDraft] = useState<ProfileDraft>({
    firstName: "",
    lastName: "",
    username: "",
    email: "",
    phone: "",
    bio: "",
  });

  const [faceIdEnabled, setFaceIdEnabled] = useState(false);

  useEffect(() => {
    setHydrating(true);

    setDraft((p) => ({
      ...p,
      firstName: user?.firstName ?? "",
      lastName: user?.lastName ?? "",
      username: user?.username ?? "",
      email: user?.email ?? "",
    }));

    setHydrating(false);
  }, [user]);

  const initials = useMemo(() => {
    const a = (draft.firstName || "").trim();
    const b = (draft.lastName || "").trim();
    const first = a.slice(0, 1).toUpperCase();
    const second = b.slice(0, 1).toUpperCase();
    const combined = (first + second).trim();
    return combined || "NA";
  }, [draft.firstName, draft.lastName]);

  function setField<K extends keyof ProfileDraft>(
    key: K,
    value: ProfileDraft[K]
  ) {
    setDraft((p) => ({ ...p, [key]: value }));
  }

  async function pickAvatar() {
    setBusy(true);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          "Permission required",
          "Allow Photos access to set a profile image."
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (result.canceled) return;
      const uri = result.assets?.[0]?.uri;
      if (!uri) return;

      setAvatarUri(uri);
    } finally {
      setBusy(false);
    }
  }

  function removeAvatar() {
    setAvatarUri(null);
  }

  async function saveChanges() {
    if (!draft.firstName.trim() || !draft.lastName.trim()) {
      Alert.alert("Missing name", "Please enter your first and last name.");
      return;
    }

    if (!draft.username.trim()) {
      Alert.alert("Missing username", "Please enter a username.");
      return;
    }

    setBusy(true);
    try {
      await updateProfile({
        firstName: draft.firstName.trim(),
        lastName: draft.lastName.trim(),
        username: draft.username.trim(),
      });

      await refresh();
      Alert.alert("Saved", "Profile updated.");
    } catch (e: any) {
      if (e instanceof ApiError) {
        if (e.status === 401) {
          Alert.alert("Session expired", "Please log in again.");
          return;
        }

        const msg = e.message || "Update failed";
        if (msg.toLowerCase().includes("username")) {
          Alert.alert("Username unavailable", msg);
          return;
        }

        Alert.alert("Error", msg);
        return;
      }

      Alert.alert("Error", e?.message ?? "Update failed");
    } finally {
      setBusy(false);
    }
  }

  function changePassword() {
    Alert.alert("Change Password", "Not implemented yet.");
  }

  async function confirmSignOut() {
    Alert.alert("Sign out?", "You’ll need to sign in again on this device.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          await logout();
        },
      },
    ]);
  }

  return (
    <KeyboardAvoidingView
      style={styles.keyboard}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Screen scroll contentStyle={styles.screenContent}>
        <View style={styles.header}>
          <Text style={styles.kicker}>Profile</Text>
          <Text style={styles.title}>Account</Text>
          <Text style={styles.sub}>
            Manage your personal info and security settings.
          </Text>
        </View>

        <Card style={styles.sectionCard}>
          <View style={styles.avatarRow}>
            <View style={styles.avatarWrap}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.initials}>{initials}</Text>
                </View>
              )}
            </View>

            <View style={styles.profileMain}>
              <Text style={styles.name}>
                {draft.firstName || "—"} {draft.lastName || ""}
              </Text>
              <Text style={styles.meta}>
                {draft.username ? `@${draft.username}` : "—"}
              </Text>

              <View style={styles.profileActions}>
                <PrimaryButton
                  label="Change photo"
                  onPress={pickAvatar}
                  loading={busy}
                  variant="secondary"
                />
                <View style={styles.smallActionGap} />
                <PrimaryButton
                  label="Remove"
                  onPress={removeAvatar}
                  disabled={!avatarUri}
                  variant="ghost"
                />
              </View>
            </View>
          </View>
        </Card>

        <View style={styles.sectionWrap}>
          <Text style={styles.sectionTitle}>Account Details</Text>

          <Card>
            <Field
              label="First name"
              value={draft.firstName}
              onChangeText={(v) => setField("firstName", v)}
              placeholder="First name"
            />
            <Divider />

            <Field
              label="Last name"
              value={draft.lastName}
              onChangeText={(v) => setField("lastName", v)}
              placeholder="Last name"
            />
            <Divider />

            <Field
              label="Username"
              value={draft.username}
              onChangeText={(v) => setField("username", v.replace(/\s/g, ""))}
              placeholder="username"
              autoCapitalize="none"
            />
            <Divider />

            <Field
              label="Email"
              value={draft.email}
              onChangeText={(v) => setField("email", v)}
              placeholder="email@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              disabled
            />
            <Divider />

            <Field
              label="Phone"
              value={draft.phone}
              onChangeText={(v) => setField("phone", v)}
              placeholder="(555) 555-5555"
              keyboardType="phone-pad"
              disabled
            />
          </Card>
        </View>

        <View style={styles.sectionWrap}>
          <Text style={styles.sectionTitle}>Bio</Text>
          <Card>
            <Text style={styles.fieldLabel}>About you</Text>
            <TextInput
              value={draft.bio}
              onChangeText={(v) => setField("bio", v)}
              placeholder="Write a short bio..."
              placeholderTextColor={theme.colors.textFaint}
              multiline
              editable={false}
              style={[styles.input, styles.bio, styles.disabledInput]}
            />
            <Text style={styles.helper}>
              Bio is UI-only right now. Add backend support before enabling
              edits.
            </Text>
          </Card>
        </View>

        <View style={styles.sectionWrap}>
          <Text style={styles.sectionTitle}>Security</Text>
          <Card>
            <Row
              title="Change password"
              subtitle="Update your password securely"
              onPress={changePassword}
              action="Open"
            />
            <Divider />

            <View style={styles.switchRow}>
              <View style={styles.switchCopy}>
                <Text style={styles.rowTitle}>Face ID</Text>
                <Text style={styles.rowSub}>
                  Use biometrics for faster sign-in
                </Text>
              </View>
              <Switch
                value={faceIdEnabled}
                onValueChange={setFaceIdEnabled}
                trackColor={{
                  false: "rgba(255,255,255,0.18)",
                  true: "rgba(10,132,255,0.35)",
                }}
                thumbColor={
                  faceIdEnabled
                    ? theme.colors.accent
                    : "rgba(255,255,255,0.75)"
                }
              />
            </View>

            <Divider />

            <Row
              title="Sign out"
              subtitle="End your session on this device"
              onPress={confirmSignOut}
              action="Sign out"
              danger
            />
          </Card>
        </View>

        <View style={styles.saveWrap}>
          <PrimaryButton
            label={hydrating ? "Loading..." : "Save changes"}
            onPress={saveChanges}
            disabled={hydrating || busy}
            loading={busy}
          />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize,
  disabled,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  keyboardType?: "default" | "email-address" | "phone-pad";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  disabled?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textFaint}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        editable={!disabled}
        style={[styles.input, disabled && styles.disabledInput]}
      />
    </View>
  );
}

function Row({
  title,
  subtitle,
  action,
  onPress,
  danger,
}: {
  title: string;
  subtitle: string;
  action: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      hitSlop={10}
    >
      <View style={styles.rowCopy}>
        <Text style={[styles.rowTitle, danger && styles.rowTitleDanger]}>
          {title}
        </Text>
        <Text style={styles.rowSub}>{subtitle}</Text>
      </View>

      <Text style={[styles.rowAction, danger && styles.rowActionDanger]}>
        {action}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  keyboard: {
    flex: 1,
  },

  screenContent: {
    paddingBottom: theme.spacing.xl,
  },

  header: {
    marginBottom: theme.spacing.lg,
  },

  kicker: {
    color: theme.colors.textFaint,
    fontSize: theme.font.size.sm,
    fontWeight: "700",
  },

  title: {
    color: theme.colors.text,
    fontSize: theme.font.size.xl,
    fontWeight: "900",
    marginTop: theme.spacing.xs,
  },

  sub: {
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
    fontSize: theme.font.size.md,
  },

  sectionCard: {
    marginBottom: theme.spacing.sm,
  },

  sectionWrap: {
    marginTop: theme.spacing.lg,
  },

  sectionTitle: {
    color: theme.colors.textFaint,
    fontSize: theme.font.size.sm,
    fontWeight: "800",
    marginBottom: theme.spacing.xs,
  },

  avatarRow: {
    flexDirection: "row",
    gap: theme.spacing.md,
    alignItems: "flex-start",
  },

  avatarWrap: {
    width: ui.avatarSize,
    height: ui.avatarSize,
    borderRadius: ui.radiusPill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: "hidden",
    backgroundColor: theme.colors.surface2,
  },

  avatarImg: {
    width: "100%",
    height: "100%",
  },

  avatarFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  initials: {
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: "900",
  },

  profileMain: {
    flex: 1,
  },

  name: {
    color: theme.colors.text,
    fontSize: theme.font.size.lg,
    fontWeight: "900",
  },

  meta: {
    color: theme.colors.textMuted,
    marginTop: 4,
    fontSize: theme.font.size.sm,
    fontWeight: "700",
  },

  profileActions: {
    marginTop: theme.spacing.md,
  },

  smallActionGap: {
    height: theme.spacing.xs,
  },

  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.sm,
  },

  field: {},

  fieldLabel: {
    color: theme.colors.textFaint,
    fontSize: theme.font.size.xs,
    fontWeight: "800",
    marginBottom: theme.spacing.xs,
  },

  input: {
    color: theme.colors.text,
    backgroundColor: theme.colors.surface2,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    fontSize: theme.font.size.md,
    fontWeight: "700",
  },

  disabledInput: {
    opacity: 0.6,
  },

  bio: {
    minHeight: 96,
    textAlignVertical: "top",
  },

  helper: {
    marginTop: theme.spacing.xs,
    color: theme.colors.textMuted,
    fontSize: theme.font.size.xs,
    fontWeight: "700",
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  rowPressed: {
    opacity: 0.75,
  },

  rowCopy: {
    flex: 1,
  },

  rowTitle: {
    color: theme.colors.text,
    fontSize: theme.font.size.md,
    fontWeight: "900",
  },

  rowTitleDanger: {
    color: theme.colors.danger,
  },

  rowSub: {
    color: theme.colors.textMuted,
    marginTop: 4,
    fontSize: theme.font.size.sm,
    fontWeight: "700",
  },

  rowAction: {
    color: theme.colors.accent,
    fontSize: theme.font.size.sm,
    fontWeight: "900",
    paddingLeft: theme.spacing.sm,
  },

  rowActionDanger: {
    color: theme.colors.danger,
  },

  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  switchCopy: {
    flex: 1,
  },

  saveWrap: {
    marginTop: theme.spacing.lg,
  },
});