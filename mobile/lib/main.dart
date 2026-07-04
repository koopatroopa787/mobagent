import 'package:flutter/material.dart';
import 'ui/alert_list.dart';
import 'ui/diff_screen.dart';

void main() {
  runApp(const FieldFixApp());
}

class FieldFixApp extends StatelessWidget {
  const FieldFixApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'FieldFix',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.indigo),
        useMaterial3: true,
      ),
      home: const _AppShell(),
    );
  }
}

/// Top-level state holder wired to the UI screens.
///
/// In production this class will be replaced (or populated) by lib/sync/
/// (colleague's WebSocket client) which pushes ALERT_NOTIFY and FIX_PROPOSAL
/// messages into _alerts and _proposals. The TODO markers below are the
/// exact integration points.
class _AppShell extends StatefulWidget {
  const _AppShell();
  @override
  State<_AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<_AppShell> {
  final List<Map<String, dynamic>> _alerts = [];
  final Map<String, Map<String, dynamic>> _proposals = {};

  // TODO lib/sync/: call _onAlert when ALERT_NOTIFY arrives over WebSocket
  void _onAlert(Map<String, dynamic> msg) =>
      setState(() => _alerts.insert(0, msg));

  // TODO lib/sync/: call _onProposal when FIX_PROPOSAL arrives over WebSocket
  void _onProposal(Map<String, dynamic> msg) =>
      setState(() => _proposals[msg['alert_id'] as String] = msg);

  // TODO lib/sync/: inject a send callback so DiffScreen can write back
  void _sendApproval(Map<String, dynamic> proposal) {
    // colleague's sync layer will send FIX_APPROVAL via WebSocket here
  }

  void _sendRejection(Map<String, dynamic> proposal) {
    // colleague's sync layer will send FIX_REJECTION via WebSocket here
  }

  @override
  Widget build(BuildContext context) {
    return AlertListScreen(
      alerts: _alerts,
      proposals: _proposals,
      onReviewProposal: (proposal) => Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => DiffScreen(
            proposal: proposal,
            onApprove: () {
              _sendApproval(proposal);
              Navigator.pop(context);
            },
            onReject: () {
              _sendRejection(proposal);
              Navigator.pop(context);
            },
          ),
        ),
      ),
    );
  }
}
