import 'package:flutter/material.dart';

/// Shows incoming ALERT_NOTIFY messages and surfaces FIX_PROPOSAL
/// proposals for the user to tap into DiffScreen.
///
/// [alerts] and [proposals] are fed by lib/sync/ (colleague's WebSocket
/// client). This widget owns no network or state logic.
class AlertListScreen extends StatelessWidget {
  final List<Map<String, dynamic>> alerts;

  /// Map of alert_id → FIX_PROPOSAL message; populated when the daemon
  /// broadcasts a fix proposal for a given alert.
  final Map<String, Map<String, dynamic>> proposals;

  final void Function(Map<String, dynamic> proposal) onReviewProposal;

  const AlertListScreen({
    super.key,
    required this.alerts,
    required this.proposals,
    required this.onReviewProposal,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('FieldFix'),
        actions: [
          IconButton(
            icon: const Icon(Icons.qr_code_scanner),
            tooltip: 'Pair device',
            // TODO lib/pairing/: replace with PairingScreen push
            onPressed: () => ScaffoldMessenger.of(context)
                .showSnackBar(const SnackBar(content: Text('Pairing — colleague\'s screen'))),
          ),
        ],
      ),
      body: alerts.isEmpty
          ? const Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.check_circle_outline, size: 48, color: Colors.green),
                  SizedBox(height: 8),
                  Text('No alerts — all clear.', style: TextStyle(color: Colors.grey)),
                ],
              ),
            )
          : ListView.separated(
              itemCount: alerts.length,
              separatorBuilder: (_, __) => const Divider(height: 1),
              itemBuilder: (context, i) {
                final alert = alerts[i];
                final proposal = proposals[alert['alert_id'] as String?];
                return _AlertTile(
                  alert: alert,
                  proposal: proposal,
                  onReview: onReviewProposal,
                );
              },
            ),
    );
  }
}

class _AlertTile extends StatelessWidget {
  final Map<String, dynamic> alert;
  final Map<String, dynamic>? proposal;
  final void Function(Map<String, dynamic>) onReview;

  const _AlertTile({
    required this.alert,
    required this.proposal,
    required this.onReview,
  });

  @override
  Widget build(BuildContext context) {
    final hasProposal = proposal != null;
    final files = (alert['candidate_files'] as List?)?.cast<String>() ?? [];

    return ListTile(
      leading: CircleAvatar(
        backgroundColor: hasProposal ? Colors.orange.shade100 : Colors.red.shade100,
        child: Icon(
          hasProposal ? Icons.assignment_turned_in : Icons.warning_amber_rounded,
          color: hasProposal ? Colors.orange.shade700 : Colors.red.shade700,
          size: 20,
        ),
      ),
      title: Text(
        alert['summary'] as String? ?? 'Test failure',
        maxLines: 2,
        overflow: TextOverflow.ellipsis,
      ),
      subtitle: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (files.isNotEmpty)
            Text(
              files.take(3).join(', '),
              style: const TextStyle(fontFamily: 'monospace', fontSize: 11),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          Text(
            hasProposal ? 'Fix ready — tap to review' : 'Awaiting fix proposal...',
            style: TextStyle(
              color: hasProposal ? Colors.orange.shade700 : Colors.grey,
              fontSize: 12,
            ),
          ),
        ],
      ),
      trailing: hasProposal ? const Icon(Icons.chevron_right) : null,
      onTap: hasProposal ? () => onReview(proposal!) : null,
    );
  }
}
