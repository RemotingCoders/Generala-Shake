import React from 'react';
import { AppRegistry, LogBox } from 'react-native';
import { App } from './src/App';
import { ErrorBoundary } from './src/ui/ErrorBoundary';
import { name as appName } from './app.json';

// Temporary workaround for problem with nested text
// not working currently.
LogBox.ignoreAllLogs();

const Root = () => (
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

AppRegistry.registerComponent(appName, () => Root);
