// app/(tabs)/profile.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  Alert,
  TextInput,
  Switch,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import * as ImagePicker from "expo-image-picker";

import { Screen } from "../../src/components/Screen";
import { Card } from "../../src/components/Card";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { theme } from "../../src/constants/theme";

import { getMe, updateProfile, logout, ApiError } from "../../src/lib/api";

type ProfileDraft = {
  firstName: string;
  lastName: string;
  username: string;

  // UI-only fields for now (not supported by backend yet)
  email: string;
  phone: string;
  bio: string;
};

export default function ProfileScreen() {
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

  // Hydrate from backend
  useEffect(() => {
    let mounted = true;

    (async () => {
      setHydrating(true);
      try {
        // Updated api.ts: getMe() returns User
        const user = await getMe();
        if (!mounted) return;

        setDraft((p) => ({
          ...p,
          firstName: user?.firstName ?? "",
          lastName: user?.lastName ?? "",
          username: user?.username ?? "",
          email: user?.email ?? "",
          // phone/bio not in backend yet (keep local)
        }));
      } catch (e: any) {
        // Central handler in _layout.tsx will redirect; just show message if useful
        const msg = e instanceof ApiError ? e.message : "Please log in again.";
        Alert.alert("Session issue", msg);
      } finally {
        if (!mounted) return;
        setHydrating(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const initials = useMemo(() => {
    const a = (draft.firstName || "").trim();
    const b = (draft.lastName || "").trim();
    const first = a.slice(0, 1).toUpperCase();
    const second = b.slice(0, 1).toUpperCase();
    const combined = (first + second).trim();
    return combined || "NA";
  }, [draft.firstName, draft.lastName]);

  function setField<K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) {
    setDraft((p) => ({ ...p, [key]: value }));
  }

  async function pickAvatar() {
    setBusy(true);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission required", "Allow Photos access to set a profile image.");
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
      // NOTE: Avatar upload not implemented on backend yet
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
      // Updated api.ts: updateProfile() returns User
      const updatedUser = await updateProfile({
        firstName: draft.firstName.trim(),
        lastName: draft.lastName.trim(),
        username: draft.username.trim(),
      });

      setDraft((p) => ({
        ...p,
        firstName: updatedUser?.firstName ?? p.firstName,
        lastName: updatedUser?.lastName ?? p.lastName,
        username: updatedUser?.username ?? p.username,
        email: updatedUser?.email ?? p.email,
      }));

      Alert.alert("Saved", "Profile updated.");
    } catch (e: any) {
      if (e instanceof ApiError) {
        if (e.status === 401) {
          // _layout.tsx handler will redirect; avoid double navigation here
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

  async function signOut() {
    // logout() now triggers the global redirect via onUnauthorized
    await logout();
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Screen>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.kicker}>Profile</Text>
            <Text style={styles.title}>Account</Text>
            <Text style={styles.sub}>Manage your personal info and security settings.</Text>
          </View>

          {/* Identity */}
          <Card>
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

              <View style={{ flex: 1 }}>
                <Text style={styles.name}>
                  {draft.firstName || "—"} {draft.lastName || ""}
                </Text>
                <Text style={styles.meta}>{draft.username ? `@${draft.username}` : "—"}</Text>

                <View style={styles.actions}>
                  <PrimaryButton label="Change photo" onPress={pickAvatar} loading={busy} />
                  <View style={{ height: 10 }} />
                  <PrimaryButton label="Remove" onPress={removeAvatar} disabled={!avatarUri} />
                </View>
              </View>
            </View>
          </Card>

          {/* Account details */}
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

          {/* Bio */}
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
              <Text style={styles.helper}>Bio is UI-only right now. Add backend support before enabling edits.</Text>
            </Card>
          </View>

          {/* Security */}
          <View style={styles.sectionWrap}>
            <Text style={styles.sectionTitle}>Security</Text>
            <Card>
              <Row title="Change password" subtitle="Update your password securely" onPress={changePassword} action="Open" />
              <Divider />
              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>Face ID</Text>
                  <Text style={styles.rowSub}>Use biometrics for faster sign-in</Text>
                </View>
                <Switch
                  value={faceIdEnabled}
                  onValueChange={setFaceIdEnabled}
                  trackColor={{ false: "rgba(255,255,255,0.18)", true: "rgba(10,132,255,0.35)" }}
                  thumbColor={faceIdEnabled ? theme.colors.accent : "rgba(255,255,255,0.75)"}
                />
              </View>
              <Divider />
              <Row title="Sign out" subtitle="End your session on this device" onPress={signOut} action="Sign out" danger />
            </Card>
          </View>

          {/* Save */}
          <View style={{ marginTop: theme.spacing.lg }}>
            <PrimaryButton
              label={hydrating ? "Loading..." : "Save changes"}
              onPress={saveChanges}
              disabled={hydrating || busy}
              loading={busy}
            />
          </View>
        </Screen>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Small UI building blocks */

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
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, danger && { color: theme.colors.danger }]}>{title}</Text>
        <Text style={styles.rowSub}>{subtitle}</Text>
      </View>
      <Text onPress={onPress} style={[styles.rowAction, danger && { color: theme.colors.danger }]}>
        {action}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 28 },

  header: { marginBottom: theme.spacing.lg },
  kicker: { color: theme.colors.textFaint, fontSize: theme.font.size.sm, fontWeight: "700" },
  title: { color: theme.colors.text, fontSize: theme.font.size.xl, fontWeight: "900", marginTop: 8 },
  sub: { color: theme.colors.textMuted, marginTop: 8, fontSize: theme.font.size.md },

  sectionWrap: { marginTop: theme.spacing.lg },
  sectionTitle: {
    color: theme.colors.textFaint,
    fontSize: theme.font.size.sm,
    fontWeight: "800",
    marginBottom: 10,
  },

  avatarRow: { flexDirection: "row", gap: theme.spacing.md, alignItems: "flex-start" },
  avatarWrap: {
    width: 84,
    height: 84,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: "hidden",
    backgroundColor: theme.colors.surface2,
  },
  avatarImg: { width: "100%", height: "100%" },
  avatarFallback: { flex: 1, alignItems: "center", justifyContent: "center" },
  initials: { color: theme.colors.text, fontSize: 22, fontWeight: "900" },

  name: { color: theme.colors.text, fontSize: 18, fontWeight: "900" },
  meta: { color: theme.colors.textMuted, marginTop: 4, fontSize: 13, fontWeight: "700" },
  actions: { marginTop: 14 },

  divider: { height: 1, backgroundColor: theme.colors.border, marginVertical: 12 },

  field: {},
  fieldLabel: { color: theme.colors.textFaint, fontSize: 12, fontWeight: "800", marginBottom: 8 },
  input: {
    color: theme.colors.text,
    backgroundColor: theme.colors.surface2,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: theme.font.size.md,
    fontWeight: "700",
  },
  disabledInput: { opacity: 0.6 },

  bio: { minHeight: 96, textAlignVertical: "top" },
  helper: { marginTop: 10, color: theme.colors.textMuted, fontSize: 12, fontWeight: "700" },

  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rowTitle: { color: theme.colors.text, fontSize: 16, fontWeight: "900" },
  rowSub: { color: theme.colors.textMuted, marginTop: 4, fontSize: 13, fontWeight: "700" },
  rowAction: { color: theme.colors.accent, fontSize: 13, fontWeight: "900", paddingLeft: 12 },

  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
});
