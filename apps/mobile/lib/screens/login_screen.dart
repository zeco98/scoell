import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../core/api.dart';
import '../core/auth.dart';
import '../core/theme.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});
  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _form = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _loading = false;
  bool _obscure = true;
  bool _canBiometric = false;

  @override
  void initState() {
    super.initState();
    // بصمة متاحة فقط بعد أول دخول ناجح (جلسة مخزنة في التخزين الآمن)
    ApiClient.instance.hasStoredSession().then((v) {
      if (mounted) setState(() => _canBiometric = v);
      if (v) ApiClient.instance.storedEmail().then((e) => _email.text = e ?? '');
    });
  }

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) return;
    setState(() => _loading = true);
    try {
      await ref.read(authProvider.notifier).login(_email.text.trim(), _password.text);
      if (mounted) context.go('/home');
    } catch (e) {
      _showError('بيانات الدخول غير صحيحة أو الخادم غير متاح');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _biometric() async {
    setState(() => _loading = true);
    try {
      final u = await ref.read(authProvider.notifier).biometricLogin();
      if (u != null && mounted) {
        context.go('/home');
      } else {
        _showError('تعذر الدخول بالبصمة — ادخل بكلمة المرور');
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _showError(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(msg), backgroundColor: ManarahColors.danger));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Form(
              key: _form,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // شعار منارة
                  Container(
                    width: 84,
                    height: 84,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: ManarahColors.brand,
                      borderRadius: BorderRadius.circular(22),
                    ),
                    child: const Icon(Icons.account_balance, color: Colors.white, size: 44),
                  ),
                  const SizedBox(height: 16),
                  Text('منارة',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                          fontWeight: FontWeight.w800, color: ManarahColors.brandStrong)),
                  Text('منصة إدارة المدارس والمعاهد',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Colors.grey[600])),
                  const SizedBox(height: 32),
                  TextFormField(
                    controller: _email,
                    textDirection: TextDirection.ltr,
                    keyboardType: TextInputType.emailAddress,
                    decoration: const InputDecoration(labelText: 'البريد الإلكتروني', prefixIcon: Icon(Icons.mail_outline)),
                    validator: (v) => v != null && v.contains('@') ? null : 'بريد إلكتروني غير صالح',
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _password,
                    obscureText: _obscure,
                    textDirection: TextDirection.ltr,
                    decoration: InputDecoration(
                      labelText: 'كلمة المرور',
                      prefixIcon: const Icon(Icons.lock_outline),
                      suffixIcon: IconButton(
                        icon: Icon(_obscure ? Icons.visibility_off : Icons.visibility),
                        onPressed: () => setState(() => _obscure = !_obscure),
                      ),
                    ),
                    validator: (v) => v != null && v.length >= 8 ? null : 'كلمة المرور 8 أحرف على الأقل',
                    onFieldSubmitted: (_) => _submit(),
                  ),
                  const SizedBox(height: 20),
                  FilledButton.icon(
                    onPressed: _loading ? null : _submit,
                    icon: _loading
                        ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : const Icon(Icons.login),
                    label: Text(_loading ? 'جارٍ التحقق...' : 'دخول'),
                  ),
                  if (_canBiometric) ...[
                    const SizedBox(height: 12),
                    OutlinedButton.icon(
                      onPressed: _loading ? null : _biometric,
                      icon: const Icon(Icons.fingerprint, color: ManarahColors.brand),
                      label: const Text('الدخول بالبصمة'),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
