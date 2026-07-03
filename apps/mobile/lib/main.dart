// منارة — تطبيق الموبايل (Parent / Teacher / Student)
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'core/theme.dart';
import 'screens/login_screen.dart';
import 'screens/home_screen.dart';

void main() => runApp(const ProviderScope(child: ManarahApp()));

final _router = GoRouter(
  initialLocation: '/login',
  routes: [
    GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
    GoRoute(path: '/home', builder: (_, __) => const HomeScreen()),
  ],
);

class ManarahApp extends ConsumerWidget {
  const ManarahApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return MaterialApp.router(
      title: 'منارة',
      debugShowCheckedModeBanner: false,
      theme: manarahTheme(),
      routerConfig: _router,
      // RTL افتراضي — واجهة عربية كاملة
      locale: const Locale('ar'),
      builder: (context, child) =>
          Directionality(textDirection: TextDirection.rtl, child: child!),
    );
  }
}
