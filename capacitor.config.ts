import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rawthermal.app',
  appName: 'Raw Thermal',
  webDir: 'dist',
  android: {
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
    }
  },
  plugins: {
    BluetoothLe: {
      displayStrings: {
        scanning: 'Scanning for printers...',
        cancel: 'Cancel',
        availableDevices: 'Available Printers',
        noDeviceFound: 'No printer found'
      }
    }
  }
};

export default config;
