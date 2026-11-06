import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from './Text';
import { TapArea } from './TapArea';
import { color, layout, textStyles } from './theme';

export function Action({ label, onPress, disabled = false, busy = false, selected, variant = 'quiet', style, containerStyle }:
  { label: string; onPress: () => void; disabled?: boolean; busy?: boolean; selected?: boolean;
    variant?: 'quiet' | 'primary' | 'soft' | 'danger'; style?: StyleProp<ViewStyle>; containerStyle?: StyleProp<ViewStyle> }) {
  const blocked = disabled || busy;
  return <TapArea accessibilityRole={selected === undefined ? 'button' : 'radio'}
    accessibilityState={{ disabled: blocked, ...(selected === undefined ? {} : { checked: selected }), busy }}
    disabled={blocked} onPress={onPress} containerStyle={[styles.container, containerStyle]}
    style={[styles.button, variant === 'primary' && styles.primary, variant === 'soft' && styles.soft,
      selected && styles.selected, blocked && styles.disabled, style]}>
    <Text style={[textStyles.action, variant === 'primary' && styles.lightText, variant === 'danger' && styles.dangerText]}>{label}</Text>
  </TapArea>;
}
const styles = StyleSheet.create({
  container: { maxWidth: '100%' },
  button: { minWidth: layout.touch, minHeight: layout.touch, paddingHorizontal: 12, paddingVertical: 12,
    borderRadius: layout.radius, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'transparent' },
  primary: { backgroundColor: color.ink }, soft: { backgroundColor: color.subtle },
  selected: { backgroundColor: color.selected, borderColor: color.ink }, disabled: { opacity: .45 },
  lightText: { color: color.page }, dangerText: { color: color.accent },
});
