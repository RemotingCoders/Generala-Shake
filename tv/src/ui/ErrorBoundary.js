// Last-resort error boundary around the whole app (Vega validation checklist: "Error boundaries implemented").
// Without it an uncaught render error leaves the TV on a blank/red screen; with it the user sees a message
// and a focusable button that remounts the app. Plain RN primitives only, so it cannot depend on the code that failed.
import React from 'react';
import { Pressable, Text, View } from 'react-native';

export class ErrorBoundary extends React.Component {
  state = { error: null, focused: false, generation: 0 };

  static getDerivedStateFromError(error){ return { error }; }

  componentDidCatch(error, info){
    console.error('[generala] uncaught render error', String(error), info && info.componentStack);
  }

  restart = () => this.setState(s => ({ error: null, generation: s.generation + 1 }));

  render(){
    const { error, focused, generation } = this.state;
    if (!error) return <React.Fragment key={generation}>{this.props.children}</React.Fragment>;
    return (
      <View style={{ flex: 1, backgroundColor: '#1E1715', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
        <Text style={{ color: '#FFF3DF', fontSize: 42, fontWeight: '700', marginBottom: 16 }}>Ups… / Oops…</Text>
        <Text style={{ color: '#D9C7B0', fontSize: 26, textAlign: 'center', marginBottom: 40 }}>
          Algo salió mal en la app. / Something went wrong in the app.
        </Text>
        <Pressable
          accessibilityRole="button"
          hasTVPreferredFocus
          onPress={this.restart}
          onFocus={() => this.setState({ focused: true })}
          onBlur={() => this.setState({ focused: false })}
          style={{ backgroundColor: '#FFD166', borderRadius: 999, paddingVertical: 20, paddingHorizontal: 48, borderWidth: 6, borderColor: focused ? '#FFF3DF' : 'transparent' }}>
          <Text style={{ color: '#1E1715', fontSize: 28, fontWeight: '800' }}>Reiniciar / Restart</Text>
        </Pressable>
        <Text style={{ color: '#8F7D6A', fontSize: 16, marginTop: 40 }} numberOfLines={2}>{String(error && error.message || error)}</Text>
      </View>
    );
  }
}
