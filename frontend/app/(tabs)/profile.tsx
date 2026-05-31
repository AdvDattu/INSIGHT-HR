import React, { useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { Button, Card } from "@/src/components/UI";
import { useAuth } from "@/src/store/auth";
import { colors, radius, spacing } from "@/src/theme/colors";

function Row({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string | null;
}) {
  return (
    <View style={rowStyles.row}>
      <View style={rowStyles.iconWrap}>
        <Ionicons name={icon} size={18} color={colors.textSecondary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={rowStyles.label}>{label}</Text>
        <Text style={rowStyles.value} numberOfLines={2}>
          {value || "—"}
        </Text>
      </View>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomColor: colors.borderLight,
    borderBottomWidth: 1,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.inputBg,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.textMuted,
    marginBottom: 2,
  },
  value: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textPrimary,
  },
});

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { employee, credentials, signOut } = useAuth();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  const initials = (() => {
    const name = employee?.employee_name || "";
    const parts = name.trim().split(/\s+/);
    return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "E";
  })();

  const handleLogout = () => {
    const doLogout = async () => {
      setSigningOut(true);
      await signOut();
      router.replace("/login");
    };
    if (Platform.OS === "web") {
      doLogout();
    } else {
      Alert.alert(
        "Log out?",
        "You'll need to sign in again to access your data.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Log out", style: "destructive", onPress: doLogout },
        ],
      );
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 12 },
        ]}
      >
        <View style={styles.headerRow}>
          <Text style={styles.kicker}>Account</Text>
          <Text style={styles.title}>Profile</Text>
        </View>

        <Card style={styles.heroCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.name}>{employee?.employee_name || "—"}</Text>
          {!!employee?.designation && (
            <Text style={styles.designation}>{employee.designation}</Text>
          )}
          <View style={styles.idChip}>
            <Ionicons name="card-outline" size={12} color={colors.textSecondary} />
            <Text style={styles.idText}>{employee?.name || "—"}</Text>
          </View>
        </Card>

        <Text style={styles.sectionLabel}>Personal Details</Text>
        <Card>
          <Row
            icon="person-outline"
            label="Full Name"
            value={employee?.employee_name}
          />
          <Row icon="mail-outline" label="Work Email" value={employee?.user_id} />
          <Row
            icon="call-outline"
            label="Mobile"
            value={employee?.cell_number}
          />
        </Card>

        <Text style={styles.sectionLabel}>Company Details</Text>
        <Card>
          <Row
            icon="briefcase-outline"
            label="Department"
            value={employee?.department}
          />
          <Row
            icon="ribbon-outline"
            label="Designation"
            value={employee?.designation}
          />
          <Row
            icon="calendar-outline"
            label="Date of Joining"
            value={employee?.date_of_joining}
          />
          <Row
            icon="business-outline"
            label="Company"
            value={employee?.company}
          />
        </Card>

        <Text style={styles.sectionLabel}>Connection</Text>
        <Card>
          <Row icon="globe-outline" label="ERPNext URL" value={credentials?.baseUrl} />
        </Card>

        <View style={{ marginTop: spacing.xl }}>
          <Button
            testID="logout-button"
            label="Log Out"
            variant="destructive"
            onPress={handleLogout}
            loading={signingOut}
            size="lg"
            fullWidth
            icon={
              <Ionicons name="log-out-outline" size={18} color={colors.primaryForeground} />
            }
          />
        </View>

        <TouchableOpacity
          style={styles.helpRow}
          onPress={() =>
            Alert.alert(
              "Help",
              "If your data isn't loading correctly, make sure your ERPNext user is linked to an Employee record and that your API key has the right permissions.",
            )
          }
        >
          <Ionicons
            name="help-circle-outline"
            size={16}
            color={colors.textMuted}
          />
          <Text style={styles.helpText}>Need help?</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  headerRow: {
    marginBottom: spacing.lg,
  },
  kicker: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  heroCard: {
    alignItems: "center",
    paddingVertical: spacing.xl,
    marginBottom: spacing.base,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  avatarText: {
    color: colors.primaryForeground,
    fontWeight: "800",
    fontSize: 28,
    letterSpacing: 1,
  },
  name: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.textPrimary,
    textAlign: "center",
    letterSpacing: -0.3,
  },
  designation: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  idChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.inputBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    marginTop: 10,
  },
  idText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: "600",
    marginLeft: 6,
    letterSpacing: 0.3,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.textMuted,
    marginTop: spacing.lg,
    marginBottom: 8,
    paddingLeft: 4,
  },
  helpRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.lg,
  },
  helpText: {
    color: colors.textMuted,
    fontSize: 13,
    marginLeft: 6,
  },
});
