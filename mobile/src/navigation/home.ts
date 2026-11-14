import { CommonActions, type NavigationAction } from 'expo-router/react-navigation';

/** Reset the root, including a previously selected My Notes tab. Never push another home. */
export function homeAction(rootKey: string) {
  return {
    ...CommonActions.reset({
      index: 0,
      routes: [{ name: '(browse)', state: { index: 0, routes: [{ name: 'index' }] } }],
    }),
    target: rootKey,
    nubiIntent: 'home' as const,
  };
}

/** The intent travels with the action when removal guards defer and replay it. */
export function isHomeAction(action: NavigationAction & { nubiIntent?: unknown }) {
  return action.type === 'RESET' && action.nubiIntent === 'home';
}
