import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../core/api.dart';
import '../core/auth.dart';
import '../core/theme.dart';

String iqd(num n) => '${NumberFormat('#,###').format(n)} د.ع';

const markLabels = {'present': 'حاضر', 'absent': 'غائب', 'late': 'متأخر', 'early': 'خروج مبكر'};
const markColors = {
  'present': ManarahColors.success,
  'absent': ManarahColors.danger,
  'late': ManarahColors.warning,
  'early': ManarahColors.info,
};

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});
  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  int _tab = 0;

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).value;
    if (user == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    final isTeacher = user.role == 'TEACHER';
    final tabs = [
      if (isTeacher) const _TeacherAttendanceTab() else _MainTab(user: user),
      const _NotificationsTab(),
    ];

    return Scaffold(
      appBar: AppBar(
        title: Text('أهلاً، ${user.name.split(' ').first} 👋'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: 'تسجيل الخروج',
            onPressed: () async {
              await ref.read(authProvider.notifier).logout();
              if (context.mounted) context.go('/login');
            },
          ),
        ],
      ),
      body: tabs[_tab],
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tab,
        onDestinationSelected: (i) {
          HapticFeedback.selectionClick();
          setState(() => _tab = i);
        },
        destinations: [
          NavigationDestination(
            icon: Icon(isTeacher ? Icons.checklist : Icons.home_outlined),
            label: isTeacher ? 'التحضير' : 'الرئيسية',
          ),
          const NavigationDestination(icon: Icon(Icons.notifications_outlined), label: 'الإشعارات'),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------- الرئيسية (Parent/Student/غيرهما)
class _MainTab extends StatefulWidget {
  final AuthUser user;
  const _MainTab({required this.user});
  @override
  State<_MainTab> createState() => _MainTabState();
}

class _MainTabState extends State<_MainTab> {
  Map<String, dynamic>? _data;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await ApiClient.instance.dio.get('/dashboard');
      if (mounted) setState(() => _data = res.data as Map<String, dynamic>);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    final wards = (_data?['wards'] as List?)?.cast<Map<String, dynamic>>();

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (wards != null)
            ...wards.map((w) => _WardCard(ward: w))
          else
            Card(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Text(
                  'أهلاً بك في منارة. لوحة دورك الكاملة متاحة على الويب — '
                  'هنا تصلك الإشعارات والتعاميم فور صدورها.',
                  style: Theme.of(context).textTheme.bodyLarge,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

// بطاقة الابن — حضور اليوم فورًا + الرصيد + آخر نتيجة (أهم شاشة تجاريًا)
class _WardCard extends StatelessWidget {
  final Map<String, dynamic> ward;
  const _WardCard({required this.ward});

  @override
  Widget build(BuildContext context) {
    final mark = ward['todayMark'] as String?;
    final balance = (ward['balance'] as num?) ?? 0;
    final results = (ward['recentResults'] as List?)?.cast<Map<String, dynamic>>() ?? [];

    return Card(
      margin: const EdgeInsets.only(bottom: 14),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                CircleAvatar(
                  backgroundColor: ManarahColors.brandSoft,
                  child: Text((ward['name'] as String).characters.first,
                      style: const TextStyle(color: ManarahColors.brand, fontWeight: FontWeight.bold)),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(ward['name'] as String,
                          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                      Text(ward['section'] as String? ?? 'بلا شعبة',
                          style: TextStyle(color: Colors.grey[600], fontSize: 12)),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: (markColors[mark] ?? Colors.grey).withValues(alpha: .12),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    mark != null ? 'اليوم: ${markLabels[mark]}' : 'لم يُسجَّل بعد',
                    style: TextStyle(color: markColors[mark] ?? Colors.grey[700], fontWeight: FontWeight.w700, fontSize: 12),
                  ),
                ),
              ],
            ),
            const Divider(height: 24),
            Row(
              children: [
                Expanded(
                  child: _Stat(
                    label: 'الرصيد المتبقي',
                    value: balance > 0 ? iqd(balance) : 'مسدد ✓',
                    color: balance > 0 ? ManarahColors.danger : ManarahColors.success,
                  ),
                ),
                Expanded(
                  child: _Stat(
                    label: 'آخر نتيجة',
                    value: results.isNotEmpty ? '${results.first['total']}/100 — ${results.first['grade']}' : '—',
                    color: ManarahColors.brand,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  const _Stat({required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: TextStyle(color: Colors.grey[600], fontSize: 12)),
          Text(value, style: TextStyle(color: color, fontWeight: FontWeight.w800, fontSize: 15)),
        ],
      );
}

// ---------------------------------------------------------------- تحضير المعلم (سريع جدًا)
class _TeacherAttendanceTab extends StatefulWidget {
  const _TeacherAttendanceTab();
  @override
  State<_TeacherAttendanceTab> createState() => _TeacherAttendanceTabState();
}

class _TeacherAttendanceTabState extends State<_TeacherAttendanceTab> {
  List<Map<String, dynamic>> _sections = [];
  String? _sectionId;
  List<Map<String, dynamic>> _rows = [];
  bool _loading = true;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _loadSections();
  }

  Future<void> _loadSections() async {
    final res = await ApiClient.instance.dio.get('/sections');
    final sections = (res.data as List)
        .cast<Map<String, dynamic>>()
        .where((s) => (s['studentCount'] as num) > 0)
        .toList();
    setState(() => _sections = sections);
    if (sections.isNotEmpty) await _loadSheet(sections.first['id'] as String);
    setState(() => _loading = false);
  }

  Future<void> _loadSheet(String sectionId) async {
    setState(() {
      _sectionId = sectionId;
      _loading = true;
    });
    final res = await ApiClient.instance.dio.get('/attendance/sheet', queryParameters: {'sectionId': sectionId});
    setState(() {
      _rows = (res.data['rows'] as List).cast<Map<String, dynamic>>();
      _loading = false;
    });
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      final res = await ApiClient.instance.dio.post('/attendance/bulk', data: {
        'sectionId': _sectionId,
        'date': DateFormat('yyyy-MM-dd').format(DateTime.now()),
        'rows': _rows.map((r) => {'studentId': r['studentId'], 'mark': r['mark']}).toList(),
      });
      if (mounted) {
        HapticFeedback.mediumImpact();
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('حُفظ التحضير — ${res.data['absent']} غائب، أُشعر ${res.data['guardiansNotified']} ولي أمر'),
          backgroundColor: ManarahColors.success,
        ));
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content: Text('فشل حفظ التحضير'), backgroundColor: ManarahColors.danger));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  // نقرة واحدة تقلّب العلامة: حاضر → غائب → متأخر → حاضر
  void _cycle(int i) {
    const order = ['present', 'absent', 'late'];
    final cur = order.indexOf(_rows[i]['mark'] as String);
    HapticFeedback.selectionClick();
    setState(() => _rows[i]['mark'] = order[(cur + 1) % order.length]);
  }

  @override
  Widget build(BuildContext context) {
    if (_loading && _sections.isEmpty) return const Center(child: CircularProgressIndicator());

    return Column(
      children: [
        SizedBox(
          height: 56,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            children: _sections
                .map((s) => Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      child: ChoiceChip(
                        label: Text(s['label'] as String),
                        selected: _sectionId == s['id'],
                        onSelected: (_) => _loadSheet(s['id'] as String),
                      ),
                    ))
                .toList(),
          ),
        ),
        Expanded(
          child: _loading
              ? const Center(child: CircularProgressIndicator())
              : ListView.separated(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  itemCount: _rows.length,
                  separatorBuilder: (_, __) => const Divider(height: 1),
                  itemBuilder: (context, i) {
                    final r = _rows[i];
                    final mark = r['mark'] as String;
                    return ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: CircleAvatar(
                        backgroundColor: ManarahColors.brandSoft,
                        child: Text((r['name'] as String).characters.first,
                            style: const TextStyle(color: ManarahColors.brand)),
                      ),
                      title: Text(r['name'] as String),
                      trailing: FilterChip(
                        label: Text(markLabels[mark]!,
                            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
                        backgroundColor: markColors[mark],
                        onSelected: (_) => _cycle(i),
                      ),
                      onTap: () => _cycle(i),
                    );
                  },
                ),
        ),
        SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: FilledButton.icon(
              onPressed: _saving || _rows.isEmpty ? null : _save,
              icon: _saving
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Icon(Icons.save),
              label: Text(_saving ? 'جارٍ الحفظ...' : 'حفظ التحضير (${_rows.where((r) => r['mark'] == 'absent').length} غائب)'),
              style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52)),
            ),
          ),
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------- الإشعارات
class _NotificationsTab extends StatefulWidget {
  const _NotificationsTab();
  @override
  State<_NotificationsTab> createState() => _NotificationsTabState();
}

class _NotificationsTabState extends State<_NotificationsTab> {
  List<Map<String, dynamic>> _items = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await ApiClient.instance.dio.get('/notifications');
      if (mounted) setState(() => _items = (res.data['items'] as List).cast<Map<String, dynamic>>());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_items.isEmpty) {
      return const Center(child: Text('لا إشعارات بعد.'));
    }
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: _items.length,
        separatorBuilder: (_, __) => const SizedBox(height: 8),
        itemBuilder: (context, i) {
          final n = _items[i];
          final unread = n['readAt'] == null;
          return Card(
            child: ListTile(
              leading: Icon(
                n['kind'] == 'absence'
                    ? Icons.person_off_outlined
                    : n['kind'] == 'payment'
                        ? Icons.receipt_long_outlined
                        : Icons.campaign_outlined,
                color: unread ? ManarahColors.brand : Colors.grey,
              ),
              title: Text(n['title'] as String,
                  style: TextStyle(fontWeight: unread ? FontWeight.w800 : FontWeight.w500)),
              subtitle: Text(n['body'] as String),
              trailing: unread ? const Icon(Icons.circle, size: 10, color: ManarahColors.brand) : null,
              onTap: unread
                  ? () async {
                      await ApiClient.instance.dio.patch('/notifications/${n['id']}/read');
                      _load();
                    }
                  : null,
            ),
          );
        },
      ),
    );
  }
}
