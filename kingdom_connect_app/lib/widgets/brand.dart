import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// The Kingdom Connect mark (crown, candle and open Bible).
class BrandMark extends StatelessWidget {
  const BrandMark({super.key, this.size = 48});

  final double size;

  @override
  Widget build(BuildContext context) => Image.asset(
        'assets/brand/kc-mark.png',
        height: size,
        semanticLabel: 'Kingdom Connect',
        errorBuilder: (_, _, _) => Icon(Icons.church, size: size, color: KC.gold),
      );
}

/// The mark, "Kingdom Connect" and the church's name.
class BrandTitle extends StatelessWidget {
  const BrandTitle({super.key, required this.church, this.compact = false});

  final String church;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return Row(mainAxisSize: MainAxisSize.min, children: [
      BrandMark(size: compact ? 30 : 40),
      const SizedBox(width: KC.s3),
      Flexible(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
          Text('KINGDOM CONNECT',
              overflow: TextOverflow.ellipsis,
              style: t.labelLarge?.copyWith(letterSpacing: 1.2, fontWeight: FontWeight.w800, color: KC.gold)),
          if (church.isNotEmpty && !compact)
            Text(church, overflow: TextOverflow.ellipsis, style: t.bodySmall),
        ]),
      ),
    ]);
  }
}
