// اختبار شاشة الدخول: تُعرض الحقول والزر، والتحقق يرفض المدخلات الناقصة
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:manarah_mobile/screens/login_screen.dart';

void main() {
  Widget wrap(Widget child) => ProviderScope(
        child: MaterialApp(
          home: Directionality(textDirection: TextDirection.rtl, child: child),
        ),
      );

  testWidgets('شاشة الدخول تعرض الحقول وزر الدخول', (tester) async {
    await tester.pumpWidget(wrap(const LoginScreen()));
    await tester.pump();

    expect(find.text('منارة'), findsOneWidget);
    expect(find.text('البريد الإلكتروني'), findsOneWidget);
    expect(find.text('كلمة المرور'), findsOneWidget);
    expect(find.text('دخول'), findsOneWidget);
  });

  testWidgets('التحقق يرفض بريدًا غير صالح وكلمة مرور قصيرة', (tester) async {
    await tester.pumpWidget(wrap(const LoginScreen()));
    await tester.pump();

    await tester.enterText(find.byType(TextFormField).first, 'not-an-email');
    await tester.enterText(find.byType(TextFormField).last, '123');
    await tester.tap(find.text('دخول'));
    await tester.pump();

    expect(find.text('بريد إلكتروني غير صالح'), findsOneWidget);
    expect(find.text('كلمة المرور 8 أحرف على الأقل'), findsOneWidget);
  });
}
