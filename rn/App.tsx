import React, { useEffect } from "react";
import { NativeModules, SafeAreaView, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";

type NativeShell = {
  h5URL?: string;
  mountH5?: () => void;
};

const Native = NativeModules.YoohooNative as NativeShell | undefined;

export default function App() {
  const h5 = Native?.h5URL || (global as { __YOOHOO__?: { h5URL?: string } }).__YOOHOO__?.h5URL || "";

  useEffect(() => {
    Native?.mountH5?.();
  }, []);

  if (!h5) {
    return <SafeAreaView style={styles.fill} />;
  }

  return (
    <SafeAreaView style={styles.fill}>
      <WebView
        source={{ uri: h5 }}
        originWhitelist={["*"]}
        allowingReadAccessToURL={h5}
        allowFileAccess
        allowFileAccessFromFileURLs
        allowUniversalAccessFromFileURLs
        javaScriptEnabled
        mediaPlaybackRequiresUserAction={false}
        onMessage={(event) => {
          NativeModules.YoohooNative?.onH5Message?.(event.nativeEvent.data);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#82C4F9" }
});
