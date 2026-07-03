// عميل API — dio + تخزين آمن للـ tokens + تجديد تلقائي عند 401
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

// محاكي أندرويد يصل للمضيف عبر 10.0.2.2 — للإنتاج مرَّر --dart-define=API_URL=https://api.manarah.io/api
const apiUrl = String.fromEnvironment('API_URL', defaultValue: 'http://10.0.2.2:3001/api');

class ApiClient {
  ApiClient._();
  static final ApiClient instance = ApiClient._();

  final _storage = const FlutterSecureStorage();
  late final Dio dio = _build();

  String? _accessToken;

  Dio _build() {
    final d = Dio(BaseOptions(baseUrl: apiUrl, connectTimeout: const Duration(seconds: 10)));
    d.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) {
        if (_accessToken != null) {
          options.headers['Authorization'] = 'Bearer $_accessToken';
        }
        handler.next(options);
      },
      onError: (e, handler) async {
        // تجديد تلقائي مرة واحدة ثم إعادة الطلب
        if (e.response?.statusCode == 401 && e.requestOptions.extra['retried'] != true) {
          final ok = await tryRefresh();
          if (ok) {
            final opts = e.requestOptions..extra['retried'] = true;
            opts.headers['Authorization'] = 'Bearer $_accessToken';
            try {
              return handler.resolve(await dio.fetch(opts));
            } catch (_) {}
          }
        }
        handler.next(e);
      },
    ));
    return d;
  }

  Future<Map<String, dynamic>> login(String email, String password) async {
    final res = await dio.post('/auth/login', data: {'email': email, 'password': password});
    _accessToken = res.data['accessToken'] as String;
    await _storage.write(key: 'refreshToken', value: res.data['refreshToken'] as String);
    await _storage.write(key: 'email', value: email);
    return res.data['user'] as Map<String, dynamic>;
  }

  Future<bool> tryRefresh() async {
    final refresh = await _storage.read(key: 'refreshToken');
    if (refresh == null) return false;
    try {
      final res = await Dio(BaseOptions(baseUrl: apiUrl))
          .post('/auth/refresh', data: {'refreshToken': refresh});
      _accessToken = res.data['accessToken'] as String;
      await _storage.write(key: 'refreshToken', value: res.data['refreshToken'] as String);
      return true;
    } catch (_) {
      await _storage.delete(key: 'refreshToken');
      return false;
    }
  }

  Future<Map<String, dynamic>?> me() async {
    try {
      final res = await dio.get('/auth/me');
      return res.data as Map<String, dynamic>;
    } catch (_) {
      return null;
    }
  }

  Future<bool> hasStoredSession() async => (await _storage.read(key: 'refreshToken')) != null;

  Future<String?> storedEmail() => _storage.read(key: 'email');

  Future<void> logout() async {
    final refresh = await _storage.read(key: 'refreshToken');
    try {
      await dio.post('/auth/logout', data: {'refreshToken': refresh});
    } catch (_) {}
    _accessToken = null;
    await _storage.delete(key: 'refreshToken');
  }
}
