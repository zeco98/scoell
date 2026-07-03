// حالة الجلسة — Riverpod
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:local_auth/local_auth.dart';
import 'api.dart';

class AuthUser {
  final String id;
  final String name;
  final String role;
  final String? tenantName;
  const AuthUser({required this.id, required this.name, required this.role, this.tenantName});

  factory AuthUser.fromJson(Map<String, dynamic> j) => AuthUser(
        id: j['id'] as String,
        name: j['name'] as String,
        role: j['role'] as String,
        tenantName: j['tenantName'] as String?,
      );
}

class AuthNotifier extends AsyncNotifier<AuthUser?> {
  @override
  Future<AuthUser?> build() async => null;

  Future<AuthUser> login(String email, String password) async {
    final u = AuthUser.fromJson(await ApiClient.instance.login(email, password));
    state = AsyncData(u);
    return u;
  }

  /// دخول بالبصمة: يتطلب جلسة refresh مخزنة من دخول سابق
  Future<AuthUser?> biometricLogin() async {
    if (!await ApiClient.instance.hasStoredSession()) return null;
    final auth = LocalAuthentication();
    final ok = await auth.authenticate(
      localizedReason: 'ادخل ببصمتك إلى منصة منارة',
      options: const AuthenticationOptions(biometricOnly: false, stickyAuth: true),
    );
    if (!ok) return null;
    if (!await ApiClient.instance.tryRefresh()) return null;
    final me = await ApiClient.instance.me();
    if (me == null) return null;
    final u = AuthUser.fromJson(me);
    state = AsyncData(u);
    return u;
  }

  Future<void> logout() async {
    await ApiClient.instance.logout();
    state = const AsyncData(null);
  }
}

final authProvider = AsyncNotifierProvider<AuthNotifier, AuthUser?>(AuthNotifier.new);
