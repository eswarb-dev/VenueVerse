import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AppStack } from '@/navigation/AppStack';
import { AuthStack } from '@/navigation/AuthStack';
import { navigationRef } from '@/navigation/navigationRef';
import { RootStackParamList } from '@/navigation/types';
import { AuthLoadingScreen } from '@/screens/auth/AuthLoadingScreen';
import { useAuth } from '@/store/AuthContext';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { session, loading } = useAuth();
  const isAuthenticated = Boolean(session);

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {loading ? (
          <Stack.Screen name="AuthLoading" component={AuthLoadingScreen} />
        ) : !isAuthenticated ? (
          <Stack.Screen name="AuthStack" component={AuthStack} />
        ) : (
          <Stack.Screen name="AppStack" component={AppStack} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
