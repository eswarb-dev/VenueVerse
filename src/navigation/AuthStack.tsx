import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ForgotPasswordScreen } from '@/screens/auth/ForgotPasswordScreen';
import { LoginScreen } from '@/screens/auth/LoginScreen';
import { APP_NAME } from '@/constants/app';
import { AuthStackParamList } from '@/navigation/types';
import { defaultScreenOptions } from '@/navigation/screenOptions';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthStack() {
  return (
    <Stack.Navigator screenOptions={defaultScreenOptions}>
      <Stack.Screen name="Login" component={LoginScreen} options={{ title: APP_NAME }} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ title: 'Reset Password' }} />
    </Stack.Navigator>
  );
}
