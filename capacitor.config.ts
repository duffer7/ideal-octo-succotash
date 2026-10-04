import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.example.kidsgame',
  appName: 'Sky Bounty',
  webDir: 'dist',
  bundledWebRuntime: false,
  // Настройки для игр: полный экран, ландшафтная ориентация, отключение overscroll
  android: {
    allowMixedContent: false,
  },
  ios: {
    contentInset: 'never',
  },
  server: {
    androidScheme: 'https',
  },
};

export default config;

