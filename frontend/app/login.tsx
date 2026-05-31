import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, Input } from "@/src/components/UI";
import { useAuth } from "@/src/store/auth";
import { useToast } from "@/src/components/Toast";
import { ERPNext, ERPNextApiError } from "@/src/services/erpnext";
import { colors, radius, spacing } from "@/src/theme/colors";
import { AuthMode, ERPNextCredentials } from "@/src/types/erpnext";

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();
  const toast = useToast();

  const [mode, setMode] = useState<AuthMode>("token");

  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [usr, setUsr] = useState("");
  const [pwd, setPwd] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    setError(null);
    if (!baseUrl.trim()) {
      setError("ERPNext URL is required");
      return;
    }
    if (mode === "token") {
      if (!apiKey.trim() || !apiSecret.trim()) {
        setError("API Key and API Secret are required");
        return;
      }
    } else {
      if (!usr.trim() || !pwd) {
        setError("Email and password are required");
        return;
      }
    }

    setLoading(true);
    try {
      const creds: ERPNextCredentials =
        mode === "token"
          ? {
              baseUrl: baseUrl.trim(),
              authMode: "token",
              apiKey: apiKey.trim(),
              apiSecret: apiSecret.trim(),
            }
          : {
              baseUrl: baseUrl.trim(),
              authMode: "password",
              usr: usr.trim(),
              pwd,
            };

      // Validate credentials & get logged-in user email
      const userEmail = await ERPNext.validateCredentials(creds);

      // Fetch Employee record using the user_id (email)
      const employee = await ERPNext.getEmployeeByUserId(creds, userEmail);

      if (!employee) {
        setError(
          `No Employee record linked to ${userEmail}. Please contact HR.`,
        );
        setLoading(false);
        return;
      }

      await signIn(creds, employee);
      toast.show(`Welcome back, ${employee.employee_name}`, "success");
      router.replace("/(tabs)");
    } catch (e: any) {
      let msg: string;
      if (e instanceof ERPNextApiError) {
        if (e.status === 401 || e.status === 403) {
          const detail =
            e.message && e.message !== "Request failed"
              ? `\n\nServer said: ${e.message.slice(0, 240)}`
              : "";
          msg =
            mode === "token"
              ? `Authentication rejected by ERPNext (HTTP ${e.status}).${detail}\n\nCheck the API Key & Secret in your ERPNext User → API Access page (re-generate keys if unsure).`
              : `Incorrect email or password (HTTP ${e.status}).${detail}`;
        } else if (e.status === 404) {
          msg = `Endpoint not found at ${baseUrl.trim()}. Make sure the URL points to your ERPNext root (e.g. https://erp.yourcompany.com) and does not include any path.`;
        } else {
          msg = e.message || `Request failed (HTTP ${e.status})`;
        }
      } else {
        msg = e?.message || "Something went wrong. Please try again.";
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brandRow}>
          <View style={styles.logoMark}>
            <Text style={styles.logoText}>ESS</Text>
          </View>
          <Text style={styles.brandLabel}>Employee Self-Service</Text>
        </View>

        <Text style={styles.title}>Sign in to your{"\n"}workspace</Text>
        <Text style={styles.subtitle}>
          Connect to your ERPNext instance with either API credentials or your
          email & password.
        </Text>

        {/* Mode toggle */}
        <View style={styles.modeToggle}>
          <TouchableOpacity
            testID="mode-token"
            style={[
              styles.modeBtn,
              mode === "token" && styles.modeBtnActive,
            ]}
            onPress={() => {
              setMode("token");
              setError(null);
            }}
            activeOpacity={0.85}
          >
            <Text
              style={[
                styles.modeLabel,
                mode === "token" && styles.modeLabelActive,
              ]}
            >
              API Token
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="mode-password"
            style={[
              styles.modeBtn,
              mode === "password" && styles.modeBtnActive,
            ]}
            onPress={() => {
              setMode("password");
              setError(null);
            }}
            activeOpacity={0.85}
          >
            <Text
              style={[
                styles.modeLabel,
                mode === "password" && styles.modeLabelActive,
              ]}
            >
              Email & Password
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.form}>
          <Input
            testID="erpnext-url-input"
            label="ERPNext URL"
            placeholder="https://yourcompany.erpnext.com"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            value={baseUrl}
            onChangeText={setBaseUrl}
          />

          {mode === "token" ? (
            <>
              <Input
                testID="api-key-input"
                label="API Key"
                placeholder="Your ERPNext API Key"
                autoCapitalize="none"
                autoCorrect={false}
                value={apiKey}
                onChangeText={setApiKey}
              />
              <Input
                testID="api-secret-input"
                label="API Secret"
                placeholder="Your ERPNext API Secret"
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
                value={apiSecret}
                onChangeText={setApiSecret}
              />
            </>
          ) : (
            <>
              <Input
                testID="email-input"
                label="Email"
                placeholder="you@company.com"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                value={usr}
                onChangeText={setUsr}
              />
              <Input
                testID="password-input"
                label="Password"
                placeholder="Your ERPNext password"
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
                value={pwd}
                onChangeText={setPwd}
              />
            </>
          )}

          {error ? (
            <View style={styles.errorBox} testID="login-error">
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Button
            testID="login-submit-button"
            label="Sign In"
            size="lg"
            loading={loading}
            onPress={onSubmit}
            fullWidth
          />
        </View>

        <View style={styles.helpBox}>
          <Text style={styles.helpLabel}>
            {mode === "token"
              ? "How to get your API credentials"
              : "About email & password login"}
          </Text>
          <Text style={styles.helpText}>
            {mode === "token" ? (
              <>
                In ERPNext, go to your User profile → API Access → click{" "}
                <Text style={{ fontWeight: "700" }}>Generate Keys</Text>. Copy
                the API Key and API Secret shown. The Secret is shown only
                once.
              </>
            ) : (
              <>
                Use the same email and password you use to log into ERPNext.
                Your credentials are stored securely on this device only and
                sent to your ERPNext instance via HTTPS Basic Auth on each
                request.
              </>
            )}
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: spacing.lg,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.xxl,
  },
  logoMark: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  logoText: {
    color: colors.primaryForeground,
    fontWeight: "800",
    fontSize: 14,
    letterSpacing: 1,
  },
  brandLabel: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.5,
    color: colors.textSecondary,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: colors.textPrimary,
    letterSpacing: -0.5,
    lineHeight: 38,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  modeToggle: {
    flexDirection: "row",
    backgroundColor: colors.inputBg,
    padding: 4,
    borderRadius: radius.full,
    marginBottom: spacing.lg,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: radius.full,
  },
  modeBtnActive: {
    backgroundColor: colors.primary,
  },
  modeLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  modeLabelActive: {
    color: colors.primaryForeground,
  },
  form: {
    marginBottom: spacing.xl,
  },
  errorBox: {
    backgroundColor: colors.destructiveBg,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: spacing.base,
  },
  errorText: {
    color: "#991B1B",
    fontSize: 13,
    lineHeight: 18,
  },
  helpBox: {
    marginTop: spacing.xl,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  helpLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.textMuted,
    marginBottom: 8,
  },
  helpText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
});
