import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ForgotPasswordScreen } from '@/screens/auth/ForgotPasswordScreen';
import { GetStartedScreen } from '@/screens/auth/GetStartedScreen';
import { LoginScreen } from '@/screens/auth/LoginScreen';
import { ResetPasswordScreen } from '@/screens/auth/ResetPasswordScreen';
import { StaffAccountCreationScreen } from '@/screens/auth/StaffAccountCreationScreen';
import { VerifyResetOtpScreen } from '@/screens/auth/VerifyResetOtpScreen';
import { AuthStackParamList } from '@/navigation/types';
import { defaultScreenOptions } from '@/navigation/screenOptions';

const Stack = createNativeStackNavigator<AuthStackParamList>();

type AuthStackProps = {
  initialRouteName?: keyof AuthStackParamList;
};

export function AuthStack({ initialRouteName = 'GetStarted' }: AuthStackProps) {
  return (
    <Stack.Navigator initialRouteName={initialRouteName} screenOptions={defaultScreenOptions}>
      <Stack.Screen name="GetStarted" component={GetStartedScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      <Stack.Screen name="StaffAccountCreation" component={StaffAccountCreationScreen} options={{ title: 'Create Staff Account' }} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ title: 'Reset Password' }} />
      <Stack.Screen name="VerifyResetOtp" component={VerifyResetOtpScreen} options={{ title: 'Verify Code' }} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} options={{ title: 'Set New Password' }} />
    </Stack.Navigator>
  );
}
