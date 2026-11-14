import type { TextStyle } from 'react-native';

// Native mapping of k-style a5b1955 tokens + approved R3 overrides.
// Original CSS/MIT notice: docs/design/place-messages/vendor/ (kept unchanged).
export const color = {
  ink: '#292929', secondary: '#626262', page: '#FFFFFF', subtle: '#F5F5F3',
  line: '#DDDDDA', accent: '#B45440', selected: '#EAEAE7',
} as const;
export const textStyles = {
  story: { fontSize: 28, lineHeight: 38, fontWeight: '700', color: color.ink },
  heading: { fontSize: 21, lineHeight: 30, fontWeight: '700', color: color.ink },
  body: { fontSize: 17, lineHeight: 29, fontWeight: '400', color: color.ink },
  action: { fontSize: 16, lineHeight: 24, fontWeight: '700', color: color.ink },
  source: { fontSize: 14, lineHeight: 21, fontWeight: '400', color: color.secondary },
} satisfies Record<string, TextStyle>;
export const layout = { gutter: 20, section: 24, large: 32, touch: 48, radius: 12, readingWidth: 640 } as const;
