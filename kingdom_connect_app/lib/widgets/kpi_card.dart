import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// One headline number on the dashboard.
class KpiCard extends StatelessWidget {
  const KpiCard({
    super.key,
    required this.label,
    required this.value,
    required this.icon,
    this.detail,
    this.detailColor,
    this.onTap,
  });

  final String label;
  final String value;
  final IconData icon;
  final String? detail;
  final Color? detailColor;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final c = Theme.of(context).colorScheme;
    final t = Theme.of(context).textTheme;
    return Semantics(
      label: '$label: $value${detail == null ? '' : ', $detail'}',
      button: onTap != null,
      excludeSemantics: true,
      child: Card(
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Container(
            decoration: const BoxDecoration(border: Border(left: BorderSide(color: KC.gold, width: 4))),
            padding: const EdgeInsets.all(KC.s4 + KC.s1),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Expanded(child: Text(label.toUpperCase(), style: t.labelSmall?.copyWith(color: c.onSurfaceVariant))),
                Icon(icon, size: 20, color: c.primary),
              ]),
              const SizedBox(height: KC.s3),
              FittedBox(
                fit: BoxFit.scaleDown,
                alignment: Alignment.centerLeft,
                child: Text(value, style: t.headlineMedium?.copyWith(fontWeight: FontWeight.w800, color: c.primary)),
              ),
              const SizedBox(height: KC.s1),
              Text(detail ?? ' ',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: t.bodySmall?.copyWith(color: detailColor ?? c.onSurfaceVariant, fontWeight: FontWeight.w600)),
            ]),
          ),
        ),
      ),
    );
  }
}
