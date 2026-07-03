// ثيم منارة — مبني من نفس design tokens الويب (theme.css)
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

abstract class ManarahColors {
  static const brand = Color(0xFF0B6E63);
  static const brandStrong = Color(0xFF095A51);
  static const brandSoft = Color(0xFFE7F2F0);
  static const accent = Color(0xFFD9A441);
  static const success = Color(0xFF16A34A);
  static const warning = Color(0xFFD97706);
  static const info = Color(0xFF0284C7);
  static const danger = Color(0xFFDC2626);
}

ThemeData manarahTheme({Brightness brightness = Brightness.light}) {
  final scheme = ColorScheme.fromSeed(
    seedColor: ManarahColors.brand,
    primary: ManarahColors.brand,
    brightness: brightness,
  );
  final base = ThemeData(colorScheme: scheme, useMaterial3: true);
  return base.copyWith(
    textTheme: GoogleFonts.cairoTextTheme(base.textTheme),
    appBarTheme: AppBarTheme(
      backgroundColor: ManarahColors.brand,
      foregroundColor: Colors.white,
      titleTextStyle: GoogleFonts.cairo(fontSize: 18, fontWeight: FontWeight.w700, color: Colors.white),
    ),
    cardTheme: base.cardTheme.copyWith(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      elevation: 0.5,
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: ManarahColors.brand,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 20),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
    ),
  );
}
