import 'package:flutter/material.dart';

/// Displays a single FIX_PROPOSAL (from shared/protocol.md) with colored
/// diff text and Approve / Reject buttons.
///
/// onApprove / onReject are provided by lib/sync/ (colleague's layer) so
/// this widget stays decoupled from the WebSocket plumbing.
class DiffScreen extends StatelessWidget {
  final Map<String, dynamic> proposal;
  final VoidCallback onApprove;
  final VoidCallback onReject;

  const DiffScreen({
    super.key,
    required this.proposal,
    required this.onApprove,
    required this.onReject,
  });

  @override
  Widget build(BuildContext context) {
    final file = proposal['file'] as String? ?? '';
    final diff = proposal['diff'] as String? ?? '';
    final explanation = proposal['explanation'] as String? ?? '';
    final generatedBy = proposal['generated_by'] as String? ?? 'unknown';

    return Scaffold(
      appBar: AppBar(
        title: Text(file.split('/').last),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(20),
          child: Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: Text(
              'via $generatedBy · $file',
              style: const TextStyle(fontSize: 11, color: Colors.white70),
            ),
          ),
        ),
      ),
      body: Column(
        children: [
          if (explanation.isNotEmpty)
            Container(
              width: double.infinity,
              color: Colors.indigo.shade50,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              child: Text(explanation, style: const TextStyle(fontStyle: FontStyle.italic)),
            ),
          Expanded(child: _DiffView(diff: diff)),
          _ApprovalBar(onApprove: onApprove, onReject: onReject),
        ],
      ),
    );
  }
}

class _DiffView extends StatelessWidget {
  final String diff;
  const _DiffView({required this.diff});

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(8),
      child: SelectableText.rich(
        TextSpan(
          children: diff.split('\n').map((line) {
            final Color color;
            if (line.startsWith('+++') || line.startsWith('---')) {
              color = Colors.grey;
            } else if (line.startsWith('+')) {
              color = Colors.green.shade700;
            } else if (line.startsWith('-')) {
              color = Colors.red.shade700;
            } else if (line.startsWith('@')) {
              color = Colors.blue.shade700;
            } else {
              color = Colors.black87;
            }
            return TextSpan(
              text: '$line\n',
              style: TextStyle(color: color, fontFamily: 'monospace', fontSize: 12),
            );
          }).toList(),
        ),
      ),
    );
  }
}

class _ApprovalBar extends StatefulWidget {
  final VoidCallback onApprove;
  final VoidCallback onReject;
  const _ApprovalBar({required this.onApprove, required this.onReject});

  @override
  State<_ApprovalBar> createState() => _ApprovalBarState();
}

class _ApprovalBarState extends State<_ApprovalBar> {
  bool _busy = false;

  void _act(VoidCallback cb) {
    if (_busy) return;
    setState(() => _busy = true);
    cb();
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
        child: Row(
          children: [
            Expanded(
              child: OutlinedButton(
                onPressed: _busy ? null : () => _act(widget.onReject),
                child: const Text('Reject'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: FilledButton(
                onPressed: _busy ? null : () => _act(widget.onApprove),
                child: _busy
                    ? const SizedBox(
                        width: 18, height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : const Text('Approve'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
