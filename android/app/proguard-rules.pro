# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# React Native / Hermes / Expo bridge entry points used from native and JS.
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class expo.modules.** { *; }

# react-native-reanimated / gesture-handler
-keep class com.swmansion.reanimated.** { *; }
-keep class com.swmansion.gesturehandler.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# Firebase Cloud Messaging notification dispatch.
-keep class com.google.firebase.messaging.** { *; }
