import { Tabs, Redirect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Platform } from "react-native";
import React from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/store/auth";
import { colors } from "@/src/theme/colors";

type IconName = keyof typeof Ionicons.glyphMap;

function makeIcon(focusedName: IconName, blurName: IconName) {
  // eslint-disable-next-line react/display-name
  return ({ color, focused }: { color: string; focused: boolean }) => (
    <Ionicons
      name={focused ? focusedName : blurName}
      size={22}
      color={color}
    />
  );
}

const DashboardIcon = makeIcon("home", "home-outline");
const LeavesIcon = makeIcon("calendar", "calendar-outline");
const PayslipsIcon = makeIcon("document-text", "document-text-outline");
const ProfileIcon = makeIcon("person-circle", "person-circle-outline");

export default function TabsLayout() {
  const { loading, credentials, employee } = useAuth();
  const insets = useSafeAreaInsets();

  if (loading) return null;
  if (!credentials || !employee) return <Redirect href="/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          letterSpacing: 0.3,
        },
        tabBarStyle: {
          backgroundColor: colors.navigationBg,
          borderTopColor: colors.borderLight,
          borderTopWidth: 1,
          // Dynamically adjust height and padding for Android navigation bar
          height: Platform.OS === "ios" ? 88 : 64 + insets.bottom,
          paddingTop: 6,
          paddingBottom: Platform.OS === "ios" ? 28 : Math.max(8, insets.bottom),
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarTestID: "nav-dashboard",
          tabBarIcon: DashboardIcon,
        }}
      />
      <Tabs.Screen
        name="leave"
        options={{
          title: "Leaves",
          tabBarTestID: "nav-leaves",
          tabBarIcon: LeavesIcon,
        }}
      />
      <Tabs.Screen
        name="payslips"
        options={{
          title: "Payslips",
          tabBarTestID: "nav-payslips",
          tabBarIcon: PayslipsIcon,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarTestID: "nav-profile",
          tabBarIcon: ProfileIcon,
        }}
      />
    </Tabs>
  );
}
